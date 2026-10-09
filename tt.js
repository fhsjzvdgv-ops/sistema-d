/* Система v6 — TickTick вживую: чтение дел, «Выполнить», начисление */
(function () {
  "use strict";
  const S = window.SYS, TT = "TickTick";
  const R = () => S.R();
  const cfg = () => S.D.config || {};
  let unU = null, unD = null, watchDay = null;

  S.ttErrText = function (e) {
    const c = e && e.code;
    if (c === "needs_reauth") return "TickTick отключился — переподключи его в claude.ai → Настройки → Коннекторы.";
    if (c === "server_not_connected" || c === "selection_required") return "TickTick не подключён к claude.ai — добавь его в Настройках → Коннекторы.";
    if (c === "not_in_manifest" || c === "consent_required") return "Окну не разрешён доступ к TickTick. Разреши его, когда Claude спросит.";
    if (c === "blocked_by_policy" || c === "approval_required") return "Доступ к TickTick закрыт политикой аккаунта.";
    if (c === "server_unavailable" || c === "rate_limited") return "TickTick не отвечает — пробую снова.";
    if (c === "tool_error") return "TickTick ответил ошибкой: " + ((e && e.message) || "");
    if (c === "not_granted" || c === "capability_disabled" || c === "capability_removed") return "Живой TickTick недоступен в этом окне. Дела засчитает вечерний подсчёт.";
    return "Не получилось связаться с TickTick" + (e && e.message ? ": " + e.message : "");
  };
  function payloadList(res) {
    const p = res && (res.payload !== undefined ? res.payload : res);
    if (Array.isArray(p)) return p;
    if (p && Array.isArray(p.result)) return p.result;
    if (p && typeof p === "string") { try { const j = JSON.parse(p); return Array.isArray(j) ? j : j.result || []; } catch (e) {} }
    return [];
  }
  S.cutoffDay = () => ((S.D.base && S.D.base.at) || "2026-09-29").slice(0, 10);

  S.ttStart = function () {
    if (!S.mcp) return;
    const t = S.today();
    if (watchDay === t && unU) return;
    if (unU) unU(); if (unD) unD();
    watchDay = t;
    const from = [S.addDays(t, -6), S.cutoffDay()].sort()[1];
    unU = S.mcp.watchTool(TT, "list_undone_tasks_by_date", { search: { startDate: S.isoStart(t), endDate: S.isoEnd(t) }, client_timezone: S.TZ }, (ev) => {
      if (ev.type === "data") { S.tt.undone = payloadList(ev.result); S.tt.err = null; S.tt.at = (ev.result.cache && ev.result.cache.storedAt) || Date.now(); S.render(); }
      else onErr(ev.error, "undone");
    }, { refetchInterval: 60000 });
    unD = S.mcp.watchTool(TT, "list_completed_tasks_by_date", { search: { startDate: S.isoStart(from), endDate: S.isoEnd(t) }, client_timezone: S.TZ }, (ev) => {
      if (ev.type === "data") { S.tt.done = payloadList(ev.result); S.tt.err = null; S.ttAward(); S.render(); }
      else onErr(ev.error, "done");
    }, { refetchInterval: 60000 });
  };
  function onErr(e, which) {
    const c = e && e.code;
    const deny = { needs_reauth: 1, server_not_connected: 1, blocked_by_policy: 1, approval_required: 1, not_in_manifest: 1, consent_required: 1, not_granted: 1, capability_disabled: 1, selection_required: 1 };
    if (deny[c]) { if (which === "undone") S.tt.undone = null; else S.tt.done = null; }
    S.tt.err = S.ttErrText(e);
    S.render();
  }
  S.ttRefresh = function () {
    if (!S.mcp) return Promise.resolve();
    return Promise.all([S.mcp.invalidate(TT, "list_completed_tasks_by_date").catch(() => {}), S.mcp.invalidate(TT, "list_undone_tasks_by_date").catch(() => {})]);
  };

  /* ---------- классификация ---------- */
  function norm(s) { return String(s || "").trim(); }
  S.stepMatch = function (title, step) {
    const a = norm(title), b = norm(step.title);
    if (!a || !b) return false;
    if (a === b || a.slice(0, 12) === b.slice(0, 12)) return true;
    const u = (S.tt.undone || []).find((x) => x.id === step.taskId);
    return !!(u && norm(u.title) === a);
  };
  S.blockOf = function (task) {
    const c = cfg(); if (!c.dailyBlocks || task.projectId !== c.dailyListId) return null;
    for (const key in c.dailyBlocks) {
      const b = c.dailyBlocks[key];
      const st = (b.steps || []).find((s) => S.stepMatch(task.title, s));
      if (st) return { key, b, step: st };
    }
    return null;
  };
  S.isAnchor = function (task) {
    const c = cfg();
    return (c.dailyAnchors || []).some((a) => norm(a.title) === norm(task.title) || norm(a.title).slice(0, 10) === norm(task.title).slice(0, 10));
  };
  function prioRank(p, map) { return (map || {})[String(p || 0)] || "E"; }
  S.ttClass = function (task) {
    const c = cfg(), r = R(), tt = r.tt || {}, title = norm(task.title);
    const folders = (r.folders || {}), excl = folders.exclude || [];
    if (task.kind === "NOTE") return null;
    if (c.rulesTaskId && task.id === c.rulesTaskId) return null;
    if ((S.D.quests || []).some((q) => q._id === task.id)) return null;
    if (/^(Ранговое испытание|Взять навык:)/.test(title)) return null;
    if (/^Добыча:/.test(title)) return { kind: "loot" };
    if (excl.indexOf(task.projectId) >= 0 || /^inbox/.test(task.projectId || "")) return null;
    const blk = S.blockOf(task);
    if (blk) {
      const sk = S.findSkill && S.findSkill(blk.b.skill);
      return { kind: "md", r: tt.dailyStep || "E", p: blk.b.path, block: blk.key, skill: blk.b.skill, branches: sk && sk.branches };
    }
    if (task.projectId === c.dailyListId) { if (S.isAnchor(task)) return null; return { kind: "tt", r: prioRank(task.priority, tt.prio), p: "mental" }; }
    const sp = (r.special || []).find((x) => title.indexOf(x.match) === 0);
    if (sp) { if (!sp.xp) return null; return { kind: "tt", r: "C", p: sp.path === "mental" ? "osnova" : sp.path || "osnova", special: 1 }; }
    if (/^Разбор (срыва|отказа)/.test(title)) return { kind: "tt", r: "C", p: "osnova", special: 1 };
    if (/^Замер:/.test(title)) return { kind: "tt", r: "E", p: "telo" };
    const own = S.ownFind && S.ownFind(task);
    if (task.projectId === c.ticktickProjectId) {
      let p = "mental";
      (task.tags || []).some((tg) => { const k = (c.tagToPath || {})[String(tg).toLowerCase()]; if (k) { p = k; return true; } return false; });
      return { kind: own ? "own" : "tt", r: own ? own.r : prioRank(task.priority, tt.systemPrio || tt.prio), p: own && own.p ? own.p : p };
    }
    const fp = (folders.lists || {})[task.projectId];
    return { kind: own ? "own" : "tt", r: own ? own.r : prioRank(task.priority, tt.prio), p: fp || (own && own.p) || "mental" };
  };
  S.ttDay = function (task, cls) {
    const ts = S.parseTT(task.completedTime);
    let d = S.dayOf(ts);
    // шаг дня засчитывается в день своего повтора (отбой, отмеченный утром, — за вчера)
    if (cls && cls.kind === "md" && task.startDate) {
      const sd = S.dayOf(S.parseTT(task.startDate));
      if (sd && sd <= d && S.diffDays(sd, d) <= 1) d = sd;
    } else if (cls && cls.block === "sleep" && S.hourOf(ts) < 6) d = S.addDays(d, -1);
    return { ts, d };
  };

  /* ---------- начисление ---------- */
  let awarding = false;
  S.ttAward = function () {
    if (!S.ready.ev || !S.ready.base || !S.ready.codex || !S.ready.quests || !S.ready.own || !S.D.config || awarding) return;
    const done = S.tt.done || [], cut = S.cutoffDay();
    awarding = true;
    const fresh = [], quiet = [];
    const jobs = [];
    done.forEach((task) => {
      if (!task || !task.id || !task.completedTime) return;
      const cls = S.ttClass(task); if (!cls) return;
      const w = S.ttDay(task, cls); if (!w.d || w.d < cut) return;
      if (cls.kind === "loot") { const id = "lootc-" + task.id; if (!S.has(id)) jobs.push(() => S.writeEv(id, { k: "lootc", t: task.title, xp: 0, g: 0, ts: w.ts, d: w.d, m: { title: task.title } })); return; }
      const id = "tt-" + task.id; if (S.has(id)) return;
      const isFresh = Date.now() - w.ts < 5 * 60000;
      let ps = null;
      if (cls.branches && cls.branches.length > 1) { const sec = ((R().branchSplit || {}).second) || 0.3; ps = {}; ps[cls.branches[0]] = 1 - sec; ps[cls.branches[1]] = sec; }
      jobs.push(() => S.award({ id, k: cls.kind, t: task.title, p: cls.p, r: cls.r, ts: w.ts, d: w.d, ps, quiet: !isFresh, noExtras: !isFresh, m: { src: "tt", list: task.projectId, block: cls.block || null } }).then((x) => { if (x) (isFresh ? fresh : quiet).push(x); }));
    });
    // блоки дня
    const c = cfg(); const days = {};
    done.forEach((task) => { const cls = S.ttClass(task); if (!task.completedTime) return; const w = S.ttDay(task, cls); if (w.d >= cut) (days[w.d] = days[w.d] || []).push({ task, cls }); });
    jobs.push(() => S.blocksAward(days));
    let p = Promise.resolve();
    jobs.forEach((j) => (p = p.then(j).catch(() => {})));
    p.then(() => {
      awarding = false;
      if (quiet.length) {
        const xp = quiet.reduce((a, x) => a + x.xp, 0), g = quiet.reduce((a, x) => a + x.g, 0);
        S.FX && S.FX.toast("[ СИСТЕМА ] Засчитано из TickTick: " + S.plural(quiet.length, "дело", "дела", "дел") + " · +" + xp + " XP · +" + g + " ◆");
      }
    });
  };
  S.blocksStatus = function (d, items) {
    const c = cfg(), out = {};
    if (!c.dailyBlocks) return out;
    items = items || (S.tt.done || []).filter((t) => t.completedTime).map((task) => ({ task, cls: S.ttClass(task) })).filter((x) => S.ttDay(x.task, x.cls).d === d);
    Object.keys(c.dailyBlocks).forEach((key) => {
      const b = c.dailyBlocks[key];
      if (b.auto) {
        const a = b.auto;
        const ok = items.some((x) => ((a.lists || []).indexOf(x.task.projectId) >= 0 && (x.task.priority || 0) >= (a.minPriority || 3)) || (x.task.projectId === c.ticktickProjectId && (x.task.tags || []).map((t) => String(t).toLowerCase()).indexOf(a.systemTag) >= 0));
        out[key] = { done: ok ? 1 : 0, need: 1, b };
      } else {
        const n = (b.steps || []).filter((s) => items.some((x) => x.task.projectId === c.dailyListId && S.stepMatch(x.task.title, s))).length;
        out[key] = { done: n, need: b.need || (b.steps || []).length || 1, b };
      }
    });
    return out;
  };
  S.blocksAward = function (days) {
    const tt = R().tt || {}; let p = Promise.resolve();
    Object.keys(days).sort().forEach((d) => {
      const st = S.blocksStatus(d, days[d]);
      const keys = Object.keys(st); if (!keys.length) return;
      keys.forEach((key) => {
        const s = st[key]; if (s.done < s.need) return;
        const id = "blk-" + d + "-" + key; if (S.has(id)) return;
        p = p.then(() => S.award({ id, k: "blk", t: "Блок закрыт: " + s.b.name, p: s.b.path, r: tt.blockBonus || "D", d, ts: Date.now(), quiet: d !== S.today(), noExtras: true, noCrit: true, m: { block: key } }));
      });
      if (keys.every((k) => st[k].done >= st[k].need)) {
        const id = "allblk-" + d;
        if (!S.has(id)) p = p.then(() => S.award({ id, k: "allblk", t: "Идеальный день: все опорные блоки", p: "osnova", r: "D", d, quiet: d !== S.today(), noExtras: true, noCrit: true }).then((x) => { if (x && d === S.today() && S.FX) S.FX.banner("[ ИДЕАЛЬНЫЙ ДЕНЬ ]", "Все опорные блоки закрыты. Это бонус сверх минимума."); }));
      }
    });
    return p;
  };

  /* ---------- действия ---------- */
  S.ttComplete = function (task) {
    if (!S.mcp || !task) return Promise.resolve(false);
    S.tt.busy[task.id] = 1; S.render();
    return S.mcp.callTool(TT, "complete_task", { project_id: task.projectId, task_id: task.id }).then(() => {
      S.FX && S.FX.sound("tick");
      return S.ttRefresh().then(() => true);
    }, (e) => {
      delete S.tt.busy[task.id]; S.render();
      S.FX && S.FX.toast("[ СИСТЕМА ] " + S.ttErrText(e)); S.FX && S.FX.sound("err");
      return false;
    }).then((ok) => { setTimeout(() => { delete S.tt.busy[task.id]; S.render(); }, 4000); return ok; });
  };
  function createdId(res) {
    const p = res && (res.payload !== undefined ? res.payload : res);
    if (p && p.id) return p.id;
    if (p && p.result && p.result.id) return p.result.id;
    if (p && typeof p === "string") { const m = p.match(/[0-9a-f]{24}/); if (m) return m[0]; }
    return null;
  }
  S.ttCreate = function (task) {
    if (!S.mcp) return Promise.reject({ code: "not_granted" });
    return S.mcp.callTool(TT, "create_task", { task: Object.assign({ timeZone: S.TZ }, task), client_timezone: S.TZ }).then((res) => { S.ttRefresh(); return createdId(res); });
  };
  S.autoRank = function (t) {
    const s = String(t).toLowerCase();
    if (/(лпр|финал|оффер|выступ)/.test(s)) return "A";
    if (/(собес|интервью|тестов|трениров|10 000)/.test(s)) return "B";
    if (/(подготов|разобрат|резюме|кейс|отклик|отжим|прогул|уборк)/.test(s)) return "C";
    if (/(написат|ответит|позвонит|отправит|прочитат|записат|купит|оплатит)/.test(s)) return "D";
    return s.length > 60 ? "D" : "E";
  };
  S.ownList = () => ((S.D.own && S.D.own.items) || []);
  S.ownFind = (task) => S.ownList().find((o) => (o.id && o.id === task.id) || (!o.id && o.t === norm(task.title)));
  S.ownCreate = function (title, path) {
    const t = norm(title); if (!t) return Promise.resolve(false);
    const today = S.today(), mine = S.ownList().filter((o) => o.d === today);
    const max = (R().own || {}).max || 8;
    if (mine.length >= max) { S.FX.toast("[ СИСТЕМА ] Лимит своих квестов на сегодня: " + max); return Promise.resolve(false); }
    const r = S.autoRank(t), prio = { E: 0, D: 1, C: 3, B: 5, A: 5, S: 5 }[r] || 0;
    const c = cfg(); const tag = Object.keys(c.tagToPath || {}).find((k) => c.tagToPath[k] === path);
    return S.ttCreate({ title: t, projectId: c.ticktickProjectId, startDate: S.isoStart(today), dueDate: S.isoStart(today), isAllDay: true, priority: prio, tags: tag ? [tag] : null, content: "Свой квест из окна «Системы». Ранг " + r + "." }).then((id) => {
      const items = S.ownList().concat([{ id, t, r, p: path || null, d: today }]).slice(-120);
      S.D.own = { items }; S.save("game/own", S.D.own);
      S.FX.toast("[ СИСТЕМА ] Квест создан · ранг " + r + " · ещё можно " + (max - mine.length - 1));
      S.FX.sound("tick"); S.render();
      return true;
    }, (e) => { S.FX.toast("[ СИСТЕМА ] " + S.ttErrText(e)); return false; });
  };
  S.createLootTask = function (item, tier, L) {
    const c = cfg(); if (!S.mcp || !c.ticktickProjectId) return;
    const tn = { small: "малая", mid: "средняя", big: "большая" }[tier] || "";
    S.ttCreate({ title: "Добыча: " + item.name, projectId: c.ticktickProjectId, priority: 0, content: "Выпала " + tn + " добыча за уровень " + L + ". " + (item.why || "") + " Забери без вины, потом поставь галочку. Хочешь другую награду этого же уровня — бери её." }).catch(() => {});
  };
})();
