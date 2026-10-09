/* Система v6.4 — лёгкий режим: минимум дня, испытание дня, наставник недели */
(function () {
  "use strict";
  const S = window.SYS, h = (...a) => S.h(...a), V = S.V, R = () => S.R(), ui = S.ui;

  /* ---------- МИНИМУМ ДНЯ: любые 3 дела ---------- */
  S.minNeed = () => ((R().minDay || {}).need) || 3;
  S.minCount = function (d) {
    if (!S.X) return 0;
    return S.X.list.filter((e) => e.d === d && S.QUEST_KINDS[e.k]).length;
  };
  S.dayClosed = (d) => S.has("minday-" + d) || S.has("allblk-" + d);
  let checking = false;
  S.checkMinDay = function () {
    if (checking || !S.ready.ev || !S.X || !S.award) return;
    const t = S.today(), id = "minday-" + t;
    if (S.has(id) || S.minCount(t) < S.minNeed()) return;
    checking = true;
    S.award({ id, k: "minday", t: "Минимум дня выполнен", p: "osnova", r: "D", noExtras: true, noCrit: true }).then((x) => {
      checking = false;
      if (x && S.FX) S.FX.banner("[ ДЕНЬ ЗАСЧИТАН ]", "Главные дела закрыты — день идёт в серию. Остальное сегодня — бонус.");
    }, () => { checking = false; });
  };
  const derive0 = S.derive;
  S.derive = function () { const r = derive0.apply(this, arguments); setTimeout(S.checkMinDay, 0); return r; };

  S.minWin = function () {
    const t = S.today(), need = S.minNeed(), n = Math.min(need, S.minCount(t)), ok = S.dayClosed(t);
    const dots = h("div", { class: "mind" }, Array.from({ length: need }, (_, i) => h("span", { class: i < n || ok ? "on" : "" })));
    const st = S.D.state || {};
    return S.win(ok ? "✓ День засчитан" : "Минимум дня: " + n + " из " + need,
      ok ? "День идёт в серию (вечером Система пересчитает, сейчас " + (st.streak || 0) + " дн.). Сегодня можно больше ничего не делать — всё сверху бонус." : "Любые 3 дела: главное дело, своё дело, квест, испытание. Остальное — бонус.",
      dots,
      h("div", { class: "muted" }, "Пропуск дня: −30 XP, −50 ◆ и 30 отжиманий в долг. Один пропуск в неделю прощается сам."));
  };

  /* ---------- СЛАБАЯ ВЕТКА ---------- */
  S.weakPath = function (from, to) {
    const sum = {}; S.PATHS.forEach((p) => (sum[p.key] = 0));
    (S.X ? S.X.list : []).forEach((e) => { if (e.d >= from && e.d <= to && S.QUEST_KINDS[e.k] && sum[e.p] != null) sum[e.p] += e.xp || 0; });
    return S.PATHS.slice().sort((a, b) => sum[a.key] - sum[b.key])[0].key;
  };

  /* ---------- НАСТАВНИК НЕДЕЛИ ---------- */
  S.mentorWeek = function () {
    const ws = S.weekStart(S.today()), path = S.weakPath(S.addDays(ws, -7), S.addDays(ws, -1));
    const ms = (S.D.pools || {}).mentors || [];
    const men = ms.find((m) => m.path === path) || ms.find((m) => m.key === "arsen") || { name: "Система", advice: [] };
    const own = (men.tasks || []).filter((x) => x.p === path);
    const pool = (((S.D.pools || {}).pools || {})[path] || []).filter((q) => q.r === "C" || q.r === "B");
    const q = own.length ? S.pick(own, "mwq" + ws) : pool.length ? S.pick(pool, "mwq" + ws) : { t: "Одно дело в слабой ветке каждый день недели" };
    const adv = men.advice && men.advice.length ? S.pick(men.advice, "mwa" + ws) : "";
    return { ws, path, men, q: { t: q.t, how: q.how }, adv, id: "mw-" + ws };
  };
  S.mentorWin = function () {
    const mw = S.mentorWeek(), p = S.BY[mw.path] || {}, done = S.has(mw.id);
    const card = S.questCard({ t: mw.q.t, how: mw.q.how, p: mw.path, r: "A", done, label: "Задание недели",
      onDo: (c) => S.doQuest({ id: mw.id, k: "mw", t: "Задание наставника: " + mw.q.t, p: mw.path, r: "A", m: { mentor: mw.men.key } }, c) });
    return S.win("Наставник недели · " + mw.men.name,
      "Твоя слабая ветка за прошлую неделю — «" + (p.name || mw.path) + "». " + (done ? "Задание выполнено, новое — в понедельник." : "Одно задание на всю неделю, без спешки."),
      mw.adv ? h("div", { class: "m-x" }, "«" + mw.adv + "»") : null, card);
  };

  /* ---------- ИСПЫТАНИЯ ПУТИ ---------- */
  S.trialsOf = (path) => (((S.D.trials || {}).paths || {})[path]) || [];
  S.trialUsedToday = () => !!(S.X && S.X.list.some((e) => e.k === "node" && e.d === S.today()));
  S.trialState = function (path) {
    const list = S.trialsOf(path).map((n, i) => Object.assign({ i }, n, { id: "node-" + path + "-" + (i + 1), done: S.has("node-" + path + "-" + (i + 1)) }));
    const cur = list.find((n) => !n.done) || null;
    return { list, cur, doneN: list.filter((n) => n.done).length };
  };
  function trialCard(path, n, label) {
    const used = S.trialUsedToday();
    return S.questCard({ t: n.t, how: n.how, p: path, r: n.r, label: label || "Испытание " + (n.i + 1) + " из " + S.trialsOf(path).length,
      lock: used ? "Сегодня испытание уже пройдено — следующее завтра" : null,
      onDo: (c) => S.doQuest({ id: n.id, k: "node", t: "Испытание: " + n.t, p: path, r: n.r, m: { node: n.i + 1 } }, c) });
  }
  S.trialTodayWin = function () {
    if (!S.D.trials) return null;
    const t = S.today(), usedEv = S.X && S.X.list.find((e) => e.k === "node" && e.d === t);
    if (usedEv) return S.win("Испытание дня", "Пройдено: " + usedEv.t.replace(/^Испытание: /, "") + ". Следующее — завтра.");
    const path = S.weakPath(S.addDays(t, -7), S.addDays(t, -1)), st = S.trialState(path);
    if (!st.cur) return null;
    const p = S.BY[path] || {};
    return S.win("Испытание дня", "Тропа «" + p.name + "» · " + st.doneN + " из " + st.list.length + ". Одно испытание в день. Другие тропы — в «Навыках».", trialCard(path, st.cur, null));
  };
  S.trailWin = function (path) {
    const st = S.trialState(path), p = S.BY[path] || {};
    if (!st.list.length) return null;
    const box = h("div", { class: "trail" });
    st.list.forEach((n) => {
      if (n.done) box.appendChild(h("div", { class: "okline" }, "✓ " + n.t));
      else if (n === st.cur) box.appendChild(trialCard(path, n));
      else if (n.i === st.cur.i + 1) box.appendChild(h("div", { class: "rg locked" }, h("span", { class: "rg-i" }, "🔒"), h("span", { class: "rg-n" }, "Следующее: ранг " + n.r), h("span", { class: "rg-r" }, "")));
    });
    const hidden = st.cur ? st.list.length - st.cur.i - 2 : 0;
    if (hidden > 0) box.appendChild(h("div", { class: "muted" }, "Ещё " + S.plural(hidden, "испытание скрыто", "испытания скрыто", "испытаний скрыто") + " — откроются по одному."));
    if (!st.cur) box.appendChild(h("div", { class: "okline" }, "Тропа пройдена целиком. Титул: «" + ((S.D.trials.titles || {})[path] || "Мастер пути") + "»"));
    return S.win("Тропа испытаний · " + p.name, st.doneN + " из " + st.list.length + " · реальные испытания по порядку, не чаще одного в день", box);
  };
  const skills0 = V.skills;
  V.skills = function (root) {
    skills0(root);
    const p = S.BY[ui.skillPath];
    if (p && p.key !== "osnova") { const w = S.trailWin(p.key); if (w) root.appendChild(w); }
  };
})();
