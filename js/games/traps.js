// ===== لعبة الفخاخ 😈: منصّة مستفزة. كل شيء شكله عادي… لحد ما تموت =====
// المستوى = سلسلة حروف، حرف لكل عمود:
//  g أرض · S بداية · p حفرة · k شوك ظاهر · h شوك مخبّي بيظهر لما تقرّب · c أرض بتقع بعد لحظة · x أرض بتقع فورًا
//  d طوبة بتنزل من السقف · 1 و 2 طوبة ترتفع (١ أو ٢) · i طوبة مخفية فوق دماغك · T علم مزيّف (فخ!) · F العلم الحقيقي
const TRAP_LEVELS = [
  "gggSggkgggppgggghggggdggggcccgggggTgggggFggg",
  "gggSgkkggg1gg2ggpppgggiggghggkgggdggdgggccggggxgggTggggkgFggg",
  "gggSgg2gppgg1ggkghgkgggcxcgggdgggiggpppggggTggkgdggFggg",
  "gggSggggTgggkgggppphgggggdddgggiggg2gcccgggxggggkkgTggggFggg"
];
const TRAP = { speed: 6, jump: 13.5, grav: 36, cx: .3 };   // وحدة = عمود واحد

function trapWorld(lv) {
  return [...lv].map((k, i) => ({ k: k === "S" ? "g" : k, i, popped: false, trig: false, dy: 5, dvy: 0, landed: false, tt: -1, gone: false, fy: 0, bonk: false }));
}
const trapSurface = c => !c || c.gone || c.k === "p" ? -Infinity : (c.k === "1" || (c.k === "d" && c.landed)) ? 1 : c.k === "2" ? 2 : 0;

