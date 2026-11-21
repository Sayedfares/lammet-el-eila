// ===== عرض 3D بـ three.js (js/vendor/three.min.js) للجري والقذف =====
// الألعاب بتستخدمه تلقائيًا لو WebGL شغّال؛ لو لأ (أو «رسم خفيف» مفعّل) بترجع للـ2D في engines.js.

function mk3D(parent, ratio, bg) {
  const T = THREE, { W, H } = canvasSize(parent, ratio), r = new T.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.setSize(W, H, false);
  const el = r.domElement; el.style.cssText = CANVAS_CSS(W, H); parent.appendChild(el);
  const scene = new T.Scene(); scene.background = new T.Color(bg);
  scene.add(new T.AmbientLight(0xffffff, .72));
  const sun = new T.DirectionalLight(0xffffff, .85); sun.position.set(-4, 9, 7); scene.add(sun);
  return { T, r, el, scene, W, H, dispose() { r.dispose(); if (r.forceContextLoss) r.forceContextLoss(); el.remove(); } };
}
const lam = c => new THREE.MeshLambertMaterial({ color: c });
function box(w, h, d, color, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color)); m.position.set(x, y, z); return m; }
function emojiTex(ch, bg) {
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, 128, 128); }
  x.font = "92px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(ch, 64, 70);
  return new THREE.CanvasTexture(c);
}
// شخصية مجسّمة بسيطة (جسم + راس + كاب + إيدين ورجلين بتتحرّك). بتبص ناحية +z
function makeChar(color = "#2f7de1", skin = "#f1c27d") {
  const T = THREE, g = new T.Group(), limb = (x, y, w, h, c) => { const p = new T.Group(); p.position.set(x, y, 0); const m = box(w, h, .16, c, 0, -h / 2, 0); p.add(m); g.add(p); return p; };
  const body = new T.Mesh(new T.CapsuleGeometry(.26, .4, 4, 10), lam(color)); body.position.y = .88; g.add(body);
  const head = new T.Mesh(new T.SphereGeometry(.27, 16, 12), lam(skin)); head.position.y = 1.5; g.add(head);
  const cap = new T.Mesh(new T.SphereGeometry(.29, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(color)); cap.position.y = 1.54; g.add(cap);
  for (const sx of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(.04, 8, 6), lam("#111")); e.position.set(sx * .1, 1.5, .25); g.add(e); }
  g.userData = { legL: limb(-.13, .58, .15, .55, "#33343c"), legR: limb(.13, .58, .15, .55, "#33343c"), armL: limb(-.36, 1.2, .13, .5, skin), armR: limb(.36, 1.2, .13, .5, skin) };
  return g;
}
function animChar(g, t, amp) {
  const u = g.userData, a = Math.sin(t * 12) * .9 * amp;
  u.legL.rotation.x = a; u.legR.rotation.x = -a; u.armL.rotation.x = -a; u.armR.rotation.x = a;
}
function hudBox(parent) {
  const h = document.createElement("div"); h.className = "hud3d"; parent.appendChild(h); return h;
}

