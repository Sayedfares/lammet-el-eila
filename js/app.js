// ===== التطبيق: المكتبة، الفرق، أسئلة العيلة، والتنقّل =====
const ORDER = ["lamma", "tf", "heads", "proverbs", "emoji", "bluff"];

function soundBtn() {
  return `<button class="icon" onclick="S.prefs.sound=!S.prefs.sound;save();route()" aria-label="${S.prefs.sound ? "اقفل الصوت" : "شغّل الصوت"}">${S.prefs.sound ? "🔊" : "🔇"}</button>`;
}

function homeView(root) {
  const m = S.match, p = S.prefs;
  const resume = m && !m.over && GAMES[m.game] ? `<a class="resume" href="#/play/${m.game}">▶ كمّل «${esc(GAMES[m.game].title)}»</a>` : "";
  root.innerHTML = `
  <header class="top"><h1 class="logo">لمّة العيلة <span>🎉</span></h1>${soundBtn()}</header>
  <p class="sub">مكتبة ألعاب للعيلة في التجمّعات</p>
  ${resume}
  <section class="panel"><div class="panelhead"><h2>الفرق</h2><a class="link" href="#/teams">عدّل</a></div>
    <div class="teamline">${S.teams.map(t => `<span class="tchip">${avatar(t, "sm")}${esc(t.name)}</span>`).join("")}</div></section>
  <div class="games">${ORDER.map(id => { const g = GAMES[id]; return `<a class="game" href="#/play/${id}" style="--gc:${g.color}">
    <span class="ic">${g.icon}</span><b>${esc(g.title)}</b><span class="d">${esc(g.desc)}</span><span class="tg">${esc(g.tag)}</span></a>`; }).join("")}</div>
  <section class="panel"><h2>المستوى</h2><div class="chips">
    ${[["k", "👶 أطفال"], ["a", "🧑 كبار"], ["mix", "👨‍👩‍👧 الكل"]].map(([v, l]) =>
      `<label class="chip"><input type="radio" name="lv" ${p.level === v ? "checked" : ""} onchange="S.prefs.level='${v}';save()"> ${l}</label>`).join("")}</div>
    <h2 class="mt">الباقات</h2><div class="chips">
    ${Object.entries({ g: "📚 عام", rm: "🌙 رمضان", eid: "🎈 العيد", sm: "🏖️ الصيف" }).map(([k, l]) =>
      `<label class="chip"><input type="checkbox" ${p.packs[k] ? "checked" : ""} onchange="S.prefs.packs.${k}=this.checked;save()"> ${l}</label>`).join("")}</div>
    <p class="note">المستوى والباقات بيأثّروا على الأسئلة والتحديات والفوازير.</p></section>
  <a class="panel familylink" href="#/family"><span class="ic">👨‍👩‍👧</span><span><b>أسئلة عن العيلة</b>
    <small>${S.family.length ? `عندك ${AR(S.family.length)} سؤال` : "اكتب أسئلة عن عيلتك تظهر في «لمّة العيلة»"}</small></span><span>◀</span></a>`;
}

