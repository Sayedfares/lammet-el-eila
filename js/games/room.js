// ===== أساس ألعاب الأوضة (كل واحد بموبايله) =====
// أي لعبة أوضة بتعمل: GAMES.x = { ...RoomBase, id, title, icon, color, desc, tag, createForm(), how(), view(), onChange() }
// وبتنادي this.enter(() => this.api("create", {...})) من create(). محتاجة السيرفر (server.py).
const RoomBase = {
  state: null, ver: -1, poll: null, busy: false, server: null, at: 0, ui: null,

  sess() { try { return JSON.parse(localStorage.getItem("lamma-" + this.id)); } catch (e) { return null; } },
  setSess(s) { try { s ? localStorage.setItem("lamma-" + this.id, JSON.stringify(s)) : localStorage.removeItem("lamma-" + this.id); } catch (e) { } },

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
    this.afterPaint();
    if (this.tickUI && !this.ui) this.ui = setInterval(() => this.tickUI(), 500);
  },
  paint() {
    if (this.root && location.hash.startsWith("#/play/" + this.id)) this.render(this.root);
  },
  afterPaint() { if (this.tickUI) this.tickUI(); },
  // ثواني متبقية من قيمة جت من السيرفر وقت آخر تحديث (للعدّادات اللي بتتحدّث من غير رسم تاني)
  left(sec) { return Math.max(0, Math.ceil(sec - (Date.now() - this.at) / 1000)); },
  clock(sec) { const l = this.left(sec); return `${AR(Math.floor(l / 60))}:${AR(l % 60).padStart(2, "٠")}`; },

  entryView() {
    const avs = AVATARS.map((a, i) => `<label class="avpick"><input type="radio" name="rav" value="${a}" ${i === rand(4) ? "checked" : ""}><span>${a}</span></label>`).join("");
    const noServer = this.server === false ? `<section class="panel warn"><h2>⚠️ اللعبة دي محتاجة السيرفر</h2>
      <p>على الكمبيوتر، افتح فولدر اللعبة وشغّل:</p><pre dir="ltr">python server.py</pre>
      <p>وبعدين افتح الرابط اللي هيظهر من كل موبايل (لازم كلكم على نفس الواي فاي).</p></section>` : "";
    return `<div class="hero" style="--gc:${this.color}"><span class="ic">${this.icon}</span><h1>${this.title}</h1><p>${this.desc}</p></div>
    ${noServer}
    <section class="panel"><h2>انت مين؟</h2>
      <label class="field">اسمك<input type="text" id="rname" maxlength="20" autocomplete="nickname" value="${esc(localStorage.getItem("lamma-name") || "")}"></label>
      <div class="avgrid" role="radiogroup" aria-label="اختار شكلك">${avs}</div></section>
    <section class="panel"><h2>ادخل أوضة موجودة</h2>
      <div class="row"><input type="text" id="rcode" maxlength="4" placeholder="الكود" dir="ltr" autocapitalize="characters" aria-label="كود الأوضة">
      <button onclick="G('${this.id}').join()">ادخل</button></div></section>
    <section class="panel"><h2>أو اعمل أوضة جديدة</h2>${this.createForm()}
      <button class="primary" onclick="G('${this.id}').create()">اعمل أوضة ✨</button></section>
    <section class="panel"><h2>إزاي بتتلعب</h2>${this.how()}</section>`;
  },

  who() {
    const name = ($("#rname").value || "").trim();
    if (!name) { toast("اكتب اسمك الأول"); return null; }
    try { localStorage.setItem("lamma-name", name); } catch (e) { }
    return { name, avatar: (document.querySelector("input[name=rav]:checked") || {}).value || "⭐" };
  },
  async join() {
    const w = this.who(); if (!w || this.busy) return;
    const code = ($("#rcode").value || "").trim().toUpperCase();
    if (code.length !== 4) return toast("الكود 4 حروف");
    await this.enter(() => this.api("join", { ...w, code, game: this.id }));
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
        if (st.game !== this.id) { toast("الأوضة دي بتاعت لعبة تانية"); return this.leave(true); }
        if (st.ver !== this.ver || !this.state) { this.at = Date.now(); this.prev = this.state; this.state = st; this.ver = st.ver; this.onChange(); this.paint(); }
      } catch (e) {
        if (e.message === "ROOM_GONE") { toast("الأوضة دي اتقفلت"); this.leave(true); }
        else if (!this.offline) { this.offline = true; toast("الاتصال بالسيرفر وقع، بحاول تاني…"); }
      }
    };
    tick(); this.poll = setInterval(tick, 1200);
  },
  stop() { clearInterval(this.poll); this.poll = null; },
  onExit() { this.stop(); clearInterval(this.ui); this.ui = null; },
  leave(force) {
    if (!force && !confirm("عايز تخرج من الأوضة؟")) return;
    this.stop(); this.setSess(null); this.state = null; this.ver = -1; route();
  },
  async act(type, extra = {}) {
    if (this.busy) return;
    const s = this.sess(); this.busy = true;
    try {
      const st = await this.api("act", { code: s.code, token: s.token, type, ...extra });
      this.at = Date.now(); this.prev = this.state; this.state = st; this.ver = st.ver; this.onChange(); this.paint();
    } catch (e) { toast(e.message); }
    finally { this.busy = false; }
  },

  // قايمة اللاعيبة؛ mark = علامة ✓ لمين خلّص، وإلا بتعرض النقط
  people(s, mark) {
    return `<ul class="plist">${s.players.map(p => `<li class="${mark && p.done ? "done" : ""}">${avatar(p, "sm")}<span>${esc(p.name)}${p.id === s.host ? " 👑" : ""}</span>
      ${mark ? `<b>${p.done ? "✓" : "…"}</b>` : `<b>${AR(p.score)}</b>`}</li>`).join("")}</ul>`;
  },
  // سطر إعداد بأزرار + و−؛ صاحب الأوضة بس هو اللي بيشوف الأزرار (بينادي this.set(key, ±1))
  stepper(label, key, shown, host) {
    return `<div class="stepper"><span>${label}</span>${host ? `<button class="small" aria-label="أقل" onclick="G('${this.id}').set('${key}',-1)">−</button>` : ""}
      <b>${shown}</b>${host ? `<button class="small" aria-label="أكتر" onclick="G('${this.id}').set('${key}',1)">+</button>` : ""}</div>`;
  },
  lobbyInfo(s) {
    const url = location.origin + location.pathname + "#/play/" + this.id;
    return `<p>قول للناس يفتحوا</p><p class="url" dir="ltr">${esc(url)}</p>
      <p>ويدخلوا بالكود</p><div class="code" dir="ltr">${esc(s.code)}</div>`;
  }
};
