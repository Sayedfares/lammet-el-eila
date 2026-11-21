// ===== ألعاب الأدوار الحركية والسريعة (فرق، موبايل واحد) =====
// كل لعبة بتعرّف play(arena, done, opts, team) بترسم جوه arena وتنادي done(نقط, رسالة) لما الدور يخلص،
// وبترجّع دالة تنضيف. makeTurnGame بيهتم بالإعدادات والدور والنتيجة والمباراة.

function makeTurnGame(def) {
  const id = def.id;
  return GAMES[id] = {
    ...def, stopFn: null,
    abort() { if (this.stopFn) { this.stopFn(); this.stopFn = null; } },
    onExit() { this.abort(); },
    render(root) {
      this.abort();   // أي إعادة رسم (زي زرار الصوت) بتلغي الدور الشغّال
      const m = S.match;
      if (!m || m.game !== id) { root.innerHTML = setupView(this, this.setupExtra()); return; }
      if (m.over) { root.innerHTML = endScreen(id); return; }
      root.innerHTML = m.g.phase === "result" ? this.resultView() : this.readyView();
    },
    setupExtra() {
      return `<section class="panel"><h2>الإعدادات</h2><div class="grid2">${numField("rounds", "عدد الجولات", 3, 1, 10)}
        ${(def.opts || []).map(o => numField("o_" + o.k, o.label, o.def, o.min, o.max)).join("")}</div></section>`;
    },
    begin() {
      const opts = {}; (def.opts || []).forEach(o => opts[o.k] = clamp($("#o_" + o.k).value, o.min, o.max, o.def));
      Match.begin(id, clamp($("#rounds").value, 1, 10, 3), { phase: "ready", opts }); route();
    },
    readyView() {
      return `${turnHead()}<section class="panel center"><p class="lead">${def.how(S.match.g.opts)}</p>
        <button class="primary" onclick="G('${id}').go()">جاهزين؟ ابدأ ▶</button></section>${scoreboard()}
        <button class="ghost" onclick="quitMatch()">إنهاء اللعبة</button>`;
    },
    go() {
      const root = $("#stage"); root.innerHTML = `${turnHead()}<div id="arena"></div>`;
      const t = Match.team();
      this.stopFn = def.play.call(this, $("#arena"), (p, msg) => this.finish(p, msg), S.match.g.opts, t);
    },
    finish(points, msg) {
      this.abort(); const g = S.match.g; points = Math.max(0, Math.round(points));
      Match.add(points); g.phase = "result"; g.points = points; g.msg = msg || ""; save();
      points ? (Sound.ok(), buzz(80)) : Sound.bad(); route();
    },
    resultView() {
      const g = S.match.g;
      return `${turnHead()}<section class="panel center"><div class="trophy">${def.icon}</div>
        <p class="lead">${esc(g.msg)}</p><p class="lead"><b>+${AR(g.points)}</b> نقطة</p>
        <button class="primary" onclick="G('${id}').nextTeam()">الدور اللي بعده ◀</button></section>${scoreboard()}`;
    },
    nextTeam() { S.match.g.phase = "ready"; Match.next(); route(); }
  };
}
const teamSprite = t => (t && !t.photo && t.avatar) || "🏃";
// عدّاد تنازلي صغير جوه arena؛ بيرجّع دالة تلغيه
function countdown(el, n, then) {
  let left = n, id = setInterval(() => { left--; if (left <= 0) { clearInterval(id); then(); } else { el.textContent = AR(left); Sound.tick(); } }, 1000);
  el.textContent = AR(left); Sound.tick();
  return () => clearInterval(id);
}

// ===== 🏃 اجري يا فلان =====
makeTurnGame({
  id: "runner", title: "اجري يا فلان", icon: "🏃", color: "#e8603c",
  desc: "اجري في ٣ حارات، اتفادى العربيات والحواجز، وهات النجوم. اسحب بصباعك!",
  tag: "فرق · موبايل واحد · حركة",
  opts: [{ k: "secs", label: "وقت الجري (ثانية)", def: 45, min: 20, max: 120 }],
  how: o => `عندك ٣ أرواح و<b>${AR(o.secs)} ثانية</b>.<br>اسحب يمين وشمال لتغيّر الحارة، <b>فوق</b> عشان تقفز فوق 🚧، و<b>تحت</b> عشان تنزلق تحت 🏗️. العربيات 🚌 غيّر الحارة.`,
  play(arena, done, o, t) {
    return runnerEngine(arena, { seed: 1 + rand(9999), seconds: o.secs, lives: 3, sprite: teamSprite(t),
      onEnd: s => done(Math.floor(s / 10), `جريتوا لحد ${AR(s)} 🏃`) });
  }
});

