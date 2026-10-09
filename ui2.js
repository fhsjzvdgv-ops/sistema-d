/* Система v6.2 — упрощение: экран «Сегодня» и лестница навыков */
(function () {
  "use strict";
  const S = window.SYS, h = (...a) => S.h(...a), V = S.V, R = () => S.R(), ui = S.ui;

  /* ---------- СЕГОДНЯ ---------- */
  const hhmm = (s) => { const m = String(s || "").match(/(\d{1,2}):(\d{2})/); return m ? m[1].padStart(2, "0") + ":" + m[2] : null; };
  function taskTime(t) { if (!t || !t.startDate || t.isAllDay) return null; return S.fmtTime(S.parseTT(t.startDate)); }
  function row(o) {
    // o: {time, title, sub, p, r, done, doneText, btn, onDo, muted, now, busy}
    const q = S.BY[o.p];
    const r = h("div", { class: "tl" + (o.done ? " done" : "") + (o.muted ? " muted" : "") + (o.now ? " now" : "") },
      h("div", { class: "tl-time" }, o.time || "день"),
      h("div", { class: "tl-dot", style: q ? { background: q.color, boxShadow: "0 0 6px " + q.hex } : null }),
      h("div", { class: "tl-body" }, h("div", { class: "tl-t" }, o.title), o.sub ? h("div", { class: "tl-s" }, o.sub) : null),
      h("div", { class: "tl-act" }, o.done ? h("span", { class: "tl-ok" }, o.doneText || "✓") : o.onDo ? h("button", { class: "btn sm", type: "button", disabled: o.busy ? true : null, onclick: o.onDo }, o.busy ? "…" : o.btn || "Выполнить") : null));
    return r;
  }
  function xpText(r, p) { return S.rankBadgeText(r) + " · " + S.preview(r, p); }
  S.rankBadgeText = (r) => "ранг " + (r || "E");

  V.today = function (root) {
    const X = S.X, c = S.D.config || {}, t = S.today(), nowH = S.hourOf(Date.now());
    const items = [];
    const doneIds = new Set();
    const doneToday = (S.tt.done || []).filter((x) => x.completedTime && S.ttDay(x, S.ttClass(x)).d === t);

    // опорные блоки: шаги по времени
    const blocks = c.dailyBlocks || {}, stt = S.tt.done ? S.blocksStatus(t) : {};
    let blocksDone = 0, blocksAll = 0;
    Object.keys(blocks).forEach((key) => {
      const b = blocks[key], s = stt[key] || { done: 0, need: b.need || 1 };
      blocksAll++; if (S.has("blk-" + t + "-" + key) || s.done >= s.need) blocksDone++;
      if (b.auto) {
        const ok = S.has("blk-" + t + "-" + key) || s.done >= s.need;
        items.push({ sort: "12:00", el: row({ time: "днём", title: b.name, sub: "Засчитается само, когда закроешь задачу найма со средним или высоким приоритетом", p: b.path, done: ok, doneText: "✓ блок" }) });
        return;
      }
      (b.steps || []).forEach((st) => {
        const tk = S.taskToday(st), tm = hhmm(st.time) || hhmm(b.time);
        if (tk.d) doneIds.add(tk.d.id); if (tk.u) doneIds.add(tk.u.id);
        const ev = tk.d && S.X.byId["tt-" + tk.d.id];
        items.push({ sort: tm || "12:00", undone: !tk.d, el: row({ time: tm, title: st.title, sub: "опора" + (tk.d ? "" : " · " + S.preview((R().tt || {}).dailyStep || "E", b.path)), p: b.path, done: !!tk.d, doneText: ev ? "+" + ev.xp + " XP" : "✓", busy: tk.u && S.tt.busy[tk.u.id],
          onDo: tk.u ? () => S.FX.confirm("Выполнить?", st.title + " — " + S.preview((R().tt || {}).dailyStep || "E", b.path)).then((ok) => ok && S.ttComplete(tk.u)) : null }) });
      });
    });
    // опорные точки (еда, душ) — без опыта
    (c.dailyAnchors || []).forEach((a) => {
      const tk = S.taskToday({ title: a.title }); if (tk.d) doneIds.add(tk.d.id); if (tk.u) doneIds.add(tk.u.id);
      items.push({ sort: hhmm(a.time) || "12:00", undone: !tk.d, el: row({ time: hhmm(a.time), title: a.title, sub: "без опыта", muted: true, done: !!tk.d, onDo: tk.u ? () => S.ttComplete(tk.u) : null, btn: "✓" }) });
    });
    // остальные дела TickTick на сегодня
    (S.tt.undone || []).forEach((task) => {
      if (doneIds.has(task.id) || task.projectId === c.dailyListId && S.isAnchor(task)) return;
      const cls = S.ttClass(task); if (!cls) return;
      if (cls.kind === "loot") { items.push({ sort: taskTime(task) || "00:00", undone: true, el: row({ time: taskTime(task), title: task.title, sub: "награда — забери без вины", done: false, onDo: () => S.ttComplete(task), btn: "Забрал" }) }); return; }
      items.push({ sort: taskTime(task) || "00:00", undone: true, el: row({ time: taskTime(task), title: task.title, sub: (S.BY[cls.p] || {}).name + " · " + S.preview(cls.r, cls.p), p: cls.p, busy: S.tt.busy[task.id],
        onDo: () => S.FX.confirm("Выполнить?", task.title + " — " + S.preview(cls.r, cls.p)).then((ok) => ok && S.ttComplete(task)) }) });
    });
    doneToday.forEach((task) => {
      if (doneIds.has(task.id) || task.projectId === c.dailyListId) return;
      const ev = S.X.byId["tt-" + task.id]; if (!ev && !/^Добыча:/.test(task.title)) return;
      items.push({ sort: taskTime(task) || "00:00", el: row({ time: taskTime(task), title: task.title, sub: ev ? (S.BY[ev.p] || {}).name : "награда", p: ev && ev.p, done: true, doneText: ev ? "+" + ev.xp + " XP" : "✓" }) });
    });
    items.sort((a, b) => a.sort.localeCompare(b.sort));
    // «сейчас» — первое невыполненное с временем не раньше, чем час назад
    const nowStr = String(Math.floor(nowH)).padStart(2, "0") + ":" + String(Math.round((nowH % 1) * 60)).padStart(2, "0");
    const cur = items.find((x) => x.undone && x.sort !== "00:00" && x.sort >= S.addMinutesStr(nowStr, -60));
    if (cur) cur.el.classList.add("now");

    // шапка дня
    root.appendChild(h("div", { class: "dayhead" },
      h("div", null, h("b", null, S.fmtDay(t)), h("small", null, "Сделал дело → «Выполнить» → опыт и золото сразу. Нажми на дело — откроется карточка")),
      h("div", { class: "dh-stats" }, h("span", null, h("b", null, "+" + X.td.xp), " XP"), h("span", null, h("b", { class: "gold" }, "+" + X.td.g), " ◆"), h("span", null, "минимум ", h("b", null, (S.dayClosed && S.dayClosed(t) ? S.minNeed() : Math.min(S.minNeed ? S.minNeed() : 3, S.minCount ? S.minCount(t) : 0)) + "/" + (S.minNeed ? S.minNeed() : 3))))));
    if (S.minWin) root.appendChild(S.minWin());
    if (S.tt.err) root.appendChild(h("div", { class: "warn" }, S.tt.err));
    else if (S.tt.undone == null) root.appendChild(h("div", { class: "empty" }, "Загружаю дела…"));

    // срочное
    const rev = S.revivalPending && S.revivalPending();
    if (rev) root.appendChild(S.questCard({ t: "Возрождение: закрыть минимум дня", p: "osnova", r: rev.r, mult: 4, label: "Возрождение ×4", onDo: (cd) => S.doQuest({ id: "rev-" + rev.id, k: "rev", t: "Возрождение", p: "osnova", r: rev.r, mult: 4 }, cd) }));
    if (S.unlocked("challenge")) {
      const ch = S.challengeWeek(), now = Date.now();
      if (!ch.done && now >= ch.start && now < ch.end) root.appendChild(S.questCard({ t: ch.q.t, p: ch.q.p, r: "N", mult: 5, label: "⚠ Суточный вызов · " + Math.round((ch.end - now) / 60000) + " мин", onDo: (cd) => S.doQuest({ id: ch.id, k: "chal", t: ch.q.t, p: ch.q.p, r: "N", mult: 5, m: { fast: now - ch.start < 600000 ? 1 : 0 } }, cd) }));
    }
    Object.keys(X.chests).forEach((id) => { const cc = X.chests[id]; if (!cc.opened) root.appendChild(h("button", { class: "pend", type: "button", onclick: () => S.openChest(id) }, "◈ Сундук серии — открыть")); });
    if ((X.inv.chest_small || 0) > 0) root.appendChild(h("button", { class: "pend", type: "button", onclick: () => S.openSmallChest() }, "◈ Малый сундук — открыть"));

    // лента дня
    const tl = h("div", { class: "timeline" }, items.map((x) => x.el));
    if (!items.length && S.tt.undone) tl.appendChild(h("div", { class: "empty" }, "На сегодня пусто."));
    root.appendChild(S.win("Сегодня", "Главные дела и свои дела — всё идёт в минимум и даёт опыт", tl));

    // испытание дня и наставник недели
    const tw = S.trialTodayWin && S.trialTodayWin(); if (tw) root.appendChild(tw);
    if (S.mentorWin && S.D.pools) root.appendChild(S.mentorWin());

    // квесты дня из базы
    root.appendChild(S.dailyQuestsBox());

    // квесты навыков
    const lq = S.legacyQuests && S.legacyQuests(); if (lq) root.appendChild(lq);

    // свой квест
    root.appendChild(S.ownAdd());
  };
  S.addMinutesStr = (hm, d) => { const a = hm.split(":").map(Number); let m = a[0] * 60 + a[1] + d; if (m < 0) m = 0; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };

  S.dailyQuestsBox = function () {
    const t = S.today(), rec = S.recToday() || [], X = S.X;
    const doneN = rec.filter((x) => S.has("rec-" + t + "-" + x.slot)).length;
    const det = S.keep(h("details", { class: "dq" }), "dq-open");
    det.appendChild(h("summary", null, h("span", { class: "dq-t" }, "Квесты дня из базы"), h("span", { class: "dq-n" }, doneN + " из " + rec.length), h("span", { class: "more" }, "открыть")));
    const body = h("div", { class: "qlist" });
    body.appendChild(h("div", { class: "muted" }, "По одному на каждый путь. Не нравится — замени (" + S.rerollsLeft() + " бесплатно)."));
    const fat = S.fatigued(), osnHidden = X.level < ((R().osnova || {}).revealLevel || 5);
    rec.forEach((x) => {
      const q = S.recQuest(x.path, x.q); if (!q) return;
      const id = "rec-" + t + "-" + x.slot;
      body.appendChild(S.questCard({ t: q.t, how: q.how, p: x.path, r: q.r, done: S.has(id), label: x.path === "osnova" && osnHidden ? "???" : null, lock: fat ? "Усталость после проваленного пакта — до 12:00" : null,
        onDo: (c) => S.doQuest({ id, k: "rec", t: q.t, p: x.path, r: q.r, m: { q: q.id } }, c), onReroll: (c) => S.reroll(x.slot, c) }));
    });
    // особые задания — только из открытых разделов
    const pl = S.D.player || {};
    if (S.unlocked("mentors") && pl.mentor) {
      const men = ((S.D.pools || {}).mentors || []).find((m) => m.key === pl.mentor.key);
      if (men && men.tasks && men.tasks.length) { const mt = S.pick(men.tasks, "men" + t + men.key), id = "men-" + t; body.appendChild(S.questCard({ t: mt.t, p: mt.p, r: mt.r, done: S.has(id), label: "Наставник " + men.name, onDo: (c) => S.doQuest({ id, k: "men", t: mt.t, p: mt.p, r: mt.r }, c) })); }
    }
    if (S.unlocked("season")) { const ss = S.seasonState(), id = "sea-" + t; body.appendChild(S.questCard({ t: ss.daily.t, p: "osnova", r: ss.daily.r, done: S.has(id), label: ss.name, onDo: (c) => S.doQuest({ id, k: "sea", t: ss.daily.t, p: "osnova", r: ss.daily.r }, c) })); }
    if (S.unlocked("pact")) body.appendChild(S.pactWin());
    det.appendChild(body);
    return h("section", { class: "win" }, det);
  };
  S.ownAdd = function () {
    const t = S.today(), mine = S.ownList().filter((o) => o.d === t).length, max = (R().own || {}).max || 8;
    const inp = h("input", { class: "inp", type: "text", placeholder: "Добавить своё дело на сегодня", maxlength: "160", "aria-label": "Своё дело" });
    const sel = h("select", { class: "inp sel", "aria-label": "Путь" }, S.ALLP.map((p) => h("option", { value: p.key }, p.name)));
    const go = () => { const v = inp.value.trim(); if (!v) return; inp.value = ""; S.ownCreate(v, sel.value); };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    return h("div", { class: "own solo" }, h("div", { class: "own-r" }, inp, sel, h("button", { class: "btn sm", type: "button", onclick: go }, "+")), h("small", { class: "muted" }, "Ранг поставит Система. Сегодня можно ещё " + Math.max(0, max - mine) + "."));
  };
  V.quests = V.today;

  /* ---------- НАВЫКИ: лестница ---------- */
  function orderSkills(p) {
    const cx = S.D.codex[p.key]; if (!cx || !cx.skills) return [];
    return cx.skills.map((sk, i) => ({ sk, i, s: S.skillStatus(sk, p), st: S.D.skills[sk.id] || {} }));
  }
  V.skills = function (root) {
    const sl = S.slots();
    const tabs = h("div", { class: "ptabs", role: "tablist" }, [S.OSNOVA].concat(S.PATHS).map((p) => h("button", { class: "ptab" + (ui.skillPath === p.key ? " on" : ""), type: "button", role: "tab", "aria-selected": ui.skillPath === p.key ? "true" : "false", style: { "--pc": p.color }, onclick: () => { ui.skillPath = p.key; S.render(true); } }, p.name)));
    const p = S.BY[ui.skillPath] || S.OSNOVA;
    const list = orderSkills(p);
    const box = h("div", { class: "ladder", style: { "--pc": p.color } });
    if (!list.length) box.appendChild(h("div", { class: "empty" }, "Загружается…"));
    // порядок: освоенные и в работе → следующий → закрытые
    const top = list.filter((x) => x.s.c === "mastered" || x.s.c === "active" || x.s.c === "paused" || (x.st.mastered || 0) > 0);
    const rest = list.filter((x) => top.indexOf(x) < 0);
    const rank = { avail: 0, held: 1, locked: 2 };
    rest.sort((a, b) => (rank[a.s.c] - rank[b.s.c]) || (((a.s.tier || {}).req || 1) - ((b.s.tier || {}).req || 1)) || (a.i - b.i));
    top.forEach((x) => box.appendChild(rung(x, p, "top")));
    rest.forEach((x, j) => box.appendChild(rung(x, p, j === 0 ? "next" : j === 1 ? "peek" : "hidden")));
    root.appendChild(h("div", { class: "sk-head" }, h("b", null, "В работе: " + sl.hab + " привычек из " + sl.hMax + " · " + sl.qst + " квест из " + sl.qMax), h("small", null, "Выбери путь. Навыки идут по порядку: освоил — открывается следующий.")));
    root.appendChild(tabs);
    root.appendChild(S.win(p.key === "osnova" ? "Основа" : "Путь «" + p.name + "»", p.key === "osnova" ? "фундамент под всеми путями — личная ответственность" : p.short, box));
  };
  function rung(x, p, mode) {
    const sk = x.sk, s = x.s, st = x.st, n = (sk.tiers || []).length;
    let icon = "○", right = "", cls = "rg", sub = "";
    if (mode === "hidden") return h("div", { class: "rg locked hid" }, h("span", { class: "rg-i" }, "🔒"), h("span", { class: "rg-n" }, "???"), h("span", { class: "rg-r" }, ""));
    if (s.c === "mastered") { icon = "★"; cls += " mastered"; right = "освоен"; sub = n + " из " + n + " ступеней"; }
    else if (s.c === "active") { icon = "●"; cls += " active"; const t = s.tier; right = t.kind === "quest" ? "квест в работе" : (st.days || 0) + "/" + ((R().habits || {}).daysToMaster || 21) + " дн."; sub = "Ступень " + S.ROMAN[t.n] + " из " + n + " · " + t.title; }
    else if (s.c === "paused") { icon = "‖"; cls += " paused"; right = "на паузе"; }
    else if (s.c === "avail") { icon = "○"; cls += " avail"; sub = "Ступень " + S.ROMAN[s.tier.n] + " · " + s.tier.title; }
    else { icon = "🔒"; cls += " locked"; right = s.label; if ((st.mastered || 0) > 0) sub = "освоено ступеней: " + st.mastered + " из " + n; }
    if (mode === "peek" && s.c === "avail") { icon = "🔒"; cls = "rg locked"; right = "следующий"; sub = ""; }
    const canTake = mode === "next" && s.c === "avail" && S.slotFor(s.tier);
    const act = canTake ? h("button", { class: "btn sm", type: "button", onclick: (e) => { e.stopPropagation(); S.takeSkill(sk, s.tier, p); } }, "Взять") : mode === "next" && s.c === "avail" ? h("span", { class: "rg-r" }, "нет места") : h("span", { class: "rg-r" }, right);
    return h("button", { class: cls, type: "button", onclick: () => S.skillSheet(sk, p) }, h("span", { class: "rg-i" }, icon), h("span", { class: "rg-b" }, h("span", { class: "rg-n" }, sk.name), sub ? h("span", { class: "rg-s" }, sub) : null), act);
  }
  S.takeSkill = function (sk, tier, p) {
    S.FX.choice("Новый навык", "Путь «" + p.name + "»", [{ name: sk.name, sub: "Ступень " + S.ROMAN[tier.n] + " · " + (tier.kind === "quest" ? "квест с шагами" : "каждый день в «Сегодня»"), text: tier.daily || tier.title, color: p.color }]).then((o) => o && S.activateSkill(sk, tier, p));
  };
  // карточка навыка: для навыка в работе — что делать сейчас и свиток
  const baseSheet = S.skillSheet;
  S.skillSheet = function (sk, p) {
    const s = S.skillStatus(sk, p);
    if (s.c !== "active" || !S.trackBody) return baseSheet(sk, p);
    const st = S.D.skills[sk.id] || {}, a = { p, sk, st, tier: s.tier };
    const m = S.FX.modal([h("div", { class: "m-sys" }, p.name + " · в работе"), h("div", { class: "m-t" }, sk.name), S.trackBody(a), h("div", { class: "m-btns" }, h("button", { class: "btn", type: "button", onclick: () => m.close() }, "Закрыть"))], { cls: "sheet" });
  };

  /* ---------- меню: только открытое ---------- */
  V.more = function (root) {
    const lv = S.X.level, secs = (S.D.growth.sections || []).filter((s) => ["today", "status", "quests", "skills", "shop"].indexOf(s.key) < 0);
    const open = secs.filter((s) => lv >= s.level).sort((a, b) => a.level - b.level);
    root.appendChild(S.win("Разделы", "Новый раздел открывается с уровнем", h("div", { class: "menu" }, open.map((s) => { const fresh = s.level > 1 && !S.seenSec(s.key); return h("button", { class: "mi" + (fresh ? " fresh" : ""), type: "button", onclick: () => S.go(s.key) }, h("b", null, s.name), h("small", null, fresh ? "новое" : s.intro.slice(0, 48) + (s.intro.length > 48 ? "…" : ""))); }))));
    const next = secs.filter((s) => s.level > lv && s.level < 900).sort((a, b) => a.level - b.level)[0];
    if (next) root.appendChild(h("div", { class: "plate" }, h("b", null, "Уровень " + next.level + ": "), "откроется «" + next.name + "». До него " + Math.max(0, S.xpForLevel(next.level) - Math.round(S.X.xp)) + " XP."));
  };
})();
