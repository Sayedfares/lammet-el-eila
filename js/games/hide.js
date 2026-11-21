// ===== اتخبّى واتنكّر — زي هايد أونلاين، في أوضتكم الحقيقية =====
// المخبّي بيتحوّل لأي حاجة موجودة في الأوضة (مروحة، أكل، كنبة…) ويقف جنبها أو يقلّدها،
// والباحثين بيلفّوا ويخمّنوا: «فلان ده مروحة». تخمين صح = اتلقى، غلط = عقاب ثواني.
// القواعد على السيرفر (server.py → HideRoom)؛ هنا الشاشات بس.
GAMES.hide = {
  ...RoomBase,
  id: "hide", title: "اتخبّى واتنكّر", icon: "🎭", color: "#0e8fa0",
  desc: "اتحوّل لأي حاجة في الأوضة واستخبّى فيها، والباحثين يخمّنوا انت مين. زي هايد أونلاين.",
  tag: "كل واحد بموبايله · ٢ لاعيبة أو أكتر",
  target: null,

  createForm() { return `<p class="note">عدد الباحثين وزمن الاستخباء والبحث بتختاروه جوه الأوضة قبل ما تبدأوا.</p>`; },
  how() {
    return `<ol class="steps">
      <li>السيرفر بيختار الباحثين (واحد أو أكتر حسب اختيارك) والباقي مخبّيين. الكل يعرف مين الباحثين.</li>
      <li>المخبّيين يختاروا من موبايلاتهم <b>حاجة موجودة فعلًا في الأوضة</b> ويروحوا يقفوا جنبها أو يقلّدوها من غير حركة. الباحثين يغمّضوا لحد ما الوقت يخلص.</li>
      <li>الباحثين يلفّوا ويخمّنوا: يختاروا اللاعب وبعدين الحاجة. تخمين صح = اللاعب اتلقى. غلط = عقاب ${AR(15)} ثانية.</li>
      <li>المخبّي يقدر يتحوّل لحاجة تانية كل ${AR(20)} ثانية وقت البحث.</li>
      <li>المخبّيين يكسبوا لو واحد منهم فضل مستخبّي لحد ما الوقت يخلص، والباحثين يكسبوا لو لقوا الكل.</li></ol>`;
  },
  async create() {
    const w = this.who(); if (!w || this.busy) return;
    await this.enter(() => this.api("create", { ...w, game: "hide" }));
  },

  onChange() {
    const a = this.prev, b = this.state; if (!a) return;
    if (a.phase !== b.phase) {
      this.target = null;
      if (b.phase === "seek") { Sound.flip(); buzz([100, 60, 100]); }
      if (b.phase === "end") { (b.winner === "seekers") === (b.role === "seeker") ? (Sound.win(), confetti()) : Sound.bad(); }
      return;
    }
    if (b.found.length > a.found.length) {
      const f = b.found[b.found.length - 1];
      toast(`🎯 ${this.nm(f.id)} اتلقى، كان ${f.obj}!`);
      f.id === b.me ? (Sound.bad(), buzz(400)) : Sound.ok();
      this.target = null;
    } else if (b.wrong > a.wrong) { Sound.bad(); buzz(200); toast(`غلط! استنى ${AR(15)} ثانية`); }
  },

  tickUI() {
    const s = this.state; if (!s) return;
    const mt = $("#mt");
    if (mt && s.left != null) mt.textContent = this.clock(s.left);
    if (s.lock != null) {
      const l = this.left(s.lock), t = $("#lockt");
      document.querySelectorAll("#guess button").forEach(b => b.disabled = l > 0);
      if (t) t.textContent = l > 0 ? `🚫 معاقب ${AR(l)} ث` : "";
    }
    if (s.switch != null) {
      const l = this.left(s.switch), t = $("#swt");
      document.querySelectorAll("#swgrid button").forEach(b => b.disabled = l > 0);
      if (t) t.textContent = l > 0 ? `تقدر تتحوّل تاني بعد ${AR(l)} ث` : "اختار حاجة جديدة لو عايز تتحوّل";
    }
  },

  // ===== مساعدات =====
  pl(id) { return this.state.players.find(p => p.id === id); },
  nm(id) { const p = this.pl(id); return p ? p.name : "؟"; },
  set(key, d) {
    const st = this.state.settings;
    const next = { seekers: st.seekers, hide: st.hide, seek: st.seek };
    if (key === "seekers") next.seekers = clamp(st.seekers + d, 1, st.smax, st.seekers);
    else { const list = st[key + "s"]; next[key] = list[clamp(list.indexOf(st[key]) + d, 0, list.length - 1, 0)]; }
    this.act("settings", next);
  },
  choose(obj) { this.act("disguise", { obj }); },
  pickTarget(id) { this.target = id; this.paint(); },
  guess(obj) { this.act("guess", { target: this.target, obj }); },
  mmss: sec => `${AR(Math.floor(sec / 60))} دقيقة${sec % 60 ? " و" + AR(sec % 60) + " ثانية" : ""}`,
  grid(s, fn, sel, id) {
    return `<div class="objgrid" id="${id}">${s.objects.map((o, i) => `<button class="${sel === i ? "sel" : ""}" onclick="G('hide').${fn}(${i})">${esc(o)}</button>`).join("")}</div>`;
  },
  crew(s) {
    return `<ul class="plist">${s.players.map(p => `<li class="${p.out ? "out" : ""}">${avatar(p, "sm")}<span>${esc(p.name)}${p.id === s.host ? " 👑" : ""}${p.out ? " 🎯" : ""}</span>
      <b>${p.team === "seeker" ? "🔎 باحث" : "🎭 مخبّي"}</b></li>`).join("")}</ul>`;
  },

  // ===== الشاشات =====
  view() {
    const s = this.state, me = this.pl(s.me);
    const head = `<div class="roomhead"><span>أوضة <b dir="ltr">${esc(s.code)}</b></span>
      <span>${avatar(me, "sm")} ${esc(me ? me.name : "")}</span></div>`;
    return head + this[s.phase](s, s.host === s.me) + `<button class="ghost" onclick="G('hide').leave()">اخرج من الأوضة</button>`;
  },

  lobby(s, host) {
    const st = s.settings, enough = s.players.length >= st.min;
    return `<section class="panel center">${this.lobbyInfo(s)}</section>
    <section class="panel"><h2>اللاعيبة (${AR(s.players.length)})</h2><ul class="plist">${s.players.map(p =>
      `<li>${avatar(p, "sm")}<span>${esc(p.name)}${p.id === s.host ? " 👑" : ""}</span></li>`).join("")}</ul>
      ${enough ? "" : `<p class="note">محتاجين ${AR(st.min)} لاعيبة على الأقل.</p>`}</section>
    <section class="panel"><h2>نمط اللعب${host ? "" : " (صاحب الأوضة بيختاره)"}</h2>
      ${this.stepper("عدد الباحثين 🔎", "seekers", AR(st.seekers), host)}
      ${this.stepper("وقت الاستخباء", "hide", AR(st.hide) + " ثانية", host)}
      ${this.stepper("وقت البحث", "seek", this.mmss(st.seek), host)}
      <p class="note">${AR(st.seekers)} باحث ضد ${AR(Math.max(0, s.players.length - st.seekers))} مخبّي.${st.seekers > st.smax ? " عدد الباحثين كتير على عدد اللاعيبة!" : ""}</p></section>
    ${host ? `<button class="primary" ${enough && st.seekers <= st.smax ? "" : "disabled"} onclick="G('hide').act('start')">ابدأ اللعبة ▶</button>` : `<p class="sub">مستنيين صاحب الأوضة يبدأ…</p>`}`;
  },

  hide(s, host) {
    const hider = s.role === "hider";
    const body = hider
      ? `<div class="prompt teal">🎭 اتنكّر!<br><small>اختار حاجة <b>موجودة فعلًا في الأوضة</b>، وروح وقف جنبها أو قلّدها من غير حركة.</small></div>
        <p class="lead center">${s.mine != null ? `انت دلوقتي: <b>${esc(s.objects[s.mine])}</b>` : "لسه ما اخترتش"}</p>${this.grid(s, "choose", s.mine, "hgrid")}`
      : `<div class="prompt teal">🙈 غمّض عينك!<br><small>المخبّيين بيتنكّروا دلوقتي. متبصّش.</small></div>`;
    return `${body}<div class="clock" id="mt" role="timer"></div>
    <section class="panel"><h2>اللاعيبة</h2>${this.crew(s)}</section>
    ${host ? `<button class="ghost" onclick="G('hide').act('skip')">ابدأ البحث دلوقتي ⏭</button>` : ""}`;
  },

  found(s) {
    return s.found.length ? `<section class="panel"><h2>اللي اتلقوا</h2><ul class="plist">${s.found.map(f =>
      `<li><span>${esc(this.nm(f.id))} — كان ${esc(f.obj)}</span><b>🔎 ${esc(this.nm(f.by))}</b></li>`).join("")}</ul></section>` : "";
  },

  seek(s) {
    const clock = `<div class="clock" id="mt" role="timer"></div><p class="sub">فاضل ${AR(s.remaining)} مخبّي</p>`;
    if (s.role === "hider") {
      return s.out
        ? `<div class="prompt teal">🎯 اتلقيت!<br><small>اقعد متفرّج، ومتقولش لحد على اللي لسه مستخبّيين.</small></div>${clock}${this.found(s)}`
        : `<div class="prompt teal">🎭 انت دلوقتي: ${esc(s.objects[s.mine])}<br><small>اثبت مكانك ومتتحركش.</small></div>${clock}
          <section class="panel"><h2>تتحوّل لحاجة تانية؟</h2><p class="note" id="swt"></p>${this.grid(s, "choose", s.mine, "swgrid")}</section>${this.found(s)}`;
    }
    const targets = s.players.filter(p => p.team === "hider" && !p.out);
    const t = this.target && targets.find(p => p.id === this.target);
    return `<div class="prompt teal">🔎 دوّر عليهم!<br><small>${t ? `انت بتخمّن ${esc(t.name)}: هو بيتنكّر في إيه؟` : "اختار اللاعيب اللي شاكك فيه"}</small></div>${clock}
      <section class="panel" id="guess"><p class="lead center" id="lockt"></p>
        ${t ? `${this.grid(s, "guess", -1, "ggrid")}<button class="ghost" onclick="G('hide').pickTarget(null)">غيّر اللاعيب</button>`
          : `<div class="pickgrid">${targets.map(p => `<button onclick="G('hide').pickTarget('${p.id}')">${avatar(p, "sm")} ${esc(p.name)}</button>`).join("")}</div>`}</section>
      ${this.found(s)}`;
  },

  end(s, host) {
    const seekers = s.winner === "seekers", won = seekers === (s.role === "seeker");
    const hiders = s.players.filter(p => p.team === "hider");
    return `<div class="end"><div class="trophy">${seekers ? "🔎" : "🎭"}</div><h1>${seekers ? "الباحثين كسبوا!" : "المخبّيين كسبوا!"}</h1>
    <p class="lead">${won ? "مبروك، انت في الفريق الكسبان 🎉" : "حظ أوفر المرة الجاية 😅"}</p>
    <section class="panel"><h2>كانوا إيه</h2><ul class="plist">${hiders.map(p => `<li class="${p.out ? "out" : ""}">${avatar(p, "sm")}
      <span>${esc(p.name)}</span><b>${esc(s.reveal[p.id] || "؟")} ${p.out ? "🎯" : "✅"}</b></li>`).join("")}</ul>
      <p class="note">🎯 اتلقى · ✅ فضل مستخبّي</p></section>
    ${host ? `<button class="primary" onclick="G('hide').act('again')">نلعب تاني ↻</button>` : `<p class="sub">صاحب الأوضة يقدر يبدأ تاني</p>`}</div>`;
  }
};
