// ===== على الجبهة: الموبايل على جبهة لاعب، والفريق يوصف الكلمة =====
// ميّل الموبايل لتحت (الشاشة ناحية الأرض) = صح، لفوق (الشاشة ناحية السقف) = عدّي.
GAMES.heads = {
  id: "heads", title: "على الجبهة", icon: "🤳", color: "#1f9d55",
  desc: "حط الموبايل على جبهتك وفريقك يوصفلك الكلمة. ميّله لتحت لو عرفتها.",
  tag: "فرق · موبايل واحد",
  armed: false,

  render(root) {
    const m = S.match;
    if (!m || m.game !== this.id) {
      const cats = Object.keys(WORDS);
      root.innerHTML = setupView(this, `<section class="panel"><h2>الفئة</h2><div class="chips">
        <label class="chip"><input type="radio" name="hcat" value="*" checked> 🎲 كله مكس</label>
        ${cats.map(c => `<label class="chip"><input type="radio" name="hcat" value="${esc(c)}"> ${esc(c)}</label>`).join("")}</div></section>
        <section class="panel"><h2>الإعدادات</h2><div class="grid2">
        ${numField("rounds", "عدد الجولات", 2, 1, 10)}${numField("timer", "وقت كل دور (ثانية)", 60, 30, 120)}</div></section>`);
      return;
    }
    if (m.over) { root.innerHTML = endScreen(this.id); return; }
    const g = m.g;
    if (g.phase === "play" && !Timer.running) { this.finish(); return; } // الصفحة اتقفلت في النص
    if (g.phase === "count" && !this.countId) g.phase = "ready";
    root.innerHTML = g.phase === "play" ? this.playView() : g.phase === "count" ? this.countView() : g.phase === "result" ? this.resultView() : this.readyView();
  },

  begin() {
    const cat = (document.querySelector("input[name=hcat]:checked") || {}).value || "*";
    Match.begin(this.id, clamp($("#rounds").value, 1, 10, 2), { cat, sec: clamp($("#timer").value, 30, 120, 60), phase: "ready" });
    route();
  },
  words() {
    const c = S.match.g.cat;
    return (c === "*" ? Object.values(WORDS).join("|") : WORDS[c] || Object.values(WORDS).join("|")).split("|").map(t => ({ t }));
  },

  readyView() {
    const g = S.match.g;
    return `${turnHead()}
    <section class="panel"><h2>إزاي تلعب</h2><ol class="steps">
      <li>واحد من الفريق يحط الموبايل على جبهته <b>بالعرض</b> والشاشة ناحية الفريق.</li>
      <li>الفريق يوصف الكلمة من غير ما يقولها.</li>
      <li>ميّل الموبايل <b>لتحت</b> لو عرفتها ✓، ولـ<b>فوق</b> لو عايز تعدّي.</li>
      <li>مفيش حساس؟ دوس على <b>يمين</b> الشاشة للصح و<b>شمال</b> للتعدية.</li></ol>
      <p class="note">الفئة: ${esc(g.cat === "*" ? "كله مكس" : g.cat)} · ${AR(g.sec)} ثانية</p>
      <button class="primary" onclick="G('heads').go()">ابدأ 🤳</button></section>
    ${scoreboard()}<button class="ghost" onclick="quitMatch()">إنهاء اللعبة</button>`;
  },

  async go() {
    // iOS محتاج إذن عشان يدينا حساس الحركة، ولازم يتطلب من دوسة
    try {
      if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== "granted") toast("من غير إذن الحركة، استخدم الدوس على الشاشة");
      }
    } catch (e) { }
    try { await document.documentElement.requestFullscreen(); await screen.orientation.lock("landscape"); } catch (e) { }
    const g = S.match.g;
    Object.assign(g, { phase: "count", words: [], cur: null, n: 3 });
    save(); route();
    const t = setInterval(() => {
      g.n--; Sound.tick();
      if (g.n <= 0) { clearInterval(t); this.countId = null; this.play(); } else { const el = $("#count"); if (el) el.textContent = AR(g.n); }
    }, 1000);
    this.countId = t;
  },
  countView() { return `<div class="heads count"><div id="count" class="huge">${AR(S.match.g.n)}</div><p>حط الموبايل على جبهتك!</p></div>`; },

  play() {
    const g = S.match.g;
    g.phase = "play"; this.nextWord(); this.armed = false;
    this.onTilt = e => this.tilt(e);
    window.addEventListener("deviceorientation", this.onTilt);
    Timer.start(g.sec, { onEnd: () => this.finish() }); Timer.owner = "heads";
    Sound.flip(); route();
  },
  nextWord() { const w = this.words(); S.match.g.cur = w[draw("heads:" + S.match.g.cat, w)].t; save(); },

  playView() {
    const g = S.match.g;
    return `<div class="heads ${g.flash || ""}">
      <button class="half pass" onclick="G('heads').mark(false)" aria-label="عدّي">عدّي ↑</button>
      <div class="word">${esc(g.cur)}</div>
      <button class="half okk" onclick="G('heads').mark(true)" aria-label="صح">صح ↓</button>
      <div class="hbar">${timerHTML(Timer.left, g.sec)}<span>✓ ${AR(g.words.filter(w => w.ok).length)}</span></div>
    </div>`;
  },

  tilt(e) {
    if (e.beta == null || !Timer.running) return;
    const ang = screen.orientation ? screen.orientation.angle : (window.orientation || 0);
    const land = Math.abs(ang % 180) === 90 || innerWidth > innerHeight;
    let neutral = false, dir = 0;
    if (land) { const gm = Math.abs(e.gamma); neutral = gm > 60; if (gm < 30) dir = Math.abs(e.beta) > 90 ? 1 : -1; }
    else { const b = e.beta; neutral = b > 60 && b < 120; if (Math.abs(b) < 30) dir = -1; else if (Math.abs(b) > 150) dir = 1; }
    if (neutral) this.armed = true;
    else if (dir && this.armed) { this.armed = false; this.mark(dir === 1); }
  },

  mark(ok) {
    const g = S.match.g; if (g.phase !== "play") return;
    g.words.push({ t: g.cur, ok });
    g.flash = ok ? "flash-ok" : "flash-pass";
    ok ? Sound.ok() : Sound.pass(); buzz(ok ? 60 : 30);
    this.nextWord(); route();
  },

  cleanup() {
    clearInterval(this.countId); this.countId = null;
    if (this.onTilt) window.removeEventListener("deviceorientation", this.onTilt);
    this.onTilt = null;
    try { if (document.fullscreenElement) document.exitFullscreen(); screen.orientation.unlock(); } catch (e) { }
  },
  onExit() { this.cleanup(); },

  finish() {
    const g = S.match.g; Timer.stop(); Timer.owner = null; this.cleanup();
    Match.add(g.words.filter(w => w.ok).length); g.phase = "result"; g.flash = ""; save(); route();
  },
  resultView() {
    const w = S.match.g.words;
    return `${turnHead()}<section class="panel"><h2>جبتوا ${AR(w.filter(x => x.ok).length)} كلمة</h2>
    <ul class="wlist">${w.map(x => `<li class="${x.ok ? "y" : "n"}">${x.ok ? "✓" : "↷"} ${esc(x.t)}</li>`).join("") || "<li>ولا كلمة 😅</li>"}</ul>
    <button class="primary" onclick="G('heads').nextTeam()">الدور اللي بعده ◀</button></section>${scoreboard()}`;
  },
  nextTeam() { S.match.g.phase = "ready"; Match.next(); route(); }
};
