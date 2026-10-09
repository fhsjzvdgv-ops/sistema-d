/* Система v6 — ядро: данные, расчёты, действия */
(function () {
  "use strict";
  const S = (window.SYS = window.SYS || {});
  const TZ = "Europe/Astrakhan";
  S.TZ = TZ;

  /* ---------- пути ---------- */
  S.PATHS = [
    { key: "mental", name: "Ментал", color: "var(--p-mental)", hex: "#4CC9F0", short: "ум, характер, решения", stat: "Интеллект" },
    { key: "materia", name: "Материя", color: "var(--p-materia)", hex: "#E8B04B", short: "деньги и ресурсы", stat: "Достаток" },
    { key: "telo", name: "Тело", color: "var(--p-telo)", hex: "#FF6B6B", short: "здоровье и боеспособность", stat: "Сила" },
    { key: "socium", name: "Социум", color: "var(--p-socium)", hex: "#5DD39E", short: "свои люди и связи", stat: "Харизма" },
    { key: "obrazy", name: "Образы", color: "var(--p-obrazy)", hex: "#C77DFF", short: "как тебя видят и слышат", stat: "Облик" }
  ];
  S.OSNOVA = { key: "osnova", name: "Основа", color: "var(--p-osnova)", hex: "#F2E6C9", short: "личная ответственность", stat: "Концентрация" };
  S.ALLP = S.PATHS.concat([S.OSNOVA]);
  S.BY = {}; S.ALLP.forEach((p) => (S.BY[p.key] = p));
  S.RANKS = ["E", "D", "C", "B", "A", "S", "N"];
  S.ROMAN = ["", "I", "II", "III", "IV", "V"];
  S.QUEST_KINDS = { tt: 1, md: 1, rec: 1, own: 1, men: 1, menw: 1, cls: 1, chain: 1, mar: 1, leg: 1, cre: 1, loc: 1, main: 1, pomo: 1, jr: 1, gr: 1, sea: 1, wkl: 1, chal: 1, prac: 1, rev: 1, pact: 1, mod: 1, sk: 1, node: 1, mw: 1, crs: 1 };

  /* ---------- время (всё в поясе Астрахани) ---------- */
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  function parts(ts) { const o = {}; fmt.formatToParts(new Date(ts)).forEach((p) => (o[p.type] = p.value)); return o; }
  S.dayOf = (ts) => { const o = parts(ts); return o.year + "-" + o.month + "-" + o.day; };
  S.hourOf = (ts) => { const o = parts(ts); return +o.hour + +o.minute / 60; };
  S.today = () => S.dayOf(Date.now());
  S.addDays = (ymd, n) => { const a = ymd.split("-").map(Number); return new Date(Date.UTC(a[0], a[1] - 1, a[2] + n)).toISOString().slice(0, 10); };
  S.dow = (ymd) => { const a = ymd.split("-").map(Number); return (new Date(Date.UTC(a[0], a[1] - 1, a[2])).getUTCDay() + 6) % 7; };
  S.weekStart = (ymd) => S.addDays(ymd, -S.dow(ymd));
  S.diffDays = (a, b) => { const x = a.split("-").map(Number), y = b.split("-").map(Number); return Math.round((Date.UTC(y[0], y[1] - 1, y[2]) - Date.UTC(x[0], x[1] - 1, x[2])) / 86400000); };
  S.isoStart = (ymd) => ymd + "T00:00:00+04:00";
  S.isoEnd = (ymd) => ymd + "T23:59:59+04:00";
  S.parseTT = (s) => (s ? Date.parse(String(s).replace(/([+-]\d\d)(\d\d)$/, "$1:$2")) : NaN);
  S.fmtDay = (ymd) => { const a = String(ymd || "").split("-"); if (a.length < 3) return ymd || ""; return new Date(Date.UTC(+a[0], +a[1] - 1, +a[2], 12)).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" }); };
  S.fmtTime = (ts) => new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  S.plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return n + " " + (m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c); };
  S.hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  S.pick = (arr, seed) => arr[S.hash(seed) % arr.length];

  /* ---------- данные ---------- */
  S.D = {
    rules: null, codex: {}, pools: null, world: null, growth: null, knowledge: null,
    state: null, skills: {}, config: null, rewards: null, base: null, player: null,
    ev: {}, day: null, journal: [], main: {}, quests: [], log: [], answers: {}, unload: [], ask: []
  };
  S.ready = { db: false, ev: false, player: false, base: false, codex: false };
  S.tt = { undone: null, done: null, err: null, at: 0, busy: {} };
  S.db = null; S.mcp = null; S.sample = null;
  S.hold = true; // эффекты уровня ждут, пока не пройдёт запуск

  const R = () => S.D.rules || {};
  S.R = R;

  /* ---------- уровни ---------- */
  S.needL = (L) => { const l = R().level || { base: 60, k: 40, pow: 1.3 }; return Math.round(l.base + (l.k || 40) * Math.pow(L, l.pow || 1)); };
  S.levelFrom = (xp) => { let L = 1, r = Math.max(0, Math.floor(xp || 0)); while (r >= S.needL(L) && L < 100000) { r -= S.needL(L); L++; } return { level: L, in: r, need: S.needL(L) }; };
  S.xpForLevel = (L) => { let t = 0; for (let i = 1; i < L; i++) t += S.needL(i); return t; };
  S.needP = (L) => { const l = R().pathLevel || { base: 40, k: 30, pow: 1.2 }; return Math.round(l.base + l.k * Math.pow(L, l.pow)); };
  S.pathLevel = (xp) => { let L = 1, r = Math.max(0, Math.floor(xp || 0)); while (r >= S.needP(L) && L < 100000) { r -= S.needP(L); L++; } return { level: L, in: r, need: S.needP(L) }; };
  S.rankReward = (r) => { const q = (R().qrank || {})[r] || [10, 3]; return { xp: q[0], g: q[1] }; };
  S.levelScale = (L) => { const s = R().levelScale || { per: 0.03, cap: 2.5 }; return Math.min(s.cap, 1 + s.per * (L - 1)); };

  /* ---------- производные ---------- */
  S.X = null;
  function evList() {
    const all = Object.keys(S.D.ev).map((id) => Object.assign({ _id: id }, S.D.ev[id])).filter((e) => e && e.k);
    all.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    let cut = -1; all.forEach((e, i) => { if (e.k === "reset") cut = i; });
    return { list: cut >= 0 ? all.slice(cut + 1) : all, reset: cut >= 0 };
  }
  S.derive = function () {
    const E = evList(), list = E.list, base = E.reset ? null : S.D.base || null;
    const X = {
      xp: base ? +base.xp || 0 : 0, g: base ? +base.g || 0 : 0, goldEarned: 0, goldSpent: 0,
      paths: {}, pathQ: {}, byKind: {}, byId: {}, days: {}, inv: {}, boosts: [], perm: { xp: 0, g: 0 }, perks: {},
      quests: 0, crits: 0, drops: 0, flows: [], chests: {}, lvlClaimed: {}, arts: {}, stats: {}, list: list
    };
    S.ALLP.forEach((p) => { X.paths[p.key] = base && base.paths ? +base.paths[p.key] || 0 : 0; X.pathQ[p.key] = 0; });
    const shop = {}; ((S.D.growth && S.D.growth.shop) || []).forEach((it) => (shop[it.id] = it));
    list.forEach((e) => {
      X.byId[e._id] = e;
      (X.byKind[e.k] = X.byKind[e.k] || []).push(e);
      const xp = +e.xp || 0, g = +e.g || 0;
      X.xp += xp; X.g += g;
      if (g > 0) X.goldEarned += g; else X.goldSpent -= g;
      if (e.ps) Object.keys(e.ps).forEach((k) => { if (X.paths[k] != null) X.paths[k] += +e.ps[k] || 0; });
      else if (e.p && X.paths[e.p] != null) X.paths[e.p] += xp;
      const d = e.d || S.dayOf(e.ts || Date.now());
      const day = (X.days[d] = X.days[d] || { xp: 0, g: 0, q: 0, byPath: {}, crits: 0, rerolls: 0, pomos: 0, kinds: {}, blocks: {}, first: null, qts: [] });
      day.xp += xp; day.g += g; day.kinds[e.k] = (day.kinds[e.k] || 0) + 1;
      if (S.QUEST_KINDS[e.k]) {
        X.quests++; day.q++; day.qts.push(e.ts || 0);
        if (e.p && X.pathQ[e.p] != null) X.pathQ[e.p]++;
        if (e.p) day.byPath[e.p] = (day.byPath[e.p] || 0) + xp;
        if (e.m && e.m.crit) { X.crits++; day.crits++; }
      }
      if (e.k === "blk") day.blocks[(e.m && e.m.block) || "?"] = 1;
      if (e.k === "pomo") day.pomos++;
      if (e.k === "reroll") day.rerolls++;
      if (e.k === "drop") X.drops++;
      if (e.k === "flow") X.flows.push(e.ts);
      if (e.k === "lvl" && e.m) X.lvlClaimed[e.m.level] = e;
      if (e.k === "perk" && e.m) X.perks[e.m.path] = Math.max(X.perks[e.m.path] || 0, e.m.tier);
      // инвентарь
      const addItem = (id, n) => { if (!id) return; X.inv[id] = (X.inv[id] || 0) + n; };
      if (e.k === "buy" && e.m && e.m.item && !(shop[e.m.item] && (shop[e.m.item].instant || shop[e.m.item].perm))) addItem(e.m.item, e.m.qty || 1);
      if (e.k === "buy" && e.m && shop[e.m.item] && shop[e.m.item].perm) { const pm = shop[e.m.item].perm; X.perm.xp += pm.xp || 0; X.perm.g += pm.g || 0; X.inv[e.m.item] = 1; }
      if ((e.k === "drop" || e.k === "chesto" || e.k === "lvl" || e.k === "boss" || e.k === "gift") && e.m && e.m.items) e.m.items.forEach((it) => addItem(it, 1));
      if (e.k === "use" && e.m && e.m.item) {
        addItem(e.m.item, -1);
        const it = shop[e.m.item];
        if (it && it.hours) X.boosts.push({ item: e.m.item, from: e.ts, until: e.ts + it.hours * 3600000, mult: it.mult });
        if (e.m.item === "x2next") X.boosts.push({ item: "x2next", from: e.ts, until: Infinity, pending: true });
      }
      if (e.m && e.m.art) X.arts[e.m.art] = (X.arts[e.m.art] || 0) + 1;
      if (e.k === "chest") X.chests[e._id] = X.chests[e._id] || { ev: e, opened: false };
      if (e.k === "chesto" && e.m && e.m.chest) X.chests[e.m.chest] = Object.assign(X.chests[e.m.chest] || {}, { opened: true });
    });
    // ×2 на следующий квест: гасится первым квестом после применения
    X.boosts.forEach((b) => {
      if (b.item !== "x2next") return;
      const used = list.some((e) => S.QUEST_KINDS[e.k] && (e.ts || 0) > b.from && e.m && e.m.x2);
      b.until = used ? b.from : Infinity;
    });
    X.gold = X.g;
    X.L = S.levelFrom(X.xp);
    X.level = X.L.level;
    X.pl = {}; S.ALLP.forEach((p) => (X.pl[p.key] = S.pathLevel(X.paths[p.key])));
    X.today = S.today();
    X.td = X.days[X.today] || { xp: 0, g: 0, q: 0, byPath: {}, crits: 0, rerolls: 0, pomos: 0, kinds: {}, blocks: {}, qts: [] };
    X.flowActive = X.flows.some((t) => Date.now() - t < ((R().flow || {}).dur || 30) * 60000);
    // статистика для достижений
    const st = X.stats, K = (k) => (X.byKind[k] || []).length;
    st.quests = X.quests; st.level = X.level; st.goldEarned = X.goldEarned; st.goldNow = X.gold;
    st.bestStreak = Math.max(+(S.D.state && S.D.state.bestStreak) || 0, +(S.D.state && S.D.state.streak) || 0);
    S.ALLP.forEach((p) => (st["path_" + p.key] = X.pathQ[p.key]));
    st.bosses = (X.byKind.boss || []).filter((e) => e.m && e.m.type === "week").length;
    st.bossesMonth = (X.byKind.boss || []).filter((e) => e.m && e.m.type === "month").length;
    st.chains = K("chaindone"); st.marathons = K("mardone"); st.legend = K("leg"); st.pomodoros = K("pomo");
    st.journal = K("jr") ; st.gratitude = K("gr"); st.perks = K("perk"); st.purchases = K("buy");
    st.pacts = K("pact"); st.mentorTasks = K("men") + K("menw"); st.classNodes = K("cls");
    st.locations = new Set((X.byKind.loc || []).map((e) => e.m && e.m.loc)).size;
    st.modules = K("mod"); st.stakesWon = K("stakew"); st.mainSteps = K("main"); st.loginDays = K("login");
    st.drops = X.drops; st.flows = X.flows.length; st.challenges = K("chal"); st.chests = K("chesto");
    st.surprises = (X.byKind.lvl || []).filter((e) => e.m && e.m.surprise).length; st.revivals = K("rev");
    st.freezes = (X.byKind.use || []).filter((e) => e.m && e.m.item === "freeze").length;
    st.egg = K("egg"); st.riddle = K("riddle"); st.shadow = K("dark"); st.light = K("light");
    st.declined = K("declined"); st.asks = (S.D.ask || []).length;
    let maxDay = 0, maxCrit = 0, maxRr = 0, maxPomo = 0, all6 = 0, early = 0, night = 0, monday = 0, recAll = 0, blocksDays = 0;
    Object.keys(X.days).forEach((d) => {
      const x = X.days[d]; maxDay = Math.max(maxDay, x.q); maxCrit = Math.max(maxCrit, x.crits); maxRr = Math.max(maxRr, x.rerolls); maxPomo = Math.max(maxPomo, x.pomos);
      if (S.ALLP.every((p) => x.byPath[p.key])) all6 = 1;
      x.qts.forEach((t) => { const h = S.hourOf(t); if (h < 6) early = 1; if (h >= 23.5) night = 1; });
      if (S.dow(d) === 0) monday = Math.max(monday, x.qts.filter((t) => S.hourOf(t) < 12).length);
      if (x.kinds.recall) recAll++;
      if (x.kinds.allblk) blocksDays++;
    });
    Object.assign(st, { maxDay, maxCritDay: maxCrit, maxRerollDay: maxRr, maxPomoDay: maxPomo, allPathsDay: all6, early, night, mondayMorning: monday, recAllDays: recAll, blocksDays });
    st.broke = (X.byKind.buy || []).length && X.gold <= 0 ? 1 : st.brokeSeen || 0;
    st.longEntry = (S.D.journal || []).some((j) => (j.text || "").length > 1000) ? 1 : 0;
    st.lettersOpened = (S.D.journal || []).filter((j) => j.kind === "letter" && j.openOn && j.openOn <= X.today).length;
    const pl = S.D.player || {};
    st.nickChanged = (pl.nickHistory || []).length ? 1 : 0; st.classChanged = pl.classChanged ? 1 : 0;
    st.mentorsTried = (pl.mentorsTried || []).length; st.artsEquipped = (pl.arts || []).length;
    st.frames = ["fr_bronze", "fr_silver", "fr_gold", "fr_dawn", "fr_legend"].filter((f) => X.inv[f]).length;
    st.perkAllT1 = S.ALLP.every((p) => X.perks[p.key] >= 1) ? 1 : 0;
    st.player2 = K("p2done"); st.marRestarts = K("marreset"); st.stakeMax = (X.byKind.stakew || []).some((e) => (e.g || 0) >= 4000) ? 1 : 0;
    st.comeback = K("comeback");
    S.X = X;
    // модули, которым нужен X
    if (S.deriveExtra) S.deriveExtra(X);
    return X;
  };

  /* ---------- множители ---------- */
  S.activeBoost = (id) => S.X && S.X.boosts.some((b) => b.item === id && Date.now() >= b.from && Date.now() < b.until);
  S.mults = function (path, kind) {
    const X = S.X, pl = S.D.player || {}, G = S.D.growth || {}, list = [];
    let xm = 1, gm = 1;
    const add = (label, x, g) => { if ((x && x !== 1) || (g && g !== 1)) list.push({ label, x: x || 1, g: g || 1 }); xm *= x || 1; gm *= g || 1; };
    const cls = (G.classes || []).find((c) => c.key === (pl.cls && pl.cls.key));
    if (cls && S.unlocked("class")) { const b = cls.bonus.all || cls.bonus[path] || 0; if (b) add("Класс «" + cls.name + "»", 1 + b, 1); }
    const men = ((S.D.pools && S.D.pools.mentors) || []).find((m) => m.key === (pl.mentor && pl.mentor.key));
    if (men && S.unlocked("mentors")) {
      if (men.path === "all" || men.path === path) add("Наставник " + men.name, 1 + men.bonus, 1);
      if (men.goldBonus) add("Наставник " + men.name, 1, 1 + men.goldBonus);
    }
    const pet = S.petInfo && S.petInfo();
    if (pet && pet.bonus && !pet.sad) add("Питомец «" + pet.stageName + "»", 1 + pet.bonus, 1);
    if (X && X.flowActive) add("Поток", (R().flow || {}).mult || 1.25, 1);
    if (S.activeBoost("xp15")) add("Буст опыта", 1.5, 1);
    if (S.activeBoost("g15")) add("Буст золота", 1, 1.5);
    if (X && (X.perm.xp || X.perm.g)) add("Вечные усиления", 1 + X.perm.xp, 1 + X.perm.g);
    const pt = (X && X.perks[path]) || 0;
    if (pt) add("Перки пути", (1 + (pt >= 1 ? 0.03 : 0)) * (1 + (pt >= 4 ? 0.05 : 0)), 1 + (pt >= 2 ? 0.03 : 0));
    if (X && X.perks.materia >= 5) add("Перк «Проценты»", 1, 1.03);
    const arts = (pl.arts || []).map((id) => (G.artifacts || []).find((a) => a.id === id)).filter(Boolean);
    arts.forEach((a) => { if (a.path === "all" || a.path === path) add("Артефакт «" + a.name + "»", 1 + a.bonus, 1); });
    if (S.shadowActive && S.shadowActive()) add("Тень", 1, (S.D.growth && S.D.growth.dark && S.D.growth.dark.goldMult) || 5);
    return { xp: xm, g: gm, list };
  };
  S.critChance = () => ((R().crit || {}).chance || 0.1) + (S.X && S.X.perks.obrazy >= 5 ? 0.05 : 0);

  /* ---------- база: запись ---------- */
  const queues = {};
  S.save = function (path, data) {
    if (!S.db) return Promise.reject({ code: "no_db" });
    const q = (queues[path] = queues[path] || { p: Promise.resolve(), next: null });
    const pending = !!q.next;
    q.next = data;
    if (pending) return q.p;
    q.p = q.p.then(() => { const d = JSON.parse(JSON.stringify(q.next)); q.next = null; return S.db.doc(path).set(d); }).catch((e) => { S.toastErr && S.toastErr(e); });
    return q.p;
  };
  const inflight = {};
  S.has = (id) => !!(S.D.ev[id] || inflight[id]);
  S.writeEv = function (id, data) {
    if (!S.db) return Promise.reject({ code: "no_db" });
    if (S.has(id)) return Promise.resolve(false);
    data.ts = data.ts || Date.now();
    data.d = data.d || S.dayOf(data.ts);
    data = JSON.parse(JSON.stringify(data));
    inflight[id] = data;
    S.D.ev[id] = data; // оптимистично
    S.derive(); S.render && S.render();
    return S.db.doc("ev/" + id).set(data).then(() => { delete inflight[id]; return true; }, (e) => {
      delete inflight[id]; delete S.D.ev[id]; S.derive(); S.render && S.render(); S.toastErr && S.toastErr(e); return false;
    });
  };
  S.uid = (p) => p + "-" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);

  /* ---------- награда за квест ---------- */
  // o: {id, k, t, p, r, mult?, d?, ts?, m?, noMult?, noCrit?, ps?}
  S.award = function (o) {
    if (S.has(o.id)) return Promise.resolve(null);
    const X = S.X || S.derive();
    const rr = S.rankReward(o.r || "E"), sc = S.levelScale(X.level);
    let xp = rr.xp * sc * (o.mult || 1), g = rr.g * sc * (o.mult || 1);
    const m = Object.assign({}, o.m || {}, { r: o.r || "E" });
    let bonus = [];
    if (!o.noMult) { const mu = S.mults(o.p, o.k); xp *= mu.xp; g *= mu.g; }
    if (!o.noCrit && Math.random() < S.critChance()) { xp *= (R().crit || {}).mult || 2; g *= (R().crit || {}).mult || 2; m.crit = 1; bonus.push("КРИТ ×2"); }
    if (!o.noMult && S.activeBoost("x2next")) { xp *= 2; g *= 2; m.x2 = 1; bonus.push("×2"); }
    xp = Math.round(xp); g = Math.round(g);
    const data = { k: o.k, t: o.t || "", p: o.p || null, xp, g, m };
    if (o.ps) { const sum = Object.keys(o.ps).reduce((a, k) => a + o.ps[k], 0) || 1; data.ps = {}; let left = xp; const ks = Object.keys(o.ps); ks.forEach((k, i) => { const v = i === ks.length - 1 ? left : Math.floor((xp * o.ps[k]) / sum); data.ps[k] = v; left -= v; }); }
    if (o.d) data.d = o.d; if (o.ts) data.ts = o.ts;
    const before = X.level;
    return S.writeEv(o.id, data).then((ok) => {
      if (!ok) return null;
      if (!o.quiet && S.FX) S.FX.questDone({ t: o.t, xp, g, bonus, p: o.p });
      if (S.QUEST_KINDS[o.k] && !o.noExtras) S.afterQuest(data);
      S.checkLevel(before);
      return data;
    });
  };
  S.afterQuest = function (data) {
    const X = S.derive();
    // поток
    const f = R().flow || { n: 5, min: 30 };
    const recent = X.list.filter((e) => S.QUEST_KINDS[e.k] && Date.now() - (e.ts || 0) < f.min * 60000).length;
    if (recent >= f.n && !X.flowActive) {
      S.writeEv(S.uid("flow"), { k: "flow", t: "Поток", xp: 0, g: 0 }).then(() => S.FX && S.FX.toast("[ ПОТОК ] ×" + (f.mult || 1.25) + " к опыту на " + (f.dur || 30) + " минут"));
    }
    // случайная добыча
    const artDrop = ((S.D.player || {}).arts || []).includes("a_lamp") ? 0.03 : 0;
    if (Math.random() < (R().drop || 0.1) + artDrop) S.randomDrop();
    // возвращение после тишины
    const days = Object.keys(X.days).filter((d) => d < X.today && X.days[d].q > 0).sort();
    const last = days[days.length - 1];
    if (last && S.diffDays(last, X.today) >= 4 && !S.has("comeback-" + X.today)) S.writeEv("comeback-" + X.today, { k: "comeback", t: "Возвращение", xp: 0, g: 0 });
  };
  S.randomDrop = function () {
    const r = Math.random();
    let items = [], g = 0, t;
    if (r < 0.5) { g = 20 + Math.floor(Math.random() * 41); t = "Мешочек золота"; }
    else if (r < 0.75) { items = ["food"]; t = "Корм для питомца"; }
    else if (r < 0.9) { items = ["reroll"]; t = "Свиток замены"; }
    else if (r < 0.97) { items = ["freeze"]; t = "Заморозка серии"; }
    else { items = ["card500"]; t = "Карта опыта +500"; }
    return S.writeEv(S.uid("drop"), { k: "drop", t, xp: 0, g, m: { items } }).then((ok) => ok && S.FX && S.FX.drop(t, g));
  };

  /* ---------- повышение уровня ---------- */
  S.checkLevel = function (before) {
    const X = S.derive();
    if (!S.ready.ev || !S.db) return;
    const seenMax = Math.max(+(S.D.player && S.D.player.maxLevel) || 1, before || 1);
    const lv = X.level;
    const G = S.D.rewards;
    for (let L = 2; L <= lv; L++) {
      const id = "lvl-" + L;
      if (S.has(id) || L <= ((S.D.base && S.D.base.levelAtStart) || 1)) continue;
      const lr = R().levelRewards || { goldPerLevel: 50 };
      const tier = L % 10 === 0 ? "big" : L % 5 === 0 ? "mid" : "small";
      const t = G && G.tiers ? G.tiers.find((x) => x.key === tier) : null;
      const item = t && t.items && t.items.length ? t.items[Math.floor(Math.random() * t.items.length)] : null;
      const surprise = Math.random() < (R().levelSurprise || 0.15);
      const m = { level: L, tier, tierName: t ? t.name : "", loot: item ? item.name : null, lootWhy: item ? item.why : null, surprise: surprise ? 1 : 0, items: surprise ? ["chest_small"] : [] };
      S.writeEv(id, { k: "lvl", t: "Уровень " + L, xp: 0, g: (lr.goldPerLevel || 50) * L, m }).then((ok) => {
        if (!ok) return;
        if (item && S.createLootTask) S.createLootTask(item, tier, L);
        if (L > seenMax && S.FX) S.FX.levelUp(L, m, (lr.goldPerLevel || 50) * L);
      });
    }
    if (lv > (+(S.D.player && S.D.player.maxLevel) || 0) && S.D.player) S.setPlayer({ maxLevel: lv });
  };

  /* ---------- игрок ---------- */
  // локальные правки держим поверх снимка из базы, пока запись не подтвердилась
  S.pend = { player: {}, day: {} }; let pv = { player: 0, day: 0 };
  function track(kind, patch, job) {
    const my = ++pv[kind];
    S.pend[kind] = Object.assign({}, S.pend[kind], patch);
    return job.then((r) => { if (pv[kind] === my) S.pend[kind] = {}; return r; });
  }
  S.setPlayer = function (patch) {
    const p = Object.assign({}, S.D.player || {}, patch);
    S.D.player = p;
    S.derive(); S.render && S.render();
    return track("player", patch, S.save("game/player", p));
  };
  S.setDay = function (patch) {
    const t = S.today();
    const d = Object.assign({ date: t }, S.D.day && S.D.day.date === t ? S.D.day : {}, patch);
    S.D.day = d;
    S.render && S.render();
    return track("day", patch, S.save("day/" + t, d));
  };

  /* ---------- покупки ---------- */
  S.shopItem = (id) => ((S.D.growth && S.D.growth.shop) || []).find((x) => x.id === id);
  S.buy = function (id, extra) {
    const it = S.shopItem(id); if (!it) return Promise.resolve(false);
    const X = S.X || S.derive();
    if (X.gold < it.cost) { S.FX && S.FX.toast("[ СИСТЕМА ] Не хватает золота: нужно " + it.cost + " ◆"); S.FX && S.FX.sound("err"); return Promise.resolve(false); }
    if (it.once && X.inv[id]) return Promise.resolve(false);
    return S.writeEv(S.uid("buy"), { k: "buy", t: it.name, xp: 0, g: -it.cost, m: Object.assign({ item: id }, extra || {}) }).then((ok) => {
      if (ok) { S.FX && S.FX.sound("coin"); S.FX && S.FX.toast("[ ПОКУПКА ] " + it.name + " — в библиотеке"); }
      return ok;
    });
  };
  S.useItem = function (id, extra) {
    const X = S.X || S.derive();
    if (!(X.inv[id] > 0)) return Promise.resolve(false);
    const it = S.shopItem(id) || { name: id };
    return S.writeEv(S.uid("use"), { k: "use", t: it.name, xp: 0, g: 0, m: Object.assign({ item: id, forDate: S.today() }, extra || {}) }).then((ok) => { if (ok) { S.FX && S.FX.sound("use"); } return ok; });
  };

  /* ---------- разделы ---------- */
  S.section = (key) => ((S.D.growth && S.D.growth.sections) || []).find((s) => s.key === key);
  S.unlocked = function (key) {
    const s = S.section(key); if (!s) return true;
    const lv = (S.X && S.X.level) || 1;
    return lv >= s.level;
  };

  /* ---------- утилиты DOM ---------- */
  S.h = function (tag, attrs) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "style" && typeof v === "object") { for (const sk in v) { if (sk.slice(0, 2) === "--") n.style.setProperty(sk, v[sk]); else n.style[sk] = v[sk]; } }
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else if (k === "html") { /* не используем */ }
      else n.setAttribute(k, v === true ? "" : v);
    }
    const add = (c) => {
      if (c == null || c === false || c === true) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      n.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    };
    for (let i = 2; i < arguments.length; i++) add(arguments[i]);
    return n;
  };
  S.store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  S.load = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  S.safe = (fn) => { try { return fn(); } catch (e) { if (window.console) console.error(e); } };
})();
