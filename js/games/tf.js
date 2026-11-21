// ===== صح ولا غلط: كل فريق معاه وقت محدد يجاوب فيه على أكبر عدد =====
GAMES.tf = {
  id: "tf", title: "صح ولا غلط", icon: "⚡", color: "#2f7de1",
  desc: "جمل ورا بعض بسرعة، والفريق يقول صح ولا غلط قبل ما الوقت يخلص.",
  tag: "فرق · موبايل واحد",

  render(root) {
    const m = S.match;
    if (!m || m.game !== this.id) {
      root.innerHTML = setupView(this, `<section class="panel"><h2>الإعدادات</h2><div class="grid2">
        ${numField("rounds", "عدد الجولات", 3, 1, 10)}${numField("timer", "وقت كل دور (ثانية)", 45, 15, 120)}</div></section>`);
      return;
    }
    if (m.over) { root.innerHTML = endScreen(this.id); return; }
    const g = m.g;
    if (g.phase === "play" && Timer.owner !== this.owner()) { Timer.set(g.left, g.sec, this.hooks()); Timer.owner = this.owner(); }
    root.innerHTML = g.phase === "play" ? this.playView() : g.phase === "result" ? this.resultView() : this.readyView();
  },

  begin() {
    Match.begin(this.id, clamp($("#rounds").value, 1, 10, 3), { sec: clamp($("#timer").value, 15, 120, 45), phase: "ready" });
    route();
  },
  owner() { return "tf:" + S.match.played; },
  hooks() { return { onTick: l => { S.match.g.left = l; save(); }, onEnd: () => this.finish() }; },

  readyView() {
    return `${turnHead()}
    <section class="panel center"><p class="lead">عندكم <b>${AR(S.match.g.sec)} ثانية</b>.<br>كل جملة قولوا عليها صح ولا غلط، وكل إجابة صح بنقطة.</p>
    <button class="primary" onclick="G('tf').go()">جاهزين؟ ابدأ ⚡</button></section>
    ${scoreboard()}<button class="ghost" onclick="quitMatch()">إنهاء اللعبة</button>`;
  },

  go() {
    const g = S.match.g;
    Object.assign(g, { phase: "play", right: 0, wrong: 0, left: g.sec, flash: "" });
    this.nextQ();
    Timer.start(g.sec, this.hooks()); Timer.owner = this.owner();
    route();
  },
  nextQ() { S.match.g.idx = draw("tf", CARDS.tf, c => allowed(c, { packs: false })); save(); },

  playView() {
    const g = S.match.g, item = CARDS.tf[g.idx];
    return `${turnHead()}
    <div class="tfcard ${g.flash}" style="--cc:#2f7de1">
      <div class="small">✓ ${AR(g.right)} &nbsp; ✗ ${AR(g.wrong)}</div>
      <div class="text">${esc(item.t)}</div>
      ${timerHTML(g.left, g.sec)}
    </div>
    <div class="actions big">
      <button class="ok" onclick="G('tf').answer(true)">صح ✓</button>
      <button class="bad" onclick="G('tf').answer(false)">غلط ✗</button>
    </div>`;
  },

  answer(v) {
    const g = S.match.g; if (g.phase !== "play" || !Timer.running) return toast("شغّل الوقت الأول");
    const ok = (CARDS.tf[g.idx].a === "T") === v;
    if (ok) { g.right++; g.flash = "flash-ok"; Sound.ok(); buzz(40); }
    else { g.wrong++; g.flash = "flash-bad"; Sound.bad(); buzz([60, 40, 60]); }
    this.nextQ(); route();
  },

  finish() {
    const g = S.match.g; Timer.stop(); Timer.owner = null;
    Match.add(g.right); g.phase = "result"; save(); route();
  },

  resultView() {
    const g = S.match.g;
    return `${turnHead()}
    <section class="panel center"><div class="trophy">⏰</div>
    <p class="lead">الوقت خلص! جاوبتوا <b>${AR(g.right)}</b> صح و<b>${AR(g.wrong)}</b> غلط.</p>
    <button class="primary" onclick="G('tf').nextTeam()">الدور اللي بعده ◀</button></section>${scoreboard()}`;
  },
  nextTeam() { S.match.g.phase = "ready"; Match.next(); route(); }
};
