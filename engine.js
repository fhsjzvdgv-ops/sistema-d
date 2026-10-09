/* Система для Дария — вечерний подсчёт прямо в окне, карточки дел, шаги квестов навыков, резервная копия */
(function () {
  "use strict";
  const S = window.SYS, h = (...a) => S.h(...a), V = S.V, R = () => S.R();

  /* ---------- шестой путь: Музыка ---------- */
  const M = { key: "music", name: "Музыка", color: "var(--p-music)", hex: "#FF7AD9", short: "биты, запись, сведение", stat: "Звук" };
  S.PATHS.push(M); S.ALLP.splice(S.ALLP.length - 1, 0, M); S.BY.music = M;
  S.QUEST_KINDS.qi = 1;

  const LG = () => (S.D.ledger = S.D.ledger || {});
  const saveLedger = () => S.db && S.db.doc("game/ledger").set(S.D.ledger);
  const saveState = (patch) => { S.D.state = Object.assign({}, S.D.state || {}, patch); S.render(); return S.db.doc("game/state").set(S.D.state); };

  /* ---------- вечерний подсчёт ---------- */
  let running = false;
  S.localEvening = function () {
    if (running || !S.db || !S.ready.ev || !S.D.state || !S.D.config || !S.X) return;
    running = true;
    const P = [];
    try { run(P); } catch (e) { console.error(e); }
    Promise.all(P).catch(() => {}).then(() => { running = false; });
  };
  /* серия: только 6 главных дел; десятки дней; каждая новая десятка требует +1 главное дело */
  const MAIN = ["music", "train", "brave", "breath", "sweet", "plan"];
  S.mainDone = (d) => MAIN.filter((k) => S.has("blk-" + d + "-" + k)).length;
  S.streakCalc = function () {
    const L = LG(), t = S.today(), start = L.start || t, offs = new Set(Object.values(L.dayOffs || {}));
    const freezeFor = (d) => S.X && S.X.list.some((e) => e.k === "use" && e.m && e.m.item === "freeze" && e.m.forDate === d);
    let tens = 0, inTen = 0; const need = {};
    for (let d = start; d <= t; d = S.addDays(d, 1)) {
      need[d] = Math.min(6, 3 + tens);
      const ok = S.mainDone(d) >= need[d];
      if (ok) { inTen++; if (inTen >= 10) { tens++; inTen = 0; } }
      else if (d === t || offs.has(d) || freezeFor(d)) { /* сегодня ещё идёт / выходной / заморозка */ }
      else inTen = 0;
    }
    return { tens, inTen, need, today: need[t] || 3 };
  };
  S.minNeed = () => S.streakCalc().today;
  S.minCount = (d) => S.mainDone(d);
  S.dayClosed = (d) => S.mainDone(d) >= (S.streakCalc().need[d] || 3);
  S.minWin = function () {
    const c = S.streakCalc(), t = S.today(), n = S.mainDone(t), ok = n >= c.today;
    const dots = h("div", { class: "mind" }, Array.from({ length: 6 }, (_, i) => h("span", { class: i < n ? "on" : "" })));
    return S.win(ok ? "✓ День в серию" : "Серия: сегодня " + n + " из " + c.today + " главных",
      "Серия " + c.tens + " · день " + c.inTen + " из 10. В зачёт идут только 6 главных дел. Каждая новая десятка — на одно главное дело больше (сейчас " + c.today + " из 6).",
      dots, h("div", { class: "muted" }, "Сорвался посреди десятки — она начинается заново, прошлые сохраняются. Один пропуск в неделю прощается. Пропуск: −30 XP, −50 ◆ и 30 отжиманий в долг."));
  };
  function closedDay(d) { return S.dayClosed(d); }
  function run(P) {
    const L = LG(), t = S.today(), rr = R();
    if (!L.start) L.start = t;
    L.done = L.done || {}; L.dayOffs = L.dayOffs || {}; L.pd = L.pd || {}; L.trials = L.trials || []; L.streakB = L.streakB || [];
    const freezeFor = (d) => S.X.list.some((e) => e.k === "use" && e.m && e.m.item === "freeze" && e.m.forDate === d);
    // 1) прошедшие дни: выходной, штраф, итог дня
    for (let d = L.start; d < t; d = S.addDays(d, 1)) {
      if (L.done[d]) continue;
      L.done[d] = 1;
      const ok = closedDay(d), need = S.streakCalc().need[d] || 3;
      if (ok && !S.has("minday-" + d)) P.push(S.award({ id: "minday-" + d, k: "minday", t: "День в серию", p: "osnova", r: "D", d, quiet: true, noExtras: true, noCrit: true }));
      let note = "";
      if (!ok) {
        const ws = S.weekStart(d);
        if (freezeFor(d)) note = "Пропуск закрыт заморозкой.";
        else if (!L.dayOffs[ws]) { L.dayOffs[ws] = d; note = "Пропуск прощён: один выходной в неделю."; }
        else if ((rr.penalty || {}).mode === "on" && !S.has("pen-" + d)) {
          P.push(S.writeEv("pen-" + d, { k: "pen", t: "Пропуск дня", xp: -30, g: -50, p: "osnova", d, ts: Date.parse(d + "T23:59:00+04:00") }));
          P.push(S.ttCreate({ title: "💪 Долг: 30 отжиманий (за " + S.fmtDay(d) + ")", projectId: "sys", tags: ["тело"], priority: 3, content: "Штраф за пропуск дня. Можно частями. Отметь, когда отдашь." }).catch(() => {}));
          note = "Штраф: −30 XP, −50 ◆ и 30 отжиманий в долг. Десятка серии начинается заново.";
        }
      }
      const day = S.X.days[d] || { xp: 0, q: 0 }, md = S.mainDone(d);
      P.push(S.db.doc("log/" + d).set({ date: d, xp: day.xp, headline: ok ? "День в серию: +" + day.xp + " XP" : "День не в серию", text: "Главных дел: " + md + " из 6 (нужно было " + need + ")." + (note ? " " + note : "") + "\nОдин принцип на завтра: начни с самого лёгкого главного дела до телефона." }));
    }
    // 2) серия в десятках
    const sc = S.streakCalc(), st = S.D.state || {}, patch = {};
    if (st.streak !== sc.tens) patch.streak = sc.tens;
    if (st.streakDays !== sc.inTen) patch.streakDays = sc.inTen;
    if ((st.bestStreak || 0) < sc.tens) patch.bestStreak = sc.tens;
    if (sc.tens > 0 && L.streakB.indexOf("ten-" + sc.tens) < 0) {
      L.streakB.push("ten-" + sc.tens);
      P.push(S.writeEv("streak-ten-" + sc.tens, { k: "streak", t: "Серия " + sc.tens + ": десять дней подряд", p: "osnova", xp: 100 * sc.tens, g: 50 * sc.tens }));
      P.push(S.writeEv("chest-ten-" + sc.tens, { k: "chest", t: "Сундук серии " + sc.tens, xp: 0, g: 0, m: { n: sc.tens * 10 } }));
      S.FX && S.FX.banner("[ СЕРИЯ " + sc.tens + " ]", "Десять дней подряд. Следующая десятка — " + Math.min(6, 3 + sc.tens) + " главных дела в день.");
    }
    // 3) фаза
    const ph = (rr.phases || []).find((x) => t >= x.from && (!x.until || t <= x.until));
    if (ph && st.phase !== ph.key) patch.phase = ph.key;
    // 4) практика навыков-привычек по закрытым блокам
    const sk = Object.assign({}, S.D.skills || {}); let skCh = false;
    S.X.list.forEach((e) => {
      if (e.k !== "blk" || !e.m || !e.m.block) return;
      const key = e.m.block, dd = e.d; L.pd[dd] = L.pd[dd] || [];
      if (L.pd[dd].indexOf(key) >= 0) return;
      L.pd[dd].push(key);
      Object.keys(sk).forEach((id) => {
        const s = sk[id]; if (!s || !(s.active > 0) || s.block !== key || s.paused) return;
        s.days = (s.days || 0) + 1; skCh = true;
        const need = (rr.habits || {}).daysToMaster || 21;
        if (s.days >= need) {
          const def = S.findSkill(id), pth = S.allSkills().find((x) => x.sk.id === id);
          P.push(S.writeEv("tier-" + id + "-" + s.active, { k: "tier", t: "Ступень освоена: " + (def ? def.name : id) + " " + S.ROMAN[s.active], p: pth ? pth.p.key : "mental", xp: (rr.xp || {}).tierMastered || 100, g: 33 }));
          s.mastered = s.active; s.active = 0; s.days = 0;
          const cfgB = (S.D.config.dailyBlocks || {})[key];
          if (cfgB && key === id) { P.push(S.db.doc("game/config").update({ dailyBlocks: { [key]: { __delete__: true } } })); const tk = cfgB.steps && cfgB.steps[0]; if (tk && tk.taskId) window.SYSD.delTask(tk.taskId); }
          delete s.block;
          S.FX && S.FX.banner("[ СТУПЕНЬ ОСВОЕНА ]", (def ? def.name : id) + " — можно брать следующую ступень в «Навыках».");
        }
      });
    });
    if (skCh) P.push(S.db.doc("game/skills").set(sk));
    // 5) ранговое испытание
    const order = S.RANKS, cur = st.rank || "E";
    const next = (rr.ranks || []).filter((x) => S.X.level >= x.from && order.indexOf(x.r) > order.indexOf(cur)).sort((a, b) => order.indexOf(a.r) - order.indexOf(b.r))[0];
    if (next) {
      const title = "Ранговое испытание " + next.r + ": сделать то, во что не верил, что сможешь";
      const TT = window.SYSD.TT();
      const task = Object.values(TT.tasks).find((x) => x.title === title && !x.deleted);
      if (!task && L.trials.indexOf(next.r) < 0) { L.trials.push(next.r); P.push(S.ttCreate({ title, projectId: "sys", priority: 5, content: "Выбери одну вещь, которую считал невозможной для себя (позвонить, выступить, показать трек, отжаться 30 раз…), и сделай. Отметь — и получишь ранг " + next.r + "." }).catch(() => {})); }
      if (task && task.completedTime && !S.has("trial-" + next.r)) {
        P.push(S.writeEv("trial-" + next.r, { k: "trial", t: "Ранг " + next.r + ": " + next.title, p: "mental", xp: (rr.xp || {}).rankTrial || 200, g: 100 }));
        patch.rank = next.r; patch.title = next.title;
        S.FX && S.FX.banner("[ НОВЫЙ РАНГ " + next.r + " ]", next.title + ". Ты сделал то, во что не верил.");
      }
    }
    if (Object.keys(patch).length) P.push(saveState(patch));
    P.push(saveLedger());
  }
  const tick0 = S.tick;
  S.tick = function () { tick0.apply(this, arguments); S.localEvening(); };

  /* ---------- шаги квестов навыков (вместо чеклиста TickTick) ---------- */
  S.questStep = function (q) {
    const TT = window.SYSD.TT(), task = TT.tasks[q._id] || {}, items = task.items || [];
    const n = (q.stepNo || 1) - 1, title = (items[n] && items[n].title) || q.step || "Шаг";
    const rr = R(), xp = (rr.xp || {}).questItem || 15;
    S.award({ id: "qi-" + q._id + "-" + n, k: "qi", t: "Шаг квеста: " + title, p: q.path, r: "C", m: { quest: q._id } }).then((x) => {
      if (!x) return;
      const total = q.stepsTotal || items.length || 1;
      if (n + 1 >= total) {
        S.db.doc("quests/" + q._id).update({ status: "done", stepNo: total, step: "" });
        S.writeEv("qd-" + q._id, { k: "qd", t: "Квест закрыт: " + q.title, p: q.path, xp: (rr.xp || {}).questDone || 100, g: 33 });
        if (q.skill) {
          const s = Object.assign({}, (S.D.skills || {})[q.skill] || {});
          S.writeEv("tier-" + q.skill + "-" + q.tier, { k: "tier", t: "Ступень освоена: " + q.title, p: q.path, xp: (rr.xp || {}).tierMastered || 100, g: 33 });
          s.mastered = q.tier; s.active = 0; delete s.taskId;
          S.db.doc("game/skills").update({ [q.skill]: s });
        }
        S.FX.banner("[ КВЕСТ ПРОЙДЕН ]", q.title);
      } else S.db.doc("quests/" + q._id).update({ stepNo: n + 2, step: (items[n + 1] && items[n + 1].title) || "" });
    });
  };
  const lq0 = S.legacyQuests;
  S.legacyQuests = function () {
    const w = lq0(); if (!w) return w;
    const list = (S.D.quests || []).filter((q) => q.status !== "later").sort((a, b) => (a.status === "done") - (b.status === "done") || (a.order || 0) - (b.order || 0));
    const cards = w.querySelectorAll(".quest");
    list.forEach((q, i) => { const c = cards[i]; if (!c || q.status === "done") return; c.appendChild(h("button", { class: "btn sm", type: "button", onclick: () => S.questStep(q) }, "Шаг сделан · " + S.preview("C", q.path))); });
    const sub = w.querySelector(".win-sub, small"); if (sub && /TickTick|вечерний/.test(sub.textContent)) sub.textContent = "Сделал текущий шаг — жми «Шаг сделан»";
    return w;
  };

  /* ---------- карточка дела ---------- */
  function compsOf(baseId, title) {
    const C = window.SYSD.TT().comp;
    return Object.values(C).filter((c) => (c.baseId || c.id) === baseId || c.title === title);
  }
  function taskStreak(days) {
    const set = new Set(days); let n = 0, d = S.today();
    if (!set.has(d)) d = S.addDays(d, -1);
    while (set.has(d)) { n++; d = S.addDays(d, -1); }
    return n;
  }
  S.taskCard = function (title) {
    const TT = window.SYSD.TT(), c = S.D.config || {}, t = S.today();
    const base = Object.values(TT.tasks).find((x) => !x.deleted && (x.title === title || String(x.title).slice(0, 12) === String(title).slice(0, 12)));
    let blockKey = null; Object.keys(c.dailyBlocks || {}).forEach((k) => { if ((c.dailyBlocks[k].steps || []).some((s) => s.title === title || (base && s.taskId === base.id))) blockKey = k; });
    const blk = blockKey ? c.dailyBlocks[blockKey] : null;
    const dl = ((S.D.state || {}).dailies || []).find((x) => x.block === blockKey);
    const comps = base ? compsOf(base.id, base.title) : [];
    const days = comps.map((x) => (x.startDate || x.completedTime || "").slice(0, 10));
    const doneToday = comps.find((x) => (x.startDate || x.completedTime || "").slice(0, 10) === t || (x.completedTime || "").slice(0, 10) === t);
    const cls = base ? S.ttClass(Object.assign({}, base, { id: base.id + "@" + t })) : null;
    const p = S.BY[(cls && cls.p) || (blk && blk.path)] || {};
    const skId = (blk && blk.skill) || (cls && cls.skill), skDef = skId && S.findSkill(skId), skSt = skId && (S.D.skills || {})[skId];
    const lines = [];
    const row = (a, b) => h("div", { class: "res-row" }, h("span", null, a), h("b", null, b));
    lines.push(row("Путь", p.name || "—"));
    if (cls && cls.r) lines.push(row("Награда", S.preview(cls.r, cls.p) + (blk ? " · весь блок ещё +D" : "")));
    if (base && base.repeatFlag) { lines.push(row("Серия по делу", taskStreak(days) + " дн. подряд")); lines.push(row("Всего выполнено", days.length + " раз")); }
    lines.push(row("Сегодня", doneToday ? "✓ сделано" : "ещё нет"));
    const cond = [
      base && base.repeatFlag ? "Повторяется каждый день. Засчитывается за день, если отметил до 23:59." : "Разовое дело: отметил — закрыто.",
      blk ? "Главное дело — идёт в серию. Серия считается десятками дней; сейчас нужно " + S.minNeed() + " из 6 главных в день." : "Не главное дело: даёт опыт и золото, но в серию не идёт.",
      blk ? "Все 6 главных за день = «идеальный день» и бонус." : null,
      "Не набрал главных дел: −30 XP, −50 ◆ и 30 отжиманий в долг, десятка серии заново (один выходной в неделю прощается).",
      skDef ? "Прокачивает навык «" + skDef.name + "»" + (skSt && skSt.active ? " — дней практики " + (skSt.days || 0) + " из 21." : ". Возьми его в «Навыках», чтобы дни шли в зачёт ступени.") : null
    ].filter(Boolean);
    let m;
    const btns = [h("button", { class: "btn ghost", type: "button", onclick: () => m.close() }, "Закрыть")];
    if (base && !doneToday) btns.push(h("button", { class: "btn", type: "button", onclick: () => { m.close(); S.ttComplete(base.repeatFlag ? Object.assign({}, base, { id: base.id + "@" + t }) : base); } }, "Выполнить"));
    if (doneToday) btns.push(h("button", { class: "btn ghost", type: "button", onclick: () => { m.close(); S.undoTask(doneToday.id); } }, "Отменить отметку"));
    if (base && !base.repeatFlag && !doneToday && base.projectId === "sys" && !/^Ранговое/.test(base.title)) btns.push(h("button", { class: "btn ghost", type: "button", onclick: () => { m.close(); window.SYSD.delTask(base.id); } }, "Удалить"));
    m = S.FX.modal([h("div", { class: "m-sys" }, "КАРТОЧКА ДЕЛА" + (blk ? " · ГЛАВНОЕ" : "")), h("div", { class: "m-t" }, title),
      base && (base.content || (blk && blk.how)) ? h("div", { class: "m-x" }, h("span", { class: "lbl" }, "Что делать"), (blk && blk.how) || base.content) : null,
      (dl && dl.why) || (base && base.why) ? h("div", { class: "m-x" }, h("span", { class: "lbl" }, "Зачем"), (dl && dl.why) || base.why) : null,
      h("div", { class: "res" }, lines),
      h("div", { class: "m-x" }, h("span", { class: "lbl" }, "Условия"), h("ul", { class: "conds" }, cond.map((x) => h("li", null, x)))),
      h("div", { class: "m-btns" }, btns)], { cls: "sheet" });
  };
  S.undoTask = function (compId) {
    window.SYSD.undo(compId);
    const id = "tt-" + compId;
    if (S.D.ev[id]) { delete S.D.ev[id]; S.db.doc("ev/" + id).delete(); }
    const t = S.today();
    ["minday-" + t, "allblk-" + t].forEach((x) => { if (S.D.ev[x]) { delete S.D.ev[x]; S.db.doc("ev/" + x).delete(); } });
    Object.keys(S.D.ev).forEach((x) => { if (x.indexOf("blk-" + t + "-") === 0) { delete S.D.ev[x]; S.db.doc("ev/" + x).delete(); } });
    S.derive(); S.render(); S.FX.toast("[ СИСТЕМА ] Отметка снята, опыт за неё убран");
  };
  const today0 = V.today;
  V.today = function (root) {
    today0(root);
    root.querySelectorAll(".tl, .dl").forEach((r) => {
      const tt = r.querySelector(".tl-t, .dl-t"); if (!tt) return;
      const body = r.querySelector(".tl-body, .dl-b"); body.style.cursor = "pointer";
      const title = tt.textContent, TTt = window.SYSD.TT().tasks;
      const base = Object.values(TTt).find((x) => !x.deleted && x.title === title);
      const sm = body.querySelector("small");
      if (base && base.cond && sm && !r.classList.contains("done")) {
        const cls = S.ttClass(Object.assign({}, base, { id: base.id + "@" + S.today() }));
        sm.textContent = (base.main ? "главное" : "бонус") + (cls && cls.r ? " · " + S.preview(cls.r, cls.p) : "") + " · " + base.cond;
      }
      body.appendChild(h("div", { class: "tl-more" }, "подробнее ›"));
      body.addEventListener("click", () => S.taskCard(tt.textContent));
    });
  };
  V.quests = V.today;

  /* ---------- главный квест: цель закрывается сама ---------- */
  const main0 = V.main;
  V.main = function (root) {
    main0(root);
    root.querySelectorAll(".okline").forEach((x) => { if (/Claude/.test(x.textContent)) x.textContent = "Все шаги пройдены — цель закрыта!"; });
    root.querySelectorAll("button").forEach((b) => { if (/Сбросить разбивку/.test(b.textContent)) b.remove(); });
  };

  /* ---------- резервная копия в Меню ---------- */
  const more0 = V.more;
  V.more = function (root) {
    more0(root);
    const inp = h("input", { type: "file", accept: ".json,application/json", hidden: true, onchange: (e) => {
      const f = e.target.files[0]; if (!f) return; const r = new FileReader();
      r.onload = () => { try { window.SYSD.importAll(r.result); location.reload(); } catch (x) { S.FX.toast("[ СИСТЕМА ] Это не файл копии игры"); } };
      r.readAsText(f);
    } });
    root.appendChild(S.win("Резервная копия", "Вся игра хранится только в этом телефоне. Раз в неделю скачивай копию — если почистишь браузер, восстановишь из файла.",
      h("div", { class: "m-btns" },
        h("button", { class: "btn", type: "button", onclick: () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([window.SYSD.exportAll()], { type: "application/json" })); a.download = "sistema-dariy-" + S.today() + ".json"; a.click(); S.FX.toast("[ СИСТЕМА ] Копия скачана"); } }, "Скачать копию"),
        h("button", { class: "btn ghost", type: "button", onclick: () => inp.click() }, "Загрузить копию")), inp));
  };
})();
