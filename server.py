#!/usr/bin/env python3
"""سيرفر لمّة العيلة.

بيعرض ملفات التطبيق، وبيشغّل أوض ألعاب («كدّاب ولا بجد؟» و«مين القاتل؟» و«اتخبّى واتنكّر» و«سباق الجري») اللي كل واحد بيلعبها من موبايله.
كل الموبايلات لازم تكون على نفس الواي فاي بتاع الجهاز اللي شغّال عليه السيرفر.

التشغيل:  python server.py        (أو PORT=9000 python server.py)
مكتبة بايثون العادية بس، من غير أي تسطيب.
"""
import json
import os
import random
import secrets
import socket
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8000"))
ROOM_TTL = 4 * 3600          # الأوضة بتتمسح بعد 4 ساعات من غير نشاط
HOST_TIMEOUT = 25            # لو صاحب الأوضة اختفى المدة دي، حد تاني ياخد مكانه
MAX_PLAYERS = 12
MAX_BODY = 4096
CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"

with open(os.path.join(ROOT, "data", "bluff.json"), encoding="utf-8") as f:
    PROMPTS = json.load(f)

LOCK = threading.Lock()
ROOMS = {}


class GameError(Exception):
    pass


def norm(s):
    s = " ".join(s.strip().lower().split())
    for a, b in (("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ة", "ه"), ("ى", "ي")):
        s = s.replace(a, b)
    return s


def clean(s, limit):
    if not isinstance(s, str):
        raise GameError("بيانات غلط")
    s = " ".join(s.split())
    if not s:
        raise GameError("متسيبش الخانة فاضية")
    if len(s) > limit:
        raise GameError(f"الكلام أطول من {limit} حرف")
    return s


class BaseRoom:
    """الأساس المشترك لأي أوضة: كود، لاعيبة، توكنز، وصاحب الأوضة."""
    game = ""

    def __init__(self):
        while True:
            self.code = "".join(random.choice(CODE_CHARS) for _ in range(4))
            if self.code not in ROOMS:
                break
        self.phase, self.ver = "lobby", 0
        self.players, self.tokens, self.host = {}, {}, None
        self.touched = time.time()

    def bump(self):
        self.ver += 1
        self.touched = time.time()

    def add_player(self, name, avatar):
        if self.phase != "lobby":
            raise GameError("اللعبة بدأت خلاص، استنوا الدور الجاي")
        if len(self.players) >= MAX_PLAYERS:
            raise GameError("الأوضة مليانة")
        name = clean(name, 20)
        if any(norm(p["name"]) == norm(name) for p in self.players.values()):
            raise GameError("الاسم ده موجود، اختار اسم تاني")
        avatar = avatar if isinstance(avatar, str) and 0 < len(avatar) <= 8 else "⭐"
        pub = f"p{len(self.players) + 1}"
        token = secrets.token_hex(16)
        self.players[pub] = {"name": name, "avatar": avatar, "score": 0, "seen": time.time()}
        self.tokens[token] = pub
        if self.host is None:
            self.host = pub
        self.bump()
        return token

    def fix_host(self):
        now = time.time()
        if now - self.players[self.host]["seen"] > HOST_TIMEOUT:
            alive = [p for p, d in self.players.items() if now - d["seen"] <= HOST_TIMEOUT]
            if alive:
                self.host = alive[0]
                self.bump()

    def need_host(self, pub):
        if pub != self.host:
            raise GameError("صاحب الأوضة بس اللي يكمّل")


