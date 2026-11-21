// ===== أدوات مشتركة بين كل الألعاب =====
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const AR = n => Number(n).toLocaleString("ar-EG");
const rand = n => Math.floor(Math.random() * n);
function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function clamp(v, min, max, def) { v = parseInt(v, 10); return isNaN(v) ? def : Math.min(max, Math.max(min, v)); }
const ptsTxt = p => p === 1 ? "نقطة" : p === 2 ? "نقطتين" : AR(p) + " نقط";

// ===== تحويل المحتوى =====
const PACKS = { g: "عام", rm: "رمضان", eid: "العيد", sm: "الصيف" };
function parseCards(arr) {
  return arr.map(s => {
    const [t, a, tags = ""] = s.split("|");
    const tg = tags.split(" ").filter(Boolean);
    const hint = tg.find(x => x.startsWith("h:"));
    return { t, a, lv: tg.includes("k") ? "k" : "a", pack: tg.find(x => PACKS[x] && x !== "g") || "g", hint: hint ? hint.slice(2) : "" };
  });
}
const CARDS = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, parseCards(v)]));

// ===== التخزين =====
const KEY = "lamma-v2";
const AVATARS = ["🦁", "🐯", "🐼", "🦊", "🐸", "🐵", "🦄", "🐙", "🐝", "🦉", "🐢", "🐬", "⭐", "🔥", "⚡", "🍉"];
// لون لكل فريق: بيظهر على كارت الدور والأسئلة عشان كل واحد يعرف هو في أنهي فريق
const TEAM_COLORS = [
  { c: "#d64545", n: "الأحمر" }, { c: "#2f7de1", n: "الأزرق" }, { c: "#1f9d55", n: "الأخضر" }, { c: "#b7791f", n: "الأصفر" },
  { c: "#8a4fd8", n: "البنفسجي" }, { c: "#e8603c", n: "البرتقالي" }, { c: "#e84393", n: "الوردي" }, { c: "#12a3b4", n: "التركواز" }
];
function makeTeam(name, i) { return { name, avatar: AVATARS[i % AVATARS.length], photo: null, color: TEAM_COLORS[i % TEAM_COLORS.length].c }; }
function defaults() {
  return {
    teams: [makeTeam("الفريق الأحمر", 0), makeTeam("الفريق الأزرق", 1)],
    prefs: { level: "mix", packs: { g: true, rm: false, eid: false, sm: false }, sound: true, lamma: { q: true, r: true, c: true, f: true } },
    family: [], decks: {}, match: null
  };
}
const S = (() => {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
  const base = defaults();
  if (!d || typeof d !== "object") return base;
  const s = Object.assign(base, d);
  s.prefs = Object.assign(defaults().prefs, d.prefs);
  s.prefs.packs = Object.assign(defaults().prefs.packs, d.prefs && d.prefs.packs);
  s.prefs.lamma = Object.assign(defaults().prefs.lamma, d.prefs && d.prefs.lamma);
  s.teams.forEach((t, i) => { if (!t.color) t.color = TEAM_COLORS[i % TEAM_COLORS.length].c; });
  return s;
})();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast("المساحة اتملت، جرّب تشيل صور الفرق"); }
}

// فلتر المستوى والباقات
function allowed(c, { level = true, packs = true } = {}) {
  const p = S.prefs;
  if (level && p.level !== "mix" && c.lv !== p.level) return false;
  if (packs && !p.packs[c.pack]) return false;
  return true;
}
// سحب كارت من غير تكرار لحد ما الكوتشينة تخلص (محفوظة بين الجلسات)
function draw(key, list, pred = () => true) {
  const ok = i => list[i] && pred(list[i]);
  let deck = (S.decks[key] || []).filter(ok);
  if (!deck.length) deck = shuffle(list.map((_, i) => i).filter(ok));
  if (!deck.length) deck = shuffle(list.map((_, i) => i)); // الفلاتر ضيقة قوي: هات من الكل
  const i = deck.pop(); S.decks[key] = deck; save(); return i;
}

// ===== الأصوات (متولّدة بالكود، من غير ملفات) =====
const Sound = {
  ctx: null,
  ac() {
    if (!S.prefs.sound) return null;
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    } catch (e) { return null; }
  },
  tone(f, d = .15, type = "sine", at = 0, vol = .2, f2) {
    const a = this.ac(); if (!a) return;
    const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + .02);
  },
  ok() { [523, 659, 784].forEach((f, i) => this.tone(f, .18, "triangle", i * .09)); },
  bad() { this.tone(220, .35, "sawtooth", 0, .12, 110); },
  pass() { this.tone(520, .18, "sine", 0, .15, 330); },
  flip() { this.tone(300, .14, "triangle", 0, .15, 900); },
  tick() { this.tone(1400, .04, "square", 0, .05); },
  timeup() { [0, .25, .5].forEach(t => this.tone(880, .18, "square", t, .12)); },
  win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, .22, "triangle", i * .13, .2)); }
};
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } }

