/* Система v6 — запуск: база, подписки, маршруты, отрисовка */
(function () {
  "use strict";
  const S = window.SYS, h = (...a) => S.h(...a), V = S.V, ui = S.ui;
  const DOCK = [["today", "Сегодня", "✦"], ["course", "Курс", "❖"], ["skills", "Навыки", "✧"], ["shop", "Магазин", "◆"], ["duel", "Дуэль", "⚔"], ["more", "Меню", "≡"]];
  const TITLES = { duel: "Дуэль" };

  /* ---------- маршруты ---------- */
  S.go = function (key) {
    const sec = S.section(key);
    if (sec && !S.unlocked(key)) { S.FX.toast("[ СИСТЕМА ] «" + sec.name + "» откроется на уровне " + sec.level); return; }
    ui.view = key; S.store("sys-view", key);
    try { history.replaceState(null, "", "#" + key); } catch (e) {}
    S.render(true);
    window.scrollTo(0, 0);
    if (sec && S.X && S.ready.ev && S.markSeen(key) && sec.level > 1) S.FX.newSection(sec);
  };
  window.addEventListener("hashchange", () => { const k = (location.hash || "").slice(1); if (k && k !== ui.view && (V[k] || S.section(k))) S.go(k); });

  /* ---------- отрисовка ---------- */
  let raf = 0, dirty = false;
  S.render = function (force) {
    if (force) { dirty = false; cancelAnimationFrame(raf); clearTimeout(raf); raf = 0; draw(); return; }
    if (raf) return;
    if (document.hidden) { raf = setTimeout(() => { raf = 0; draw(); }, 60); return; }
    raf = requestAnimationFrame(() => { raf = 0; draw(); });
  };
  function typing() { const a = document.activeElement; const v = document.getElementById("view"); return a && v && v.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); }
  document.addEventListener("focusout", () => setTimeout(() => { if (dirty && !typing()) { dirty = false; draw(); } }, 50));
  function draw() {
    if (!S.D.rules || !S.D.growth) { S.renderHud && S.X && S.renderHud(); return; }
    S.derive();
    S.safe(S.renderHud);
    S.safe(drawDock);
    applyTheme();
    if (typing()) { dirty = true; return; }
    const view = document.getElementById("view"); if (!view) return;
    const y = window.scrollY;
    view.textContent = "";
    const key = V[ui.view] ? (ui.view === "quests" ? "today" : ui.view) : "today";
    const sec = S.section(key);
    if (sec && !S.unlocked(key)) { view.appendChild(S.lockedCard(sec)); return; }
    const head = sec && ["today", "status", "quests", "skills", "shop", "more", "duel"].indexOf(key) < 0 ? h("div", { class: "vhead" }, h("button", { class: "back", type: "button", onclick: () => S.go("more"), "aria-label": "Назад" }, "‹"), h("h1", null, sec.name)) : TITLES[key] ? h("div", { class: "vhead" }, h("h1", null, TITLES[key])) : null;
    if (head) view.appendChild(head);
    S.safe(() => V[key](view));
    if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
  }
  function drawDock() {
    const d = document.getElementById("dock"); if (!d) return;
    const fresh = (S.D.growth.sections || []).some((s) => S.X.level >= s.level && s.level > 1 && s.level < 900 && !S.seenSec(s.key));
    d.textContent = "";
    DOCK.forEach(([k, n, i]) => {
      const on = ui.view === k || (k === "more" && DOCK.every((x) => x[0] !== ui.view));
      d.appendChild(h("button", { class: "dk" + (on ? " on" : ""), type: "button", "aria-current": on ? "page" : null, onclick: () => S.go(k) }, h("span", { class: "di" }, i), h("span", null, n), k === "more" && fresh ? h("i", { class: "dot-new" }) : null));
    });
  }
  function applyTheme() { const t = (S.D.player && S.D.player.theme) || "system"; document.documentElement.setAttribute("data-skin", t); }

  /* ---------- итоги дня и обучение ---------- */
  S.showResults = function (force) {
    const t = S.today(), y = S.addDays(t, -1);
    if (!force && (S.D.player || {}).resultsDay === t) return;
    if (!force) S.setPlayer({ resultsDay: t });
    const X = S.X, day = X.days[y] || { xp: 0, q: 0, g: 0 };
    const lg = (S.D.log || []).find((e) => e.date === y);
    const pens = X.list.filter((e) => (e.k === "pen" || e.k === "lvldown") && e.d === y);
    const all = S.dayClosed ? S.dayClosed(y) : S.has("allblk-" + y), st = S.D.state || {}, pre = y < S.cutoffDay();
    const lines = [
      h("div", { class: "res-row" }, h("span", null, "Опыт"), h("b", null, "+" + day.xp + " XP")),
      h("div", { class: "res-row" }, h("span", null, "Квестов"), h("b", null, String(day.q))),
      h("div", { class: "res-row" }, h("span", null, "Золото"), h("b", { class: "gold" }, (day.g >= 0 ? "+" : "") + day.g + " ◆")),
      h("div", { class: "res-row" + (all ? " ok" : " bad") }, h("span", null, "Минимум дня"), h("b", null, all ? "засчитан" : "не набран"))
    ];
    const verdict = pens.length ? "[ ШТРАФ НАЧИСЛЕН ] " + pens.map((e) => e.t + (e.g ? " " + e.g + " ◆" : "")).join(" · ") : all ? "[ СЕРИЯ СОХРАНЕНА ] " + (st.streak || 0) + " дн." : "[ ДЕНЬ НЕ ЗАКРЫТ ] Ничего страшного — сегодня новый";
    if (pre && !lg) return;
    const m = S.FX.modal([h("div", { class: "m-sys" }, "ИТОГИ ДНЯ · " + S.fmtDay(y)), pre ? null : h("div", { class: "m-t" + (pens.length ? " red" : "") }, verdict), pre ? null : h("div", { class: "res" }, lines),
      lg ? h("div", { class: "m-x" }, h("b", null, lg.headline || ""), h("div", { class: "etext" }, lg.text || "")) : null,
      h("div", { class: "m-btns" }, h("button", { class: "btn", type: "button", onclick: () => m.close() }, "В бой"))], { cls: "results" });
  };
  S.onboard = function (force) {
    const pl = S.D.player || {}, ob = (S.D.growth || {}).onboard; if (!ob) return;
    if (pl.onboarded && !force) return false;
    S.hold = true;
    const slide = (i) => {
      if (i >= ob.slides.length) { S.hold = false; if (!pl.onboarded) S.setPlayer({ onboarded: Date.now() }); S.showResults(); setTimeout(S.FX.pump, 400); return; }
      const s = ob.slides[i];
      const m = S.FX.modal([h("div", { class: "m-sys" }, "КАК ЭТО РАБОТАЕТ · " + (i + 1) + "/" + ob.slides.length), h("div", { class: "m-t" }, s[0]), h("div", { class: "m-x" }, s[1]), h("div", { class: "m-btns" }, h("button", { class: "btn", type: "button", onclick: () => { m.close(); slide(i + 1); } }, i + 1 < ob.slides.length ? "Дальше" : "Начать"))], { sticky: true });
    };
    const first = () => {
      const m = S.FX.modal([h("div", { class: "init" }, ob.title), h("div", { class: "m-t big" }, ob.text),
        h("div", { class: "m-btns" }, h("button", { class: "btn ghost", type: "button", onclick: () => { S.FX.toast("[ СИСТЕМА ] " + ob.declineText); S.FX.sound("err"); if (!S.has("declined")) S.writeEv("declined", { k: "declined", t: "Попытка отказа", xp: 0, g: 0 }); } }, ob.decline),
          h("button", { class: "btn", type: "button", onclick: () => { m.close(); S.FX.sound("level"); slide(0); } }, ob.accept))], { sticky: true, cls: "initm" });
    };
    first();
    return true;
  };
  S.darkPrompt = function () {
    if (!S.unlocked("dark")) return;
    const d = S.D.growth.dark || {}, t = S.today();
    if (S.hourOf(Date.now()) < (d.hour || 23) || S.has("dark-" + t) || S.has("light-" + t) || S.load("sys-dark") === t) return;
    if (S.hash("dark" + t) % 100 >= (d.chance || 0.25) * 100) return;
    S.store("sys-dark", t); S.go("dark");
  };

  /* ---------- подписки ---------- */
  function subs(db) {
    const onErr = () => {};
    const done = (k) => { S.ready[k] = true; S.render(); };
    db.doc("game/state").onSnapshot((s) => { S.D.state = s.exists ? s.data() : null; done("state"); }, onErr);
    db.doc("game/config").onSnapshot((s) => { S.D.config = s.exists ? s.data() : null; done("config"); if (S.tt.done) S.ttAward(); }, onErr);
    db.doc("game/skills").onSnapshot((s) => { S.D.skills = s.exists ? s.data() || {} : {}; done("skills"); }, onErr);
    db.doc("game/rewards").onSnapshot((s) => { S.D.rewards = s.exists ? s.data() : null; S.render(); }, onErr);
    db.doc("game/base").onSnapshot((s) => { S.D.base = s.exists ? s.data() : null; done("base"); boot2(); }, onErr);
    db.doc("game/own").onSnapshot((s) => { S.D.own = s.exists ? s.data() : { items: [] }; S.ready.own = true; S.render(); if (S.tt.done) S.ttAward(); }, onErr);
    db.doc("game/player").onSnapshot((s) => { if (s.exists) S.D.player = Object.assign({}, s.data(), S.pend.player); else if (!S.D.player) S.D.player = Object.assign({}, S.pend.player); done("player"); boot2(); }, onErr);
    db.collection("codex").onSnapshot((snap) => {
      const map = {}; S.D.knowledge = null;
      snap.docs.forEach((d) => { const x = d.data(); if (!x) return;
        if (d.id === "knowledge" || d.id === "principles") { if (!S.D.knowledge || d.id === "knowledge") S.D.knowledge = x; }
        else if (d.id === "rules") S.D.rules = x;
        else if (d.id === "g_pools") S.D.pools = x;
        else if (d.id === "g_world") S.D.world = x;
        else if (d.id === "g_growth") S.D.growth = x;
        else if (d.id === "trials") S.D.trials = x;
        else if (d.id === "tree") S.D.tree = x;
        else if (d.id === "course") S.D.course = x;
        else map[d.id] = x; });
      S.D.codex = map; done("codex"); boot2();
    }, onErr);
    db.collection("ev").onSnapshot((snap) => {
      const m = {}; snap.docs.forEach((d) => (m[d.id] = d.data()));
      S.D.ev = m; S.ready.ev = true; S.derive(); S.render(); boot2();
    }, () => { S.ready.ev = true; });
    S.subDay = function () {
      const t = S.today(); if (S.dayKey === t) return; S.dayKey = t;
      if (S.unDay) S.unDay();
      S.unDay = db.doc("day/" + t).onSnapshot((s) => { if (S.dayKey !== t) return; S.D.day = Object.assign(s.exists ? s.data() : { date: t }, S.pend.day); S.ready.day = true; S.render(); boot2(); }, onErr);
      db.doc("day/" + S.addDays(t, -1)).get().then((s) => { S.D.dayPrev = s.exists ? s.data() : null; }, onErr);
    };
    S.subDay();
    db.collection("quests").onSnapshot((snap) => { S.D.quests = snap.docs.map((d) => Object.assign({ _id: d.id }, d.data())); S.ready.quests = true; S.render(); if (S.tt.done) S.ttAward(); }, onErr);
    db.collection("log").orderBy("date", "desc").limit(14).onSnapshot((snap) => { S.D.log = snap.docs.map((d) => d.data()).filter(Boolean); S.render(); }, onErr);
    db.collection("main").onSnapshot((snap) => { const m = {}; snap.docs.forEach((d) => (m[d.id] = d.data())); S.D.main = m; S.render(); }, onErr);
    db.collection("journal").orderBy("ts", "desc").limit(300).onSnapshot((snap) => { S.D.journal = snap.docs.map((d) => d.data()); S.render(); }, onErr);
    db.collection("ask").orderBy("ts", "desc").limit(60).onSnapshot((snap) => { S.D.ask = snap.docs.map((d) => d.data()).reverse(); S.render(); }, onErr);
    db.collection("answers").limit(1000).onSnapshot((snap) => { const m = {}; snap.docs.forEach((d) => { const x = d.data(); if (x && typeof x.text === "string") m[d.id] = x.text; }); S.D.answers = m; S.ilSync && S.ilSync(); }, onErr);
    db.collection("unload").onSnapshot((snap) => { S.D.unload = snap.docs.map((d) => d.data()).filter(Boolean); if (ui.view === "journal" && ui.journalTab === "il") S.render(); }, onErr);
  }
  let booted2 = false;
  function boot2() {
    if (booted2) return;
    if (!(S.ready.ev && S.ready.player && S.ready.codex && S.ready.base && S.ready.day && S.D.rules && S.D.growth)) return;
    booted2 = true;
    S.derive();
    if (!(S.D.player && S.D.player.maxLevel)) S.setPlayer({ maxLevel: S.X.level });
    if (!S.onboard()) { S.hold = false; S.showResults(); setTimeout(S.FX.pump, 400); }
    S.tick();
    setInterval(() => { S.subDay && S.subDay(); S.tick(); S.darkPrompt(); S.render(); }, 60000);
    S.darkPrompt();
  }

  /* ---------- старт ---------- */
  function start() {
    document.getElementById("view").appendChild(h("div", { class: "empty boot" }, "[ СИСТЕМА ] Загрузка…"));
    const fail = setTimeout(() => { S.ready.boot = true; const v = document.getElementById("view"); v.textContent = ""; v.appendChild(h("div", { class: "warn" }, "Не загрузилось. Обнови страницу.")); }, 11000);
    if (!window.claude || typeof window.claude.use !== "function") return;
    window.claude.use("db").then((db) => {
      clearTimeout(fail); S.ready.boot = true;
      if (!db) { const v = document.getElementById("view"); v.textContent = ""; v.appendChild(h("div", { class: "warn" }, "База недоступна в этом окне.")); return; }
      S.db = db; S.ready.db = true; subs(db);
    });
    window.claude.use("mcp").then((mcp) => { S.mcp = mcp; if (!mcp) S.tt.err = null; S.render(); if (mcp && S.ready.codex) S.ttStart(); else if (mcp) setTimeout(() => S.ttStart(), 1500); });
    window.claude.use("sample").then((s) => { S.sample = s; S.render(); });
  }
  const hk = (location.hash || "").slice(1);
  ui.view = hk || S.load("sys-view") || "today";
  if (ui.view === "quests") ui.view = "today";
  start();
})();