function teamsView(root) {
  root.innerHTML = `
  <header class="top"><a class="backlink" href="#/"><span aria-hidden="true">→</span> رجوع</a><h1>الفرق</h1>${soundBtn()}</header>
  ${S.teams.map((t, i) => `<section class="panel team">
    <details class="avbox"><summary aria-label="غيّر شكل الفريق">${avatar(t, "lg")}</summary>
      <div class="avgrid">${AVATARS.map(a => `<button type="button" class="${!t.photo && t.avatar === a ? "sel" : ""}" onclick="setAvatar(${i},'${a}')">${a}</button>`).join("")}</div>
      <div class="row"><label class="btn small">📷 صورة<input type="file" accept="image/*" hidden onchange="setPhoto(${i},this.files[0])"></label>
      ${t.photo ? `<button class="small" onclick="setAvatar(${i},'${esc(t.avatar)}')">شيل الصورة</button>` : ""}</div>
    </details>
    <input type="text" value="${esc(t.name)}" maxlength="20" aria-label="اسم الفريق ${AR(i + 1)}" oninput="S.teams[${i}].name=this.value;save()" onblur="fixName(${i})">
    <button class="icon" aria-label="امسح الفريق" onclick="removeTeam(${i})" ${S.teams.length <= 2 ? "disabled" : ""}>✕</button>
  </section>`).join("")}
  <button class="ghost" onclick="addTeam()" ${S.teams.length >= 8 ? "disabled" : ""}>+ فريق جديد</button>
  <p class="note">لو بتلعبوا أفراد مش فرق، اعمل فريق لكل واحد. تغيير عدد الفرق بيلغي اللعبة الشغّالة.</p>
  <a class="primary btn" href="#/">تمام ✓</a>`;
}
function fixName(i) { if (!S.teams[i].name.trim()) { S.teams[i].name = "فريق " + AR(i + 1); save(); route(); } }
function addTeam() { S.teams.push({ name: "فريق " + AR(S.teams.length + 1), avatar: AVATARS[S.teams.length % AVATARS.length], photo: null }); S.match = null; save(); route(); }
function removeTeam(i) { S.teams.splice(i, 1); S.match = null; save(); route(); }
function setAvatar(i, a) { S.teams[i].avatar = a; S.teams[i].photo = null; save(); route(); }
async function setPhoto(i, f) {
  try { S.teams[i].photo = await readPhoto(f); save(); route(); }
  catch (e) { toast(e.message); }
}

function familyView(root) {
  root.innerHTML = `
  <header class="top"><a class="backlink" href="#/"><span aria-hidden="true">→</span> رجوع</a><h1>أسئلة عن العيلة</h1>${soundBtn()}</header>
  <p class="sub">اكتب أسئلة محدش يعرفها غير عيلتك. بتظهر في «لمّة العيلة» تحت «عن العيلة» بنقطتين.<br>متخزّنة على الجهاز ده بس.</p>
  <section class="panel"><h2>سؤال جديد</h2>
    <label class="field">السؤال<input type="text" id="fq" maxlength="120"></label>
    <label class="field">الإجابة<input type="text" id="fa" maxlength="80"></label>
    <button class="primary" onclick="addFamily()">ضيف ➕</button>
    <h2 class="mt">أفكار</h2><div class="chips">${FAMILY_SUGGEST.map((s, i) => `<button class="chip" onclick="$('#fq').value=FAMILY_SUGGEST[${i}];$('#fa').focus()">${esc(s)}</button>`).join("")}</div>
  </section>
  <section class="panel"><h2>أسئلتك (${AR(S.family.length)})</h2>
    ${S.family.length ? `<ul class="flist">${S.family.map((f, i) => `<li><div><b>${esc(f.q)}</b><small>${esc(f.a)}</small></div>
      <button class="icon" aria-label="امسح السؤال" onclick="S.family.splice(${i},1);save();route()">✕</button></li>`).join("")}</ul>` : `<p class="note">لسه مفيش أسئلة.</p>`}
  </section>`;
}
function addFamily() {
  const q = $("#fq").value.trim(), a = $("#fa").value.trim();
  if (!q || !a) return toast("اكتب السؤال والإجابة");
  S.family.push({ q, a }); S.prefs.lamma.f = true; save(); route(); toast("اتضاف ✓");
}

function route() {
  const root = $("#app");
  const [, a = "", b = ""] = (location.hash || "#/").split("/");
  if (a === "play" && GAMES[b]) {
    const g = GAMES[b];
    root.innerHTML = `<header class="top"><a class="backlink" href="#/"><span aria-hidden="true">→</span> المكتبة</a><span class="gt">${g.icon} ${esc(g.title)}</span>${soundBtn()}</header><div id="stage"></div>`;
    g.render($("#stage"));
  } else if (a === "teams") teamsView(root);
  else if (a === "family") familyView(root);
  else homeView(root);
}

window.addEventListener("hashchange", () => {
  Timer.stop(); Timer.owner = null;
  Object.values(GAMES).forEach(g => g.onExit && g.onExit());
  route(); window.scrollTo(0, 0);
});
route();
