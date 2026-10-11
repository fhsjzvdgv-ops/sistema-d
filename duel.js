/* Система — дуэль с другом: рейтинг, счёт месяца (доля своего плана), отчёт по дням, колесо наказаний.
   Общий код для окна Эдуарда и сайта Дария, различия — в блоке CFG. */
(function () {
  "use strict";
  const S = window.SYS, h = (...a) => S.h(...a), V = S.V;
  const BOX = "https://textdb.dev/api/data/e70f9805-330d-4735-8cec-187972f073c2-";
  const ME = "dariy", RIVAL = "eduard", RIVAL_NAME = "Эдуард";
  const ME_LABEL = (S.D.player || {}).nick || "Ты";
  const MAINN = () => 6;
  const mainDone = (d) => (S.mainDone ? S.mainDone(d) : 0);
  const closed = (d) => (S.dayClosed ? S.dayClosed(d) : false);
  const startDay = () => ((S.D.ledger || {}).start || S.today());
  const myName = () => (S.D.player || {}).nick || "Дарий";
  const streakDays = () => { const c = S.streakCalc ? S.streakCalc() : { tens: 0, inTen: 0 }; return c.tens * 10 + c.inTen; };
  const docRival = () => null;
  function push(x) { fetch(BOX + ME, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(x) }).catch(() => {}); }
  const DISC = [
    ["mainPct", "Главные дела, % месяца", "Сколько главных дел сделано с 1-го числа от всех возможных. У каждого свой список главных, поэтому сравнивается доля — честно.", "%"],
    ["perfect", "Идеальные дни", "Дни месяца, когда закрыто всё главное дня.", ""],
    ["closed", "Дни в серию", "Дни месяца, засчитанные в серию по своим правилам."]
  ];
  const WHEEL = [
    ["🍕", "Пицца", "Проигравший заказывает пиццу на двоих."],
    ["💨", "Кальян", "Кальян за счёт проигравшего."],
    ["☕", "Лавандовый раф", "Проигравший покупает победителю лавандовый раф или любой кофе в хорошей дорогой кофейне."],
    ["🍾", "Белуга 1,5 л", "Проигравший покупает победителю «Белугу» 1,5 литра."],
    ["🙋", "Знакомство", "Идёте гулять вместе. Проигравший знакомится с девушкой: подойти, нормально поговорить, спросить, как дела, взять контакт — если она сама не против. Без давления: «нет» значит «нет», идёшь к следующей."],
    ["💪", "100 отжиманий", "100 отжиманий в течение 2 часов, подходами, при победителе."],
    ["🧱", "Планка 10 минут", "10 минут планки суммарно за 15 минут, при победителе."]
  ];
  const ym = (d) => d.slice(0, 7);
  const prevMonth = (m) => { const a = m.split("-").map(Number); const d = new Date(Date.UTC(a[0], a[1] - 2, 1)); return d.toISOString().slice(0, 7); };
  function monthStats(m) {
    const t = S.today(), start = m + "-01", nb = Math.max(1, MAINN());
    let d = start, nd = 0, main = 0, perfect = 0, cl = 0;
    while (ym(d) === m && d <= t) { if (d >= startDay()) { nd++; const md = mainDone(d); main += md; if (md >= nb) perfect++; if (closed(d)) cl++; } d = S.addDays(d, 1); }
    return { month: m, mainPct: nd ? Math.round((100 * main) / (nb * nd)) : 0, perfect, closed: cl };
  }
  function daysReport(n) {
    const out = {}, t = S.today();
    for (let i = 0; i < n; i++) {
      const d = S.addDays(t, -i); if (d < startDay()) break;
      const list = [];
      S.X.list.forEach((e) => { if (e.d !== d || !S.QUEST_KINDS[e.k]) return; list.push({ t: String(e.t || "").replace(/^(Курс «[^»]+»: |Испытание: )/, "").slice(0, 70), xp: e.xp || 0 }); });
      out[d] = { main: mainDone(d), ok: closed(d), items: list };
    }
    return out;
  }
  S.duelMine = function () {
    const t = S.today(), st = S.D.state || {};
    return Object.assign({ name: myName(), at: Date.now(), level: S.X.level, xp: Math.round(S.X.xp), rank: st.rank || "E", streak: streakDays(), days: daysReport(7), spins: (S.D.player || {}).duelSpins || {} },
      { cur: monthStats(ym(t)), prev: monthStats(prevMonth(ym(t))) });
  };
  let live = null, lastPush = 0, lastPull = 0;
  try { live = JSON.parse(localStorage.getItem("sysD_rival")); } catch (e) {}
  S.duelSync = function (force) {
    if (!S.X || !S.db) return;
    const now = Date.now(), local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (!local && (force || now - lastPush > 5 * 60000)) { lastPush = now; push(S.duelMine()); }
    if (force || now - lastPull > 5 * 60000) {
      lastPull = now;
      try { fetch(BOX + RIVAL, { cache: "no-store" }).then((r) => r.text()).then((t) => { const x = JSON.parse(t); if (x && x.name) { live = x; try { localStorage.setItem("sysD_rival", t); } catch (e) {} S.render(); } }).catch(() => {}); } catch (e) {}
    }
  };
  const tick0 = S.tick;
  S.tick = function () { tick0.apply(this, arguments); S.duelSync(); };
  function rival() { const doc = docRival(); if (live && (!doc || (live.at || 0) >= (doc.at || 0))) return live; return doc || live || null; }
  function score(me, r) {
    let a = 0, b = 0;
    if (me && r) DISC.forEach(([k]) => { if (me[k] > r[k]) a++; else if (r[k] > me[k]) b++; });
    return [a, b];
  }
  function board(meN, rn, me, r, title, sub) {
    const [a, b] = score(me, r);
    const rows = DISC.map(([k, n, how, u]) => {
      u = u || ""; const x = me[k], y = r && r[k] != null ? r[k] : null, mx = Math.max(x || 0, y || 0, 1);
      const wa = y != null && x > y, wb = y != null && y > x;
      const hw = h("div", { class: "vs-how", hidden: true }, how);
      return [h("button", { class: "vs-row", type: "button", onclick: () => { hw.hidden = !hw.hidden; } },
        h("div", { class: "vs-l" }, n),
        h("div", { class: "vs-line" },
          h("b", { class: "vs-a" + (wa ? " won" : "") }, x + u),
          h("span", { class: "vs-bar a" }, h("i", { class: wa ? "won" : "", style: { width: Math.round(100 * (x || 0) / mx) + "%" } })),
          h("span", { class: "vs-bar b" }, h("i", { class: wb ? "won" : "", style: { width: y == null ? "0%" : Math.round(100 * y / mx) + "%" } })),
          h("b", { class: "vs-b" + (wb ? " won" : "") }, y == null ? "—" : y + u))), hw];
    });
    const verdict = !r ? "Ждём цифры соперника — придут сами" : a === b ? "Пока ничья" : (a > b ? meN : rn) + " впереди";
    return S.win(title, sub, h("div", { class: "vs" },
      h("div", { class: "vs-top" },
        h("div", { class: "vs-p" + (r && a > b ? " lead" : "") }, h("small", null, meN), h("b", { class: "vs-s" }, r ? String(a) : "–")),
        h("div", { class: "vs-mid" }, ":"),
        h("div", { class: "vs-p" + (r && b > a ? " lead" : "") }, h("small", null, rn), h("b", { class: "vs-s" }, r ? String(b) : "–"))),
      h("div", { class: "vs-v" }, verdict), rows));
  }
  function ratingCard(n, x, lead) {
    return h("div", { class: "rt-c" + (lead ? " lead" : "") }, h("small", null, n), h("b", { class: "rt-l" }, x ? String(x.level) : "–"), h("span", null, "уровень"),
      h("div", { class: "rt-row" }, h("span", null, "ранг"), h("b", null, x ? x.rank || "E" : "—")),
      h("div", { class: "rt-row" }, h("span", null, "опыт"), h("b", null, x && x.xp != null ? String(x.xp) : "—")),
      h("div", { class: "rt-row" }, h("span", null, "серия"), h("b", null, x && x.streak != null ? x.streak + " дн." : "—")));
  }
  function wheelEl(spun, canSpin, onSpin) {
    const n = WHEEL.length, seg = 360 / n, cols = ["#1b3a66", "#22497A"];
    const grad = WHEEL.map((w, i) => cols[i % 2] + " " + (i * seg) + "deg " + ((i + 1) * seg) + "deg").join(",");
    const disc = h("div", { class: "wh-disc", style: { background: "conic-gradient(" + grad + ")" } },
      WHEEL.map((w, i) => h("span", { class: "wh-lab", style: { transform: "rotate(" + (i * seg + seg / 2) + "deg)" } }, h("i", null, w[0]), h("small", null, w[1]))));
    if (spun != null) disc.style.transform = "rotate(" + (360 - (spun * seg + seg / 2)) + "deg)";
    const out = h("div", { class: "wh-res" }, spun != null ? h("div", null, h("b", null, WHEEL[spun][0] + " " + WHEEL[spun][1]), h("div", { class: "muted" }, WHEEL[spun][2])) : null);
    const btn = h("button", { class: "btn wide", type: "button", disabled: canSpin ? null : true }, canSpin ? "Крутить колесо" : spun != null ? "Колесо уже прокручено" : "Крутит проигравший после конца месяца");
    btn.addEventListener("click", () => {
      if (!canSpin) return; btn.disabled = true;
      const pick = Math.floor(Math.random() * n), turns = 6 * 360 + (360 - (pick * seg + seg / 2));
      disc.style.transition = "transform 5s cubic-bezier(.12,.8,.18,1)"; disc.style.transform = "rotate(" + turns + "deg)";
      let k = 0; const tk = setInterval(() => { S.FX.sound("tick"); if (++k > 22) clearInterval(tk); }, 200);
      setTimeout(() => { S.FX.sound("level"); out.textContent = ""; out.appendChild(h("div", null, h("b", null, WHEEL[pick][0] + " " + WHEEL[pick][1]), h("div", { class: "muted" }, WHEEL[pick][2]))); onSpin(pick); }, 5200);
    });
    return h("div", { class: "wh" }, h("div", { class: "wh-box" }, h("div", { class: "wh-ptr" }), disc), out, btn);
  }
  function dayCol(name, d) {
    if (!d) return h("div", { class: "rp-col" }, h("b", null, name), h("div", { class: "muted" }, "нет данных"));
    const xp = (d.items || []).reduce((a, x) => a + (x.xp || 0), 0);
    return h("div", { class: "rp-col" }, h("b", null, name),
      h("div", { class: "muted" }, (d.ok ? "✓ в серию" : "✗ не в серию") + " · главных " + (d.main != null ? d.main : "—") + " · +" + xp + " XP"),
      (d.items || []).length ? h("ul", { class: "conds" }, d.items.map((x) => h("li", null, x.t))) : h("div", { class: "muted" }, "ничего не отмечено"));
  }
  const MON = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  const monName = (m) => MON[+m.slice(5, 7) - 1];
  V.duel = function (root) {
    S.duelSync();
    const me = S.duelMine(), rv = rival(), rn = (rv && rv.name) || RIVAL_NAME, meN = ME_LABEL;
    // рейтинг
    const lead = rv ? (me.xp > (rv.xp || 0) ? 1 : (rv.xp || 0) > me.xp ? 2 : 0) : 0;
    root.appendChild(S.win("Рейтинг", "Уровень, ранг, опыт и серия — у каждого свои, обновляются сами.", h("div", { class: "rt" }, ratingCard(meN, me, lead === 1), ratingCard(rn, rv, lead === 2))));
    // месяц
    const cm = ym(S.today()), rCur = rv && rv.cur && rv.cur.month === cm ? rv.cur : null;
    root.appendChild(board(meN, rn, me.cur, rCur, "Дуэль месяца · " + monName(cm), "Доля от своего плана с 1-го числа. Месяц закрывается в последний день в 23:59. Нажми на строку — как считается."));
    // колесо: итог прошлого месяца
    const pm = prevMonth(cm), mp = me.prev, rp = rv && rv.prev && rv.prev.month === pm ? rv.prev : null;
    const [pa, pb] = score(mp, rp), loserMe = rp && pb > pa, loserHim = rp && pa > pb;
    const spunMine = (me.spins || {})[pm], spunHis = rv && rv.spins ? rv.spins[pm] : undefined, spun = spunMine != null ? spunMine : spunHis != null ? spunHis : null;
    const sub = !rp ? "В конце месяца проигравший крутит колесо и выполняет то, что выпало." : pa === pb ? "Прошлый месяц (" + monName(pm) + ") — ничья, колесо не крутим." : "Прошлый месяц (" + monName(pm) + ") проиграл " + (loserMe ? meN : rn) + " " + Math.min(pa, pb) + ":" + Math.max(pa, pb) + ".";
    root.appendChild(S.win("Колесо наказаний", sub, wheelEl(spun, !!(loserMe && spun == null), (pick) => { const sp = Object.assign({}, (S.D.player || {}).duelSpins || {}, { [pm]: pick }); S.setPlayer({ duelSpins: sp }); setTimeout(() => S.duelSync(true), 500); }),
      h("details", { class: "kn" }, h("summary", null, h("span", null, "Что может выпасть"), h("span", { class: "more" }, String(WHEEL.length))), h("div", { class: "body" }, h("ul", { class: "conds" }, WHEEL.map((w) => h("li", null, w[0] + " " + w[1] + " — " + w[2])))))));
    // отчёт по дням
    const rep = h("div"), rd = (rv && rv.days) || {};
    Object.keys(me.days).sort().reverse().forEach((d, i) => {
      const det = h("details", { class: "kn" }); if (i === 0) det.open = true;
      const m = me.days[d], o = rd[d];
      det.appendChild(h("summary", null, h("span", null, S.fmtDay(d)), h("span", { class: "more" }, (m.ok ? "✓" : "✗") + " / " + (o ? (o.ok ? "✓" : "✗") : "—"))));
      det.appendChild(h("div", { class: "body rp" }, dayCol(meN, m), dayCol(rn, o)));
      rep.appendChild(det);
    });
    root.appendChild(S.win("Отчёт по дням", "Кто что сделал за последние 7 дней. ✓ — день в серию." + (rv ? " Данные соперника: " + S.fmtDay(S.dayOf(rv.at)) + ", " + S.fmtTime(rv.at) + "." : ""), rep));
  };
})();
