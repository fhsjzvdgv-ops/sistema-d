/* Система v6.5 — понятный интерфейс: главный экран = статус + дела дня, дерево навыков, курс */
(function () {
  "use strict";
  const S = window.SYS, h = (...a) => S.h(...a), V = S.V, R = () => S.R(), ui = S.ui;

  /* ================= ДЕРЕВО: замки по родителям ================= */
  S.treeOf = (path) => (((S.D.tree || {}).paths || {})[path]) || null;
  S.treeParents = function (id) {
    const t = S.D.tree && S.D.tree.paths; if (!t) return [];
    for (const k in t) { const pp = (t[k].parents || {})[id]; if (pp) return pp; }
    return [];
  };
  const mastered = (id) => ((S.D.skills[id] || {}).mastered || 0);
  const skillName = (id) => { const sk = S.findSkill && S.findSkill(id); return sk ? sk.name : id; };
  const status0 = S.skillStatus;
  S.skillStatus = function (sk, p) {
    const s = status0(sk, p);
    if ((s.c === "avail" || s.c === "held" || s.c === "locked") && !mastered(sk.id)) {
      const par = S.treeParents(sk.id);
      if (par.length && !par.some((id) => mastered(id) >= 1)) return { c: "locked", gate: true, label: "откроется после «" + par.map(skillName).join("» или «") + "»", tier: s.tier };
    }
    return s;
  };

  /* ================= ДЕРЕВО: отрисовка ================= */
  const ICON = { mastered: "★", active: "●", avail: "+", held: "⏸", paused: "‖", locked: "🔒" };
  S.treeView = function (p) {
    const tr = S.treeOf(p.key), cx = S.D.codex[p.key];
    if (!tr || !cx || !cx.skills) return h("div", { class: "empty" }, "Загружается…");
    const byId = {}; cx.skills.forEach((sk) => (byId[sk.id] = sk));
    const ROW = 112, TOP = 14, H = TOP + tr.rows.length * ROW;
    const pos = {};
    tr.rows.forEach((row, r) => row.forEach((id, i) => (pos[id] = { x: ((i + 0.5) / row.length) * 100, y: TOP + r * ROW })));
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 " + H); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("class", "tree-lines"); svg.setAttribute("aria-hidden", "true");
    Object.keys(tr.parents || {}).forEach((cid) => (tr.parents[cid] || []).forEach((pid) => {
      if (!pos[cid] || !pos[pid]) return;
      const a = pos[pid], b = pos[cid], on = mastered(pid) >= 1;
      const ln = document.createElementNS(NS, "path");
      const y1 = a.y + 84, y2 = b.y - 2, my = (y1 + y2) / 2;
      ln.setAttribute("d", "M" + a.x + " " + y1 + " C " + a.x + " " + my + ", " + b.x + " " + my + ", " + b.x + " " + y2);
      ln.setAttribute("class", "tl-edge" + (on ? " on" : ""));
      ln.setAttribute("vector-effect", "non-scaling-stroke");
      svg.appendChild(ln);
    }));
    const box = h("div", { class: "tree", style: { height: H + "px", "--pc": p.color } }, svg);
    Object.keys(pos).forEach((id) => {
      const sk = byId[id]; if (!sk) return;
      const s = S.skillStatus(sk, p), st = S.D.skills[id] || {}, n = (sk.tiers || []).length;
      const pips = h("span", { class: "tn-pips" }, Array.from({ length: n }, (_, i) => h("i", { class: i < (st.mastered || 0) ? "m" : st.active === i + 1 ? "a" : "" })));
      const node = h("button", { class: "tn " + s.c, type: "button", style: { left: pos[id].x + "%", top: pos[id].y + "px" }, "aria-label": sk.name + ": " + s.label, onclick: () => S.skillSheet(sk, p) },
        h("span", { class: "tn-c" }, ICON[s.c] || "○"), h("span", { class: "tn-n" }, sk.name), pips);
      box.appendChild(node);
    });
    return box;
  };

  V.skills = function (root) {
    const sl = S.slots();
    if (!ui.skillPath || !S.BY[ui.skillPath]) ui.skillPath = "mental";
    const order = [S.OSNOVA].concat(S.PATHS);
    const tabs = h("div", { class: "ptabs wrapt", role: "tablist" }, order.map((p) => h("button", { class: "ptab" + (ui.skillPath === p.key ? " on" : ""), type: "button", role: "tab", "aria-selected": ui.skillPath === p.key ? "true" : "false", style: { "--pc": p.color }, onclick: () => { ui.skillPath = p.key; S.render(true); } }, p.name + " · " + S.X.pl[p.key].level)));
    const p = S.BY[ui.skillPath];
    root.appendChild(h("div", { class: "sk-head" }, h("b", null, "Мест: привычек " + sl.hab + "/" + sl.hMax + " · квестов " + sl.qst + "/" + sl.qMax), h("small", null, "Сверху корни — они открыты сразу. Освоил ступень I — открываются ветки ниже. Можно выбирать любую открытую.")));
    root.appendChild(tabs);
    root.appendChild(S.win(p.key === "osnova" ? "Основа" : "Путь «" + p.name + "»", p.short, S.treeView(p),
      h("div", { class: "legend" }, h("span", { class: "lg mastered" }, "освоен"), h("span", { class: "lg active" }, "в работе"), h("span", { class: "lg avail" }, "можно взять"), h("span", { class: "lg held" }, "после фазы"), h("span", { class: "lg locked" }, "закрыт"))));
    if (S.activeTracks().length) root.appendChild(S.win("В работе", "Нажми: что делать сейчас и что дальше", S.legacyActive()));
    if (p.key !== "osnova" && S.trailWin) { const w = S.trailWin(p.key); if (w) root.appendChild(w); }
  };

  /* ================= КУРС ================= */
  S.courseMods = () => ((S.D.course || {}).modules) || [];
  S.crsId = (m, i) => "crs-" + m.id + "-" + (i + 1);
  S.modDone = (m) => m.tasks.every((_, i) => S.has(S.crsId(m, i)));
  S.modProgress = (m) => m.tasks.filter((_, i) => S.has(S.crsId(m, i))).length;
  S.courseState = function () {
    const mods = S.courseMods(), cur = mods.find((m) => !S.modDone(m)) || null;
    const exId = (S.D.player || {}).courseExtra, extra = exId && cur && exId !== cur.id ? mods.find((m) => m.id === exId && !S.modDone(m)) : null;
    return { mods, cur, extra, doneN: mods.filter(S.modDone).length };
  };
  S.crsTask = function (m) { const i = m.tasks.findIndex((_, j) => !S.has(S.crsId(m, j))); return i < 0 ? null : { i, t: m.tasks[i] }; };
  function modWin(m, label) {
    const sk = S.findSkill(m.skill), p = S.BY[m.path] || S.OSNOVA;
    const box = h("div", { class: "crs" });
    box.appendChild(h("div", { class: "crs-why" }, m.why));
    box.appendChild(h("ul", { class: "crs-l" }, m.lesson.map((x) => h("li", null, x))));
    m.tasks.forEach((t, i) => {
      const id = S.crsId(m, i);
      box.appendChild(S.questCard({ t: t.t, how: t.how, p: m.path, r: t.r, done: S.has(id), label: "Задание " + (i + 1) + " из " + m.tasks.length, onDo: (c) => S.doQuest({ id, k: "crs", t: "Курс «" + m.title + "»: " + t.t, p: m.path, r: t.r, m: { mod: m.id } }, c) }));
    });
    if (sk) {
      const s = S.skillStatus(sk, p);
      box.appendChild(h("div", { class: "crs-sk" }, h("span", null, "Навык темы: «" + sk.name + "» — " + s.label), h("button", { class: "btn sm ghost", type: "button", onclick: () => S.skillSheet(sk, p) }, s.c === "avail" ? "Взять" : "Открыть")));
    }
    return S.win(label + " · " + m.title, (S.BY[m.path] || {}).name + " · " + S.modProgress(m) + " из " + m.tasks.length, box);
  }
  S.courseStages = () => ((S.D.course || {}).stages) || [];
  S.stageOf = (m) => S.courseStages().find((s) => s.n === m.stage) || null;
  V.course = function (root) {
    const cs = S.courseState(), stages = S.courseStages();
    if (!cs.mods.length) { root.appendChild(h("div", { class: "empty" }, "Курс загружается…")); return; }
    const curSt = cs.cur ? S.stageOf(cs.cur) : null;
    root.appendChild(h("div", { class: "sk-head" }, h("b", null, "Курс: " + cs.doneN + " из " + cs.mods.length + " тем" + (curSt ? " · ступень " + curSt.n + " из " + stages.length + " «" + curSt.title + "»" : "")), h("small", null, "Длинный путь, а не марафон: темп — тема в неделю, можно быстрее. Тема пройдена, когда сделаны её 3 задания. Одну тему можно вести параллельно — «по желанию».")));
    if (cs.cur) root.appendChild(modWin(cs.cur, "Тема " + cs.cur.n));
    if (cs.extra) root.appendChild(modWin(cs.extra, "По желанию"));
    const list = h("div", { class: "crs-list" });
    let lastSt = null;
    cs.mods.forEach((m) => {
      const st = S.stageOf(m);
      if (st && st !== lastSt) {
        lastSt = st;
        const sm = cs.mods.filter((x) => x.stage === st.n), sd = sm.filter(S.modDone).length;
        list.appendChild(h("div", { class: "crs-stage" + (sd === sm.length ? " done" : "") }, h("b", null, "Ступень " + st.n + " · " + st.title), h("small", null, st.why + " · " + sd + " из " + sm.length)));
      }
      const done = S.modDone(m), isCur = cs.cur && m.id === cs.cur.id, isEx = cs.extra && m.id === cs.extra.id;
      const right = done ? h("span", { class: "ok" }, "✓") : isCur ? h("span", { class: "rg-r" }, "сейчас") : isEx ? h("span", { class: "rg-r" }, "по желанию") : !cs.extra ? h("button", { class: "btn sm ghost", type: "button", onclick: () => S.setPlayer({ courseExtra: m.id }).then(() => S.FX.banner("[ ТЕМА ПО ЖЕЛАНИЮ ]", "«" + m.title + "» — теперь идёт параллельно с основной.")) }, "взять") : h("span", { class: "rg-r" }, "");
      list.appendChild(h("div", { class: "crs-row" + (done ? " done" : "") }, h("span", { class: "crs-n" }, String(m.n)), h("span", { class: "crs-t" }, m.title, h("small", null, (S.BY[m.path] || {}).name + " · " + S.modProgress(m) + "/" + m.tasks.length)), right));
    });
    root.appendChild(S.win("Программа", "4 ступени по порядку: тело → голова → люди → дело. «Взять» — одна тема по желанию параллельно.", list));
    if (cs.extra) root.appendChild(h("div", { class: "muted" }, "Сменить тему по желанию — сначала закончи «" + cs.extra.title + "»."));
  };

  /* ================= ГЛАВНЫЙ ЭКРАН ================= */
  function statusCard() {
    const X = S.X, st = S.D.state || {}, pl = S.D.player || {}, t = S.today();
    const need = S.minNeed ? S.minNeed() : 3, n = S.dayClosed && S.dayClosed(t) ? need : Math.min(need, S.minCount ? S.minCount(t) : 0);
    const pct = Math.round((100 * X.L.in) / X.L.need);
    const paths = h("div", { class: "hs-paths" }, S.ALLP.map((p) => h("button", { class: "hs-p", type: "button", style: { "--pc": p.color }, onclick: () => { ui.skillPath = p.key; S.go("skills"); } }, h("i"), p.name, h("b", null, String(X.pl[p.key].level)))));
    return h("section", { class: "win hs" },
      h("button", { class: "hs-top", type: "button", onclick: () => S.go("status"), "aria-label": "Профиль" },
        h("span", { class: "hs-lv" }, h("small", null, "УРОВЕНЬ"), h("b", null, String(X.level))),
        h("span", { class: "hs-mid" }, h("b", null, pl.nick || st.player || "Игрок"), h("small", null, (pl.title || st.title || "Пробуждённый") + " · ранг " + (st.rank || "E")), S.bar(pct, "xpbar"), h("small", null, X.L.in + " / " + X.L.need + " XP до уровня " + (X.level + 1)))),
      h("div", { class: "hs-row" },
        h("span", { class: "hs-min" }, "Главные ", h("span", { class: "mind sm" }, Array.from({ length: need }, (_, i) => h("span", { class: i < n ? "on" : "" })))),
        h("span", null, "серия ", h("b", null, String(st.streak || 0)), " · " + (st.streakDays || 0) + "/10"),
        h("span", null, h("b", { class: "gold" }, "◆ " + X.gold))),
      n >= need ? h("div", { class: "okline" }, "✓ День засчитан. Всё остальное сегодня — бонус.") : h("div", { class: "muted" }, "Серия — только за главные дела. Пропуск: −30 XP, −50 ◆ и 30 отжиманий в долг."),
      paths);
  }
  function courseCard() {
    const cs = S.courseState(); if (!cs.cur) return null;
    const m = cs.cur;
    return h("button", { class: "win crs-card", type: "button", onclick: () => S.go("course") },
      h("span", { class: "crs-k" }, "КУРС · " + (S.stageOf(m) ? "СТУПЕНЬ " + S.stageOf(m).n + " · " : "") + "ТЕМА " + m.n + " ИЗ " + cs.mods.length), h("b", null, m.title), h("small", null, S.modProgress(m) + " из " + m.tasks.length + " заданий" + (cs.extra ? " · по желанию: " + cs.extra.title : "") + " →"));
  }
  const hhmm = (s) => { const mm = String(s || "").match(/(\d{1,2}):(\d{2})/); return mm ? mm[1].padStart(2, "0") + ":" + mm[2] : null; };
  const taskTime = (t) => (!t || !t.startDate || t.isAllDay ? null : S.fmtTime(S.parseTT(t.startDate)));
  function rowEl(it) {
    const q = S.BY[it.p];
    return h("div", { class: "dl" + (it.done ? " done" : "") },
      h("span", { class: "dl-dot", style: q ? { background: q.color } : null }),
      h("span", { class: "dl-b" }, h("span", { class: "dl-t" }, it.title), h("small", null, [it.tag, it.time].filter(Boolean).join(" · "))),
      it.done ? h("span", { class: "dl-ok" }, it.doneText || "✓") : it.onDo ? h("button", { class: "btn sm", type: "button", disabled: it.busy ? true : null, onclick: it.onDo }, it.busy ? "…" : it.btn || "Готово") : null);
  }
  function collectDay() {
    const c = S.D.config || {}, t = S.today(), now = S.hourOf(Date.now()), items = [], seen = new Set();
    const nowM = Math.floor(now) * 60 + Math.round((now % 1) * 60);
    const mins = (s) => { const a = (s || "").split(":").map(Number); return a.length === 2 ? a[0] * 60 + a[1] : null; };
    const prev = (r, p) => S.preview(r, p);
    // опорные шаги
    Object.keys(c.dailyBlocks || {}).forEach((key) => {
      const b = c.dailyBlocks[key]; if (b.auto) return;
      (b.steps || []).forEach((st) => {
        const tk = S.taskToday(st); if (tk.d) seen.add(tk.d.id); if (tk.u) seen.add(tk.u.id);
        const tm = hhmm(st.time) || hhmm(b.time), m = mins(tm), ev = tk.d && S.X.byId["tt-" + tk.d.id];
        let sc = 60;
        items.push({ title: st.title, p: b.path, tag: "опора · " + b.name, time: tm, done: !!tk.d, doneText: ev ? "+" + ev.xp + " XP" : "✓", sc, sort: tm || "12:00",
          busy: tk.u && S.tt.busy[tk.u.id], onDo: tk.u ? () => S.FX.confirm("Готово?", st.title + " — " + prev((R().tt || {}).dailyStep || "E", b.path)).then((ok) => ok && S.ttComplete(tk.u)) : null });
      });
    });
    // испытание дня
    if (S.D.trials && S.trialState) {
      const used = S.X.list.find((e) => e.k === "node" && e.d === t);
      if (used) items.push({ title: used.t.replace(/^Испытание: /, ""), p: used.p, tag: "испытание дня", done: true, doneText: "+" + used.xp + " XP", sc: 0, sort: "00:00" });
      else { const path = S.weakPath(S.addDays(t, -7), S.addDays(t, -1)), ts = S.trialState(path), n = ts.cur;
        if (n) items.push({ title: n.t, p: path, tag: "испытание дня · " + (S.BY[path] || {}).name + " · ранг " + n.r, sc: 45, sort: "99:00", onDo: () => S.doQuest({ id: n.id, k: "node", t: "Испытание: " + n.t, p: path, r: n.r, m: { node: n.i + 1 } }) }); }
    }
    // курс
    const cs = S.courseState ? S.courseState() : {};
    [cs.cur, cs.extra].filter(Boolean).forEach((m, j) => { const ct = S.crsTask(m); if (!ct) return; const id = S.crsId(m, ct.i);
      items.push({ title: ct.t.t, p: m.path, tag: "курс · " + m.title + " · ранг " + ct.t.r, sc: j ? 18 : 30, sort: "99:10", onDo: () => S.doQuest({ id, k: "crs", t: "Курс «" + m.title + "»: " + ct.t.t, p: m.path, r: ct.t.r, m: { mod: m.id } }) }); });
    (S.X.byKind.crs || []).filter((e) => e.d === t).forEach((e) => items.push({ title: e.t.replace(/^Курс «[^»]+»: /, ""), p: e.p, tag: "курс", done: true, doneText: "+" + e.xp + " XP", sc: 0, sort: "00:00" }));
    // наставник недели
    if (S.mentorWeek && S.D.pools) { const mw = S.mentorWeek(); const d = S.X.byId[mw.id];
      items.push({ title: mw.q.t, p: mw.path, tag: "наставник " + mw.men.name + " · задание недели · ранг A", done: !!d && d.d === t, doneText: d ? "+" + d.xp + " XP" : "✓", hide: !!d && d.d !== t, sc: S.dow(t) <= 2 ? 25 : 16, sort: "99:20",
        onDo: () => S.doQuest({ id: mw.id, k: "mw", t: "Задание наставника: " + mw.q.t, p: mw.path, r: "A", m: { mentor: mw.men.key } }) }); }
    // задачи TickTick
    (S.tt.undone || []).forEach((task) => {
      if (seen.has(task.id) || (task.projectId === c.dailyListId && S.isAnchor(task))) return;
      const cls = S.ttClass(task); if (!cls) return;
      if (cls.kind === "loot") { items.push({ title: task.title, tag: "награда — забери без вины", sc: 5, sort: "98:00", btn: "Забрал", onDo: () => S.ttComplete(task) }); return; }
      const pr = task.priority || 0;
      items.push({ title: task.title, p: cls.p, tag: (S.BY[cls.p] || {}).name + " · ранг " + cls.r, time: taskTime(task), sc: pr >= 5 ? 48 : pr >= 3 ? 35 : 15, sort: taskTime(task) || "50:00", busy: S.tt.busy[task.id],
        onDo: () => S.FX.confirm("Готово?", task.title + " — " + prev(cls.r, cls.p)).then((ok) => ok && S.ttComplete(task)) });
    });
    (S.tt.done || []).filter((x) => x.completedTime && S.ttDay(x, S.ttClass(x)).d === t).forEach((task) => {
      if (seen.has(task.id) || task.projectId === c.dailyListId) return;
      const ev = S.X.byId["tt-" + task.id]; if (!ev) return;
      items.push({ title: task.title, p: ev.p, tag: (S.BY[ev.p] || {}).name, done: true, doneText: "+" + ev.xp + " XP", sc: 0, sort: "00:00" });
    });
    (S.X.byKind.rec || []).concat(S.X.byKind.node ? [] : []).filter((e) => e.d === t).forEach((e) => items.push({ title: e.t, p: e.p, tag: "квест из базы", done: true, doneText: "+" + e.xp + " XP", sc: 0, sort: "00:00" }));
    return items.filter((x) => !x.hide);
  }
  V.today = function (root) {
    if (S.tt.err) root.appendChild(h("div", { class: "warn" }, S.tt.err));
    Object.keys(S.X.chests).forEach((id) => { const cc = S.X.chests[id]; if (!cc.opened) root.appendChild(h("button", { class: "pend", type: "button", onclick: () => S.openChest(id) }, "◈ Сундук серии — открыть")); });
    if ((S.X.inv.chest_small || 0) > 0) root.appendChild(h("button", { class: "pend", type: "button", onclick: () => S.openSmallChest() }, "◈ Малый сундук — открыть"));
    root.appendChild(statusCard());
    const cc = courseCard(); if (cc) root.appendChild(cc);

    const all = collectDay(), undone = all.filter((x) => !x.done), done = all.filter((x) => x.done);
    undone.sort((a, b) => (b.sc - a.sc) || String(a.sort).localeCompare(String(b.sort)));
    const main = undone.slice(0, 6).sort((a, b) => String(a.sort).localeCompare(String(b.sort))), rest = undone.slice(6).sort((a, b) => String(a.sort).localeCompare(String(b.sort)));
    const list = h("div", { class: "dlist" }, main.map(rowEl));
    if (!main.length) list.appendChild(h("div", { class: "empty" }, S.tt.undone == null ? "Загружаю дела…" : "На сегодня всё сделано. Отдыхай без вины."));
    root.appendChild(S.win("Главное на сегодня", "6 главных дел — только они идут в серию. Делай когда удобно, отмечай до полуночи. Нажми на дело — откроется карточка.", list));

    if (rest.length || true) {
      const det = S.keep(h("details", { class: "dq" }), "rest-open");
      det.appendChild(h("summary", null, h("span", { class: "dq-t" }, "Остальные дела"), h("span", { class: "dq-n" }, String(rest.length)), h("span", { class: "more" }, "открыть")));
      const body = h("div", { class: "qlist" }, h("div", { class: "dlist" }, rest.map(rowEl)));
      body.appendChild(S.dailyQuestsBox());
      const lq = S.legacyQuests && S.legacyQuests(); if (lq) body.appendChild(lq);
      det.appendChild(body);
      root.appendChild(h("section", { class: "win" }, det));
    }
    if (done.length) {
      const det = S.keep(h("details", { class: "dq" }), "done-open");
      det.appendChild(h("summary", null, h("span", { class: "dq-t" }, "Сделано сегодня"), h("span", { class: "dq-n" }, String(done.length)), h("span", { class: "more" }, "открыть")));
      det.appendChild(h("div", { class: "qlist" }, h("div", { class: "dlist" }, done.map(rowEl))));
      root.appendChild(h("section", { class: "win" }, det));
    }
    root.appendChild(S.ownAdd());
  };
  V.quests = V.today;
  V.knowledge = function (root) { root.appendChild(S.knowWin()); };
  const hud0 = S.renderHud;
  S.renderHud = function () { hud0.apply(this, arguments); try { document.body.dataset.view = ui.view === "quests" ? "today" : ui.view; } catch (e) {} };


  /* ================= КАК ИГРАТЬ (один раз) ================= */
  const HOWTO = [
    ["Каждый день — экран «Сегодня»", "Сверху твой уровень и серия: в зачёт идут только 6 главных дел. Серия считается десятками дней, каждая новая десятка требует на одно главное дело больше. Ниже «Главное на сегодня» — 5 дел. Сделал — жмёшь «Готово». Нажми на само дело — откроется его карточка: что делать, зачем, награда и серия."],
    ["Курс — твоя программа", "Темы по порядку: короткий урок, 3 задания и навык темы. Темп — тема в неделю. Параллельно можно взять одну тему по желанию."],
    ["Навыки — дерево", "Корни открыты сразу. Освоил ступень — открываются ветки ниже. Выбираешь сам, сколько позволяют места."],
    ["Вечером ничего делать не надо", "Утром Система сама подведёт итог вчерашнего дня. Пропуск минимума — штраф: −30 XP, −50 ◆ и 30 отжиманий в долг. Один пропуск в неделю прощается. Остальные разделы — в «Меню», открываются с уровнем."]
  ];
  S.howTo = function (i) {
    i = i || 0; if (i >= HOWTO.length) { S.setPlayer({ howto65: Date.now() }); return; }
    const m = S.FX.modal([h("div", { class: "m-sys" }, "КАК ИГРАТЬ · " + (i + 1) + "/" + HOWTO.length), h("div", { class: "m-t" }, HOWTO[i][0]), h("div", { class: "m-x" }, HOWTO[i][1]),
      h("div", { class: "m-btns" }, h("button", { class: "btn", type: "button", onclick: () => { m.close(); S.howTo(i + 1); } }, i + 1 < HOWTO.length ? "Дальше" : "Понятно"))], { sticky: true });
  };
  const today0 = V.today;
  V.today = function (root) {
    today0(root);
    const pl = S.D.player || {};
    if (!pl.howto65 && pl.onboarded && !S.hold && !document.querySelector(".mback") && !S._howShown) { S._howShown = true; setTimeout(() => S.howTo(0), 600); }
  };
  V.quests = V.today;

  /* ================= МЕНЮ: профиль ================= */
  const more0 = V.more;
  V.more = function (root) {
    root.appendChild(h("div", { class: "menu" }, h("button", { class: "mi", type: "button", onclick: () => S.go("status") }, h("b", null, "Профиль"), h("small", null, "Статус, цель месяца, пути, бонусы")), h("button", { class: "mi", type: "button", onclick: () => S.go("knowledge") }, h("b", null, "Знания"), h("small", null, "Понятия из базы — откуда что взялось")), h("button", { class: "mi", type: "button", onclick: () => S.howTo(0) }, h("b", null, "Как играть"), h("small", null, "Четыре коротких экрана"))));
    more0(root);
  };
})();