// ===== الجري 3D =====
function runnerView3D(arena, opts) {
  const wrap = document.createElement("div"); wrap.style.position = "relative"; arena.appendChild(wrap);
  const { T, r, el, scene, W, H, dispose } = mk3D(wrap, 1.3, "#8fd3f4"), K = .025, LANE = 2, ROWS = 15, seed = opts.seed || 1;
  scene.fog = new T.Fog("#8fd3f4", 14, 46);
  const cam = new T.PerspectiveCamera(58, W / H, .1, 80); cam.position.set(0, 4.3, 6.2); cam.lookAt(0, .9, -8);
  const road = box(7.4, .2, 150, "#454552", 0, -.1, -60); scene.add(road);
  for (const sx of [-1, 1]) scene.add(box(30, .2, 150, "#5da35d", sx * 18.7, -.12, -60));
  const dashes = [];
  for (const lx of [-1.1, 1.1]) for (let i = 0; i < 18; i++) { const d = box(.14, .02, 1.3, "#e8e8e8", lx, .02, 0); scene.add(d); dashes.push([d, i]); }
  const rnd = mulberry(7), houses = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 9; i++) {
    const h = 3 + rnd() * 7, b = box(2 + rnd() * 1.5, h, 2.4, ["#f2c9a0", "#e6a3a3", "#a3c4e6", "#cfe6a3", "#f3e19a"][i % 5], sx * (6 + rnd() * 2), h / 2, 0); scene.add(b); houses.push([b, i]);
  }
  const player = makeChar(opts.color || "#2f7de1"); player.rotation.y = Math.PI; scene.add(player);
  const shadow = new T.Mesh(new T.CircleGeometry(.4, 16), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: .3 })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .02; scene.add(shadow);
  const hud = hudBox(wrap), rows = new Map(), busColors = ["#e8603c", "#f2b705", "#2f7de1", "#8a4fd8"];
  function build(type, l, r_) {
    const g = new T.Group(); g.position.x = (l - 1) * LANE;
    if (type === 1) { g.add(box(1.5, 1.3, 3, busColors[(r_ + l) % 4], 0, .75, 0), box(1.52, .45, 2.6, "#cfe9f7", 0, 1.1, 0), box(1.3, .12, 2.8, "#fff", 0, 1.45, 0)); }
    else if (type === 2) { g.add(box(.14, .75, .14, "#ddd", -.7, .38, 0), box(.14, .75, .14, "#ddd", .7, .38, 0), box(1.7, .3, .22, "#d64545", 0, .55, 0), box(1.72, .1, .24, "#fff", 0, .55, 0)); }
    else if (type === 3) { g.add(box(.16, 2, .16, "#888", -.8, 1, 0), box(.16, 2, .16, "#888", .8, 1, 0), box(1.8, .55, .25, "#f2b705", 0, 1.75, 0)); }
    return g;
  }
  function ensureRow(rw) {
    if (rows.has(rw)) return;
    const p = runnerRow(seed, rw), g = new T.Group();
    for (let l = 0; l < 3; l++) {
      if (p.o[l]) g.add(build(p.o[l], l, rw));
      else if (p.coin === l) { const c = new T.Mesh(new T.CylinderGeometry(.38, .38, .1, 20), lam("#ffc400")); c.rotation.x = Math.PI / 2; c.position.set((l - 1) * LANE, .9, 0); c.userData.coin = 1; g.add(c); }
    }
    scene.add(g); rows.set(rw, g);
  }
  let shown = { s: -1, l: -1 };
  return {
    el, dispose() { dispose(); wrap.remove(); },
    draw(st, score, dt) {
      const d = st.dist * K, base = Math.floor(st.dist / RUN_ROW);
      for (const [i, p] of rows) if (i < base - 2) { scene.remove(p); rows.delete(i); }
      for (let i = Math.max(3, base - 1); i < base + ROWS; i++) ensureRow(i);
      for (const [i, g] of rows) { g.position.z = -(i * RUN_ROW * K - d); g.children.forEach(c => { if (c.userData.coin) c.rotation.z += dt * 4; }); }
      for (const [m, i] of dashes) m.position.z = (d % 3.2) - i * 3.2 + 6;
      for (const [m, i] of houses) m.position.z = (d % 7) - i * 7 + 6;
      const ph = st.j > 0 ? Math.sin(Math.PI * (.7 - st.j) / .7) : 0, px = (st.lx - 1) * LANE;
      player.position.set(px, ph * 1.7, 0);
      player.scale.y = st.s > 0 ? .55 : 1; player.rotation.x = st.s > 0 ? .5 : 0;
      player.visible = !(st.inv > 0 && Math.floor(st.inv * 12) % 2);
      animChar(player, st.t, ph > 0 || st.s > 0 ? .25 : 1);
      shadow.position.x = px; shadow.scale.setScalar(1 - ph * .4);
      cam.position.x = px * .45; cam.position.y = 4.3 + (st.hit > 0 ? Math.sin(st.t * 80) * .08 : 0); cam.lookAt(px * .3, .9, -8);
      r.render(scene, cam);
      if (shown.s !== score || shown.l !== st.lives) { shown = { s: score, l: st.lives }; hud.innerHTML = `<span>⭐ ${AR(score)}</span><span>${"❤️".repeat(Math.max(0, st.lives))}</span>`; }
    }
  };
}

