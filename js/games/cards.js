// ===== ألعاب الكروت: لمّة العيلة، كمّل المثل، فزّورة إيموجي =====
// كل لعبة فيها "فئات"؛ الفريق يختار فئة (أو يلف العجلة)، يقلب الكارت، والمقدّم يحكم صح ولا غلط.

function makeCardGame(def) {
  const id = def.id;
  const game = Object.assign({
    cat(key) { return this.cats().find(c => c.key === key) || this.cats(true).find(c => c.key === key); },

    render(root) {
      const m = S.match;
      if (!m || m.game !== id) { root.innerHTML = setupView(this, this.setupExtra ? this.setupExtra() : this.timerSetup()); return; }
      if (m.over) { root.innerHTML = endScreen(id); return; }
      const c = m.g.card;
      root.innerHTML = c && this.cat(c.key) ? this.cardView() : this.pickView();
      // لو الصفحة اتفتحت تاني والكارت مقلوب: رجّع المؤقّت واقف عند آخر وقت
      if (c && c.flipped && Timer.owner !== this.owner()) { Timer.set(c.left, this.secFor(c), this.hooks()); Timer.owner = this.owner(); paintTimer(); }
    },

    timerSetup() {
      return `<section class="panel"><h2>الإعدادات</h2><div class="grid2">
      ${numField("rounds", "عدد الجولات", 5, 1, 20)}${numField("timer", "وقت الكارت (ثانية)", def.defaultTimer || 30, 10, 180)}</div></section>`;
    },

    begin() {
      if (!this.cats().length) return toast("اختار نوع واحد على الأقل");
      const rounds = clamp($("#rounds").value, 1, 20, 5), timer = clamp($("#timer").value, 10, 180, def.defaultTimer || 30);
      Match.begin(id, rounds, { timer, card: null });
      route();
    },

    pickView() {
      const cats = this.cats();
      const wheel = def.wheel && cats.length > 1;
      return `${turnHead()}
      ${wheel ? `${wheelHTML(cats)}
        <button class="primary" id="spin" onclick="G('${id}').spin()">🎡 لِف العجلة</button>
        <p class="or">أو اختار بنفسك</p>` : ""}
      <div class="grid2 cats">${cats.map(c => `<button class="cat" style="--cc:${c.color}" onclick="G('${id}').drawCard('${c.key}')">
        <span class="ic">${c.icon}</span>${esc(c.label)}<small>${ptsTxt(c.pts)}</small></button>`).join("")}</div>
      ${scoreboard()}
      <button class="ghost" onclick="quitMatch()">إنهاء اللعبة</button>`;
    },

    spin() {
      const b = $("#spin"); if (b.disabled) return;
      document.querySelectorAll("button").forEach(x => x.disabled = true);
      spinWheel(this.cats(), key => this.drawCard(key));
    },

    drawCard(key) {
      const c = this.cat(key);
      const idx = draw(id + ":" + key, c.list(), c.pred || (x => allowed(x)));
      S.match.g.card = { key, idx, flipped: false, revealed: false, left: 0 };
      Timer.stop(); Timer.owner = null;
      save(); route();
    },

    owner() { return id + ":" + S.match.played; },
    secFor(card) { const c = this.cat(card.key), item = c.list()[card.idx]; return c.timer ? c.timer(item) : S.match.g.timer; },
    hooks() { return { onTick: l => { const c = S.match && S.match.g.card; if (c) { c.left = l; save(); } } }; },

    cardView() {
      const m = S.match, card = m.g.card, c = this.cat(card.key), item = c.list()[card.idx];
      const sec = this.secFor(card), left = card.flipped ? card.left : sec;
      return `${turnHead()}
      <div class="flip ${card.flipped ? "on" : ""}" id="flip" style="--cc:${Match.team().color}">
        <div class="flip-in">
          <button class="face front" onclick="G('${id}').flip()" ${card.flipped ? 'tabindex="-1" aria-hidden="true"' : ""}>
            <span class="ic">${c.icon}</span><b>${esc(c.label)}</b><small>${ptsTxt(c.pts)}</small>
            <span class="hint">دوس عشان تقلب الكارت</span>
          </button>
          <div class="face back" ${card.flipped ? "" : 'aria-hidden="true"'}>
            <div class="tag">${c.icon} ${esc(c.label)} · ${ptsTxt(c.pts)}${item.hint ? ` · تلميح: ${esc(item.hint)}` : ""}</div>
            ${c.back(item)}
            ${c.answer ? `<div class="answer" id="ans" ${card.revealed ? "" : "hidden"}>الإجابة: <b>${esc(c.answer(item))}</b></div>
              ${card.revealed ? "" : `<button class="reveal" id="revealBtn" onclick="G('${id}').reveal()">اكشف الإجابة 👀</button>`}` : ""}
            ${timerHTML(left, sec)}
          </div>
        </div>
      </div>
      <div class="after ${card.flipped ? "" : "hide"}" id="after">
        <div class="actions">
          <button class="ok" onclick="G('${id}').mark(true)">${c.okTxt || "صح ✓"}</button>
          <button class="bad" onclick="G('${id}').mark(false)">${c.badTxt || "غلط ✗"}</button>
        </div>
        <button class="ghost" onclick="G('${id}').change()">غيّر الكارت ↻</button>
      </div>`;
    },

    flip() {
      const card = S.match.g.card; if (card.flipped) return;
      card.flipped = true; card.left = this.secFor(card); save();
      $("#flip").classList.add("on");
      $("#flip .front").setAttribute("tabindex", "-1");
      $("#flip .back").removeAttribute("aria-hidden");
      $("#after").classList.remove("hide");
      Sound.flip(); buzz(30);
      Timer.start(card.left, this.hooks()); Timer.owner = this.owner(); paintTimer();
    },

    reveal() {
      S.match.g.card.revealed = true; save();
      $("#ans").hidden = false; $("#revealBtn").remove(); Sound.flip();
    },

    mark(ok) {
      Timer.stop(); Timer.owner = null;
      const c = this.cat(S.match.g.card.key);
      if (ok) { Match.add(c.pts); Sound.ok(); buzz(60); } else { Sound.bad(); buzz([80, 60, 80]); }
      S.match.g.card = null; Match.next(); route();
    },

    change() { this.drawCard(S.match.g.card.key); }
  }, def);
  GAMES[id] = game;
  return game;
}