// ===== ⛵ فاصل المراكب و 🎯 مدفع العيلة (نفس محرّك القذف) =====
const launcherGame = (id, title, icon, color, desc, ammo, style, how) => makeTurnGame({
  id, title, icon, color, desc, tag: "فرق · موبايل واحد · حركة",
  opts: [{ k: "shots", label: "عدد الطلقات", def: 5, min: 3, max: 10 }],
  how: o => `عندك <b>${AR(o.shots)} طلقات</b>. اسحب ${ammo} من المقلاع لورا وسيّبه. ${how}`,
  play: (arena, done, o) => launcherEngine(arena, { shots: o.shots, ammo, style, onEnd: (s, msg) => done(Math.floor(s / 10), msg) })
});
launcherGame("boats", "فاصل المراكب", "⛵", "#2a7fa8", "اسحب المقلاع وارمي الكورة وفاصل المراكب على القراصنة.", "⚽", "boats", "هدّ المراكب ووقّع القراصنة 🏴‍☠️.");
launcherGame("cannon", "مدفع العيلة", "🎯", "#b7791f", "اضرب أفراد العيلة بالطماطم من المدفع (بالإيموجي طبعًا!).", "🍅", "family", "صيّب الإيموجي اللي فوق الصناديق.");

// ===== 👆 اضغط أسرع =====
makeTurnGame({
  id: "tap", title: "اضغط أسرع", icon: "👆", color: "#d53f8c",
  desc: "اضغط الزرار الكبير أكتر عدد مرات في الوقت المحدد.",
  tag: "فرق · موبايل واحد · سرعة",
  opts: [{ k: "secs", label: "الوقت (ثانية)", def: 10, min: 5, max: 30 }],
  how: o => `هتضغط الزرار الكبير أسرع ما تقدر لمدة <b>${AR(o.secs)} ثانية</b>. كل ضغطة بنقطة.`,
  play(arena, done, o) {
    let n = 0, running = false, left = o.secs, timer = 0;
    arena.insertAdjacentHTML("beforeend", `<div class="bigtap"><div class="clock" id="tcount"></div><button id="tbtn2">👆</button><p class="lead center" id="tinfo"></p></div>`);
    const btn = $("#tbtn2"), info = $("#tinfo");
    btn.onpointerdown = e => { e.preventDefault(); if (!running) return; n++; info.textContent = `${AR(n)} ضغطة`; Sound.tone(300 + n % 8 * 40, .05, "square", 0, .05); };
    const stop = countdown($("#tcount"), 3, () => {
      running = true; $("#tcount").textContent = AR(left); Sound.flip();
      timer = setInterval(() => { left--; $("#tcount").textContent = AR(left); if (left <= 0) { clearInterval(timer); running = false; done(n, `ضغطتوا ${AR(n)} مرة! 👆`); } }, 1000);
    });
    return () => { stop(); clearInterval(timer); };
  }
});

