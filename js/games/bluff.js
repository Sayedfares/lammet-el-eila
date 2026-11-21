// ===== كدّاب ولا بجد؟ — كل واحد بموبايله في أوضة =====
// كل واحد يألّف إجابة غلط مقنعة، وبعدين الكل يحاول يلاقي الإجابة الصح وسط الكدب.
// محتاجة السيرفر (server.py) شغّال وكل الموبايلات على نفس الواي فاي.
const SESS_KEY = "lamma-bluff";
GAMES.bluff = {
  id: "bluff", title: "كدّاب ولا بجد؟", icon: "🤥", color: "#8a4fd8",
  desc: "كل واحد بموبايله: ألّف إجابة غلط تضحك بيها على الباقيين، ودوّر على الإجابة الصح.",
  tag: "كل واحد بموبايله · أوضة",
  state: null, ver: -1, poll: null, draft: "", busy: false, server: null,

  sess() { try { return JSON.parse(localStorage.getItem(SESS_KEY)); } catch (e) { return null; } },
  setSess(s) { try { s ? localStorage.setItem(SESS_KEY, JSON.stringify(s)) : localStorage.removeItem(SESS_KEY); } catch (e) { } },

  async api(path, body) {
    let r;
    try {
      r = await fetch("api/" + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
    } catch (e) { throw new Error("مفيش اتصال بالسيرفر"); }
    const j = await r.json().catch(() => ({ error: "NO_SERVER" }));
    if (!r.ok) throw new Error(j.error || "حصلت مشكلة");
    return j;
  },

  render(root) {
    this.root = root;
    const s = this.sess();
    if (!s) {
      root.innerHTML = this.entryView();
      if (this.server === null) this.api("ping").then(() => { this.server = true; }, () => { this.server = false; this.paint(); });
      return;
    }
    root.innerHTML = this.state ? this.view() : `<p class="sub">بيدخل الأوضة…</p>`;
    this.startPoll();
  },
  paint() { if (this.root && location.hash.startsWith("#/play/bluff")) { this.render(this.root); this.restoreDraft(); } },

  entryView() {
    const avs = AVATARS.map((a, i) => `<label class="avpick"><input type="radio" name="bav" value="${a}" ${i === rand(4) ? "checked" : ""}><span>${a}</span></label>`).join("");
    const noServer = this.server === false ? `<section class="panel warn"><h2>⚠️ اللعبة دي محتاجة السيرفر</h2>
      <p>على الكمبيوتر، افتح فولدر اللعبة وشغّل:</p><pre dir="ltr">python server.py</pre>
      <p>وبعدين افتح الرابط اللي هيظهر من كل موبايل (لازم كلكم على نفس الواي فاي).</p></section>` : "";
    return `<div class="hero" style="--gc:${this.color}"><span class="ic">${this.icon}</span><h1>${this.title}</h1><p>${this.desc}</p></div>
    ${noServer}
    <section class="panel"><h2>انت مين؟</h2>
      <label class="field">اسمك<input type="text" id="bname" maxlength="20" autocomplete="nickname" value="${esc(localStorage.getItem("lamma-name") || "")}"></label>
      <div class="avgrid" role="radiogroup" aria-label="اختار شكلك">${avs}</div></section>
    <section class="panel"><h2>ادخل أوضة موجودة</h2>
      <div class="row"><input type="text" id="bcode" maxlength="4" placeholder="الكود" dir="ltr" autocapitalize="characters" aria-label="كود الأوضة">
      <button onclick="G('bluff').join()">ادخل</button></div></section>
    <section class="panel"><h2>أو اعمل أوضة جديدة</h2>
      <div class="chips"><label class="chip"><input type="radio" name="bmode" value="facts" checked> 🧠 معلومات غريبة</label>
      <label class="chip"><input type="radio" name="bmode" value="people"> 😂 أسئلة عن اللاعيبة</label></div>
      ${numField("brounds", "عدد الجولات", 5, 3, 10)}
      <button class="primary" onclick="G('bluff').create()">اعمل أوضة ✨</button></section>
    <section class="panel"><h2>إزاي بتتلعب</h2><ol class="steps">
      <li>يظهر سؤال لكل الناس، وكل واحد يكتب إجابة <b>غلط</b> بس مقنعة.</li>
      <li>الإجابات كلها تظهر مخلوطة مع الإجابة الصح.</li>
      <li>اختار اللي انت شايفها صح: لو صح تاخد <b>نقطتين</b>، وكل واحد يختار كدبتك تاخد <b>نقطة</b>.</li>
      <li>في «أسئلة عن اللاعيبة» مفيش إجابة صح: اختار أظرف إجابة، وكل صوت بنقطة لصاحبها.</li></ol></section>`;
  },

  who() {
    const name = ($("#bname").value || "").trim();
    if (!name) { toast("اكتب اسمك الأول"); return null; }
    try { localStorage.setItem("lamma-name", name); } catch (e) { }
    return { name, avatar: (document.querySelector("input[name=bav]:checked") || {}).value || "⭐" };
  },
  async create() {
    const w = this.who(); if (!w || this.busy) return;
    const mode = document.querySelector("input[name=bmode]:checked").value;
    await this.enter(() => this.api("create", { ...w, mode, rounds: clamp($("#brounds").value, 3, 10, 5) }));
  },
  async join() {
    const w = this.who(); if (!w || this.busy) return;
    const code = ($("#bcode").value || "").trim().toUpperCase();
    if (code.length !== 4) return toast("الكود 4 حروف");
    await this.enter(() => this.api("join", { ...w, code }));
  },
  async enter(fn) {
    this.busy = true;
    try { const r = await fn(); this.setSess(r); this.state = null; this.ver = -1; route(); }
    catch (e) { toast(e.message === "NO_SERVER" ? "السيرفر مش شغّال" : e.message); }
    finally { this.busy = false; }
  },

  startPoll() {
    if (this.poll) return;
    const tick = async () => {
      const s = this.sess(); if (!s) return this.stop();
      try {
        const st = await this.api(`state?code=${encodeURIComponent(s.code)}&token=${encodeURIComponent(s.token)}`);
        this.offline = false;
        if (st.ver !== this.ver || !this.state) { this.prev = this.state; this.state = st; this.ver = st.ver; this.onChange(); this.paint(); }
      } catch (e) {
        if (e.message === "ROOM_GONE") { toast("الأوضة دي اتقفلت"); this.leave(true); }
        else if (!this.offline) { this.offline = true; toast("الاتصال بالسيرفر وقع، بحاول تاني…"); }
      }
    };
    tick(); this.poll = setInterval(tick, 1200);
  },
  stop() { clearInterval(this.poll); this.poll = null; },
  onExit() { this.stop(); },
  onChange() {
    const a = this.prev, b = this.state; if (!a || a.phase === b.phase) return;
    if (b.phase === "write") { this.draft = ""; Sound.flip(); buzz(40); }
    if (b.phase === "vote") { Sound.flip(); buzz(40); }
    if (b.phase === "reveal") { (b.gains[b.me] || 0) > 0 ? Sound.ok() : Sound.bad(); }
    if (b.phase === "end") { Sound.win(); confetti(); }
  },
  leave(force) {
    if (!force && !confirm("عايز تخرج من الأوضة؟")) return;
    this.stop(); this.setSess(null); this.state = null; this.ver = -1; route();
  },
  async act(type, extra = {}) {
    if (this.busy) return;
    const s = this.sess(); this.busy = true;
    try {
      const st = await this.api("act", { code: s.code, token: s.token, type, ...extra });
      this.prev = this.state; this.state = st; this.ver = st.ver; this.onChange(); this.paint();
    } catch (e) { toast(e.message); }
    finally { this.busy = false; }
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
  people(s, mark) {
    return `<ul class="plist">${s.players.map(p => `<li class="${mark && p.done ? "done" : ""}">${avatar(p, "sm")}<span>${esc(p.name)}${p.id === s.host ? " 👑" : ""}</span>
      ${mark ? `<b>${p.done ? "✓" : "…"}</b>` : `<b>${AR(p.score)}</b>`}</li>`).join("")}</ul>`;
  },
  hostSkip(s, host) {
    return host ? `<button class="ghost" onclick="G('bluff').act('skip')">كمّل من غير اللي متأخرين ⏭</button>` : "";
  },

  lobby(s, host) {
    const url = location.origin + location.pathname + "#/play/bluff";
    return `<section class="panel center"><p>قول للناس يفتحوا</p><p class="url" dir="ltr">${esc(url)}</p>
      <p>ويدخلوا بالكود</p><div class="code" dir="ltr">${esc(s.code)}</div>
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
