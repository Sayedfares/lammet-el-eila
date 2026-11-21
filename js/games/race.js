// ===== سباق الجري: كل واحد بموبايله على نفس الحواجز، والسيرفر بيرتّب النقط =====
// محرّك الجري (runnerEngine) بيتفتح في طبقة فوق الشاشة عشان إعادة الرسم من الـpolling متقطعش الجري.
GAMES.race = {
  ...RoomBase,
  id: "race", title: "سباق الجري", icon: "🏁", color: "#e8603c",
  desc: "كلكم بتجروا في نفس الطريق من موبايلاتكم، ومين يجمع نقط أكتر يكسب. زي صابواي بس مع الشلة.",
  tag: "كل واحد بموبايله · أوضة · ٢+",
  eng: null,

  createForm() { return `<p class="note">وقت السباق بتختاره جوه الأوضة قبل ما تبدأوا.</p>`; },
  how() {
    return `<ol class="steps"><li>صاحب الأوضة يبدأ السباق، وبعد عدّ تنازلي الكل بيجري مع بعض.</li>
      <li>اسحب يمين وشمال لتغيّر الحارة، <b>فوق</b> للقفز فوق 🚧، و<b>تحت</b> للانزلاق تحت 🏗️، والعربيات 🚌 غيّر حارتك.</li>
      <li>معاك ٣ أرواح، والنجوم ⭐ بتزوّد النقط. اللي معاه أعلى نقط لما الوقت يخلص يكسب.</li></ol>`;
  },
  async create() {
    const w = this.who(); if (!w || this.busy) return;
    await this.enter(() => this.api("create", { ...w, game: "race" }));
  },

  onExit() { this.stopRun(); RoomBase.onExit.call(this); },
  leave(force) { this.stopRun(); RoomBase.leave.call(this, force); },
  onChange() {
    const b = this.state;
    if (b.phase === "run" && !this.eng) this.startRun(b);
    if (b.phase !== "run") this.stopRun();
    const a = this.prev; if (!a || a.phase === b.phase) return;
    if (b.phase === "count") { Sound.flip(); buzz(60); }
    if (b.phase === "end") { const top = [...b.players].sort((p, q) => q.score - p.score)[0]; top.id === b.me ? (Sound.win(), confetti()) : Sound.flip(); }
  },

  // إرسال نتيجة من غير ما يتجاهلها الـbusy بتاع act (النتيجة النهائية بتتعاد لو فشلت)
  async push(type, score, tries = 3) {
    const s = this.sess(); if (!s) return;
    try {
      const st = await this.api("act", { code: s.code, token: s.token, type, score });
      if (st.ver >= this.ver) { this.at = Date.now(); this.prev = this.state; this.state = st; this.ver = st.ver; this.onChange(); this.paint(); }
    } catch (e) { if (type === "finish" && tries > 1 && e.message !== "ROOM_GONE") setTimeout(() => this.push(type, score, tries - 1), 1500); }
  },
  startRun(s) {
    const box = document.createElement("div"); box.id = "rrun"; box.className = "overlay run";
    box.innerHTML = `<div class="sheet"><div id="rarena"></div><ul class="plist" id="rstand"></ul></div>`;
    document.body.appendChild(box);
    const me = s.players.find(p => p.id === s.me);
    this.eng = runnerEngine($("#rarena"), {
      seed: s.seed, seconds: s.secs, lives: 3, sprite: (me && me.avatar) || "🏃",
      onScore: sc => this.push("progress", sc),
      onEnd: sc => { this.eng = () => { }; this.push("finish", sc); $("#rarena").innerHTML = `<p class="lead center">خلّصت بـ ${AR(sc)} نقطة! مستنيين الباقيين…</p>`; }
    });
  },
  stopRun() { if (this.eng) { this.eng(); this.eng = null; } const b = $("#rrun"); if (b) b.remove(); },

  tickUI() {
    const s = this.state; if (!s) return;
    const c = $("#rcount"); if (c && s.left != null) c.textContent = AR(Math.ceil(this.left(s.left)));
    const st = $("#rstand");
    if (st) st.innerHTML = [...s.players].sort((a, b) => b.score - a.score).map(p => `<li>${avatar(p, "sm")}<span>${esc(p.name)}${p.id === s.me ? " (انت)" : ""}</span><b>${AR(p.score)}${p.fin ? " ✓" : ""}</b></li>`).join("");
  },

  view() {
    const s = this.state, me = s.players.find(p => p.id === s.me);
    const head = `<div class="roomhead"><span>أوضة <b dir="ltr">${esc(s.code)}</b></span><span>${avatar(me, "sm")} ${esc(me ? me.name : "")}</span></div>`;
    return head + this[s.phase](s, s.host === s.me) + `<button class="ghost" onclick="G('race').leave()">اخرج من الأوضة</button>`;
  },
  set(key, d) {
    const l = this.state.secsList, i = l.indexOf(this.state.secs);
    this.act("settings", { secs: l[clamp(i + d, 0, l.length - 1, i)] });
  },
  lobby(s, host) {
    const enough = s.players.length >= s.min;
    return `<section class="panel center">${this.lobbyInfo(s)}</section>
    <section class="panel"><h2>اللاعيبة (${AR(s.players.length)})</h2><ul class="plist">${s.players.map(p => `<li>${avatar(p, "sm")}<span>${esc(p.name)}${p.id === s.host ? " 👑" : ""}</span></li>`).join("")}</ul>
      ${enough ? "" : `<p class="note">محتاجين ${AR(s.min)} لاعيبين على الأقل.</p>`}</section>
    <section class="panel"><h2>الإعدادات${host ? "" : " (صاحب الأوضة بيختارها)"}</h2>${this.stepper("وقت السباق", "secs", AR(s.secs) + " ثانية", host)}</section>
    ${host ? `<button class="primary" ${enough ? "" : "disabled"} onclick="G('race').act('start')">ابدأ السباق 🏁</button>` : `<p class="sub">مستنيين صاحب الأوضة يبدأ…</p>`}`;
  },
  count() { return `<div class="prompt orange center">🏁 استعدوا!<div class="clock" id="rcount"></div></div><p class="sub">سيّب صباعك على الشاشة وجهّز نفسك…</p>`; },
  run() { return `<section class="panel center"><p class="lead">🏃 السباق شغّال… الجري على الشاشة اللي فوق.</p></section>`; },
  end(s, host) {
    const rows = [...s.players].sort((a, b) => b.score - a.score), medal = i => ["🥇", "🥈", "🥉"][i] || "";
    return `<div class="end"><div class="trophy">🏁</div><h1>${esc(rows[0].name)} كسب!</h1>
    <section class="panel"><ul class="plist">${rows.map((p, i) => `<li>${medal(i)} ${avatar(p, "sm")}<span>${esc(p.name)}${p.id === s.me ? " (انت)" : ""}</span><b>${AR(p.score)}</b></li>`).join("")}</ul></section>
    ${host ? `<button class="primary" onclick="G('race').act('again')">سباق تاني ↻</button>` : `<p class="sub">صاحب الأوضة يقدر يبدأ تاني</p>`}</div>`;
  }
};
