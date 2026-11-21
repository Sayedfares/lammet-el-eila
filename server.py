#!/usr/bin/env python3
"""سيرفر لمّة العيلة.

بيعرض ملفات التطبيق، وبيشغّل أوض لعبة «كدّاب ولا بجد؟» اللي كل واحد بيلعبها من موبايله.
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


class Room:
    def __init__(self, mode, rounds):
        while True:
            self.code = "".join(random.choice(CODE_CHARS) for _ in range(4))
            if self.code not in ROOMS:
                break
        self.mode, self.rounds = mode, rounds
        self.round, self.phase, self.ver = 0, "lobby", 0
        self.players, self.tokens, self.host = {}, {}, None
        self.used = set()
        self.prompt = self.truth = None
        self.answers, self.options, self.votes, self.gains = {}, [], {}, {}
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

    def fix_host(self):
        now = time.time()
        if now - self.players[self.host]["seen"] > HOST_TIMEOUT:
            alive = [p for p, d in self.players.items() if now - d["seen"] <= HOST_TIMEOUT]
            if alive:
                self.host = alive[0]
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
            "ver": self.ver, "code": self.code, "me": me, "host": self.host, "phase": ph,
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


def api(path, data):
    with LOCK:
        now = time.time()
        for code in [c for c, r in ROOMS.items() if now - r.touched > ROOM_TTL]:
            del ROOMS[code]

        if path == "create":
            mode = "people" if data.get("mode") == "people" else "facts"
            try:
                rounds = min(10, max(3, int(data.get("rounds", 5))))
            except (TypeError, ValueError):
                rounds = 5
            room = Room(mode, rounds)
            token = room.add_player(data.get("name"), data.get("avatar"))
            ROOMS[room.code] = room
            return {"code": room.code, "token": token}

        room = ROOMS.get(str(data.get("code", "")).strip().upper())
        if path == "join":
            if not room:
                raise GameError("مفيش أوضة بالكود ده، اتأكد منه")
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
