// ===== مين القاتل؟ — زي أمونج أس، كل واحد بموبايله وانتوا بتتحركوا في البيت =====
// البريئين بيخلّصوا مهام على الموبايل، والقتلة بيقتلوا من غير ما حد يشوفهم.
// لو حد لقى جثة (أو ضغط اجتماع طارئ) الكل بيتجمّع ويتكلّم ويصوّت على مين يتطرد.
// القواعد كلها على السيرفر (server.py → KillerRoom)؛ هنا الشاشات والمهام الصغيرة بس.
const KTASKS = [
  { t: "اشحن الموبايل", k: "hold" }, { t: "ظبّط الكهربا", k: "seq" }, { t: "اكتب كود الواي فاي", k: "code" },
  { t: "اغسل الأطباق", k: "hold" }, { t: "رتّب الأوراق", k: "seq" }, { t: "افتح الخزنة", k: "code" },
  { t: "املا كوباية الشاي", k: "hold" }, { t: "شغّل التكييف", k: "seq" }, { t: "سجّل الحضور", k: "code" }
];

GAMES.killer = {
  ...RoomBase,
  id: "killer", title: "مين القاتل؟", icon: "🔪", color: "#c0392b",
  desc: "زي أمونج أس: فيكم قاتل أو أكتر وسط البريئين. خلّصوا المهام، واكشفوا القاتل قبل ما يخلّص عليكم.",
  tag: "كل واحد بموبايله · ٤ لاعيبة أو أكتر",
  show: false, pick: null,

  createForm() { return `<p class="note">عدد القتلة والمهام وزمن النقاش بتختاروه جوه الأوضة قبل ما تبدأوا.</p>`; },
  how() {
    return `<ol class="steps">
      <li>كل واحد بيعرف دوره على موبايله <b>لوحده</b>: بريء 🧑 أو قاتل 🔪. القتلة بيعرفوا بعض.</li>
      <li>اتحركوا في البيت. البريء يخلّص مهامه (حتى بعد ما يموت)، والقاتل يمثّل إنه بيخلّص مهام.</li>
      <li>القاتل يقرّب من حد ويضغط «اقتل». اللي اتقتل يفضل <b>مكانه</b> لحد ما حد يلاقيه ويبلّغ.</li>
      <li>أي حد يلاقي جثة يضغط «بلّغ»، أو يضغط «اجتماع طارئ» (مرة واحدة). الكل يتجمّع ويتناقش ويصوّت.</li>
      <li>اللي أغلبية الأصوات تختاره يتطرد. البريئين يكسبوا لو خلّصوا كل المهام أو طردوا كل القتلة، والقتلة يكسبوا لما يبقوا بعدد البريئين.</li></ol>`;
  },
  async create() {
    const w = this.who(); if (!w || this.busy) return;
    await this.enter(() => this.api("create", { ...w, game: "killer" }));
  },

  onExit() { RoomBase.onExit.call(this); this.closeTask(); },

  onChange() {
    const a = this.prev, b = this.state; if (!a) return;
    if (a.phase === b.phase) {
      if (a.alive && !b.alive) { Sound.bad(); buzz(500); }
      return;
    }
    this.closeTask(); this.pick = null;
    if (b.phase === "play") this.show = false;
    if (b.phase === "talk") { Sound.bad(); buzz([200, 100, 200, 100, 400]); }
    if (b.phase === "vote" || b.phase === "result") { Sound.flip(); buzz(60); }
    if (b.phase === "end") {
      (b.winner === "crew") === (b.role === "crew") ? (Sound.win(), confetti()) : Sound.bad();
    }
  },

  // ===== عدّادات بتتحدّث من غير ما نرسم الشاشة تاني =====
  tickUI() {
    const s = this.state; if (!s) return;
    const mt = $("#mt");
    if (mt && s.left != null) mt.textContent = this.clock(s.left);
    const kb = $("#killbtn");
    if (kb && s.cd != null) {
      const l = this.left(s.cd);
      kb.disabled = l > 0;
      kb.textContent = l > 0 ? `🔪 جاهز بعد ${AR(l)} ث` : "🔪 اقتل";
    }
  },

  // ===== مساعدات =====
  pl(id) { return this.state.players.find(p => p.id === id); },
  nm(id) { const p = this.pl(id); return p ? p.name : "؟"; },
  toggle() { this.show = !this.show; this.pick = null; this.paint(); },
  setPick(k) { this.pick = k; this.paint(); },
  kill(id) { this.pick = null; this.act("kill", { target: id }); },
  report(id) { this.pick = null; this.act("report", id ? { body: id } : {}); },
  emergency() { if (confirm("تنادي اجتماع طارئ؟ ليك مرة واحدة بس.")) this.report(null); },
  castVote(t) { this.act("vote", { target: t }); },
  set(key, d) {
    const st = this.state.settings, talks = st.talks;
    const next = { killers: st.killers, tasks: st.tasks, talk: st.talk };
    if (key === "talk") next.talk = talks[clamp(talks.indexOf(st.talk) + d, 0, talks.length - 1, 0)];
    else next[key] = clamp(st[key] + d, 1, key === "killers" ? st.kmax : 5, st[key]);
    this.act("settings", next);
  },

  // ===== الشاشات =====
  view() {
    const s = this.state, me = this.pl(s.me);
    const head = `<div class="roomhead"><span>أوضة <b dir="ltr">${esc(s.code)}</b></span>
      <span>${avatar(me, "sm")} ${esc(me ? me.name : "")}</span></div>`;
    return head + this[s.phase](s, s.host === s.me) + `<button class="ghost" onclick="G('killer').leave()">اخرج من الأوضة</button>`;
  },
  plist(s, ids, extra) {
    return `<ul class="plist">${ids.map(id => { const p = this.pl(id);
      return `<li class="${p.alive === false ? "out" : ""}">${avatar(p, "sm")}<span>${esc(p.name)}${id === s.host ? " 👑" : ""}${p.alive === false ? " 💀" : ""}</span>${extra ? extra(p) : ""}</li>`; }).join("")}</ul>`;
  },
  lobby(s, host) {
    const st = s.settings, enough = s.players.length >= st.min;
    return `<section class="panel center">${this.lobbyInfo(s)}</section>
    <section class="panel"><h2>اللاعيبة (${AR(s.players.length)})</h2>${this.plist(s, s.players.map(p => p.id))}
      ${enough ? "" : `<p class="note">محتاجين ${AR(st.min)} لاعيبة على الأقل.</p>`}</section>
    <section class="panel"><h2>الإعدادات${host ? "" : " (صاحب الأوضة بيختارها)"}</h2>
      ${this.stepper("عدد القتلة 🔪", "killers", AR(st.killers), host)}
      ${this.stepper("مهام كل واحد", "tasks", AR(st.tasks), host)}
      ${this.stepper("زمن النقاش", "talk", AR(st.talk) + " ثانية", host)}
      <p class="note">أقصى عدد قتلة مع ${AR(s.players.length)} لاعيبة: ${AR(st.kmax)}.</p></section>
    ${host ? `<button class="primary" ${enough ? "" : "disabled"} onclick="G('killer').act('start')">ابدأ اللعبة ▶</button>` : `<p class="sub">مستنيين صاحب الأوضة يبدأ…</p>`}`;
  },

  picker(s, ids, title, fn) {
    return `<section class="panel"><h2>${title}</h2><div class="pickgrid">${ids.map(id => { const p = this.pl(id);
      return `<button onclick="G('killer').${fn}('${id}')">${avatar(p, "sm")} ${esc(p.name)}</button>`; }).join("")}</div>
      <button class="ghost" onclick="G('killer').setPick(null)">إلغاء</button></section>`;
  },

  play(s) {
    const killer = s.role === "killer", others = s.players.filter(p => p.id !== s.me);
    const mates = others.filter(p => p.killer).map(p => p.name);
    const pct = s.progress.total ? Math.round(100 * s.progress.done / s.progress.total) : 0;
    let h = `<button class="rolecard ${this.show ? (killer ? "k" : "c") : ""}" onclick="G('killer').toggle()">${this.show
      ? (killer ? `<b>🔪 انت القاتل</b><small>${mates.length ? "شركاؤك: " + esc(mates.join("، ")) : "انت لوحدك"} · مهامك تمويه</small>`
        : `<b>🧑 انت بريء</b><small>خلّص مهامك واكشف القاتل</small>`) + `<small>اضغط عشان تخبّي</small>`
      : `<b>🙈 دورك مخفي</b><small>اضغط عشان تشوفه (بعيد عن عيون الناس)</small>`}</button>
    <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct}%"></div></div>
    <p class="sub">مهام البريئين: ${AR(s.progress.done)} من ${AR(s.progress.total)}</p>`;
    if (!s.alive) {
      h += `<section class="panel dead">${s.waiting ? `<b>💀 اتقتلت!</b><p>اقعد مكانك من غير ما تتحرك لحد ما حد يلاقيك ويبلّغ. متقولش مين قتلك.</p>`
        : `<b>👻 انت شبح</b><p>كمّل مهامك وساعد الفريق، بس من غير ما تتكلّم مع الأحياء.</p>`}</section>`;
    }
    h += `<section class="panel"><h2>مهامك</h2><div class="tasks">${s.tasks.map(t => `<button class="task ${t.done ? "done" : ""}" ${t.done ? "disabled" : ""}
      onclick="G('killer').openTask(${t.id})">${t.done ? "✅" : "🔸"} ${esc(KTASKS[t.id].t)}</button>`).join("")}</div></section>`;
    if (this.pick === "kill") h += this.picker(s, others.filter(p => p.alive && !p.killer).map(p => p.id), "تقتل مين؟ (لازم يكون جنبك)", "kill");
    else if (this.pick === "report") h += this.picker(s, others.map(p => p.id), "لقيت جثة مين؟", "report");
    else if (s.alive) {
      if (killer && this.show) h += `<button class="killbtn" id="killbtn" onclick="G('killer').setPick('kill')">🔪 اقتل</button>`;
      h += `<div class="actions"><button class="bad" onclick="G('killer').setPick('report')">🆘 بلّغ عن جثة</button>
        <button onclick="G('killer').emergency()" ${s.meetings < 1 ? "disabled" : ""}>🚨 اجتماع طارئ</button></div>`;
    }
    return h;
  },

  talk(s, host) {
    return `<div class="prompt red">🚨 ${esc(this.nm(s.caller))} ${s.reason === "body" ? "لقى جثة!" : "نادى اجتماع طارئ!"}</div>
    ${s.found && s.found.length ? `<p class="lead center">💀 ${esc(s.found.map(id => this.nm(id)).join("، "))}</p>` : ""}
    <p class="sub">اتجمّعوا وناقشوا: مين كان فين؟ مين بيتصرّف غريب؟</p>
    <div class="clock" id="mt" role="timer"></div>
    <section class="panel"><h2>الأحياء</h2>${this.plist(s, s.players.filter(p => p.alive).map(p => p.id))}</section>
    ${host ? `<button class="primary" onclick="G('killer').act('skip')">ابدأ التصويت ▶</button>` : ""}`;
  },

  vote(s, host) {
    const mine = s.myVote, alive = s.players.filter(p => p.alive);
    const can = s.alive && mine == null;
    return `<div class="prompt red">🗳️ مين القاتل؟</div><div class="clock" id="mt" role="timer"></div>
    <div class="opts">${alive.map(p => `<button class="opt ${mine === p.id ? "sel" : ""}" ${can ? "" : "disabled"} onclick="G('killer').castVote('${p.id}')">
      ${avatar(p, "sm")} ${esc(p.name)}${p.id === s.me ? " <small>(انت)</small>" : ""}</button>`).join("")}
      <button class="opt ${mine === "skip" ? "sel" : ""}" ${can ? "" : "disabled"} onclick="G('killer').castVote('skip')">⏭ تخطّي (مش متأكد)</button></div>
    <p class="sub">${!s.alive ? "الأشباح مبتصوّتش" : mine != null ? "صوتك اتسجّل، مستنيين الباقيين…" : "اختار واحد"}</p>
    <section class="panel"><h2>مين صوّت</h2>${this.plist(s, alive.map(p => p.id), p => `<b>${p.done ? "✓" : "…"}</b>`)}</section>
    ${host ? `<button class="ghost" onclick="G('killer').act('skip')">خلّص التصويت ⏭</button>` : ""}`;
  },

  result(s) {
    const e = s.ejected;
    return `<div class="prompt red center">${e ? `🚪 ${esc(this.nm(e.id))} اتطرد<br><small>${e.role === "killer" ? "كان قاتل 🔪" : "كان بريء 🧑"}</small>` : "محدش اتطرد"}</div>
    <div class="clock" id="mt" role="timer"></div>
    <section class="panel"><h2>مين اختار مين</h2><ul class="plist">${s.votes.map(r => `<li><span>${r.id === "skip" ? "⏭ تخطّي" : esc(this.nm(r.id))}</span>
      <b>${esc(r.voters.map(v => this.nm(v)).join("، "))}</b></li>`).join("") || `<li><span>محدش صوّت</span></li>`}</ul></section>
    <p class="sub">${s.over ? "اللعبة قربت تخلص…" : "هنرجع نكمّل بعد ثواني."}</p>`;
  },

  end(s, host) {
    const crew = s.winner === "crew", won = crew === (s.role === "crew");
    return `<div class="end"><div class="trophy">${crew ? "🧑" : "🔪"}</div><h1>${crew ? "البريئين كسبوا!" : "القتلة كسبوا!"}</h1>
    <p class="lead">${won ? "مبروك، انت في الفريق الكسبان 🎉" : "حظ أوفر المرة الجاية 😅"}</p>
    <section class="panel"><h2>مين كان مين</h2>${this.plist(s, s.players.map(p => p.id), p => `<b>${s.roles[p.id] === "killer" ? "🔪 قاتل" : "🧑 بريء"}</b>`)}</section>
    ${host ? `<button class="primary" onclick="G('killer').act('again')">نلعب تاني بنفس الأوضة ↻</button>` : `<p class="sub">صاحب الأوضة يقدر يبدأ تاني</p>`}</div>`;
  },

  // ===== المهام الصغيرة (بتتفتح فوق الشاشة، برّه إعادة الرسم) =====
  openTask(id) {
    this.closeTask();
    const def = KTASKS[id], box = document.createElement("div");
    box.id = "ktask"; box.className = "overlay";
    box.innerHTML = `<div class="sheet"><h2>${esc(def.t)}</h2><div id="kbody"></div><button class="ghost" id="kclose">إلغاء</button></div>`;
    document.body.appendChild(box);
    $("#kclose").onclick = () => this.closeTask();
    const done = () => { this.closeTask(); Sound.ok(); buzz(60); this.act("task", { task: id }); };
    this["task_" + def.k]($("#kbody"), done);
  },
  closeTask() { const b = $("#ktask"); if (b) b.remove(); },
  task_seq(body, done) {
    let next = 1;
    body.innerHTML = `<p class="sub">اضغط الأرقام بالترتيب من ١ لـ ٦</p><div class="seqgrid">${shuffle([1, 2, 3, 4, 5, 6]).map(n => `<button data-n="${n}">${AR(n)}</button>`).join("")}</div>`;
    body.querySelectorAll("button").forEach(b => b.onclick = () => {
      if (+b.dataset.n === next) { b.disabled = true; b.classList.add("ok"); if (++next > 6) done(); }
      else { next = 1; Sound.bad(); buzz(80); body.querySelectorAll("button").forEach(x => { x.disabled = false; x.classList.remove("ok"); }); }
    });
  },
  task_hold(body, done) {
    let t = null, v = 0;
    body.innerHTML = `<p class="sub">اضغط وفضّل ماسك لحد ما الشريط يتملي</p><div class="bar"><div id="hbar" style="width:0"></div></div>
      <button class="holdbtn" id="hbtn">✋ اضغط وامسك</button>`;
    const bar = $("#hbar"), stop = () => { clearInterval(t); t = null; v = 0; bar.style.width = "0"; };
    const btn = $("#hbtn");
    btn.onpointerdown = e => {
      e.preventDefault(); if (t) return;
      t = setInterval(() => { v += 4; bar.style.width = v + "%"; if (v >= 100) { clearInterval(t); done(); } }, 100);
    };
    ["onpointerup", "onpointerleave", "onpointercancel"].forEach(k => btn[k] = stop);
    btn.oncontextmenu = e => e.preventDefault();
  },
  task_code(body, done) {
    const code = String(1000 + rand(9000));
    body.innerHTML = `<p class="sub">اكتب الكود ده:</p><div class="code" dir="ltr">${code}</div>
      <input type="text" id="kcode" inputmode="numeric" maxlength="4" autocomplete="off" dir="ltr" aria-label="الكود"><button class="primary" id="kok">تمام</button>`;
    const go = () => $("#kcode").value.trim() === code ? done() : (Sound.bad(), toast("الكود غلط، جرّب تاني"));
    $("#kok").onclick = go;
    $("#kcode").onkeydown = e => { if (e.key === "Enter") go(); };
    $("#kcode").focus();
  }
};