function trapEngine(arena, opts) {
  const lv = TRAP_LEVELS[opts.level % TRAP_LEVELS.length];
  let cells = trapWorld(lv), N = cells.length, deaths = 0, t = 0, ended = false, raf = 0, prev = 0, dir = 0, hint = "";
  const start = lv.indexOf("S") + .5, p = { x: start, y: 0, vy: 0, face: 1, ground: false, run: 0 };
  const view = !has3D() || !window.THREE ? trapView2D(arena) : trapView3D(arena, opts);
  view.rebuild(cells);

  const end = ok => { if (ended) return; ended = true; cleanup(); opts.onEnd(ok, deaths, t); };
  function die(why) {
    deaths++; hint = why || ""; Sound.bad(); buzz([120, 60, 120]);
    cells = trapWorld(lv); Object.assign(p, { x: start, y: 0, vy: 0, ground: false }); view.rebuild(cells); view.flash && view.flash();
  }
  const cellAt = x => cells[Math.floor(x)];
  function frame(ts) {
    if (ended) return;
    const dt = Math.min(.04, (ts - prev) / 1000 || 0); prev = ts; t += dt;
    const bye = why => { die(why); raf = requestAnimationFrame(frame); };   // موتة: ارجع من البداية وكمّل اللعب
    // أفقي (مع صدّ الطوب)
    if (dir) {
      p.face = dir; const nx = Math.max(TRAP.cx, p.x + dir * TRAP.speed * dt);
      const a = Math.floor(nx - TRAP.cx), b = Math.floor(nx + TRAP.cx);
      if (![a, b].some(i => trapSurface(cells[i]) > p.y + .05)) p.x = nx;
    }
    p.run = dir && p.ground ? p.run + dt : 0;
    // رأسي
    const oy = p.y; p.vy -= TRAP.grav * dt; p.y += p.vy * dt; p.ground = false;
    const i0 = Math.floor(p.x - TRAP.cx + .001), i1 = Math.floor(p.x + TRAP.cx - .001);
    let surf = -Infinity; for (let i = i0; i <= i1; i++) surf = Math.max(surf, trapSurface(cells[i]));
    if (p.vy <= 0 && surf > -Infinity && p.y <= surf && oy >= surf - .35) {
      p.y = surf; p.vy = 0; p.ground = true;
      for (let i = i0; i <= i1; i++) { const c = cells[i]; if (c && (c.k === "c" || c.k === "x") && c.tt < 0) c.tt = 0; }
    }
    for (let i = i0; i <= i1; i++) {   // طوبة مخفية فوق: دماغك بتخبط فيها
      const c = cells[i];
      if (c && c.k === "i" && p.vy > 0 && p.y + 1 >= 1.9 && oy + 1 < 1.9 + .3) { p.vy = 0; p.y = 1.9 - 1; if (!c.bonk) { c.bonk = true; Sound.flip(); } }
    }
    // الفخاخ
    for (const c of cells) {
      const cx = c.i + .5, near = Math.abs(p.x - cx);
      if (c.tt >= 0 && !c.gone) { c.tt += dt; if (c.tt > (c.k === "x" ? .04 : .35)) c.gone = true; }
      if (c.gone) c.fy += 18 * dt;
      if (c.k === "h" && !c.popped && near < 2.2) c.popped = true;
      if (c.k === "d" && !c.landed) {
        if (!c.trig && near < 1.1) c.trig = true;
        if (c.trig) {
          c.dvy += 45 * dt; c.dy -= c.dvy * dt;
          if (c.dy <= 0) { c.dy = 0; c.landed = true; Sound.flip(); }
          if (near < .8 && p.y < c.dy + 1 && p.y + 1 > c.dy) return bye("الطوبة نزلت فوق دماغك! 🧱");
        }
      }
      if ((c.k === "k" || (c.k === "h" && c.popped)) && near < .5 && p.y < .55) return bye("شوك! 🌵");
      if (c.k === "T" && near < .6 && p.y < 1.5) return bye("العلم ده مزيّف! 😈");
      if (c.k === "F" && near < .6) { Sound.win(); return end(true); }
    }
    if (p.y < -6) return bye("وقعت في حفرة! 🕳️");
    view.draw(cells, p, t, dt, { deaths, left: Math.max(0, opts.seconds - t), hint });
    if (t >= opts.seconds) return end(false);
    raf = requestAnimationFrame(frame);
  }

  // تحكّم: أزرار على الشاشة (◀ ▶ بالضغط المستمر، ⬆ للقفز) أو الأسهم/المسافة
  const jump = () => { if (p.ground) { p.vy = TRAP.jump; p.ground = false; Sound.tone(500, .12, "square", 0, .06, 800); } };
  const pad = document.createElement("div"); pad.className = "trapad";
  const hold = (txt, d) => { const b = document.createElement("button"); b.textContent = txt;
    b.onpointerdown = e => { e.preventDefault(); dir = d; }; b.onpointerup = b.onpointerleave = b.onpointercancel = () => { if (dir === d) dir = 0; }; return b; };
  const jb = document.createElement("button"); jb.className = "jump"; jb.textContent = "⬆ اقفز"; jb.onpointerdown = e => { e.preventDefault(); jump(); };
  const side = document.createElement("div"); side.append(hold("◀", -1), hold("▶", 1)); pad.append(side, jb); arena.appendChild(pad);
  const kd = e => { if (e.key === "ArrowLeft") dir = -1; else if (e.key === "ArrowRight") dir = 1; else if (e.key === "ArrowUp" || e.key === " ") jump(); else return; e.preventDefault(); };
  const ku = e => { if ((e.key === "ArrowLeft" && dir < 0) || (e.key === "ArrowRight" && dir > 0)) dir = 0; };
  addEventListener("keydown", kd); addEventListener("keyup", ku);
  function cleanup() { cancelAnimationFrame(raf); removeEventListener("keydown", kd); removeEventListener("keyup", ku); view.dispose(); }
  raf = requestAnimationFrame(ts => { prev = ts; frame(ts); });
  return () => { ended = true; cleanup(); };
}