// ===== 🎨 ذاكرة الألوان (سايمون) =====
makeTurnGame({
  id: "simon", title: "ذاكرة الألوان", icon: "🎨", color: "#8a4fd8",
  desc: "اتفرّج على ترتيب الألوان وكرّره من غير غلطة. كل دور بيزيد لون.",
  tag: "فرق · موبايل واحد · ذاكرة",
  how: () => "الجهاز هينوّر ألوان بالترتيب، وانت تكرّرها. كل دور بيتضاف لون جديد. كل دور صح بنقطة، وأول غلطة بتوقّف الدور.",
  play(arena, done) {
    const cols = ["#d64545", "#2f7de1", "#1f9d55", "#f2b705"], fr = [330, 392, 262, 523], seq = [], timers = [];
    let pos = 0, locked = true, rounds = 0, gone = false;
    arena.insertAdjacentHTML("beforeend", `<p class="lead center" id="sinfo"></p><div class="simon">${cols.map((c, i) => `<button data-i="${i}" style="background:${c}" aria-label="لون ${i + 1}"></button>`).join("")}</div>`);
    const pads = [...arena.querySelectorAll(".simon button")], info = $("#sinfo");
    const later = (f, ms) => timers.push(setTimeout(() => { if (!gone) f(); }, ms));
    const flash = i => { pads[i].classList.add("lit"); Sound.tone(fr[i], .3, "triangle", 0, .2); later(() => pads[i].classList.remove("lit"), 320); };
    function show() {
      locked = true; pos = 0; seq.push(rand(4)); info.textContent = `دور الجهاز… (${AR(seq.length)})`;
      seq.forEach((v, k) => later(() => flash(v), 700 + k * 620));
      later(() => { locked = false; info.textContent = "دورك! كرّر الألوان"; }, 700 + seq.length * 620);
    }
    pads.forEach(p => p.onpointerdown = e => {
      e.preventDefault(); if (locked) return;
      const i = +p.dataset.i; flash(i);
      if (i !== seq[pos]) { locked = true; Sound.bad(); return later(() => done(rounds, rounds ? `وصلتوا لـ ${AR(rounds)} ألوان صح 🎨` : "غلطتوا من أول لون 😅"), 500); }
      if (++pos === seq.length) { rounds++; locked = true; info.textContent = "برافو! ✓"; later(show, 900); }
    });
    show();
    return () => { gone = true; timers.forEach(clearTimeout); };
  }
});

// ===== 🍎 اصطاد الإيموجي =====
makeTurnGame({
  id: "hunt", title: "اصطاد الإيموجي", icon: "🍎", color: "#1f9d55",
  desc: "دوّر على الإيموجي المطلوب وسط الزحمة، واضغط عليه بسرعة.",
  tag: "فرق · موبايل واحد · سرعة",
  opts: [{ k: "secs", label: "الوقت (ثانية)", def: 30, min: 10, max: 90 }],
  how: o => `فوق الشاشة إيموجي مطلوب، دوّر عليه في الشبكة واضغط. صح بنقطة، غلط بيخصم نقطة. عندك <b>${AR(o.secs)} ثانية</b>.`,
  play(arena, done, o) {
    const pool = ["🍎", "🍌", "🍇", "🍉", "🍓", "🥕", "🍋", "🍒", "🥝", "🍑", "🍍", "🥥", "🌽", "🍆", "🥦", "🍄"];
    let score = 0, left = o.secs, target = "";
    arena.insertAdjacentHTML("beforeend", `<div class="huntbar"><span id="hsc">⭐ ٠</span><b>دوّر على: <span id="htg" class="big"></span></b><span id="hlf"></span></div><div class="huntgrid" id="hgrid"></div>`);
    function deal() {
      const rest = shuffle(pool); target = rest.pop();
      const cells = shuffle([target, ...Array.from({ length: 15 }, () => rest[rand(rest.length)])]);
      $("#htg").textContent = target;
      $("#hgrid").innerHTML = cells.map(e => `<button>${e}</button>`).join("");
      $("#hgrid").querySelectorAll("button").forEach(b => b.onpointerdown = ev => {
        ev.preventDefault();
        if (b.textContent === target) { score++; Sound.ok(); } else { score = Math.max(0, score - 1); Sound.bad(); buzz(60); }
        $("#hsc").textContent = "⭐ " + AR(score); deal();
      });
    }
    deal(); $("#hlf").textContent = "⏱ " + AR(left);
    const id = setInterval(() => { left--; $("#hlf").textContent = "⏱ " + AR(left); if (left <= 0) { clearInterval(id); done(score, `اصطدتوا ${AR(score)} 🍎`); } }, 1000);
    return () => clearInterval(id);
  }
});

