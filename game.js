/* Система v6 — механики: квесты дня, пакт, вызов, босс, питомец, класс, марафоны, цепочки, сезон, Чистилище */
(function () {
  "use strict";
  const S = window.SYS;
  const R = () => S.R();
  const W = () => S.D.world || {};
  const G = () => S.D.growth || {};
  const P = () => S.D.pools || {};

  /* ---------- рекомендованные квесты ---------- */
  S.recCount = function () {
    const r = R().rec || {}, lv = (S.X && S.X.level) || 1; let n = r.perPath || 1;
    (r.extraFromLevel || []).forEach((x) => { if (lv >= x[0]) n = x[1]; });
    return n;
  };
  S.recRanks = function () {
    const r = R().rec || {}, lv = (S.X && S.X.level) || 1; let rk = ["E", "E", "D"];
    (r.rankByLevel || []).forEach((x) => { if (lv >= x[0]) rk = x[1]; });
    return rk;
  };
  function poolFor(path) { return ((P().pools || {})[path]) || []; }
  function pickRec(path, seed, exclude) {
    const pool = poolFor(path), ranks = S.recRanks();
    let cand = pool.filter((q) => ranks.indexOf(q.r) >= 0 && exclude.indexOf(q.id) < 0);
    if (!cand.length) cand = pool.filter((q) => exclude.indexOf(q.id) < 0);
    if (!cand.length) return null;
    return cand[S.hash(seed) % cand.length].id;
  }
  S.recToday = function () {
    const t = S.today(), day = S.D.day;
    return day && day.date === t && Array.isArray(day.rec) && day.rec.length ? day.rec : null;
  };
  S.ensureRec = function () {
    if (!S.ready.day || !P().pools || S.recToday()) return;
    const t = S.today(), paths = (R().rec || {}).paths || S.ALLP.map((p) => p.key);
    const n = S.recCount(), rec = [];
    paths.forEach((p) => {
      const ex = [];
      for (let i = 0; i < n; i++) { const id = pickRec(p, t + p + i, ex); if (id) { ex.push(id); rec.push({ slot: p + i, path: p, q: id }); } }
    });
    S.setDay({ rec, rerolls: 0 });
  };
  S.recQuest = (path, id) => poolFor(path).find((q) => q.id === id);
  S.rerollsLeft = function () {
    const r = R().rerolls || { free: 3 }; const perk = S.ALLP.filter((p) => (S.X.perks[p.key] || 0) >= 3).length;
    const used = (S.D.day && S.D.day.date === S.today() && S.D.day.rerolls) || 0;
    return Math.max(0, (r.free || 3) + perk - used);
  };
  S.reroll = function (slot, el) {
    const day = S.D.day || {}, rec = (day.rec || []).slice(), i = rec.findIndex((x) => x.slot === slot); if (i < 0) return;
    const cur = rec[i]; if (S.has("rec-" + S.today() + "-" + slot)) return;
    const free = S.rerollsLeft() > 0;
    const go = () => S.FX.scan(el).then(() => {
      const ex = rec.filter((x) => x.path === cur.path).map((x) => x.q).concat(day.seen || []);
      const id = pickRec(cur.path, S.today() + slot + Math.random(), ex) || pickRec(cur.path, String(Math.random()), [cur.q]);
      if (!id) return;
      rec[i] = Object.assign({}, cur, { q: id });
      S.setDay({ rec, rerolls: (day.rerolls || 0) + 1, seen: (day.seen || []).concat([cur.q]).slice(-40) });
      S.writeEv(S.uid("rr"), { k: "reroll", t: "Замена", xp: 0, g: 0 });
      const left = S.rerollsLeft();
      S.FX.toast("[ СИСТЕМА ] Осталось бесплатных замен на сегодня: " + left);
    });
    if (free) return go();
    const inv = (S.X.inv.reroll || 0) > 0;
    if (inv) return S.useItem("reroll").then((ok) => ok && go());
    const cost = (R().rerolls || {}).cost || 30;
    return S.FX.confirm("Замена за " + cost + " ◆", "Бесплатные замены на сегодня кончились.", "Заменить").then((ok) => ok && S.buy("reroll").then((b) => b && go()));
  };
  S.fatigued = function () {
    const y = S.addDays(S.today(), -1);
    return S.has("pactf-" + y) && S.hourOf(Date.now()) < 12;
  };

  /* ---------- пакт ---------- */
  S.pactToday = () => (S.D.day && S.D.day.date === S.today() && S.D.day.pact) || null;
  S.pactStreak = function () {
    let n = 0, d = S.addDays(S.today(), -1);
    while (S.has("pact-" + d)) { n++; d = S.addDays(d, -1); }
    return n;
  };
  S.pactCheck = function (id, d) {
    const X = S.X, day = X.days[d] || { q: 0, byPath: {}, kinds: {}, qts: [] };
    const tq = (X.byKind.tt || []).concat(X.byKind.md || [], X.byKind.rec || [], X.byKind.own || []);
    switch (id) {
      case "blocks": return S.has("allblk-" + d);
      case "telo3": return X.list.filter((e) => e.d === d && S.QUEST_KINDS[e.k] && e.p === "telo").length >= 3;
      case "q5noon": return day.qts.filter((t) => S.hourOf(t) < 14).length >= 5;
      case "rankB": return X.list.some((e) => e.d === d && S.QUEST_KINDS[e.k] && e.m && ["B", "A", "S", "N"].indexOf(e.m.r) >= 0);
      case "pomo4": return (day.kinds.pomo || 0) >= 4;
      case "recAll": return S.has("recall-" + d);
      default: return null;
    }
  };
  S.pactSettle = function () {
    // итог вчерашних и сегодняшнего (после 21:00) пактов
    const t = S.today(), days = [S.addDays(t, -1), t];
    days.forEach((d) => {
      if (S.has("pact-" + d) || S.has("pactf-" + d)) return;
      const pk = d === t ? S.pactToday() : (S.D.dayPrev && S.D.dayPrev.date === d ? S.D.dayPrev.pact : null);
      if (!pk) return;
      if (d === t && S.hourOf(Date.now()) < 21) return;
      const auto = S.pactCheck(pk.id, d);
      if (auto === true || pk.manualDone) S.pactReward(d, pk);
      else if (d !== t || S.hourOf(Date.now()) >= 23.9) S.pactFail(d, pk);
    });
  };
  S.pactReward = function (d, pk) {
    const pr = (W().pactRules) || { xp: 50, perStreak: 10, cap: 200 };
    const xp = Math.min(pr.cap, pr.xp + pr.perStreak * S.pactStreak());
    return S.writeEv("pact-" + d, { k: "pact", t: "Пакт: " + pk.t, p: "osnova", xp, g: Math.round(xp / 3), d, m: { pact: pk.id } }).then((ok) => ok && S.FX.banner("[ ПАКТ ВЫПОЛНЕН ]", "+" + xp + " XP. Серия пактов растёт."));
  };
  S.pactFail = function (d, pk) {
    const pr = W().pactRules || {};
    if (d < (pr.from || "2026-10-12")) return S.writeEv("pactf-" + d, { k: "pactsoft", t: "Пакт не выполнен (мягкий старт)", xp: 0, g: 0, d });
    return S.writeEv("pactf-" + d, { k: "pactf", t: "Пакт провален — усталость до 12:00", xp: 0, g: 0, d });
  };

  /* ---------- суточный вызов ---------- */
  S.challengeWeek = function () {
    const ws = S.weekStart(S.today()), cr = W().challengeRules || { from: 10, to: 20, window: 60 };
    const dayIdx = S.hash("chal" + ws) % 7, hour = cr.from + (S.hash("chalh" + ws) % Math.max(1, cr.to - cr.from));
    const d = S.addDays(ws, dayIdx), ch = S.pick(W().challenges || [{ t: "—", p: "mental" }], "chalq" + ws);
    const start = Date.parse(d + "T" + String(hour).padStart(2, "0") + ":00:00+04:00");
    return { id: "chal-" + ws, d, start, end: start + (cr.window || 60) * 60000, q: ch, done: S.has("chal-" + ws) };
  };

  /* ---------- неделя, босс ---------- */
  S.bossState = function (type) {
    type = type || "week";
    const X = S.X, br = W().bossRules || {}, t = S.today();
    let from, to, list, hpCfg, key;
    if (type === "week") { from = S.weekStart(t); to = S.addDays(from, 6); list = W().bossesWeek || []; hpCfg = br.weekHp || { base: 600, perLevel: 60 }; key = from; }
    else { from = t.slice(0, 8) + "01"; const a = t.split("-").map(Number); to = new Date(Date.UTC(a[0], a[1], 0)).toISOString().slice(0, 10); list = W().bossesMonth || []; hpCfg = br.monthHp || { base: 3000, perLevel: 200 }; key = t.slice(0, 7); }
    if (!list.length) return null;
    const idx = type === "week" ? Math.floor(S.diffDays("2026-09-28", from) / 7) : (+key.slice(0, 4) * 12 + +key.slice(5, 7));
    const boss = list[((idx % list.length) + list.length) % list.length];
    const maxHp = Math.round(hpCfg.base + hpCfg.perLevel * X.level);
    const gHp = Math.round((br.guardHp || { base: 80 }).base + (br.guardHp || { perLevel: 8 }).perLevel * X.level) * (type === "month" ? 3 : 1);
    const hunter = (S.D.player && S.D.player.mentor && S.D.player.mentor.key === "hunter" && S.unlocked("mentors")) ? 1.15 : 1;
    const blade = ((S.D.player && S.D.player.arts) || []).includes("a_blade") ? 1.1 : 1;
    const events = X.list.filter((e) => S.QUEST_KINDS[e.k] && e.d >= from && e.d <= to && e.k !== "blk");
    const mondayQ = events.filter((e) => e.d === from).length;
    const scout = type === "week" && mondayQ >= (br.scoutQuests || 3) ? (br.scoutMult || 1.2) : 1;
    const guards = (boss.guards || []).map((p) => ({ p, hp: gHp, max: gHp }));
    let hp = maxHp, sealed = false, sealHits = 0, php = (br.playerHp || 100) + ((X.perks.telo || 0) >= 5 ? 25 : 0), phpMax = php, dead = false, killedAt = null, killedDay = null, log = [];
    const byDay = {}; events.forEach((e) => (byDay[e.d] = byDay[e.d] || []).push(e));
    for (let d = from; d <= to && d <= t; d = S.addDays(d, 1)) {
      (byDay[d] || []).sort((a, b) => a.ts - b.ts).forEach((e) => {
        if (dead || hp <= 0) return;
        let dmg = (e.xp || 0) * scout * hunter * blade * (e.p === boss.weak ? br.weakMult || 1.5 : 1);
        const g = guards.find((x) => x.hp > 0 && x.p === e.p && (type === "month" || d > from));
        if (g) { g.hp = Math.max(0, g.hp - dmg); return; }
        if (sealed) { if (e.p === boss.weak) { sealHits++; if (sealHits >= (br.sealQuests || 3)) sealed = false; } else return; }
        hp = Math.max(0, hp - dmg);
        if (!sealed && sealHits === 0 && hp <= maxHp * (br.sealAt || 0.5) && hp > 0) { sealed = true; log.push("печать"); }
        if (hp <= 0) { killedAt = e.ts; killedDay = d; }
      });
      if (d < t && hp > 0 && !dead) {
        const blocks = X.days[d] && Object.keys(X.days[d].blocks || {}).length;
        if (!blocks && d >= S.cutoffDay()) { hp = Math.min(maxHp, hp + maxHp * (br.regen || 0.1)); php -= br.hitPerMissedDay || 25; if (php <= 0) dead = true; }
        if (guards.some((x) => x.hp > 0) && d > from) hp = Math.min(maxHp, hp + maxHp * 0.05);
      }
    }
    const claimId = "boss-" + type + "-" + key;
    return { type, key, boss, from, to, maxHp, hp: Math.round(hp), guards, sealed, sealHits, scout, php: Math.max(0, php), phpMax, dead, killed: hp <= 0, killedAt, killedDay, claimed: S.has(claimId), claimId, mondayQ };
  };
  S.bossClaim = function (bs) {
    const rw = ((W().bossRules || {}).reward || {})[bs.type] || { xp: 200, g: 150 };
    const first = !(S.X.byKind.boss || []).some((e) => e.m && e.m.boss === bs.boss.key);
    const art = Math.random() < (bs.type === "month" ? 0.5 : 0.15) ? S.rollArtifact(bs.type === "month") : null;
    const m = { type: bs.type, boss: bs.boss.key, title: first ? "Победитель: " + bs.boss.name : null, items: [], art: art ? art.id : null, full: bs.php >= bs.phpMax ? 1 : 0, dow: S.dow(bs.killedDay || S.today()) };
    return S.writeEv(bs.claimId, { k: "boss", t: "Победа: " + bs.boss.name, p: "osnova", xp: rw.xp, g: rw.g, m }).then((ok) => {
      if (!ok) return;
      S.FX.chest("Босс повержен: " + bs.boss.name, ["+" + rw.xp + " XP", "+" + rw.g + " ◆", first ? "Титул «Победитель: " + bs.boss.name + "»" : null, art ? "Артефакт: " + art.name : null].filter(Boolean));
    });
  };

  /* ---------- артефакты ---------- */
  S.rollArtifact = function (month) {
    const arts = G().artifacts || [], rar = G().rarity || {};
    if (month && Math.random() < 0.3) return arts.find((a) => a.rar === "nat");
    const r = Math.random(); let tier = "sup"; if (r < (rar.myth || [0, 0.1])[1]) tier = "myth"; else if (r < 0.4) tier = "leg";
    const pool = arts.filter((a) => a.rar === tier);
    return pool[Math.floor(Math.random() * pool.length)] || arts[0];
  };
  S.artSlots = function () { let n = 0; (G().artSlots || []).forEach((x) => { if (S.X.level >= x[0]) n = x[1]; }); return n; };

  /* ---------- питомец ---------- */
  S.petInfo = function () {
    const pl = S.D.player || {}, pet = pl.pet, cfg = G().pet; if (!pet || !cfg || !S.X) return null;
    const feeds = (S.X.byKind.use || []).filter((e) => e.m && (e.m.item === "food" || e.m.item === "treat") && e.ts >= pet.born);
    const shop = {}; (G().shop || []).forEach((i) => (shop[i.id] = i));
    let xp = feeds.reduce((a, e) => a + ((shop[e.m.item] || {}).petXp || 0), 0);
    const hatched = feeds.length >= (cfg.hatchFeeds || 3);
    const lastFeed = feeds.length ? feeds[feeds.length - 1].ts : pet.born;
    const sadDays = S.diffDays(S.dayOf(lastFeed), S.today());
    const sad = sadDays > (cfg.sadAfterDays || 3);
    if (hatched) xp += Math.round(S.X.list.filter((e) => S.QUEST_KINDS[e.k] && e.ts >= pet.born).reduce((a, e) => a + (e.xp || 0), 0) * (cfg.shareXp || 0.1));
    let st = cfg.stages[hatched ? 1 : 0]; cfg.stages.forEach((s, i) => { if (hatched && i >= 1 && xp >= s[1]) st = s; });
    if (!hatched) st = cfg.stages[0];
    const idx = cfg.stages.indexOf(st), next = cfg.stages[idx + 1];
    const sp = (cfg.species || {})[pet.path] || ["Сова", "🦉"];
    return { name: pet.name || sp[0], species: sp[0], icon: sp[1], stageName: st[0], stage: idx, bonus: hatched ? st[2] : 0, xp, next, hatched, feeds: feeds.length, sad, sadDays };
  };

  /* ---------- класс ---------- */
  S.classNodes = function () {
    const pl = S.D.player || {}, c = (G().classes || []).find((x) => x.key === (pl.cls && pl.cls.key)); if (!c) return null;
    const pools = P().pools || {}, tiers = (G().classRules || {}).tiers || ["D", "C", "B", "A", "S"];
    const nodes = [], used = {};
    tiers.forEach((rk, ti) => {
      const cand = []; c.paths.forEach((p) => (pools[p] || []).forEach((q) => { if (q.r === rk || (rk === "S" && q.r === "A")) cand.push(Object.assign({ p }, q)); }));
      const seen = {}; let uniq = cand.filter((q) => (seen[q.id] || used[q.id] ? false : (seen[q.id] = 1)));
      if (uniq.length < 4) uniq = cand.filter((q, i, a) => a.findIndex((x) => x.id === q.id) === i);
      uniq.sort((a, b) => S.hash(c.key + a.id) - S.hash(c.key + b.id));
      for (let i = 0; i < 5; i++) {
        const n = ti * 5 + i;
        if (n === 24) { nodes.push({ n, t: c.finale, p: c.paths[0], r: "S", finale: true, tier: ti }); continue; }
        const q = uniq.length ? uniq[i % uniq.length] : { t: "Испытание", p: c.paths[0] };
        if (q.id) used[q.id] = 1;
        nodes.push({ n, t: q.t, how: q.how, p: q.p, r: rk, tier: ti });
      }
    });
    const since = (pl.cls && pl.cls.since) || 0;
    const done = {}; (S.X.byKind.cls || []).forEach((e) => { if (e.ts >= since && e.m && e.m.cls === c.key) done[e.m.node] = e; });
    const today = S.today(), todayDone = Object.values(done).some((e) => e.d === today);
    nodes.forEach((nd) => {
      nd.done = !!done[nd.n];
      const prevTierDone = nd.tier === 0 || nodes.some((x) => x.tier === nd.tier - 1 && done[x.n]);
      nd.open = !nd.done && prevTierDone && (!nd.finale || Object.keys(done).length >= 24);
      nd.fog = nd.finale && Object.keys(done).length < 24;
    });
    return { c, nodes, count: Object.keys(done).length, todayDone };
  };

  /* ---------- цепочки ---------- */
  S.chainState = function (ch) {
    const steps = ch.steps.map((s, i) => ({ i, t: s.t, r: s.r, ev: S.X.byId["chain-" + ch.key + "-" + i] }));
    const doneN = steps.filter((s) => s.ev).length;
    const last = steps.filter((s) => s.ev).pop();
    const canToday = !last || last.ev.d < S.today();
    return { steps, doneN, next: steps.find((s) => !s.ev), canToday, complete: doneN >= steps.length };
  };

  /* ---------- марафоны ---------- */
  S.marState = function (mr) {
    const starts = (S.X.byKind.marstart || []).filter((e) => e.m && e.m.mar === mr.key);
    const start = starts.length ? starts[starts.length - 1] : null;
    if (!start) return { active: false };
    const marks = (S.X.byKind.mar || []).filter((e) => e.m && e.m.mar === mr.key && e.m.start === start._id).map((e) => e.d);
    const set = new Set(marks); let streak = 0, d = S.today();
    if (!set.has(d)) d = S.addDays(d, -1);
    while (set.has(d)) { streak++; d = S.addDays(d, -1); }
    const broken = !set.has(S.today()) && !set.has(S.addDays(S.today(), -1)) && S.diffDays(start.d, S.today()) >= 1 && marks.length > 0;
    const done = S.has("mardone-" + mr.key + "-" + start._id);
    return { active: !done, start, marks: set, streak, broken, done, todayMarked: set.has(S.today()) };
  };

  /* ---------- сезон ---------- */
  S.seasonState = function () {
    const t = S.today(), ym = t.slice(0, 7), sc = W().seasons || {};
    const pts = S.X.list.filter((e) => e.d && e.d.slice(0, 7) === ym && (e.xp || 0) > 0).reduce((a, e) => a + e.xp, 0);
    let tier = 0; (sc.tiers || []).forEach((x, i) => { if (pts >= x[1]) tier = i; });
    const next = (sc.tiers || [])[tier + 1];
    return { ym, name: (sc.names || {})[ym] || "Сезон", pts, tier, tierName: ((sc.tiers || [])[tier] || ["—"])[0], next, daily: S.pick(sc.daily || [{ t: "Сезонное задание", r: "C" }], "sea" + t) };
  };
  S.seasonSettle = function () {
    const sc = W().seasons || {}, t = S.today(), prev = S.addDays(t.slice(0, 8) + "01", -1).slice(0, 7);
    if (S.has("season-" + prev) || prev < "2026-09") return;
    const pts = S.X.list.filter((e) => e.d && e.d.slice(0, 7) === prev && (e.xp || 0) > 0).reduce((a, e) => a + e.xp, 0);
    let tier = 0; (sc.tiers || []).forEach((x, i) => { if (pts >= x[1]) tier = i; });
    const g = (sc.reward || [])[tier] || 0;
    S.writeEv("season-" + prev, { k: "season", t: "Итог сезона: " + ((sc.tiers || [])[tier] || ["—"])[0], xp: 0, g, m: { tier, pts, ym: prev } });
  };

  /* ---------- Чистилище: ставки ---------- */
  S.stakes = function () {
    return (S.X.byKind.stake || []).map((e) => {
      const id = e._id, marks = new Set((S.X.byKind.stk || []).filter((x) => x.m && x.m.stake === id).map((x) => x.d));
      const days = (e.m && e.m.days) || 3, start = e.d;
      let missed = false; for (let d = start; d < S.today() && S.diffDays(start, d) < days; d = S.addDays(d, 1)) if (!marks.has(d)) missed = true;
      const doneDays = marks.size, finished = doneDays >= days;
      const res = S.has("stakew-" + id) ? "win" : S.has("stakes-" + id) ? "surrender" : S.has("stakef-" + id) ? "fail" : null;
      return { id, ev: e, t: (e.m && e.m.t) || "Испытание", days, start, marks, doneDays, missed, finished, res, stake: -(e.g || 0) };
    });
  };

  /* ---------- сюжет: обновление ---------- */
  S.deriveExtra = function () {};

  /* ---------- проверки при загрузке и раз в минуту ---------- */
  S.tick = function () {
    if (!S.ready.ev || !S.ready.player || !S.D.player) return;
    const t = S.today();
    // вход за день
    const lr = R().login || { g: 25, xp: 5 };
    if (!S.has("login-" + t) && S.ready.base) {
      const extra = (S.X.perks.socium || 0) >= 5 ? 15 : 0;
      S.writeEv("login-" + t, { k: "login", t: "Ежедневный вход", xp: lr.xp, g: lr.g + extra, p: "osnova" }).then((ok) => ok && S.FX.toast("[ СИСТЕМА ] Ежедневная награда за вход: +" + lr.xp + " XP · +" + (lr.g + extra) + " ◆"));
    }
    S.ensureRec();
    S.pactSettle();
    S.seasonSettle();
    // все рекомендованные за день
    const rec = S.D.day && S.D.day.date === t ? S.D.day.rec || [] : [];
    if (rec.length && rec.every((x) => S.has("rec-" + t + "-" + x.slot)) && !S.has("recall-" + t)) {
      S.writeEv("recall-" + t, { k: "recall", t: "Все рекомендованные закрыты", xp: 0, g: 20 }).then((ok) => ok && S.FX.banner("[ ВСЕ КВЕСТЫ ВЫПОЛНЕНЫ ]", "Рекомендованные квесты дня закрыты. +20 ◆"));
    }
    if (S.tt.done) S.ttAward();
    if (S.mcp) S.ttStart();
    S.checkLevel();
    S.checkAchievements();
  };

  /* ---------- достижения ---------- */
  S.achState = function () {
    const st = S.X.stats, list = G().achievements || [];
    return list.map((a) => ({ a, got: (st[a.stat] || 0) >= a.n, v: st[a.stat] || 0 }));
  };
  S.checkAchievements = function () {
    if (!S.ready.ev || !G().achievements) return;
    if (!S.D.player) return;
    const seen = S.D.player.ach || null;
    const got = S.achState().filter((x) => x.got).map((x) => x.a.id);
    if (!seen) { S.setPlayer({ ach: got }); return; }
    const fresh = got.filter((id) => seen.indexOf(id) < 0);
    if (!fresh.length) return;
    S.setPlayer({ ach: seen.concat(fresh) });
    fresh.slice(0, 3).forEach((id, i) => {
      const a = (G().achievements || []).find((x) => x.id === id);
      setTimeout(() => S.FX.banner("[ ДОСТИЖЕНИЕ" + (a.hidden ? " · СКРЫТОЕ" : "") + " ]", a.name + (a.title ? " · титул «" + a.title + "»" : "")), 600 + i * 1500);
    });
  };
  S.titles = function () {
    const out = [], st = S.D.state || {};
    out.push(st.title || "Пробуждённый");
    S.achState().forEach((x) => { if (x.got && x.a.title) out.push(x.a.title); });
    (S.X.byKind.chaindone || []).forEach((e) => e.m && e.m.title && out.push(e.m.title));
    (S.X.byKind.mardone || []).forEach((e) => e.m && e.m.title && out.push(e.m.title));
    (S.X.byKind.boss || []).forEach((e) => e.m && e.m.title && out.push(e.m.title));
    (S.X.byKind.credone || []).forEach((e) => e.m && e.m.title && out.push(e.m.title));
    const lm = (W().legendMilestones || []); lm.forEach((x) => { if ((S.X.stats.legend || 0) >= x[0]) out.push(x[1]); });
    const pet = S.petInfo(); if (pet && pet.stage >= 4) out.push((G().pet || {}).title || "Хранитель Легенды");
    if (S.has("riddle")) out.push(((G().archive || {}).reward || {}).title || "Хранитель Архива");
    return Array.from(new Set(out));
  };
  S.unlockAt = (L) => (G().sections || []).filter((s) => s.level === L);
  S.nextUnlocks = function () {
    const lv = S.X.level;
    return (G().sections || []).filter((s) => s.level > lv && s.level <= lv + 2).sort((a, b) => a.level - b.level);
  };
  S.shadowActive = function () { const e = (S.X && S.X.byKind.dark || []).slice(-1)[0]; return !!(e && Date.now() - e.ts < 24 * 3600000); };
})();