const qBack = item => `<div class="text">${esc(item.t)}</div>`;

// ===== لمّة العيلة =====
makeCardGame({
  id: "lamma", title: "لمّة العيلة", icon: "🎉", color: "#e8603c", wheel: true, defaultTimer: 30,
  desc: "أسئلة وألغاز وتحديات وأسئلة عن العيلة نفسها، بعجلة حظ.",
  tag: "فرق · موبايل واحد",
  cats(all) {
    const p = S.prefs.lamma;
    const list = [
      { key: "q", label: "سؤال", icon: "❓", color: "#2f7de1", pts: 1, list: () => CARDS.q, back: qBack, answer: i => i.a },
      { key: "r", label: "لغز", icon: "🧩", color: "#8a4fd8", pts: 2, list: () => CARDS.r, back: qBack, answer: i => i.a },
      { key: "c", label: "تحدي", icon: "🔥", color: "#e8603c", pts: 2, list: () => CARDS.c, back: qBack, timer: i => +i.a, okTxt: "نجح ✓", badTxt: "فشل ✗" },
      { key: "f", label: "عن العيلة", icon: "👨‍👩‍👧", color: "#1f9d55", pts: 2, list: () => S.family.map(x => ({ t: x.q, a: x.a, lv: "a", pack: "g" })), pred: () => true, back: qBack, answer: i => i.a }
    ];
    return all ? list : list.filter(c => p[c.key] && (c.key !== "f" || S.family.length));
  },
  setupExtra() {
    const p = S.prefs.lamma;
    return `<section class="panel"><h2>الأنواع</h2><div class="chips">
      ${this.cats(true).map(c => `<label class="chip"><input type="checkbox" ${p[c.key] ? "checked" : ""} ${c.key === "f" && !S.family.length ? "disabled" : ""}
        onchange="S.prefs.lamma.${c.key}=this.checked;save()"> ${c.icon} ${esc(c.label)}</label>`).join("")}</div>
      ${S.family.length ? "" : `<p class="note">عشان تفعّل «عن العيلة» <a class="link" href="#/family">اكتب أسئلة عن العيلة</a> الأول.</p>`}
    </section>${this.timerSetup()}`;
  }
});

// ===== كمّل المثل =====
makeCardGame({
  id: "proverbs", title: "كمّل المثل", icon: "📜", color: "#b7791f", defaultTimer: 20,
  desc: "أول المثل الشعبي قدامك، والفريق يكمّله.",
  tag: "فرق · موبايل واحد",
  cats() {
    return [{ key: "p", label: "مثل شعبي", icon: "📜", color: "#b7791f", pts: 1, list: () => CARDS.pro, pred: () => true,
      back: i => `<div class="small">كمّل المثل:</div><div class="text">${esc(i.t)} …</div>`, answer: i => i.t + " " + i.a }];
  }
});

// ===== فزّورة إيموجي =====
makeCardGame({
  id: "emoji", title: "فزّورة إيموجي", icon: "🤔", color: "#d53f8c", defaultTimer: 30,
  desc: "شوية إيموجي بيقولوا مثل أو حكاية أو حاجة، خمّنوها.",
  tag: "فرق · موبايل واحد",
  cats() {
    return [{ key: "e", label: "فزّورة", icon: "🤔", color: "#d53f8c", pts: 1, list: () => CARDS.emo,
      back: i => `<div class="emoji" dir="ltr">${esc(i.t)}</div>`, answer: i => i.a }];
  }
});
