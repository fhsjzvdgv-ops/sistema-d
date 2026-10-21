/* Система — дуэль на троих: рейтинг, счёт месяца (доля своего плана), колесо наказаний, отчёт по дням.
   Общий код для всех игроков; различия — в блоке CFG. */
(function () {
  "use strict";
  const S = window.SYS, h = (...a) => S.h(...a), V = S.V, ui = S.ui;
  const kd = (key, ...kids) => { ui.open = ui.open || {}; return S.keep(h("details", { class: "kn" }, ...kids), key); };
  const APP = window.APP, BOX = APP.box, RIVALS = APP.rivals, ME_LABEL = "Ты", RKEY = APP.rivalKey || "sys_rivals", WHEEL_CFG = APP.wheel || null;
  const MAINN = () => APP.main.length;
  const mainDone = (d) => (S.mainDone ? S.mainDone(d) : 0);
  const closed = (d) => (S.dayClosed ? S.dayClosed(d) : false);
  const startDay = () => ((S.D.ledger || {}).start || S.today());
  const myName = () => APP.meName;
  const streakDays = () => { const c = S.streakCalc ? S.streakCalc() : { tens: 0, inTen: 0 }; return c.tens * 10 + c.inTen; };
  const docRivals = () => ({});
  function push(x) { fetch(BOX + APP.me, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(x) }).catch(() => {}); }
  const DISC = [
    ["mainPct", "Главные дела, % месяца", "Сколько главных дел сделано с 1-го числа от всех возможных. У каждого свой список главных, поэтому сравнивается доля — честно.", "%"],
    ["perfect", "Идеальные дни", "Дни месяца, когда закрыто всё главное дня.", ""],
    ["closed", "Дни в серию", "Дни месяца, засчитанные в серию по своим правилам.", ""]
  ];
  const WHEEL = WHEEL_CFG || [
    ["🍕", "Пицца", "Проигравший заказывает пиццу на всех."],
    ["💨", "Кальян", "Кальян за счёт проигравшего."],
    ["☕", "Лавандовый раф", "Проигравший покупает победителю лавандовый раф или любой кофе в хорошей дорогой кофейне."],
    ["🍾", "Белуга 1,5 л", "Проигравший покупает победителю «Белугу» 1,5 литра."],
    ["🙋", "Знакомство", "Идёте гулять вместе. Проигравший знакомится с девушкой: подойти, нормально поговорить, спросить, как дела, взять контакт — если она сама не против. Без давления: «нет» значит «нет», идёшь к следующей."],
    ["💪", "100 отжиманий", "100 отжиманий в течение 2 часов, подходами, при победителе."],
    ["🧱", "Планка 10 минут", "10 минут планки суммарно за 15 минут, при победителе."]
  ];
  const REP = [
    ["💪", "50 отжиманий", "50 отжиманий."],
    ["🧱", "Планка 5 минут", "5 минут планки суммарно."],
    ["🦵", "50 приседаний", "50 приседаний."],
    ["🔥", "30 бёрпи", "30 бёрпи."],
    ["🫐", "Чёрная смородина", "Покупаешь чёрную смородину."]
  ];
  const ym = (d) => d.slice(0, 7);
  const prevMonth = (m) => { const a = m.split("-").map(Number); return new Date(Date.UTC(a[0], a[1] - 2, 1)).toISOString().slice(0, 7); };
  function monthStats(m) {
    const t = S.today(), nb = Math.max(1, MAINN());
    let d = m + "-01", nd = 0, main = 0, perfect = 0, cl = 0;
    while (ym(d) === m && d <= t) { if (d >= startDay()) { nd++; const md = mainDone(d); main += md; if (md >= nb) perfect++; if (closed(d)) cl++; } d = S.addDays(d, 1); }
    return { month: m, mainPct: nd ? Math.round((100 * main) / (nb * nd)) : 0, perfect, closed: cl, nd };
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
  let live = {}, lastPush = 0, lastPull = 0;
  try { live = JSON.parse(localStorage.getItem(RKEY)) || {}; } catch (e) {}
  S.duelSync = function (force) {
    if (!S.X || !S.db) return;
    const now = Date.now(), local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (!local && (force || now - lastPush > 5 * 60000)) { lastPush = now; push(S.duelMine()); }
    if (force || now - lastPull > 5 * 60000) {
      lastPull = now;
      RIVALS.forEach((r) => { try { fetch(BOX + r.id, { cache: "no-store" }).then((x) => x.text()).then((t) => { const d = JSON.parse(t); if (d && d.name) { live[r.id] = d; try { localStorage.setItem(RKEY, JSON.stringify(live)); } catch (e) {} S.render(); } }).catch(() => {}); } catch (e) {} });
    }
  };
  const tick0 = S.tick;
  S.tick = function () { tick0.apply(this, arguments); S.duelSync(); };
  const recent = (a, b) => (a && (!b || (a.at || 0) >= (b.at || 0))) ? a : (b || a || null);
  function players() {
    const me = S.duelMine(), doc = docRivals();
    return [{ id: "me", name: ME_LABEL, d: me }].concat(RIVALS.map((r) => ({ id: r.id, name: r.name, d: recent(live[r.id], doc[r.id]) })));
  }
  // очки по дисциплинам: сколько соперников строго слабее
  function scores(list, pick) {
    const pl = list.filter((p) => pick(p));
    const tot = {}; list.forEach((p) => (tot[p.id] = 0));
    if (pl.length < 2) return { tot, ok: false };
    DISC.forEach(([k]) => pl.forEach((p) => { tot[p.id] += pl.filter((q) => q !== p && pick(q)[k] < pick(p)[k]).length; }));
    return { tot, ok: true };
  }
  function board(list, pick, title, sub) {
    const sc = scores(list, pick), has = list.filter((p) => pick(p));
    const max = Math.max.apply(null, Object.values(sc.tot).concat([-1])), leaders = sc.ok ? list.filter((p) => sc.tot[p.id] === max && pick(p)) : [];
    const top = h("div", { class: "vs-top n" + list.length }, list.map((p) => h("div", { class: "vs-p" + (sc.ok && leaders.length === 1 && leaders[0] === p ? " lead" : "") }, h("small", null, p.name), h("b", { class: "vs-s" }, pick(p) && sc.ok ? String(sc.tot[p.id]) : "–"))));
    const verdict = !sc.ok ? "Ждём цифры соперников — придут сами" : leaders.length === 1 ? leaders[0].name + (leaders[0].id === "me" ? " впереди" : " впереди") : "Пока ничья";
    const rows = DISC.map(([k, n, how, u]) => {
      u = u || ""; const vals = list.map((p) => (pick(p) ? pick(p)[k] : null)), mx = Math.max.apply(null, vals.map((v) => v || 0).concat([1])), best = Math.max.apply(null, vals.map((v) => (v == null ? -1 : v)));
      const strict = vals.filter((v) => v === best).length === 1;
      const kk = "vs-" + k; const hw = h("div", { class: "vs-how", hidden: !((ui.open || {})[kk]) }, how);
      return [h("button", { class: "vs-row", type: "button", onclick: () => { hw.hidden = !hw.hidden; ui.open = ui.open || {}; ui.open[kk] = !hw.hidden; } }, h("div", { class: "vs-l" }, n),
        list.map((p, i) => h("div", { class: "vs3" }, h("span", { class: "vs3-n" }, p.name), h("span", { class: "vs-bar" }, h("i", { class: strict && vals[i] === best ? "won" : "", style: { width: vals[i] == null ? "0%" : Math.round(100 * vals[i] / mx) + "%" } })), h("b", { class: "vs3-v" + (strict && vals[i] === best ? " won" : "") }, vals[i] == null ? "—" : vals[i] + u)))), hw];
    });
    return { el: S.win(title, sub, h("div", { class: "vs" }, top, h("div", { class: "vs-v" }, verdict), rows)), sc, leaders, has };
  }
  function ratingCard(p, lead) {
    const x = p.d;
    return h("div", { class: "rt-c" + (lead ? " lead" : "") }, h("small", null, p.name), h("b", { class: "rt-l" }, x ? String(x.level) : "–"), h("span", null, "уровень"),
      h("div", { class: "rt-row" }, h("span", null, "ранг"), h("b", null, x ? x.rank || "E" : "—")),
      h("div", { class: "rt-row" }, h("span", null, "опыт"), h("b", null, x && x.xp != null ? String(x.xp) : "—")),
      h("div", { class: "rt-row" }, h("span", null, "серия"), h("b", null, x && x.streak != null ? x.streak + " д" : "—")));
  }
  function wheelEl(spun, canSpin, onSpin, who, items, opts) {
    const W = items || WHEEL;
    const n = W.length, seg = 360 / n, cols = ["#1b3a66", "#22497A"];
    const grad = W.map((w, i) => cols[i % 2] + " " + (i * seg) + "deg " + ((i + 1) * seg) + "deg").join(",");
    const disc = h("div", { class: "wh-disc", style: { background: "conic-gradient(" + grad + ")" } },
      W.map((w, i) => h("span", { class: "wh-lab", style: { transform: "rotate(" + (i * seg + seg / 2) + "deg)" } }, h("i", null, w[0]), h("small", null, w[1]))));
    if (spun != null) disc.style.transform = "rotate(" + (360 - (spun * seg + seg / 2)) + "deg)";
    const out = h("div", { class: "wh-res" }, spun != null ? h("div", null, h("b", null, W[spun][0] + " " + W[spun][1]), h("div", { class: "muted" }, W[spun][2])) : null);
    const btn = h("button", { class: "btn wide", type: "button", disabled: canSpin ? null : true }, canSpin ? ((opts && opts.label) || "Крутить колесо") : spun != null ? "Колесо уже прокручено" : who ? "Крутит " + who + " после конца месяца" : "Крутит проигравший после конца месяца");
    btn.addEventListener("click", () => {
      if (!canSpin) return;
      if (opts && opts.gate) { opts.gate().then((ok) => ok && start()); } else start();
    });
    function start() {
      btn.disabled = true;
      const pick = Math.floor(Math.random() * n), turns = 6 * 360 + (360 - (pick * seg + seg / 2));
      disc.style.transition = "transform 5s cubic-bezier(.12,.8,.18,1)"; disc.style.transform = "rotate(" + turns + "deg)";
      let k = 0; const tk = setInterval(() => { S.FX.sound("tick"); if (++k > 22) clearInterval(tk); }, 200);
      setTimeout(() => { S.FX.sound("level"); out.textContent = ""; out.appendChild(h("div", null, h("b", null, W[pick][0] + " " + W[pick][1]), h("div", { class: "muted" }, W[pick][2]))); onSpin(pick); }, 5200);
    }
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
    const list = players(), cm = ym(S.today()), pm = prevMonth(cm);
    // рейтинг
    const xmax = Math.max.apply(null, list.map((p) => (p.d ? p.d.xp || 0 : -1))), xl = list.filter((p) => p.d && (p.d.xp || 0) === xmax);
    root.appendChild(S.win("Рейтинг", "Уровень, ранг, опыт и серия — у каждого свои, обновляются сами.", h("div", { class: "rt n" + list.length }, list.map((p) => ratingCard(p, xl.length === 1 && xl[0] === p)))));
    // месяц
    const mb = board(list, (p) => (p.d && p.d.cur && p.d.cur.month === cm ? p.d.cur : null), "Дуэль месяца · " + monName(cm), "Доля от своего плана с 1-го числа. Очки: сколько соперников ты обогнал в каждой дисциплине. Нажми на строку — как считается.");
    root.appendChild(mb.el);
    // колесо: итог прошлого месяца
    const pb = scores(list, (p) => (p.d && p.d.prev && p.d.prev.month === pm && p.d.prev.nd ? p.d.prev : null));
    let loser = null;
    if (pb.ok) { const vals = Object.values(pb.tot), mn = Math.min.apply(null, vals); const ls = list.filter((p) => pb.tot[p.id] === mn && p.d && p.d.prev && p.d.prev.month === pm && p.d.prev.nd); if (ls.length === 1) loser = ls[0]; }
    const spun = loser ? (loser.id === "me" ? (S.D.player || {}).duelSpins || {} : (loser.d && loser.d.spins) || {})[pm] : null;
    const sub = !pb.ok ? "В конце месяца проигравший крутит колесо и выполняет то, что выпало." : loser ? "Прошлый месяц (" + monName(pm) + ") проиграл " + (loser.id === "me" ? "ты" : loser.name) + "." : "Прошлый месяц (" + monName(pm) + ") — ничья в хвосте, колесо не крутим.";
    root.appendChild(S.win("Колесо наказаний", sub, wheelEl(spun == null ? null : spun, !!(loser && loser.id === "me" && spun == null), (pick) => { const sp = Object.assign({}, (S.D.player || {}).duelSpins || {}, { [pm]: pick }); S.setPlayer({ duelSpins: sp }); setTimeout(() => S.duelSync(true), 500); }, loser && loser.id !== "me" ? loser.name : null),
      kd("wh-list", h("summary", null, h("span", null, "Что может выпасть"), h("span", { class: "more" }, String(WHEEL.length))), h("div", { class: "body" }, h("ul", { class: "conds" }, WHEEL.map((w) => h("li", null, w[0] + " " + w[1] + " — " + w[2])))))));
    // рулетка за не скинутый отчёт: крутит тот, кто пропустил; выпавшее — его долг
    const rspins = S.X.list.filter((e) => e.k === "repspin").sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 5);
    root.appendChild(S.win("Рулетка отчёта", "Не скинул отчёт — крутишь сам. Что выпало, становится твоим долгом в «Своих делах». Следите друг за другом сами.",
      wheelEl(null, true, (pick) => {
        const w = REP[pick];
        S.writeEv("repspin-" + Date.now(), { k: "repspin", t: w[1], xp: 0, g: 0, p: "osnova" });
        S.ttCreate({ title: "🎰 Долг за отчёт: " + w[1], projectId: (S.D.config || {}).ticktickProjectId || "sys", tags: ["тело"], priority: 3, content: w[2] + " Выпало на рулетке за нескинутый отчёт. Выполнил — отметь." }).catch(() => {});
      }, null, REP, { label: "Не скинул отчёт — крутить", gate: () => S.FX.confirm("Не скинул отчёт?", "Крутим рулетку, и выпавшее ты выполняешь.", "Крутить") }),
      rspins.length ? kd("wh-hist", h("summary", null, h("span", null, "Что выпадало"), h("span", { class: "more" }, String(rspins.length))), h("div", { class: "body" }, h("ul", { class: "conds" }, rspins.map((e) => h("li", null, S.fmtDay(e.d) + " — " + e.t))))) : null));
    // отчёт по дням
    const rep = h("div"), me = list[0].d;
    Object.keys(me.days).sort().reverse().forEach((d, i) => {
      ui.open = ui.open || {}; if (ui.open["rp-" + d] === undefined) ui.open["rp-" + d] = i === 0; const det = S.keep(h("details", { class: "kn" }), "rp-" + d);
      const marks = list.map((p) => { const o = p.d && p.d.days ? p.d.days[d] : null; return o ? (o.ok ? "✓" : "✗") : "—"; }).join(" / ");
      det.appendChild(h("summary", null, h("span", null, S.fmtDay(d)), h("span", { class: "more" }, marks)));
      det.appendChild(h("div", { class: "body rp" }, list.map((p) => dayCol(p.name, p.d && p.d.days ? p.d.days[d] : null))));
      rep.appendChild(det);
    });
    const lastAt = list.slice(1).filter((p) => p.d).map((p) => p.name + " — " + S.fmtTime(p.d.at)).join(", ");
    root.appendChild(S.win("Отчёт по дням", "Кто что сделал за последние 7 дней. ✓ — день в серию." + (lastAt ? " Данные: " + lastAt + "." : ""), rep));
  };
})();