function trapView2D(arena) {
  const { c, x, W, H } = mkCanvas(arena, .62), S_ = W / 11;   // ١١ عمود ظاهرين
  return {
    el: c, dispose() { }, rebuild() { },
    draw(cells, p, t, dt, hud) {
      x.fillStyle = "#a8dcff"; x.fillRect(0, 0, W, H);
      const camX = Math.max(0, p.x - 3), gy = H * .78, X = v => (v - camX) * S_, Y = v => gy - v * S_;
      for (const c of cells) {
        const sx = X(c.i);
        if (sx < -S_ || sx > W) continue;
        const h = trapSurface(c);
        if (h > -Infinity) { x.fillStyle = c.k === "c" ? "#9c6a38" : "#8b5a2b"; x.fillRect(sx, Y(h), S_ + 1, H); x.fillStyle = "#6fae55"; x.fillRect(sx, Y(h), S_ + 1, S_ * .18); }
        if (c.k === "k" || (c.k === "h" && c.popped)) emojiAt(x, "🌵", sx + S_ / 2, Y(.3), S_ * .8);
        if (c.k === "d") emojiAt(x, "🧱", sx + S_ / 2, Y(c.dy + .5), S_);
        if (c.k === "T" || c.k === "F") emojiAt(x, "🚩", sx + S_ / 2, Y(.8), S_ * 1.1);
        if (c.k === "i" && c.bonk) emojiAt(x, "🟧", sx + S_ / 2, Y(2.4), S_);
      }
      emojiAt(x, "🏃", X(p.x), Y(p.y + .5), S_ * .9);
      x.fillStyle = "#222"; x.font = `800 ${S_ * .5}px Cairo, sans-serif`; x.textAlign = "start"; x.textBaseline = "top";
      x.fillText(`💀 ${AR(hud.deaths)}`, 10, 8); x.textAlign = "end"; x.fillText(`⏱ ${AR(Math.ceil(hud.left))}`, W - 10, 8);
    }
  };
}