// ===== احتفال =====
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas"); c.className = "confetti"; document.body.appendChild(c);
  const x = c.getContext("2d"), W = c.width = innerWidth, H = c.height = innerHeight;
  const cols = ["#2f7de1", "#8a4fd8", "#e8603c", "#1f9d55", "#f2b705", "#e84393"];
  const ps = Array.from({ length: 170 }, () => ({
    x: Math.random() * W, y: -20 - Math.random() * H * .6, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 3,
    r: Math.random() * 6.28, vr: (Math.random() - .5) * .3, s: 6 + Math.random() * 7, c: cols[rand(cols.length)]
  }));
  const end = performance.now() + 4000;
  (function f(now) {
    x.clearRect(0, 0, W, H);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .04; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    if (now < end) requestAnimationFrame(f); else c.remove();
  })(performance.now());
}

function toast(msg) {
  const t = $("#toast"); if (!t) return;
  t.textContent = msg; t.classList.add("on");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2800);
}

// ===== المؤقّت (واحد بس شغّال في أي وقت) =====
const Timer = {
  id: null, left: 0, total: 0, hooks: {},
  set(left, total, hooks = {}) { this.stop(); this.left = left; this.total = total; this.hooks = hooks; },
  start(sec, hooks) { this.set(sec, sec, hooks); this.resume(); },
  resume() {
    if (this.id || this.left <= 0) return;
    this.id = setInterval(() => {
      this.left--;
      if (this.left <= 5 && this.left > 0) Sound.tick();
      this.hooks.onTick && this.hooks.onTick(this.left);
      paintTimer();
      if (this.left <= 0) { this.stop(); Sound.timeup(); buzz([200, 100, 200]); this.hooks.onEnd && this.hooks.onEnd(); paintTimer(); }
    }, 1000);
  },
  stop() { clearInterval(this.id); this.id = null; },
  get running() { return !!this.id; }
};
const secTxt = l => l > 0 ? AR(l) + " ثانية" : "⏰ الوقت خلص!";
function timerHTML(left, total, light = true) {
  return `<div class="timer ${light ? "" : "dark"}" aria-hidden="true"><div id="bar" style="width:${total ? left / total * 100 : 0}%"></div></div>
  <div class="timeTxt"><span id="sec">${secTxt(left)}</span>
  <button type="button" id="tbtn" onclick="toggleTimer()" ${left <= 0 ? "hidden" : ""}>${Timer.running ? "إيقاف ⏸" : "تشغيل ▶"}</button></div>`;
}
function paintTimer() {
  const b = $("#bar"), s = $("#sec"), t = $("#tbtn");
  if (b) b.style.width = (Timer.total ? Timer.left / Timer.total * 100 : 0) + "%";
  if (s) s.textContent = secTxt(Timer.left);
  if (t) { t.hidden = Timer.left <= 0; t.textContent = Timer.running ? "إيقاف ⏸" : "تشغيل ▶"; }
}
function toggleTimer() { Timer.running ? Timer.stop() : Timer.resume(); paintTimer(); }