class BluffRoom(BaseRoom):
    game = "bluff"

    def __init__(self, mode, rounds):
        super().__init__()
        self.mode, self.rounds = mode, rounds
        self.round = 0
        self.used = set()
        self.prompt = self.truth = None
        self.answers, self.options, self.votes, self.gains = {}, [], {}, {}

    def pick(self, kind):
        pool = [i for i in range(len(PROMPTS[kind])) if (kind, i) not in self.used]
        if not pool:
            self.used = {u for u in self.used if u[0] != kind}
            pool = list(range(len(PROMPTS[kind])))
        i = random.choice(pool)
        self.used.add((kind, i))
        return PROMPTS[kind][i]

    def new_round(self):
        self.round += 1
        self.answers, self.options, self.votes, self.gains = {}, [], {}, {}
        if self.mode == "facts":
            self.prompt, self.truth = self.pick("facts")
        else:
            who = random.choice(list(self.players.values()))["name"]
            self.prompt, self.truth = self.pick("people").replace("{p}", who), None
        self.phase = "write"

    def eligible(self):
        """اللاعيبة اللي قدامهم اختيار واحد على الأقل مش بتاعهم."""
        return [p for p in self.players if any(p not in o["owners"] for o in self.options)]

    def to_vote(self):
        groups = {}
        for pub, text in self.answers.items():
            groups.setdefault(norm(text), {"text": text, "owners": [], "truth": False})["owners"].append(pub)
        opts = list(groups.values())
        if self.truth:
            opts.append({"text": self.truth, "owners": [], "truth": True})
        random.shuffle(opts)
        for i, o in enumerate(opts):
            o["id"] = i
        self.options, self.phase = opts, "vote"
        if not self.eligible():
            self.score()

    def score(self):
        gains = {p: 0 for p in self.players}
        for voter, oid in self.votes.items():
            o = self.options[oid]
            if o["truth"]:
                gains[voter] += 2
            for owner in o["owners"]:
                gains[owner] += 1
        for p, g in gains.items():
            self.players[p]["score"] += g
        self.gains, self.phase = gains, "reveal"

    def act(self, pub, kind, data):
        host = pub == self.host
        if kind == "start":
            if not host:
                raise GameError("صاحب الأوضة بس اللي يبدأ")
            if self.phase not in ("lobby", "end"):
                raise GameError("اللعبة شغّالة")
            need = 2 if self.mode == "facts" else 3
            if len(self.players) < need:
                raise GameError(f"محتاجين {need} لاعيبة على الأقل")
            if self.phase == "end":
                self.round = 0
                for p in self.players.values():
                    p["score"] = 0
            self.new_round()
        elif kind == "answer":
            if self.phase != "write":
                raise GameError("مش وقت الكتابة")
            if pub in self.answers:
                raise GameError("انت كتبت إجابتك خلاص")
            text = clean(data.get("text"), 60)
            if self.truth and norm(text) == norm(self.truth):
                raise GameError("دي الإجابة الصح! 😄 اكتب إجابة غلط تضحك عليهم بيها")
            self.answers[pub] = text
            if len(self.answers) == len(self.players):
                self.to_vote()
        elif kind == "vote":
            if self.phase != "vote":
                raise GameError("مش وقت التصويت")
            if pub in self.votes:
                raise GameError("انت صوّت خلاص")
            oid = data.get("option")
            if not isinstance(oid, int) or not 0 <= oid < len(self.options):
                raise GameError("اختيار مش موجود")
            if pub in self.options[oid]["owners"]:
                raise GameError("متقدرش تختار إجابتك")
            self.votes[pub] = oid
            if all(p in self.votes for p in self.eligible()):
                self.score()
        elif kind == "skip":
            if not host:
                raise GameError("صاحب الأوضة بس اللي يكمّل")
            if self.phase == "write":
                if not self.answers and not self.truth:
                    raise GameError("لسه محدش كتب حاجة")
                self.to_vote()
            elif self.phase == "vote":
                self.score()
        elif kind == "next":
            if not host:
                raise GameError("صاحب الأوضة بس اللي يكمّل")
            if self.phase != "reveal":
                raise GameError("مش دلوقتي")
            if self.round >= self.rounds:
                self.phase = "end"
            else:
                self.new_round()
        else:
            raise GameError("طلب مش معروف")
        self.bump()

    def view(self, me):
        self.fix_host()
        ph = self.phase

        def done(p):
            if ph == "write":
                return p in self.answers
            if ph == "vote":
                return p in self.votes or p not in self.eligible()
            return False

        v = {
            "ver": self.ver, "game": self.game, "code": self.code, "me": me, "host": self.host, "phase": ph,
            "mode": self.mode, "round": self.round, "rounds": self.rounds,
            "players": [{"id": p, "name": d["name"], "avatar": d["avatar"], "score": d["score"], "done": done(p)}
                        for p, d in self.players.items()],
            "prompt": self.prompt if ph != "lobby" else None,
        }
        if ph == "write":
            v["myAnswer"] = self.answers.get(me)
        if ph == "vote":
            v["options"] = [{"id": o["id"], "text": o["text"], "mine": me in o["owners"]} for o in self.options]
            v["myVote"] = self.votes.get(me)
            v["canVote"] = me in self.eligible()
        if ph in ("reveal", "end") and self.options:
            name = lambda p: self.players[p]["name"]
            v["results"] = [{"text": o["text"], "truth": o["truth"], "owners": [name(p) for p in o["owners"]],
                             "voters": [name(p) for p, oid in self.votes.items() if oid == o["id"]]}
                            for o in self.options]
            v["gains"] = self.gains
        return v


