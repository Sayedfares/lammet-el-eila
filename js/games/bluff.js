// ===== كدّاب ولا بجد؟ — كل واحد بموبايله في أوضة =====
// كل واحد يألّف إجابة غلط مقنعة، وبعدين الكل يحاول يلاقي الإجابة الصح وسط الكدب.
// الأساس المشترك (الاتصال بالسيرفر والأوضة) في room.js.
GAMES.bluff = {
  ...RoomBase,
  id: "bluff", title: "كدّاب ولا بجد؟", icon: "🤥", color: "#8a4fd8",
  desc: "كل واحد بموبايله: ألّف إجابة غلط تضحك بيها على الباقيين، ودوّر على الإجابة الصح.",
  tag: "كل واحد بموبايله · أوضة",
  draft: "",

  createForm() {
    return `<div class="chips"><label class="chip"><input type="radio" name="bmode" value="facts" checked> 🧠 معلومات غريبة</label>
      <label class="chip"><input type="radio" name="bmode" value="people"> 😂 أسئلة عن اللاعيبة</label></div>
      ${numField("brounds", "عدد الجولات", 5, 3, 10)}`;
  },
  how() {
    return `<ol class="steps">
      <li>يظهر سؤال لكل الناس، وكل واحد يكتب إجابة <b>غلط</b> بس مقنعة.</li>
      <li>الإجابات كلها تظهر مخلوطة مع الإجابة الصح.</li>
      <li>اختار اللي انت شايفها صح: لو صح تاخد <b>نقطتين</b>، وكل واحد يختار كدبتك تاخد <b>نقطة</b>.</li>
      <li>في «أسئلة عن اللاعيبة» مفيش إجابة صح: اختار أظرف إجابة، وكل صوت بنقطة لصاحبها.</li></ol>`;
  },
  afterPaint() { this.restoreDraft(); },

  async create() {
    const w = this.who(); if (!w || this.busy) return;
    const mode = document.querySelector("input[name=bmode]:checked").value;
    await this.enter(() => this.api("create", { ...w, mode, rounds: clamp($("#brounds").value, 3, 10, 5) }));
  },

  onChange() {
    const a = this.prev, b = this.state; if (!a || a.phase === b.phase) return;
    if (b.phase === "write") { this.draft = ""; Sound.flip(); buzz(40); }
    if (b.phase === "vote") { Sound.flip(); buzz(40); }
    if (b.phase === "reveal") { (b.gains[b.me] || 0) > 0 ? Sound.ok() : Sound.bad(); }
    if (b.phase === "end") { Sound.win(); confetti(); }
  },
  submit() {
    const t = ($("#bans").value || "").trim(); if (!t) return toast("اكتب إجابتك");
    this.draft = t; this.act("answer", { text: t });
  },
  restoreDraft() {
    const el = $("#bans"); if (!el) return;
    el.value = this.draft;
    if (this.focused) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  },

  // ===== الشاشات =====
  view() {
    const s = this.state, me = s.players.find(p => p.id === s.me), host = s.host === s.me;
    const head = `<div class="roomhead"><span>أوضة <b dir="ltr">${esc(s.code)}</b></span>
      ${s.phase !== "lobby" ? `<span>جولة ${AR(Math.min(s.round, s.rounds))} من ${AR(s.rounds)}</span>` : ""}
      <span>${avatar(me, "sm")} ${esc(me ? me.name : "")}</span></div>`;
    const body = { lobby: this.lobby, write: this.write, vote: this.vote, reveal: this.reveal, end: this.end }[s.phase].call(this, s, host);
    return head + body + `<button class="ghost" onclick="G('bluff').leave()">اخرج من الأوضة</button>`;
  },
  hostSkip(s, host) {
    return host ? `<button class="ghost" onclick="G('bluff').act('skip')">كمّل من غير اللي متأخرين ⏭</button>` : "";
  },

  lobby(s, host) {
    return `<section class="panel center">${this.lobbyInfo(s)}
      <p class="note">${s.mode === "facts" ? "🧠 معلومات غريبة" : "😂 أسئلة عن اللاعيبة"} · ${AR(s.rounds)} جولات</p></section>
    <section class="panel"><h2>اللاعيبة (${AR(s.players.length)})</h2>${this.people(s)}</section>
    ${host ? `<button class="primary" onclick="G('bluff').act('start')">ابدأ اللعبة ▶</button>` : `<p class="sub">مستنيين صاحب الأوضة يبدأ…</p>`}`;
  },

  write(s, host) {
    const mine = s.myAnswer;
    return `<div class="prompt">${esc(s.prompt)}</div>
    ${mine ? `<section class="panel center"><p>كتبت: <b>${esc(mine)}</b></p><p class="sub">مستنيين الباقيين…</p></section>`
      : `<section class="panel"><label class="field">${s.mode === "facts" ? "اكتب إجابة غلط بس مقنعة" : "اكتب إجابتك"}
        <input type="text" id="bans" maxlength="60" autocomplete="off" oninput="G('bluff').draft=this.value"
          onfocus="G('bluff').focused=true" onblur="G('bluff').focused=false" onkeydown="if(event.key==='Enter')G('bluff').submit()"></label>
        <button class="primary" onclick="G('bluff').submit()">ابعت ✍️</button></section>`}
    <section class="panel"><h2>مين خلّص</h2>${this.people(s, true)}</section>${this.hostSkip(s, host)}`;
  },

  vote(s, host) {
    const pick = s.myVote;
    const q = s.mode === "facts" ? "أنهي واحدة هي الإجابة الصح؟" : "أنهي إجابة أظرف؟";
    return `<div class="prompt">${esc(s.prompt)}</div><p class="sub">${q}</p>
    <div class="opts">${s.options.map(o => `<button class="opt ${pick === o.id ? "sel" : ""}" ${o.mine || pick != null || !s.canVote ? "disabled" : ""}
      onclick="G('bluff').act('vote',{option:${o.id}})">${esc(o.text)}${o.mine ? " <small>(إجابتك)</small>" : ""}</button>`).join("")}</div>
    ${pick != null ? `<p class="sub">صوتك اتسجّل، مستنيين الباقيين…</p>` : ""}
    <section class="panel"><h2>مين صوّت</h2>${this.people(s, true)}</section>${this.hostSkip(s, host)}`;
  },

  results(s) {
    return `<div class="opts">${s.results.map(r => `<div class="res ${r.truth ? "truth" : ""}">
      <div class="rt">${r.truth ? "✅ " : ""}${esc(r.text)}</div>
      <div class="rm">${r.truth ? "الإجابة الصح" : "كتبها: " + esc(r.owners.join(" و "))}</div>
      ${r.voters.length ? `<div class="rv">اختاروها: ${esc(r.voters.join("، "))}</div>` : ""}</div>`).join("")}</div>`;
  },
  reveal(s, host) {
    const g = s.gains[s.me] || 0;
    return `<div class="prompt">${esc(s.prompt)}</div>
    <p class="lead center">${g ? `كسبت ${ptsTxt(g)} الجولة دي 🎉` : "مكسبتش نقط الجولة دي 😅"}</p>
    ${this.results(s)}
    <section class="panel"><h2>النتيجة</h2>${this.people({ ...s, players: [...s.players].sort((a, b) => b.score - a.score) })}</section>
    ${host ? `<button class="primary" onclick="G('bluff').act('next')">${s.round >= s.rounds ? "النتيجة النهائية 🏆" : "الجولة اللي بعدها ◀"}</button>` : `<p class="sub">مستنيين صاحب الأوضة…</p>`}`;
  },
  end(s, host) {
    const rows = [...s.players].sort((a, b) => b.score - a.score), top = rows[0].score;
    const w = rows.filter(p => p.score === top);
    return `<div class="end"><div class="trophy">🏆</div><h1>${w.length > 1 ? "تعادل!" : "مبروك!"}</h1>
    <div class="winners">${w.map(p => `<div class="wn">${avatar(p, "xl")}<b>${esc(p.name)}</b></div>`).join("")}</div>
    <section class="panel">${this.people({ ...s, players: rows })}</section>
    ${host ? `<button class="primary" onclick="G('bluff').act('start')">نلعب تاني بنفس الأوضة ↻</button>` : `<p class="sub">صاحب الأوضة يقدر يبدأ تاني</p>`}</div>`;
  }
};