// ===== ✏️ رسم وتخمين =====
makeTurnGame({
  id: "draw", title: "رسم وتخمين", icon: "✏️", color: "#12a3b4",
  desc: "واحد يرسم الكلمة بصباعه، وفريقه يخمّن قبل الوقت.",
  tag: "فرق · موبايل واحد",
  opts: [{ k: "secs", label: "وقت الرسم (ثانية)", def: 60, min: 20, max: 180 }],
  how: o => `واحد من الفريق هو <b>الرسّام</b>: يبص على الموبايل لوحده ويشوف الكلمة، ويرسمها <b>من غير كلام وكتابة</b>. باقي الفريق يخمّن في ${AR(o.secs)} ثانية. خمّنوها = نقطتين.`,
  play(arena, done, o) {
    const word = CARDS.draw[draw("draw", CARDS.draw, c => allowed(c, { packs: false }))].t;
    let left = o.secs, shown = false, timer = 0;
    arena.insertAdjacentHTML("beforeend", `<div class="drawbar"><button id="dword">👁 اعرض الكلمة (للرسّام بس)</button><span id="dlf">⏱ ${AR(left)}</span></div><div id="dcv"></div>
      <div class="actions"><button class="ok" id="dok">خمّنوها ✓</button><button id="dclr">مسح 🧽</button></div>`);
    const { c, x, W, H } = mkCanvas($("#dcv"), .85);
    x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); x.lineWidth = 4; x.lineCap = x.lineJoin = "round"; x.strokeStyle = "#222";
    let last = null;
    const pos = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    c.onpointerdown = e => { last = pos(e); c.setPointerCapture(e.pointerId); x.beginPath(); x.arc(last[0], last[1], 1, 0, 7); x.stroke(); };
    c.onpointermove = e => { if (!last) return; const p = pos(e); x.beginPath(); x.moveTo(last[0], last[1]); x.lineTo(p[0], p[1]); x.stroke(); last = p; };
    c.onpointerup = c.onpointercancel = () => { last = null; };
    $("#dclr").onclick = () => { x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); };
    $("#dword").onclick = () => { shown = !shown; $("#dword").textContent = shown ? `الكلمة: ${word} (اضغط تخبّيها)` : "👁 اعرض الكلمة (للرسّام بس)"; };
    $("#dok").onclick = () => done(2, `الكلمة كانت «${word}» وخمّنوها! ✏️`);
    timer = setInterval(() => { left--; $("#dlf").textContent = "⏱ " + AR(left); if (left <= 0) { clearInterval(timer); done(0, `الوقت خلص! الكلمة كانت «${word}»`); } }, 1000);
    return () => clearInterval(timer);
  }
});

// ===== ⚖️ ثقيل ولا خفيف (الأول في كل زوج هو الأثقل فعلًا) =====
const HEAVY_PAIRS = [
  ["🐘 فيل", "🐴 حصان"], ["🐋 حوت أزرق", "🐘 فيل"], ["🐴 حصان", "🐕 كلب"], ["🐕 كلب", "🐈 قطة"], ["🐈 قطة", "🐁 فار"],
  ["🚌 أتوبيس", "🚗 عربية"], ["🚗 عربية", "🏍️ موتوسيكل"], ["🏍️ موتوسيكل", "🚲 عجلة"], ["🧺 غسالة", "📦 ميكروويف"],
  ["📦 ميكروويف", "🥤 خلاط"], ["🍉 بطيخة", "🍎 تفاحة"], ["🍎 تفاحة", "🍇 حبّة عنب"], ["📚 كتاب", "📄 ورقة"],
  ["💻 لاب توب", "📱 موبايل"], ["📱 موبايل", "🔑 مفتاح"], ["🔑 مفتاح", "🪶 ريشة"], ["🦁 أسد", "🐇 أرنب"],
  ["🐇 أرنب", "🐦 عصفور"], ["🐃 جاموسة", "🐑 خروف"], ["🐑 خروف", "🐔 فرخة"], ["🐔 فرخة", "🕊️ حمامة"], ["🐻 دب", "🐺 ذئب"],
  ["🪑 كرسي", "🛏️ مخدة"], ["🗄️ دولاب", "🪑 كرسي"], ["🪨 حجر كبير", "🧽 إسفنجة"], ["🧱 طوبة", "🍞 رغيف عيش"]
];
makeTurnGame({
  id: "heavy", title: "ثقيل ولا خفيف", icon: "⚖️", color: "#b7791f",
  desc: "حاجتين قدامك، أنهي فيهم الأثقل؟ جاوب أسرع ما تقدر.",
  tag: "فرق · موبايل واحد · سرعة",
  opts: [{ k: "secs", label: "الوقت (ثانية)", def: 30, min: 10, max: 90 }],
  how: o => `هيظهر حاجتين، اضغط على الأثقل فيهم. كل إجابة صح بنقطة. عندك <b>${AR(o.secs)} ثانية</b>.`,
  play(arena, done, o) {
    let score = 0, wrong = 0, left = o.secs, order = shuffle(HEAVY_PAIRS), k = 0;
    arena.insertAdjacentHTML("beforeend", `<div class="huntbar"><span id="hsc">✓ ٠</span><b>أنهي أثقل؟</b><span id="hlf">⏱ ${AR(left)}</span></div><div class="heavy" id="hv"></div>`);
    function deal() {
      if (k >= order.length) { order = shuffle(HEAVY_PAIRS); k = 0; }
      const [a, b] = order[k++], flip = Math.random() < .5, opts = flip ? [b, a] : [a, b];
      $("#hv").innerHTML = opts.map(t => `<button>${esc(t)}</button>`).join("");
      $("#hv").querySelectorAll("button").forEach(btn => btn.onpointerdown = e => {
        e.preventDefault();
        if (btn.textContent === a) { score++; Sound.ok(); } else { wrong++; Sound.bad(); buzz(60); }
        $("#hsc").textContent = "✓ " + AR(score); deal();
      });
    }
    deal();
    const id = setInterval(() => { left--; $("#hlf").textContent = "⏱ " + AR(left); if (left <= 0) { clearInterval(id); done(score, `جاوبتوا ${AR(score)} صح و${AR(wrong)} غلط ⚖️`); } }, 1000);
    return () => clearInterval(id);
  }
});