// ===== الفرق والأفاتار =====
function avatar(t, size = "") {
  return t && t.photo
    ? `<img class="av ${size}" src="${esc(t.photo)}" alt="">`
    : `<span class="av ${size}" aria-hidden="true">${esc((t && t.avatar) || "⭐")}</span>`;
}
// تصغير الصورة قبل حفظها عشان متملاش التخزين
function readPhoto(file) {
  return new Promise((res, rej) => {
    if (!file || !file.type.startsWith("image/")) return rej(new Error("اختار صورة"));
    const fr = new FileReader();
    fr.onerror = () => rej(new Error("مقدرتش أقرا الصورة"));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error("الصورة دي مش مدعومة"));
      img.onload = () => {
        const n = 160, c = document.createElement("canvas"); c.width = c.height = n;
        const s = Math.min(img.width, img.height);
        c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, n, n);
        res(c.toDataURL("image/jpeg", .8));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

// ===== مباراة بين الفرق (أدوار + نقط) =====
const Match = {
  begin(game, rounds, g = {}) { S.match = { game, rounds, turn: 0, played: 0, scores: S.teams.map(() => 0), g }; save(); },
  team() { return S.teams[S.match.turn]; },
  add(p) { S.match.scores[S.match.turn] += p; },
  next() {
    const m = S.match; m.played++;
    if (m.played >= m.rounds * S.teams.length) m.over = true;
    else m.turn = (m.turn + 1) % S.teams.length;
    save();
  },
  roundNo() { return Math.min(S.match.rounds, Math.floor(S.match.played / S.teams.length) + 1); }
};
function turnHead() {
  const m = S.match, t = Match.team();
  return `<div class="turnhead" style="--tc:${t.color}">${avatar(t, "lg")}<div><div class="turn">الدور على: ${esc(t.name)}</div>
  <div class="meta">الجولة ${AR(Match.roundNo())} من ${AR(m.rounds)}</div></div></div>`;
}
function scoreboard() {
  const m = S.match;
  return `<section class="panel"><h2>النتيجة</h2><ul class="board">${S.teams.map((t, i) =>
    `<li class="${!m.over && i === m.turn ? "now" : ""}" style="--tc:${t.color}">${avatar(t, "sm")}<span class="nm">${esc(t.name)}</span><b>${AR(m.scores[i])}</b></li>`).join("")}</ul></section>`;
}
function endScreen(id) {
  const m = S.match;
  const rows = S.teams.map((t, i) => ({ t, s: m.scores[i] })).sort((a, b) => b.s - a.s);
  const top = rows[0].s, w = rows.filter(r => r.s === top);
  if (!m.celebrated) { m.celebrated = true; save(); setTimeout(() => { Sound.win(); confetti(); buzz([100, 50, 100, 50, 300]); }, 200); }
  const medal = i => ["🥇", "🥈", "🥉"][i] || "";
  return `<div class="end"><div class="trophy">🏆</div><h1>${w.length > 1 ? "تعادل!" : "مبروك!"}</h1>
  <div class="winners">${w.map(r => `<div class="wn">${avatar(r.t, "xl")}<b>${esc(r.t.name)}</b></div>`).join("")}</div>
  <section class="panel"><ul class="board">${rows.map((r, i) => `<li style="--tc:${r.t.color}">${medal(i)} ${avatar(r.t, "sm")}<span class="nm">${esc(r.t.name)}</span><b>${AR(r.s)}</b></li>`).join("")}</ul></section>
  <button class="primary" onclick="S.match=null;save();route()">نلعب تاني ↻</button>
  <a class="btn ghost" href="#/">ارجع للمكتبة</a></div>`;
}
function quitMatch() { if (confirm("عايز تنهي اللعبة وتشوف النتيجة؟")) { Timer.stop(); S.match.over = true; save(); route(); } }

// ===== شاشة الإعداد المشتركة =====
const GAMES = {};
const G = id => GAMES[id];
function numField(id, label, val, min, max) {
  return `<label class="field">${label}<input type="number" id="${id}" inputmode="numeric" min="${min}" max="${max}" value="${val}"></label>`;
}
function setupView(game, extra = "") {
  return `<div class="hero" style="--gc:${game.color}"><span class="ic">${game.icon}</span><h1>${esc(game.title)}</h1><p>${esc(game.long || game.desc)}</p></div>
  <section class="panel"><div class="panelhead"><h2>الفرق</h2><a class="link" href="#/teams">عدّل الفرق</a></div>
  <div class="teamline">${S.teams.map(t => `<span class="tchip">${avatar(t, "sm")}${esc(t.name)}</span>`).join("")}</div></section>
  ${extra}
  <button class="primary" onclick="G('${game.id}').begin()">يلا نلعب ▶</button>`;
}

// ===== عجلة الحظ =====
function wheelHTML(segs) {
  const n = segs.length, seg = 360 / n;
  const grad = segs.map((s, i) => `${s.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(",");
  return `<div class="wheel-wrap"><div class="pointer" aria-hidden="true">▼</div>
  <div class="wheel" id="wheel" style="background:conic-gradient(${grad})">
  ${segs.map((s, i) => `<span class="wl" style="transform:rotate(${i * seg + seg / 2}deg)"><span>${s.icon}<br>${esc(s.label)}</span></span>`).join("")}
  <span class="hub"></span></div></div>`;
}
function spinWheel(segs, cb) {
  const el = $("#wheel"), n = segs.length, seg = 360 / n, idx = rand(n);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dur = reduce ? 600 : 4000;
  const target = 360 * (reduce ? 1 : 6) + (360 - (idx * seg + seg / 2)) + (Math.random() - .5) * seg * .6;
  el.style.transition = `transform ${dur}ms cubic-bezier(.17,.67,.12,1)`;
  el.style.transform = `rotate(${target}deg)`;
  for (let k = 0; k < 24; k++) setTimeout(() => Sound.tick(), dur * (1 - Math.pow(1 - k / 24, 2.2)));
  setTimeout(() => cb(segs[idx].key), dur + 250);
}