KILLER_TASKS = 9             # عدد المهام اللي العميل عارفها (ids من 0 لـ 8)
KILLER_MIN = 4
KILL_CD = 25                 # ثواني بين كل قتلة والتانية
VOTE_SECS = 45
RESULT_SECS = 9
TALK_CHOICES = (30, 60, 90, 120)


def max_killers(n):
    return min(3, max(1, (n - 1) // 3))


class KillerRoom(BaseRoom):
    """مين القاتل؟ — زي أمونج أس: بريئين بيخلّصوا مهام، وقتلة بيقتلوا، واجتماعات وتصويت."""
    game = "killer"

    def __init__(self):
        super().__init__()
        self.killers_n, self.tasks_n, self.talk = 1, 3, 60
        self.reset()

    def reset(self):
        self.role, self.alive, self.todo = {}, set(), {}
        self.bodies, self.cd_until, self.meetings = [], {}, {}
        self.votes, self.deadline = {}, 0
        self.caller = self.reason = self.found = self.ejected = self.winner = None
        self.tally_rows = []

    # ----- مساعدات -----
    def killers(self):
        return [p for p in self.alive if self.role[p] == "killer"]

    def progress(self):
        crew = [p for p in self.todo if self.role[p] == "crew"]
        return sum(d for p in crew for d in self.todo[p].values()), sum(len(self.todo[p]) for p in crew)

    def check_win(self):
        k = len(self.killers())
        c = len(self.alive) - k
        done, total = self.progress()
        if k == 0 or done >= total:
            self.winner = "crew"
        elif k >= c:
            self.winner = "killers"
        return self.winner

    def start_game(self):
        n = len(self.players)
        if n < KILLER_MIN:
            raise GameError(f"محتاجين {KILLER_MIN} لاعيبة على الأقل")
        if self.killers_n > max_killers(n):
            raise GameError(f"مع {n} لاعيبة أقصى عدد قتلة {max_killers(n)}")
        self.reset()
        ids = list(self.players)
        bad = set(random.sample(ids, self.killers_n))
        now = time.time()
        for p in ids:
            self.role[p] = "killer" if p in bad else "crew"
            self.todo[p] = {t: False for t in random.sample(range(KILLER_TASKS), self.tasks_n)}
            self.meetings[p] = 1
        self.alive = set(ids)
        for p in bad:
            self.cd_until[p] = now + KILL_CD
        self.phase = "play"

    def meeting(self, caller, reason):
        self.caller, self.reason = caller, reason
        self.found = list(self.bodies)
        self.bodies = []
        self.votes = {}
        self.phase, self.deadline = "talk", time.time() + self.talk

    def start_vote(self):
        self.phase, self.deadline = "vote", time.time() + VOTE_SECS

    def tally(self):
        counts = {}
        for target in self.votes.values():
            counts[target] = counts.get(target, 0) + 1
        top = max(counts.values(), default=0)
        leaders = [t for t, c in counts.items() if c == top]
        self.ejected = None
        if len(leaders) == 1 and leaders[0] != "skip":
            out = leaders[0]
            self.alive.discard(out)
            self.ejected = {"id": out, "role": self.role[out]}
        self.tally_rows = [{"id": t, "voters": [v for v, x in self.votes.items() if x == t]} for t in counts]
        self.check_win()
        self.phase, self.deadline = "result", time.time() + RESULT_SECS

    def after_result(self):
        if self.winner:
            self.phase = "end"
            return
        now = time.time()
        for p in self.killers():
            self.cd_until[p] = now + KILL_CD
        self.phase = "play"

    def tick(self):
        if self.phase in ("talk", "vote", "result") and time.time() >= self.deadline:
            {"talk": self.start_vote, "vote": self.tally, "result": self.after_result}[self.phase]()
            self.bump()

    # ----- الأفعال -----
    def act(self, pub, kind, data):
        self.tick()
        ph, now = self.phase, time.time()
        if kind == "settings":
            self.need_host(pub)
            if ph != "lobby":
                raise GameError("الإعدادات بتتغيّر قبل البداية بس")
            k, t, tk = data.get("killers"), data.get("tasks"), data.get("talk")
            if not all(isinstance(x, int) and not isinstance(x, bool) for x in (k, t, tk)):
                raise GameError("بيانات غلط")
            if not 1 <= k <= 3 or not 1 <= t <= 5 or tk not in TALK_CHOICES:
                raise GameError("إعدادات مش مقبولة")
            self.killers_n, self.tasks_n, self.talk = k, t, tk
        elif kind == "start":
            self.need_host(pub)
            if ph != "lobby":
                raise GameError("اللعبة شغّالة")
            self.start_game()
        elif kind == "again":
            self.need_host(pub)
            if ph != "end":
                raise GameError("مش دلوقتي")
            self.reset()
            self.phase = "lobby"
        elif kind == "skip":
            self.need_host(pub)
            if ph == "talk":
                self.start_vote()
            elif ph == "vote":
                self.tally()
            else:
                raise GameError("مش دلوقتي")
        elif kind == "task":
            if ph != "play":
                raise GameError("مش وقت المهام")
            t = data.get("task")
            if isinstance(t, bool) or t not in self.todo[pub]:
                raise GameError("المهمة دي مش بتاعتك")
            self.todo[pub][t] = True
            if self.role[pub] == "crew" and self.check_win():
                self.phase = "end"
        elif kind == "kill":
            if ph != "play":
                raise GameError("مش وقت القتل")
            if self.role[pub] != "killer" or pub not in self.alive:
                raise GameError("انت مش قاتل")
            if now < self.cd_until[pub]:
                raise GameError("لسه بتستعد، استنى شوية")
            target = data.get("target")
            if target not in self.alive or self.role.get(target) != "crew":
                raise GameError("مينفعش تقتل الشخص ده")
            self.alive.discard(target)
            self.bodies.append(target)
            self.cd_until[pub] = now + KILL_CD
            if self.check_win():
                self.phase = "end"
        elif kind == "report":
            if ph != "play" or pub not in self.alive:
                raise GameError("مش دلوقتي")
            body = data.get("body")
            if body is not None:
                if body not in self.bodies:
                    raise GameError("مفيش جثة بالاسم ده")
                self.meeting(pub, "body")
            else:
                if self.meetings[pub] < 1:
                    raise GameError("استخدمت اجتماعك الطارئ")
                self.meetings[pub] -= 1
                self.meeting(pub, "button")
        elif kind == "vote":
            if ph != "vote" or pub not in self.alive:
                raise GameError("مش وقت التصويت")
            if pub in self.votes:
                raise GameError("انت صوّت خلاص")
            target = data.get("target")
            if target != "skip" and target not in self.alive:
                raise GameError("اختيار مش موجود")
            self.votes[pub] = target
            if all(p in self.votes for p in self.alive):
                self.tally()
        else:
            raise GameError("طلب مش معروف")
        self.bump()

    # ----- اللي بيشوفه كل لاعب -----
    def view(self, me):
        self.fix_host()
        self.tick()
        ph, now = self.phase, time.time()
        started = ph != "lobby"
        mine = self.role.get(me)

        def row(p, d):
            r = {"id": p, "name": d["name"], "avatar": d["avatar"]}
            if started:
                r["alive"] = p in self.alive
                r["done"] = p in self.votes if ph == "vote" else False
                if mine == "killer" and self.role[p] == "killer":
                    r["killer"] = True
            return r

        v = {"ver": self.ver, "game": self.game, "code": self.code, "me": me, "host": self.host, "phase": ph,
             "players": [row(p, d) for p, d in self.players.items()],
             "settings": {"killers": self.killers_n, "tasks": self.tasks_n, "talk": self.talk,
                          "kmax": max_killers(len(self.players)), "min": KILLER_MIN, "talks": list(TALK_CHOICES)}}
        if not started:
            return v
        done, total = self.progress()
        v.update(role=mine, alive=me in self.alive, tasks=[{"id": t, "done": d} for t, d in self.todo[me].items()],
                 progress={"done": done, "total": total}, meetings=self.meetings[me], waiting=me in self.bodies)
        if mine == "killer" and me in self.alive:
            v["cd"] = max(0, self.cd_until[me] - now)
        if ph in ("talk", "vote", "result"):
            v.update(left=max(0, self.deadline - now), reason=self.reason, caller=self.caller, found=self.found)
        if ph == "vote":
            v["myVote"] = self.votes.get(me)
        if ph == "result":
            v.update(ejected=self.ejected, votes=self.tally_rows, over=self.winner)
        if ph == "end":
            v.update(winner=self.winner, roles=self.role)
        return v


HIDE_OBJECTS = [
    "مروحة", "تلفزيون", "كنبة", "ترابيزة", "كرسي", "ستارة", "دولاب", "ثلاجة", "أباجورة", "مخدة",
    "سجادة", "شنطة", "جزمة", "ساعة", "مراية", "نبتة", "كوباية", "طبق فاكهة", "رغيف عيش", "إزازة مياه",
    "علبة مناديل", "ريموت", "شاحن", "كتاب", "لعبة", "سلة مهملات", "باب", "شباك", "مقشة", "كورة",
]
HIDE_MIN = 2
HIDE_SECS = (30, 60, 90, 120)
SEEK_SECS = (120, 180, 300, 600)
WRONG_LOCK = 15              # ثواني منع الباحث بعد تخمين غلط
SWITCH_CD = 20               # ثواني بين تغيير تنكّر المخبّي وتغييره تاني وقت البحث


def max_seekers(n):
    return max(1, min(5, n - 1))


class HideRoom(BaseRoom):
    """اتخبّى واتنكّر — زي هايد أونلاين: المخبّيين بيتحوّلوا لحاجات في الأوضة والباحثين بيخمّنوا."""
    game = "hide"

    def __init__(self):
        super().__init__()
        self.seekers_n, self.hide_s, self.seek_s = 1, 60, 300
        self.reset()

    def reset(self):
        self.role, self.disguise, self.found = {}, {}, []
        self.lock, self.switch_at, self.wrong = {}, {}, {}
        self.deadline, self.winner = 0, None

    def hiders_left(self):
        return [p for p, r in self.role.items() if r == "hider" and p not in {f["id"] for f in self.found}]

    def start_game(self):
        n = len(self.players)
        if n < HIDE_MIN:
            raise GameError(f"محتاجين {HIDE_MIN} لاعيبة على الأقل")
        if self.seekers_n > max_seekers(n):
            raise GameError(f"مع {n} لاعيبة أقصى عدد باحثين {max_seekers(n)}")
        self.reset()
        ids = list(self.players)
        seek = set(random.sample(ids, self.seekers_n))
        self.role = {p: "seeker" if p in seek else "hider" for p in ids}
        self.wrong = {p: 0 for p in seek}
        self.phase, self.deadline = "hide", time.time() + self.hide_s

    def start_seek(self):
        for p, r in self.role.items():
            if r == "hider" and p not in self.disguise:
                self.disguise[p] = random.randrange(len(HIDE_OBJECTS))
        self.phase, self.deadline = "seek", time.time() + self.seek_s

    def finish(self, winner):
        self.winner, self.phase = winner, "end"

    def tick(self):
        if self.phase in ("hide", "seek") and time.time() >= self.deadline:
            if self.phase == "hide":
                self.start_seek()
            else:
                self.finish("hiders")
            self.bump()

    def act(self, pub, kind, data):
        self.tick()
        ph, now = self.phase, time.time()
        if kind == "settings":
            self.need_host(pub)
            if ph != "lobby":
                raise GameError("الإعدادات بتتغيّر قبل البداية بس")
            k, h, s = data.get("seekers"), data.get("hide"), data.get("seek")
            if not all(isinstance(x, int) and not isinstance(x, bool) for x in (k, h, s)):
                raise GameError("بيانات غلط")
            if not 1 <= k <= 5 or h not in HIDE_SECS or s not in SEEK_SECS:
                raise GameError("إعدادات مش مقبولة")
            self.seekers_n, self.hide_s, self.seek_s = k, h, s
        elif kind == "start":
            self.need_host(pub)
            if ph != "lobby":
                raise GameError("اللعبة شغّالة")
            self.start_game()
        elif kind == "again":
            self.need_host(pub)
            if ph != "end":
                raise GameError("مش دلوقتي")
            self.reset()
            self.phase = "lobby"
        elif kind == "skip":
            self.need_host(pub)
            if ph != "hide":
                raise GameError("مش دلوقتي")
            self.start_seek()
        elif kind == "disguise":
            obj = data.get("obj")
            if ph not in ("hide", "seek") or self.role.get(pub) != "hider" or pub not in self.hiders_left():
                raise GameError("مش دلوقتي")
            if isinstance(obj, bool) or not isinstance(obj, int) or not 0 <= obj < len(HIDE_OBJECTS):
                raise GameError("اختيار مش موجود")
            if ph == "seek":
                if now < self.switch_at.get(pub, 0):
                    raise GameError("استنى شوية قبل ما تتحوّل تاني")
                self.switch_at[pub] = now + SWITCH_CD
            self.disguise[pub] = obj
        elif kind == "guess":
            if ph != "seek" or self.role.get(pub) != "seeker":
                raise GameError("مش وقت التخمين")
            if now < self.lock.get(pub, 0):
                raise GameError("لسه معاقب، استنى شوية")
            target, obj = data.get("target"), data.get("obj")
            if target not in self.hiders_left():
                raise GameError("اللاعب ده مش مخبّي")
            if isinstance(obj, bool) or not isinstance(obj, int) or not 0 <= obj < len(HIDE_OBJECTS):
                raise GameError("اختيار مش موجود")
            if self.disguise[target] == obj:
                self.found.append({"id": target, "by": pub, "obj": self.disguise[target]})
                if not self.hiders_left():
                    self.finish("seekers")
            else:
                self.wrong[pub] += 1
                self.lock[pub] = now + WRONG_LOCK
        else:
            raise GameError("طلب مش معروف")
        self.bump()

    def view(self, me):
        self.fix_host()
        self.tick()
        ph, now = self.phase, time.time()
        started = ph != "lobby"
        n = len(self.players)
        out = {f["id"] for f in self.found}

        def row(p, d):
            r = {"id": p, "name": d["name"], "avatar": d["avatar"]}
            if started:
                r["team"], r["out"] = self.role[p], p in out
            return r

        v = {"ver": self.ver, "game": self.game, "code": self.code, "me": me, "host": self.host, "phase": ph,
             "players": [row(p, d) for p, d in self.players.items()],
             "settings": {"seekers": self.seekers_n, "hide": self.hide_s, "seek": self.seek_s, "smax": max_seekers(n),
                          "min": HIDE_MIN, "hides": list(HIDE_SECS), "seeks": list(SEEK_SECS)}}
        if not started:
            return v
        mine = self.role[me]
        v.update(role=mine, objects=HIDE_OBJECTS, left=max(0, self.deadline - now) if ph != "end" else 0,
                 found=[{"id": f["id"], "by": f["by"], "obj": HIDE_OBJECTS[f["obj"]]} for f in self.found],
                 remaining=len(self.hiders_left()))
        if mine == "hider":
            v["mine"] = self.disguise.get(me)
            v["out"] = me in out
            v["switch"] = max(0, self.switch_at.get(me, 0) - now) if ph == "seek" else 0
        else:
            v["lock"] = max(0, self.lock.get(me, 0) - now)
            v["wrong"] = self.wrong.get(me, 0)
        if ph == "end":
            v.update(winner=self.winner, reveal={p: HIDE_OBJECTS[o] for p, o in self.disguise.items()})
        return v


RACE_SECS = (30, 45, 60, 90)
RACE_COUNT = 5               # ثواني العدّ التنازلي قبل ما السباق يبدأ
RACE_GRACE = 8               # مهلة زيادة بعد وقت السباق لحد ما كل الموبايلات تبعت نتيجتها
RACE_MAX = 100000


class RaceRoom(BaseRoom):
    """سباق الجري: كل واحد بيجري على موبايله في نفس الحواجز (seed واحد) والسيرفر بيرتّب النقط."""
    game = "race"

    def __init__(self):
        super().__init__()
        self.secs = 45
        self.reset()

    def reset(self):
        self.seed, self.deadline = 0, 0
        self.score, self.fin = {}, set()

    def tick(self):
        if self.phase in ("count", "run") and time.time() >= self.deadline:
            if self.phase == "count":
                self.phase, self.deadline = "run", time.time() + self.secs + RACE_GRACE
            else:
                self.phase = "end"
            self.bump()

    def act(self, pub, kind, data):
        self.tick()
        ph = self.phase
        if kind == "settings":
            self.need_host(pub)
            if ph != "lobby":
                raise GameError("الإعدادات بتتغيّر قبل البداية بس")
            s = data.get("secs")
            if isinstance(s, bool) or s not in RACE_SECS:
                raise GameError("إعدادات مش مقبولة")
            self.secs = s
        elif kind == "start":
            self.need_host(pub)
            if ph != "lobby":
                raise GameError("اللعبة شغّالة")
            if len(self.players) < 2:
                raise GameError("محتاجين لاعيبين على الأقل")
            self.reset()
            self.seed = random.randint(1, 10 ** 6)
            self.score = {p: 0 for p in self.players}
            self.phase, self.deadline = "count", time.time() + RACE_COUNT
        elif kind == "again":
            self.need_host(pub)
            if ph != "end":
                raise GameError("مش دلوقتي")
            self.reset()
            self.phase = "lobby"
        elif kind in ("progress", "finish"):
            sc = data.get("score")
            if ph != "run" or isinstance(sc, bool) or not isinstance(sc, int) or not 0 <= sc <= RACE_MAX:
                raise GameError("مش دلوقتي")
            if pub not in self.fin:
                self.score[pub] = max(self.score.get(pub, 0), sc)
                if kind == "finish":
                    self.fin.add(pub)
                    if len(self.fin) == len(self.players):
                        self.phase = "end"
        else:
            raise GameError("طلب مش معروف")
        self.bump()

    def view(self, me):
        self.fix_host()
        self.tick()
        ph = self.phase
        v = {"ver": self.ver, "game": self.game, "code": self.code, "me": me, "host": self.host, "phase": ph, "secs": self.secs,
             "secsList": list(RACE_SECS), "min": 2,
             "players": [{"id": p, "name": d["name"], "avatar": d["avatar"], "score": self.score.get(p, 0), "fin": p in self.fin}
                         for p, d in self.players.items()]}
        if ph in ("count", "run"):
            v.update(seed=self.seed, left=max(0, self.deadline - time.time()))
        return v


def api(path, data):
    with LOCK:
        now = time.time()
        for code in [c for c, r in ROOMS.items() if now - r.touched > ROOM_TTL]:
            del ROOMS[code]

        if path == "create":
            kind = {"killer": KillerRoom, "hide": HideRoom, "race": RaceRoom}.get(data.get("game"))
            if kind:
                room = kind()
                token = room.add_player(data.get("name"), data.get("avatar"))
                ROOMS[room.code] = room
                return {"code": room.code, "token": token}
            mode = "people" if data.get("mode") == "people" else "facts"
            try:
                rounds = min(10, max(3, int(data.get("rounds", 5))))
            except (TypeError, ValueError):
                rounds = 5
            room = BluffRoom(mode, rounds)
            token = room.add_player(data.get("name"), data.get("avatar"))
            ROOMS[room.code] = room
            return {"code": room.code, "token": token}

        room = ROOMS.get(str(data.get("code", "")).strip().upper())
        if path == "join":
            if not room:
                raise GameError("مفيش أوضة بالكود ده، اتأكد منه")
            if data.get("game") and data["game"] != room.game:
                raise GameError("الكود ده بتاع لعبة تانية")
            return {"code": room.code, "token": room.add_player(data.get("name"), data.get("avatar"))}

        pub = room and room.tokens.get(str(data.get("token", "")))
        if not pub:
            raise GameError("ROOM_GONE")
        room.players[pub]["seen"] = now
        room.touched = now
        if path == "act":
            room.act(pub, data.get("type"), data)
        elif path != "state":
            raise GameError("طلب مش معروف")
        return room.view(pub)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def run_api(self, path, data):
        try:
            self.send_json(200, api(path, data))
        except GameError as e:
            self.send_json(400, {"error": str(e)})

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/api/ping":
            return self.send_json(200, {"ok": True})
        if u.path == "/api/state":
            q = {k: v[0] for k, v in parse_qs(u.query).items()}
            return self.run_api("state", q)
        # الإجابات الصح والكود مش للعرض
        if u.path.endswith(".py") or u.path.startswith("/data/") or "/." in u.path:
            return self.send_error(404)
        return super().do_GET()

    def do_POST(self):
        u = urlparse(self.path)
        if not u.path.startswith("/api/"):
            return self.send_error(404)
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = -1
        if not 0 <= n <= MAX_BODY:
            return self.send_json(413, {"error": "الطلب كبير"})
        try:
            data = json.loads(self.rfile.read(n) or b"{}")
            if not isinstance(data, dict):
                raise ValueError
        except ValueError:
            return self.send_json(400, {"error": "بيانات غلط"})
        self.run_api(u.path[len("/api/"):], data)


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # مبيبعتش حاجة، بس بيعرّفنا عنوان الجهاز على الشبكة
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("لمّة العيلة شغّالة 🎉")
    print(f"  على الجهاز ده:     http://localhost:{PORT}")
    print(f"  من الموبايلات:     http://{lan_ip()}:{PORT}   (لازم نفس الواي فاي)")
    print("  للإيقاف: Ctrl+C")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