// ===== 🔤 كلمة السر: حروف بتظهر واحد واحد، والأسرع في التخمين ياخد نقط أكتر =====
makeTurnGame({
  id: "code", title: "كلمة السر", icon: "🔤", color: "#4a5ad8",
  desc: "كلمة مستخبية، حروفها بتظهر واحد واحد. كل ما تخمّنها بدري تاخد نقط أكتر.",
  tag: "فرق · موبايل واحد",
  how: () => "هتظهر فئة الكلمة وحروفها بتظهر واحد واحد. لما الفريق يعرف الكلمة يدوس <b>«عرفنا!»</b> ويقولها بصوت عالي. نقطك = عدد الحروف اللي لسه مستخبية (على الأقل نقطة).",
  play(arena, done) {
    const item = CARDS.code[draw("code", CARDS.code, c => allowed(c, { packs: false }))], letters = [...item.t.replace(/ /g, "")];
    let shown = 1, timer = 0, paused = false;
    arena.insertAdjacentHTML("beforeend", `<p class="lead center">الفئة: <b>${esc(item.a)}</b></p><div class="slots" id="slots"></div>
      <div id="cact"></div>`);
    const slots = () => $("#slots").innerHTML = letters.map((l, i) => `<span class="slot ${i < shown ? "on" : ""}">${i < shown ? esc(l) : ""}</span>`).join("");
    const left = () => letters.length - shown;
    function act() {
      $("#cact").innerHTML = paused
        ? `<p class="lead center">قالوا إيه؟ الكلمة هي: <b>${esc(item.t)}</b></p><div class="actions"><button class="ok" id="cok">صح ✓</button><button class="bad" id="cbad">غلط ✗</button></div>`
        : `<button class="primary" id="cknow">🙋 عرفنا!</button>`;
      if (paused) { $("#cok").onclick = () => done(Math.max(1, left()), `الكلمة «${item.t}» 🔤`); $("#cbad").onclick = () => { paused = false; act(); run(); }; }
      else $("#cknow").onclick = () => { paused = true; clearInterval(timer); act(); };
    }
    function run() {
      clearInterval(timer);
      timer = setInterval(() => {
        if (shown >= letters.length) { clearInterval(timer); return done(0, `محدش عرفها! الكلمة «${item.t}»`); }
        shown++; slots(); Sound.tick();
      }, 2500);
    }
    slots(); act(); run();
    return () => clearInterval(timer);
  }
});