function trapView3D(arena, opts) {
  const wrap = document.createElement("div"); wrap.style.position = "relative"; arena.appendChild(wrap);
  const { T, r, el, scene, W, H, dispose } = mk3D(wrap, .66, "#a8dcff");
  scene.fog = new T.Fog("#a8dcff", 18, 48);
  const cam = new T.PerspectiveCamera(50, W / H, .1, 90), hud = hudBox(wrap);
  const player = makeChar(opts.color || "#2f7de1"); scene.add(player);
  const clouds = new T.Group(); for (let i = 0; i < 14; i++) { const c = new T.Mesh(new T.SphereGeometry(1.2 + Math.random(), 10, 8), new T.MeshBasicMaterial({ color: "#fff", transparent: true, opacity: .9 })); c.scale.set(1.8, .7, .7); c.position.set(i * 7, 6 + Math.random() * 4, -9); clouds.add(c); } scene.add(clouds);
  let group = null, nodes = [], shake = 0, hudTxt = "";
  const flagMat = lam("#e8423c"), spikeGeo = new T.ConeGeometry(.17, .5, 8), thwompTex = emojiTex("😠", "#555");
  function spikes(x) { const g = new T.Group(); for (const o of [-.28, 0, .28]) { const m = new T.Mesh(spikeGeo, lam("#d9d9e0")); m.position.set(x + o, .25, 0); g.add(m); } return g; }
  function flag(x) { const g = new T.Group(); g.add(box(.08, 2.6, .08, "#ddd", x - .3, 1.3, 0)); const f = box(.9, .55, .05, "#e8423c", x + .15, 2.3, 0); g.add(f); return g; }
  return {
    el, dispose() { dispose(); wrap.remove(); },
    flash() { shake = .4; },
    rebuild(cells) {
      if (group) scene.remove(group);
      group = new T.Group(); nodes = [];
      cells.forEach(c => {
        const x = c.i + .5, g = new T.Group(), n = { c, g, spikes: null, block: null };
        if (c.k !== "p") {
          const dirt = box(1, 3, 4, c.k === "c" ? "#a87440" : "#8b5a2b", x, -1.5, 0), grass = box(1.01, .2, 4.02, c.k === "c" ? "#8fbf63" : "#6fae55", x, -.1, 0); g.add(dirt, grass);
          if (c.k === "1" || c.k === "2") g.add(box(1, +c.k, 3, "#b5533c", x, +c.k / 2, 0));
        }
        if (c.k === "k" || c.k === "h") { n.spikes = spikes(x); if (c.k === "h") n.spikes.scale.y = .001; g.add(n.spikes); }
        if (c.k === "d") { n.block = box(1, 1, 3, "#555", x, 5.5, 0); const f = new T.Mesh(new T.PlaneGeometry(.8, .8), new T.MeshBasicMaterial({ map: thwompTex })); f.position.set(0, 0, 1.51); n.block.add(f); g.add(n.block); }
        if (c.k === "i") { n.block = box(1, 1, 3, "#f2a03c", x, 2.4, 0); n.block.visible = false; g.add(n.block); }
        if (c.k === "T" || c.k === "F") g.add(flag(x));
        group.add(g); nodes.push(n);
      });
      scene.add(group);
    },
    draw(cells, p, t, dt, h) {
      for (const n of nodes) {
        const c = n.c;
        if (c.gone) n.g.position.y = -c.fy; else if (c.tt >= 0) n.g.position.y = Math.sin(t * 60) * .03;
        if (c.k === "h" && n.spikes) n.spikes.scale.y += ((c.popped ? 1 : .001) - n.spikes.scale.y) * Math.min(1, dt * 30);
        if (c.k === "d") n.block.position.y = c.dy + .5;
        if (c.k === "i") n.block.visible = c.bonk;
      }
      player.position.set(p.x, p.y, 0); player.rotation.y = p.face * Math.PI / 2;
      animChar(player, t * (p.ground ? 1 : .3), p.ground ? Math.min(1, p.run * 20) : .2);
      shake = Math.max(0, shake - dt);
      cam.position.set(p.x + 2 + (shake ? Math.sin(t * 90) * .15 : 0), 3.4, 11.5); cam.lookAt(p.x + 2, 2.3, 0);
      clouds.position.x = p.x * .6;
      r.render(scene, cam);
      const txt = `<span>💀 ${AR(h.deaths)}</span><span>${h.hint ? esc(h.hint) : ""}</span><span>⏱ ${AR(Math.ceil(h.left))}</span>`;
      if (txt !== hudTxt) { hudTxt = txt; hud.innerHTML = txt; }
    }
  };
}

makeTurnGame({
  id: "traps", title: "الفخاخ 😈", icon: "😈", color: "#6a2fb0",
  desc: "منصّة مستفزة: كل حاجة شكلها عادي لحد ما تموت. وصّل للعلم الحقيقي بأقل عدد موتات!",
  tag: "فرق · موبايل واحد · مستفزة",
  opts: [{ k: "secs", label: "الوقت (ثانية)", def: 90, min: 30, max: 300 }],
  how: o => `وصّل للعلم 🚩 الحقيقي في <b>${AR(o.secs)} ثانية</b>. ◀ ▶ للحركة و⬆ للقفز. فيه فخاخ في كل حتة: شوك بيظهر فجأة، أرض بتقع، طوب بينزل من السقف، وعلم مزيّف! كل موتة بتقلّل نقطك: <b>٥ نقط من غير موتات، ونقطة لو موتّوا ٤ مرات أو أكتر</b>.`,
  play(arena, done, o, t) {
    return trapEngine(arena, { level: rand(TRAP_LEVELS.length), seconds: o.secs, color: t && t.color,
      onEnd: (ok, deaths) => done(ok ? Math.max(1, 5 - deaths) : 0, ok ? `وصلتوا العلم بعد ${AR(deaths)} موتة 🚩` : `الوقت خلص بعد ${AR(deaths)} موتة 💀`) });
  }
});
