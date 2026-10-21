/* Система для Дария — замена облака: база и список дел живут в телефоне (localStorage) */
(function () {
  "use strict";
  const APP = window.APP || {};
  const KEY = APP.key || "sysD_db", TKEY = APP.ttkey || "sysD_tt", APPN = APP.app || APPN;
  let DB = {}, TTS = { tasks: {}, comp: {} };
  try { DB = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { DB = {}; }
  try { TTS = JSON.parse(localStorage.getItem(TKEY)) || TTS; } catch (e) {}
  /* ---------- облачная копия: сохраняется сама, восстанавливается сама ---------- */
  const CLOUD = (APP.box || "https://textdb.dev/api/data/e70f9805-330d-4735-8cec-187972f073c2-") + (APP.me || "dariy") + "-save";
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const fresh = !localStorage.getItem(KEY);
  let cloudT = 0;
  function cloudSave() {
    if (LOCAL) return;
    clearTimeout(cloudT);
    cloudT = setTimeout(() => {
      const db = {}; Object.keys(DB).forEach((k) => { if (k.indexOf("codex/") !== 0) db[k] = DB[k]; });
      fetch(CLOUD, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ app: APPN, at: DB._at || Date.now(), db, tt: TTS }) }).catch(() => {});
    }, 30000);
  }
  let saveT = 0;
  function persist(mark) {
    if (mark !== false) DB._at = Date.now();
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(DB)); localStorage.setItem(TKEY, JSON.stringify(TTS)); } catch (e) {}
    }, 150);
    cloudSave();
  }
  window.addEventListener("pagehide", () => { if (window.__noSave) return; try { localStorage.setItem(KEY, JSON.stringify(DB)); localStorage.setItem(TKEY, JSON.stringify(TTS)); } catch (e) {} });

  /* ---------- посев контента ---------- */
  function init() {
  const SEED = window.SEED;
  if (SEED) {
    Object.keys(SEED.codex).forEach((id) => (DB["codex/" + id] = SEED.codex[id]));
    Object.keys(SEED.game).forEach((id) => { if (!DB["game/" + id]) DB["game/" + id] = SEED.game[id]; });
    Object.keys(SEED.main).forEach((id) => { if (!DB["main/" + id]) DB["main/" + id] = SEED.main[id]; });
    // опорные блоки: новые поля из посева (how) — без потери взятых навыков
    const cfg = DB["game/config"];
    Object.keys(SEED.game.config.dailyBlocks).forEach((k) => { if (!cfg.dailyBlocks[k] || DB._seedV !== SEED.v) cfg.dailyBlocks[k] = Object.assign({}, cfg.dailyBlocks[k] || {}, SEED.game.config.dailyBlocks[k]); });
    if (DB._seedV !== SEED.v) { const st = DB["game/state"]; st.dailies = SEED.game.state.dailies; }
    SEED.tasks.forEach((t) => { if (!TTS.tasks[t.id] || DB._seedV !== SEED.v) TTS.tasks[t.id] = Object.assign({}, TTS.tasks[t.id] || {}, t, TTS.tasks[t.id] && TTS.tasks[t.id].completedTime ? { completedTime: TTS.tasks[t.id].completedTime } : {}); });
    if (DB._seedV !== SEED.v) {
      (SEED.removeTasks || []).forEach((id) => { if (TTS.tasks[id]) TTS.tasks[id].deleted = true; });
      (SEED.removeEvents || []).forEach((k) => { if (DB[k]) delete DB[k]; DB._del = DB._del || {}; DB._del[k] = Date.now(); });
      Object.keys(SEED.ensureEvents || {}).forEach((k) => { if (!DB[k] && !(DB._del && DB._del[k])) DB[k] = Object.assign({}, SEED.ensureEvents[k], { ts: Date.now() }); });
    }
    DB._seedV = SEED.v;
    persist(false);
  }
  }
  /* слияние с облаком: события и отметки только складываются (ничего не теряется), снятые — помечаются */
  function mergeIn(x) {
    if (!x || x.app !== APPN || !x.db) return false;
    const c = x.db, ct = x.tt || { tasks: {}, comp: {} };
    const del = Object.assign({}, c._del || {}, DB._del || {}), tdel = Object.assign({}, ct._del || {}, TTS._del || {});
    let got = false;
    Object.keys(c).forEach((k) => { if (k.indexOf("ev/") === 0 && !DB[k] && !del[k]) { DB[k] = c[k]; got = true; } });
    Object.keys(del).forEach((k) => { delete DB[k]; });
    DB._t = DB._t || {};
    const U = (a1, b1) => Object.assign({}, b1 || {}, a1 || {}), uni = (a1, b1) => Array.from(new Set([].concat(a1 || [], b1 || [])));
    Object.keys(c).forEach((k) => {
      if (k.indexOf("ev/") === 0 || k.indexOf("codex/") === 0 || k[0] === "_") return;
      // у каждого документа своё время правки: побеждает та копия, которую правили позже; общее время базы не важно
      const cT = (c._t && c._t[k]) || x.at || 0, lT = (DB._t[k]) || (DB[k] ? (DB._at || 0) : 0), cloudNewer = cT > lT;
      const before = JSON.stringify(DB[k]);
      if (k === "game/ledger") {
        const L = DB[k] || {}, R = c[k] || {};
        DB[k] = Object.assign({}, cloudNewer ? R : L, { start: [L.start, R.start].filter(Boolean).sort()[0], done: U(L.done, R.done), dayOffs: U(L.dayOffs, R.dayOffs), pd: U(L.pd, R.pd), streakB: uni(L.streakB, R.streakB), trials: uni(L.trials, R.trials) });
      } else if (k === "game/player") {
        const L = DB[k] || {}, R = c[k] || {};
        DB[k] = Object.assign({}, cloudNewer ? Object.assign({}, L, R) : Object.assign({}, R, L), { duelSpins: U(L.duelSpins, R.duelSpins), seen: uni(L.seen, R.seen), ach: uni(L.ach, R.ach) });
      } else if (k.indexOf("main/") === 0 && DB[k]) {
        // прогресс главного квеста только растёт
        DB[k] = Object.assign({}, cloudNewer ? c[k] : DB[k], { cur: Math.max((DB[k] || {}).cur || 0, (c[k] || {}).cur || 0) });
      } else if (!DB[k] || cloudNewer) { DB[k] = c[k]; }
      if (JSON.stringify(DB[k]) !== before) got = true;
      DB._t[k] = Math.max(lT, cT);
    });
    Object.keys(ct.comp || {}).forEach((id) => { if (!TTS.comp[id] && !tdel[id]) { TTS.comp[id] = ct.comp[id]; got = true; } });
    Object.keys(tdel).forEach((id) => { delete TTS.comp[id]; });
    Object.keys(ct.tasks || {}).forEach((id) => {
      const a = TTS.tasks[id], b = ct.tasks[id];
      if (!a) { TTS.tasks[id] = b; got = true; return; }
      if (b.completedTime && !a.completedTime && !tdel[id]) { a.completedTime = b.completedTime; got = true; }
      if (b.deleted && !a.deleted) { a.deleted = true; got = true; }
    });
    DB._del = del; TTS._del = tdel; DB._at = Math.max(DB._at || 0, x.at || 0);
    return got;
  }
  function pull() { return fetch(CLOUD, { cache: "no-store" }).then((r) => r.text()).then((t) => JSON.parse(t)); }
  const ready = (!LOCAL ? Promise.race([
    pull().then((x) => { mergeIn(x); }).catch(() => {}),
    new Promise((r) => setTimeout(r, 6000))
  ]) : Promise.resolve()).then(() => { init(); if (!LOCAL) cloudSave(); });
  // пока страница открыта: раз в 2 минуты сливаемся с облаком; пришло новое — перезагрузка
  if (!LOCAL) setInterval(() => {
    if (document.querySelector(".mback")) return;
    pull().then((x) => { if (mergeIn(x)) { try { localStorage.setItem(KEY, JSON.stringify(DB)); localStorage.setItem(TKEY, JSON.stringify(TTS)); } catch (e) {} window.__noSave = true; location.reload(); } else cloudSave(); }).catch(() => {});
  }, 120000);

  function touch(path) { DB._t = DB._t || {}; DB._t[path] = Date.now(); }

  /* ---------- база ---------- */
  const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const docL = {}, colL = {};
  const colOf = (path) => path.split("/").slice(0, -1).join("/");
  function snapDoc(path) { const d = DB[path]; return { exists: d !== undefined, id: path.split("/").pop(), data: () => clone(d) }; }
  function colDocs(col) {
    const pre = col + "/", out = [];
    Object.keys(DB).forEach((k) => { if (k.indexOf(pre) === 0 && k.slice(pre.length).indexOf("/") < 0) out.push({ id: k.slice(pre.length), data: (function (v) { return () => clone(v); })(DB[k]) }); });
    return out;
  }
  function emit(path) {
    setTimeout(() => {
      (docL[path] || []).forEach((cb) => cb(snapDoc(path)));
      const col = colOf(path);
      (colL[col] || []).forEach((q) => q.fire());
    }, 0);
  }
  function deepMerge(a, b) {
    if (typeof a !== "object" || a === null || Array.isArray(a)) a = {};
    const o = Object.assign({}, a);
    Object.keys(b).forEach((k) => {
      const v = b[k];
      if (v && typeof v === "object" && v.__delete__) delete o[k];
      else if (v && typeof v === "object" && !Array.isArray(v)) o[k] = deepMerge(o[k], v);
      else o[k] = v;
    });
    return o;
  }
  function docRef(path) {
    return {
      id: path.split("/").pop(),
      get: () => Promise.resolve(snapDoc(path)),
      set: (d) => { DB[path] = clone(d); if (DB._del && DB._del[path]) delete DB._del[path]; touch(path); persist(); emit(path); return Promise.resolve(); },
      update: (d) => { DB[path] = deepMerge(DB[path], clone(d)); touch(path); persist(); emit(path); return Promise.resolve(); },
      delete: () => { delete DB[path]; if (path.indexOf("ev/") === 0) { DB._del = DB._del || {}; DB._del[path] = Date.now(); } touch(path); persist(); emit(path); return Promise.resolve(); },
      onSnapshot: (cb) => { (docL[path] = docL[path] || []).push(cb); setTimeout(() => cb(snapDoc(path)), 0); return () => { docL[path] = docL[path].filter((x) => x !== cb); }; }
    };
  }
  function query(col, ord, lim) {
    const q = {
      orderBy: (f, dir) => query(col, [f, dir || "asc"], lim),
      limit: (n) => query(col, ord, n),
      doc: (id) => docRef(col + "/" + id),
      get: () => Promise.resolve({ docs: run() }),
      onSnapshot: (cb) => {
        const L = { fire: () => cb({ docs: run(), size: run().length }) };
        (colL[col] = colL[col] || []).push(L);
        setTimeout(L.fire, 0);
        return () => { colL[col] = colL[col].filter((x) => x !== L); };
      }
    };
    function run() {
      let d = colDocs(col);
      if (ord) { const [f, dir] = ord; d.sort((a, b) => { const x = (a.data() || {})[f], y = (b.data() || {})[f]; return (x > y ? 1 : x < y ? -1 : 0) * (dir === "desc" ? -1 : 1); }); }
      if (lim) d = d.slice(0, lim);
      return d;
    }
    return q;
  }
  const db = { doc: docRef, collection: (c) => query(c) };

  /* ---------- встроенный список дел (вместо TickTick) ---------- */
  const day = (iso) => String(iso || "").slice(0, 10);
  const nowISO = () => { const t = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 19); return t + "+04:00"; };
  function inst(t, d) {
    const tm = (t.startDate || "").slice(10) || "T12:00:00+04:00";
    return { id: t.id + "@" + d, baseId: t.id, title: t.title, projectId: t.projectId, priority: t.priority || 0, tags: t.tags || null, startDate: d + tm, isAllDay: !!t.isAllDay, kind: t.kind || "TEXT", content: t.content || "" };
  }
  function undone(from, to) {
    const out = [];
    Object.values(TTS.tasks).forEach((t) => {
      if (t.deleted) return;
      if (t.repeatFlag) {
        if (day(t.startDate || t.created) > to) return;
        if (!TTS.comp[t.id + "@" + to]) out.push(inst(t, to));
      } else if (!t.completedTime && !(t.after && TTS.tasks[t.after] && !TTS.tasks[t.after].completedTime)) out.push(Object.assign({ kind: t.kind || "TEXT" }, t));
    });
    return out;
  }
  function completed(from, to) {
    return Object.values(TTS.comp).filter((c) => { const d = day(c.completedTime); return d >= from && d <= to; }).map(clone);
  }
  const watchers = [];
  function payloadFor(w) {
    const s = w.input.search || {}, from = day(s.startDate), to = day(s.endDate);
    return w.tool === "list_undone_tasks_by_date" ? undone(from, to) : completed(from, to);
  }
  function fireAll() { watchers.forEach((w) => setTimeout(() => w.h({ type: "data", result: { payload: payloadFor(w), cache: { storedAt: Date.now() } } }), 0)); }
  const mcp = {
    watchTool: (server, tool, input, h) => { const w = { tool, input, h }; watchers.push(w); setTimeout(() => h({ type: "data", result: { payload: payloadFor(w), cache: { storedAt: Date.now() } } }), 0); return () => { const i = watchers.indexOf(w); if (i >= 0) watchers.splice(i, 1); }; },
    invalidate: () => { fireAll(); return Promise.resolve(); },
    callTool: (server, tool, input) => {
      if (tool === "complete_task") {
        const id = input.task_id, base = id.split("@")[0], t = TTS.tasks[base];
        if (!t) return Promise.reject({ code: "tool_error", message: "нет такой задачи" });
        const rec = Object.assign(inst(t, id.indexOf("@") > 0 ? id.split("@")[1] : day(nowISO())), { id, completedTime: nowISO() });
        if (id.indexOf("@") < 0) { rec.id = base; rec.startDate = t.startDate || null; t.completedTime = rec.completedTime; }
        TTS.comp[rec.id] = rec; if (TTS._del && TTS._del[rec.id]) delete TTS._del[rec.id]; persist(); fireAll();
        return Promise.resolve({ payload: { ok: true } });
      }
      if (tool === "create_task") {
        const id = "t" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
        TTS.tasks[id] = Object.assign({ id, created: day(nowISO()) }, clone(input.task), { id });
        persist(); fireAll();
        return Promise.resolve({ payload: { id } });
      }
      return Promise.reject({ code: "tool_error", message: "не поддерживается: " + tool });
    }
  };

  /* ---------- служебное для движка ---------- */
  window.SYSD = {
    DB: () => DB, TT: () => TTS, persist, fireAll, emit,
    undo: (id) => { const rec = TTS.comp[id]; if (!rec) return; delete TTS.comp[id]; TTS._del = TTS._del || {}; TTS._del[id] = Date.now(); const t = TTS.tasks[id]; if (t) delete t.completedTime; persist(); fireAll(); },
    delTask: (id) => { const t = TTS.tasks[id]; if (t) { t.deleted = true; persist(); fireAll(); } },
    exportAll: () => JSON.stringify({ app: APPN, at: Date.now(), db: DB, tt: TTS }),
    importAll: (txt) => { const x = JSON.parse(txt); if (x.app !== APPN || !x.db) throw new Error("bad"); localStorage.setItem(KEY, JSON.stringify(x.db)); localStorage.setItem(TKEY, JSON.stringify(x.tt || { tasks: {}, comp: {} })); }
  };
  const caps = { db, mcp };
  window.claude = { use: (name) => ready.then(() => caps[name] || null) };
})();