// ===== القذف 3D: المنطق ثنائي الأبعاد والعرض مجسّم (الصناديق مكعبات حقيقية والأهداف شخصيات) =====
function launcherView3D(arena, g) {
  const wrap = document.createElement("div"); wrap.style.position = "relative"; arena.appendChild(wrap);
  const { T, r, el, scene, W, H, dispose } = mk3D(wrap, .64, g.boats ? "#9ad8f2" : "#ffd89a");
  const s = 26 / W, X = x => (x - W / 2) * s, Y = y => (g.GROUND - y) * s, cy = (2 * g.GROUND - H) / 2 * s, fov = 38;
  const cam = new T.PerspectiveCamera(fov, W / H, .5, 120), dist = (H * s) / (2 * Math.tan(fov * Math.PI / 360));
  cam.position.set(0, cy, dist); cam.lookAt(0, cy, 0);
  const ground = box(60, 4, 8, g.boats ? "#3a8fb7" : "#6fae55", 0, -2, 0); scene.add(ground);
  for (let i = 0; i < 6; i++) { const c = new T.Mesh(new T.SphereGeometry(1 + Math.random(), 12, 8), new T.MeshBasicMaterial({ color: "#fff", transparent: true, opacity: .85 })); c.position.set(-12 + i * 5, 9 + Math.random() * 4, -8); c.scale.set(1.8, .8, .8); scene.add(c); }
  const bd = g.BS * s * .92, rad = g.RAD * s;
  const post = box(.5, (g.GROUND - g.L.y) * s, .5, "#6b4a2b", X(g.L.x), Y(g.L.y) / 2 + .2, 0); scene.add(post);
  scene.add(box(1.4, .35, .4, "#6b4a2b", X(g.L.x), Y(g.L.y) + .15, 0));
  const ball = new T.Mesh(new T.SphereGeometry(rad, 20, 14), new T.MeshLambertMaterial({ map: emojiTex(g.ammo, g.boats ? "#ffffff" : "#d64545") })); scene.add(ball);
  const bands = [0, 1].map(() => { const m = new T.Mesh(new T.CylinderGeometry(.09, .09, 1, 6), lam("#4b2e14")); m.visible = false; scene.add(m); return m; });
  const dots = Array.from({ length: 16 }, () => { const m = new T.Mesh(new T.SphereGeometry(.14, 8, 6), new T.MeshBasicMaterial({ color: "#222" })); m.visible = false; scene.add(m); return m; });
  const meshes = new Map(), bursts = [], woods = g.boats ? ["#8b5a2b", "#6a4220"] : ["#c98a4b", "#a86c34"];
  const face = (b) => {
    const f = new T.Group(), body = new T.Mesh(new T.CapsuleGeometry(bd * .22, bd * .28, 4, 8), lam(g.boats ? "#2b2b33" : "#e8603c")); body.position.y = -bd * .22; f.add(body);
    const head = new T.Mesh(new T.SphereGeometry(bd * .3, 16, 12), lam("#f1c27d")); head.position.y = bd * .22; f.add(head);
    const pl = new T.Mesh(new T.CircleGeometry(bd * .27, 20), new T.MeshBasicMaterial({ map: emojiTex(b.e), transparent: true })); pl.position.set(0, bd * .22, bd * .29); f.add(pl);
    return f;
  };
  function seg(m, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0); m.scale.y = Math.hypot(dx, dy); m.rotation.z = Math.atan2(dy, dx) - Math.PI / 2; m.visible = true; }
  const hud = hudBox(wrap); let hudTxt = "";
  return {
    el, dispose() { dispose(); wrap.remove(); },
    burst(b) {
      const n = b.t ? 10 : 6, col = b.t ? "#ffd84a" : woods[0];
      for (let i = 0; i < n; i++) { const m = box(.28, .28, .28, col, X(b.x + b.w / 2), Y(b.y + b.h / 2), 0); m.userData = { vx: (Math.random() - .5) * 9, vy: 2 + Math.random() * 7, vz: (Math.random() - .3) * 4, life: .8 }; scene.add(m); bursts.push(m); }
    },
    draw(st, dt) {
      const seen = new Set();
      for (const b of st.blocks) {
        seen.add(b.id); let m = meshes.get(b.id);
        if (!m) {
          if (b.t) m = face(b); else { m = box(bd, bd, bd, woods[0]); m.material = lam(woods[0]); }
          scene.add(m); meshes.set(b.id, m);
        }
        m.position.set(X(b.x + b.w / 2), Y(b.y + b.h / 2), 0);
        if (!b.t) m.material.color.set(b.hp > 1 ? woods[0] : woods[1]);
      }
      for (const [id, m] of meshes) if (!seen.has(id)) { scene.remove(m); meshes.delete(id); }
      const bp = st.pull || g.L, bx = st.ball || bp;
      ball.visible = !!st.ball || st.shots > 0; ball.position.set(X(bx.x), Y(bx.y), 0); ball.rotation.z -= dt * 6;
      const fork = [[X(g.L.x) - .6, Y(g.L.y) + .35], [X(g.L.x) + .6, Y(g.L.y) + .35]];
      if (st.pull) { const p = [X(st.pull.x), Y(st.pull.y)]; seg(bands[0], fork[0], p); seg(bands[1], fork[1], p); } else bands.forEach(b => b.visible = false);
      dots.forEach((d, i) => { const p = st.traj && st.traj[i]; d.visible = !!p; if (p) d.position.set(X(p[0]), Y(p[1]), 0); });
      for (let i = bursts.length - 1; i >= 0; i--) {
        const m = bursts[i], u = m.userData; u.vy -= 22 * dt; m.position.x += u.vx * dt; m.position.y += u.vy * dt; m.position.z += u.vz * dt; m.rotation.x += dt * 8; u.life -= dt;
        if (u.life <= 0) { scene.remove(m); bursts.splice(i, 1); }
      }
      r.render(scene, cam);
      const t = `<span>${g.ammo.repeat(Math.max(0, st.shots))}</span><span>🎯 ${AR(st.score)}</span>`;
      if (t !== hudTxt) { hudTxt = t; hud.innerHTML = t; }
    }
  };
}
