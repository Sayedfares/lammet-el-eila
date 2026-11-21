// ===== محرّكات الألعاب الحركية (canvas): الجري والقذف =====
// كل محرّك بياخد عنصر (arena) ويرسم جواه، وبيرجّع دالة تنضيف (تلغي الأنيميشن والمستمعين).

function mkCanvas(arena, ratio) {
  const W = Math.min(520, arena.clientWidth || innerWidth - 32), H = Math.round(W * ratio), d = window.devicePixelRatio || 1;
  const c = document.createElement("canvas");
  c.width = W * d; c.height = H * d;
  c.style.cssText = `width:${W}px;height:${H}px;touch-action:none;border-radius:18px;display:block;margin:0 auto 10px;user-select:none;-webkit-user-select:none`;
  arena.appendChild(c);
  const x = c.getContext("2d"); x.scale(d, d);
  return { c, x, W, H };
}
function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function emojiAt(x, ch, px, py, size) { x.font = `${size}px sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(ch, px, py); }

// ===== الجري (٣ حارات): ٠ فاضي، ١ عربية (غيّر الحارة)، ٢ حاجز واطي (اقفز)، ٣ حاجز عالي (انزلق) =====
const RUN_ROW = 170;
function runnerRow(seed, r) {
  const q = mulberry(seed * 9973 + r * 7919), o = [0, 0, 0], k = q();
  let coin = -1;
  if (r < 3 || k < .3) { /* فاضي */ }
  else if (k < .75) o[Math.floor(q() * 3)] = 1 + Math.floor(q() * 3);
  else { const free = Math.floor(q() * 3); for (let i = 0; i < 3; i++) if (i !== free) o[i] = 1; }
  if (r >= 3 && q() < .45) { const l = Math.floor(q() * 3); if (!o[l]) coin = l; }
  return { o, coin };
}
// opts: { seed, seconds, lives, sprite, onScore(score) كل ثانية, onEnd(score) }
function runnerEngine(arena, opts) {
  const { c, x, W, H } = mkCanvas(arena, 1.3), U = W / 400, ROW = RUN_ROW * U, PY = H * .78;
  const laneX = l => W * (1 / 6 + l / 3), seed = opts.seed || 1;
  const st = { dist: 0, lane: 1, px: laneX(1), j: 0, s: 0, lives: opts.lives || 3, coins: 0, inv: 0, t: 0, last: -1 };
  let raf = 0, prev = 0, sent = 0, ended = false;
  const score = () => Math.floor(st.dist / U / 10) + st.coins * 5;
  const speed = () => (230 + Math.min(230, st.dist / U * .03)) * U;
  const moveLane = d => { st.lane = Math.max(0, Math.min(2, st.lane + d)); };
  const jump = () => { if (st.j <= 0 && st.s <= 0) st.j = .7; };
  const slide = () => { if (st.s <= 0 && st.j <= 0) st.s = .6; };
  const end = () => { if (ended) return; ended = true; cleanup(); opts.onEnd(score()); };

  function hitRow(r) {
    const p = runnerRow(seed, r), t = p.o[st.lane];
    if (t && st.inv <= 0) {
      const air = st.j > .12 && st.j < .58, sl = st.s > 0;
      if (!((t === 2 && air) || (t === 3 && sl))) {
        st.lives--; st.inv = 1.2; Sound.bad(); buzz(150);
        if (st.lives <= 0) return end();
      }
    }
    if (p.coin === st.lane) { st.coins++; Sound.tone(880, .08, "triangle", 0, .12); }
  }

  function draw() {
    x.fillStyle = "#4a4a52"; x.fillRect(0, 0, W, H);
    x.strokeStyle = "rgba(255,255,255,.55)"; x.lineWidth = 3; x.setLineDash([22 * U, 22 * U]); x.lineDashOffset = -(st.dist % (44 * U));
    for (const lx of [W / 3, 2 * W / 3]) { x.beginPath(); x.moveTo(lx, 0); x.lineTo(lx, H); x.stroke(); }
    x.setLineDash([]);
    const r0 = Math.max(3, Math.floor(st.dist / ROW) - 1);
    for (let r = r0; r <= r0 + Math.ceil(H / ROW) + 2; r++) {
      const y = PY - (r * ROW - st.dist), p = runnerRow(seed, r);
      if (y < -40 || y > H + 40) continue;
      for (let l = 0; l < 3; l++) {
        if (p.o[l]) emojiAt(x, ["", "🚌", "🚧", "🏗️"][p.o[l]], laneX(l), y, 40 * U);
        else if (p.coin === l) emojiAt(x, "⭐", laneX(l), y, 30 * U);
      }
    }
    const ph = st.j > 0 ? Math.sin(Math.PI * (.7 - st.j) / .7) : 0;
    x.fillStyle = "rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(st.px, PY + 18 * U, 18 * U * (1 - ph * .3), 6 * U, 0, 0, 7); x.fill();
    if (!(st.inv > 0 && Math.floor(st.inv * 12) % 2)) {
      x.save(); x.translate(st.px, PY - ph * 46 * U);
      if (st.s > 0) x.scale(1.25, .55);
      emojiAt(x, opts.sprite || "🏃", 0, 0, 42 * U * (1 + ph * .3)); x.restore();
    }
    x.fillStyle = "#fff"; x.font = `800 ${18 * U}px Cairo, sans-serif`; x.textAlign = "start"; x.textBaseline = "top";
    x.fillText("⭐ " + AR(score()), 10, 8);
    x.textAlign = "end"; x.fillText("❤️".repeat(Math.max(0, st.lives)), W - 10, 8);
    x.fillStyle = "rgba(255,255,255,.3)"; x.fillRect(0, H - 6, W, 6);
    x.fillStyle = "#f2b705"; x.fillRect(0, H - 6, W * Math.min(1, st.t / opts.seconds), 6);
  }

  function frame(ts) {
    if (ended) return;
    const dt = Math.min(.05, (ts - prev) / 1000 || 0); prev = ts;
    st.t += dt; st.dist += speed() * dt;
    st.j = Math.max(0, st.j - dt); st.s = Math.max(0, st.s - dt); st.inv = Math.max(0, st.inv - dt);
    st.px += (laneX(st.lane) - st.px) * Math.min(1, dt * 14);
    const row = Math.floor(st.dist / ROW);
    while (st.last < row && !ended) hitRow(++st.last);
    if (ended) return;
    draw();
    if (opts.onScore && st.t - sent >= 1) { sent = st.t; opts.onScore(score()); }
    if (st.t >= opts.seconds) return end();
    raf = requestAnimationFrame(frame);
  }

  // تحكّم: سحب على الشاشة، أزرار تحت، أو أسهم الكيبورد
  let sx = 0, sy = 0;
  c.onpointerdown = e => { sx = e.clientX; sy = e.clientY; };
  c.onpointerup = e => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1); else dy < 0 ? jump() : slide();
  };
  const keys = e => { const k = { ArrowLeft: () => moveLane(-1), ArrowRight: () => moveLane(1), ArrowUp: jump, ArrowDown: slide }[e.key]; if (k) { e.preventDefault(); k(); } };
  addEventListener("keydown", keys);
  const pad = document.createElement("div"); pad.className = "runpad";
  [["◀", () => moveLane(-1)], ["⬆ اقفز", jump], ["⬇ انزلق", slide], ["▶", () => moveLane(1)]].forEach(([t, f]) => {
    const b = document.createElement("button"); b.textContent = t; b.onpointerdown = e => { e.preventDefault(); f(); }; pad.appendChild(b);
  });
  arena.appendChild(pad);
  function cleanup() { cancelAnimationFrame(raf); removeEventListener("keydown", keys); }
  raf = requestAnimationFrame(ts => { prev = ts; frame(ts); });
  return () => { ended = true; cleanup(); };
}

// ===== القذف: اسحب من المقلاع واسيب. opts: { shots, ammo, style: "boats"|"family", onEnd(score, msg) } =====
function launcherEngine(arena, opts) {
  const { c, x, W, H } = mkCanvas(arena, .64), U = W / 520, G_ = 900 * U, GROUND = H * .86, BS = 34 * U;
  const L = { x: W * .13, y: GROUND - 70 * U }, MAXPULL = 95 * U, RAD = 10 * U;
  const boats = opts.style === "boats", faces = ["👴", "👵", "👨", "👩", "🧒", "👶", "🐱", "👦"];
  let blocks = [], shots = opts.shots, score = 0, ball = null, pull = null, raf = 0, prev = 0, settle = 0, ended = false;

  // مستوى جديد: أعمدة من الصناديق، وفوق كل عمود عالي هدف
  (function build() {
    const cols = boats ? 5 : 4, gap = boats ? 0 : 10 * U, x0 = W * .56, hs = boats ? [1, 2, 3, 2, 1] : null;
    let id = 0;
    for (let i = 0; i < cols; i++) {
      const n = boats ? hs[i] : 1 + Math.floor(Math.random() * 3), cx = x0 + i * (BS + gap);
      for (let k = 0; k < n; k++) blocks.push({ id: id++, x: cx, y: GROUND - (k + 1) * BS, w: BS, h: BS, hp: 2, vy: 0, fell: 0, t: 0 });
      if (!boats || n >= 2) blocks.push({ id: id++, x: cx + 2 * U, y: GROUND - n * BS - BS + 2 * U, w: BS - 4 * U, h: BS - 4 * U, hp: 1, vy: 0, fell: 0, t: 1, e: boats ? "🏴‍☠️" : faces[Math.floor(Math.random() * faces.length)] });
    }
  })();
  const targets = () => blocks.filter(b => b.t);
  const alive = () => targets().length;

  function floorOf(b) {
    let f = GROUND;
    for (const o of blocks) if (o !== b && o.y >= b.y + b.h - 3 * U && o.x < b.x + b.w - 2 && o.x + o.w > b.x + 2) f = Math.min(f, o.y);
    return f;
  }
  function physics(dt) {
    for (const b of blocks.slice()) {
      const f = floorOf(b);
      if (b.y + b.h < f - 1) {
        b.vy += G_ * dt; b.y = Math.min(f - b.h, b.y + b.vy * dt); b.fell += b.vy * dt;
        if (b.vy > 160 * U) for (const o of blocks) if (o.t && o !== b && !b.t && b.x < o.x + o.w && b.x + b.w > o.x && b.y + b.h > o.y && b.y < o.y + o.h) kill(o);
      } else { if (b.t && b.fell > 26 * U) kill(b); b.vy = 0; b.fell = 0; b.y = f - b.h; }
    }
  }
  function kill(b) { blocks = blocks.filter(o => o !== b); score += b.t ? 100 : 10; Sound[b.t ? "ok" : "flip"](); if (b.t) buzz(60); }

  function step(dt) {
    physics(dt);
    if (!ball) return;
    ball.vy += G_ * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.age += dt;
    if (ball.y + RAD > GROUND) { ball.y = GROUND - RAD; ball.vy *= -.35; ball.vx *= .7; }
    for (const b of blocks.slice()) {
      const nx = Math.max(b.x, Math.min(ball.x, b.x + b.w)), ny = Math.max(b.y, Math.min(ball.y, b.y + b.h)), dx = ball.x - nx, dy = ball.y - ny;
      if (dx * dx + dy * dy < RAD * RAD) {
        const sp = Math.hypot(ball.vx, ball.vy);
        if (b.t || sp > 140 * U) { b.hp -= b.t ? 2 : 1; if (b.hp <= 0) kill(b); else Sound.flip(); }
        if (Math.abs(dx) > Math.abs(dy)) { ball.vx = (dx < 0 ? -1 : 1) * Math.abs(ball.vx) * .4; ball.x += dx < 0 ? -3 : 3; }
        else { ball.vy = (dy < 0 ? -1 : 1) * Math.abs(ball.vy) * .4; ball.y += dy < 0 ? -3 : 3; }
        ball.vx *= .75;
      }
    }
    if (ball.x > W + 40 || ball.x < -40 || ball.y > H + 60 || ball.age > 7 || (ball.y + RAD >= GROUND - 1 && Math.hypot(ball.vx, ball.vy) < 30 * U)) ball = null;
  }

  const traj = () => {
    const v = { x: (L.x - pull.x) * 7.5, y: (L.y - pull.y) * 7.5 }, pts = [];
    for (let i = 1; i <= 16; i++) { const t = i * .07; pts.push([L.x + v.x * t, L.y + v.y * t + G_ * t * t / 2]); }
    return pts;
  };
  function draw() {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, boats ? "#9ad8f2" : "#ffd89a"); g.addColorStop(1, boats ? "#e3f6ff" : "#fff3dc");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = boats ? "#3a8fb7" : "#7bb661"; x.fillRect(0, GROUND, W, H - GROUND);
    x.fillStyle = "#6b4a2b"; x.fillRect(L.x - 5 * U, L.y + 8 * U, 10 * U, GROUND - L.y - 8 * U);
    for (const b of blocks) {
      if (b.t) { emojiAt(x, b.e, b.x + b.w / 2, b.y + b.h / 2, 30 * U); continue; }
      x.fillStyle = b.hp > 1 ? (boats ? "#8b5a2b" : "#c98a4b") : (boats ? "#6a4220" : "#a86c34");
      x.beginPath(); x.roundRect ? x.roundRect(b.x, b.y, b.w, b.h, 4 * U) : x.rect(b.x, b.y, b.w, b.h); x.fill();
      x.strokeStyle = "rgba(0,0,0,.25)"; x.lineWidth = 1.5; x.stroke();
    }
    const bp = pull || L;
    if (pull) {
      x.strokeStyle = "#4b2e14"; x.lineWidth = 4 * U; x.beginPath(); x.moveTo(L.x - 8 * U, L.y); x.lineTo(pull.x, pull.y); x.lineTo(L.x + 8 * U, L.y); x.stroke();
      x.fillStyle = "rgba(0,0,0,.35)"; traj().forEach(([px, py]) => { x.beginPath(); x.arc(px, py, 3 * U, 0, 7); x.fill(); });
    }
    if (ball) emojiAt(x, opts.ammo, ball.x, ball.y, RAD * 2.4); else if (shots > 0) emojiAt(x, opts.ammo, bp.x, bp.y, RAD * 2.4);
    x.fillStyle = "#2b2118"; x.font = `800 ${17 * U}px Cairo, sans-serif`; x.textAlign = "start"; x.textBaseline = "top";
    x.fillText(`${opts.ammo.repeat(Math.max(0, shots))}`, 10, 8); x.textAlign = "end"; x.fillText(`🎯 ${AR(score)}`, W - 10, 8);
  }
  function finish() {
    if (ended) return; ended = true; cancelAnimationFrame(raf);
    const won = !alive(), bonus = won ? shots * 50 : 0;
    opts.onEnd(score + bonus, won ? `خلّصتوا كل الأهداف! 🎉 (بونص ${AR(bonus)})` : `فاضل ${AR(alive())} هدف.`);
  }
  function frame(ts) {
    if (ended) return;
    const dt = Math.min(.033, (ts - prev) / 1000 || 0); prev = ts;
    step(dt); draw();
    const still = !ball && blocks.every(b => b.vy === 0);
    settle = still ? settle + dt : 0;
    if (settle > .9 && (shots <= 0 || !alive())) return finish();
    raf = requestAnimationFrame(frame);
  }
  const pos = e => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  c.onpointerdown = e => {
    if (ball || shots <= 0 || ended) return;
    const p = pos(e); if (Math.hypot(p.x - L.x, p.y - L.y) < 90 * U) { pull = p; c.setPointerCapture(e.pointerId); }
  };
  c.onpointermove = e => {
    if (!pull) return; const p = pos(e), dx = p.x - L.x, dy = p.y - L.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, MAXPULL / d);
    pull = { x: L.x + dx * k, y: L.y + dy * k };
  };
  c.onpointerup = () => {
    if (!pull) return;
    const vx = (L.x - pull.x) * 7.5, vy = (L.y - pull.y) * 7.5, d = Math.hypot(L.x - pull.x, L.y - pull.y); pull = null;
    if (d < 14 * U) return;
    ball = { x: L.x, y: L.y, vx, vy, age: 0 }; shots--; Sound.pass(); buzz(30);
  };
  raf = requestAnimationFrame(ts => { prev = ts; frame(ts); });
  return () => { ended = true; cancelAnimationFrame(raf); };
}
