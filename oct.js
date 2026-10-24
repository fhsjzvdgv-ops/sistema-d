/* Система — Octalysis: история по дням, «Зачем» и главы, выбор из 3 заданий, окно ×2, общий рейд недели, респект.
   Общий код для всех игроков; различия — в window.APP. */
(function () {
  "use strict";
  const S = window.SYS, h = (...a) => S.h(...a), V = S.V, ui = S.ui;
  // в окне Эдуарда нет window.APP — там свои настройки
  const APP = window.APP || { me: "eduard", meName: "Эдуард", rivals: [{ id: "dariy", name: "Дарий" }, { id: "ilya", name: "Илья" }], rivalKey: "sysE_rivals" };
  if (!S.mainDone) { const blocks = () => Object.keys((S.D.config || {}).dailyBlocks || {}); S.mainDone = (d) => blocks().filter((k) => S.has("blk-" + d + "-" + k)).length; }
  if (!S.streakCalc) {
    // окно Эдуарда: день в серию — если засчитан минимум дня; прощений нет
    const closed = (d) => (S.dayClosed ? S.dayClosed(d) : S.has("minday-" + d) || S.has("allblk-" + d));
    S.streakCalc = function () {
      const t = S.today(), start = S.cutoffDay ? S.cutoffDay() : "2026-09-29", need = {}, st = {}; let run = 0, best = 0;
      const nb = Math.max(1, Object.keys((S.D.config || {}).dailyBlocks || {}).length);
      for (let d = start; d <= t; d = S.addDays(d, 1)) { need[d] = nb; if (closed(d)) { st[d] = "ok"; run++; } else if (d === t) st[d] = "today"; else { st[d] = "miss"; run = 0; } if (run > best) best = run; }
      return { tens: Math.floor(run / 10), inTen: run % 10, need, st, run, best, wkOff: {}, today: nb, start };
    };
  }
  const kd = (key, ...kids) => { ui.open = ui.open || {}; return S.keep(h("details", { class: "kn" }, ...kids), key); };
  const PL = () => S.D.player || {};
  const hash = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
  const vhead = (title) => h("div", { class: "vhead" }, h("button", { class: "back", type: "button", onclick: () => S.go("more"), "aria-label": "Назад" }, "‹"), h("h1", null, title));

  /* ================= ИСТОРИЯ ПО ДНЯМ ================= */
  const MARK = { ok: ["✓", "в серию"], off: ["◌", "пропуск прощён (1 в неделю)"], freeze: ["❄", "закрыт заморозкой"], miss: ["✗", "сорван"], today: ["…", "сегодня ещё идёт"] };
  const SKIP = { login: 1, lvl: 1, lootc: 1 };
  V.history = function (root) {
    root.appendChild(vhead("История"));
    const c = S.streakCalc(), t = S.today(), days = [];
    for (let d = t; d >= c.start; d = S.addDays(d, -1)) days.push(d);
    const cnt = { ok: 0, off: 0, miss: 0 }; days.forEach((d) => { if (cnt[c.st[d]] != null) cnt[c.st[d]]++; });
    root.appendChild(S.win("Сводка", "С первого дня игры — " + S.fmtDay(c.start),
      h("div", { class: "res" },
        h("div", { class: "res-row ok" }, h("span", null, "Дней в серию"), h("b", null, String(cnt.ok))),
        h("div", { class: "res-row" }, h("span", null, "Прощённых пропусков"), h("b", null, String(cnt.off))),
        h("div", { class: "res-row bad" }, h("span", null, "Сорванных дней"), h("b", null, String(cnt.miss))),
        h("div", { class: "res-row" }, h("span", null, "Сейчас подряд"), h("b", null, c.run + " дн.")),
        h("div", { class: "res-row" }, h("span", null, "Лучшая серия"), h("b", null, c.best + " дн.")),
        h("div", { class: "res-row" }, h("span", null, "Десяток собрано"), h("b", null, String(c.tens))))));
    const n = ui.histN || 21, wrap = h("div");
    days.slice(0, n).forEach((d, i) => {
      const s = c.st[d] || "miss", day = S.X.days[d] || { xp: 0, g: 0 }, md = S.mainDone(d), need = c.need[d] || 3;
      const evs = S.X.list.filter((e) => (e.d || S.dayOf(e.ts)) === d && !SKIP[e.k]).sort((a, b) => (a.ts || 0) - (b.ts || 0));
      ui.open = ui.open || {}; if (ui.open["hs-" + d] === undefined) ui.open["hs-" + d] = i === 0;
      const det = S.keep(h("details", { class: "kn hs-day " + s }), "hs-" + d);
      det.appendChild(h("summary", null, h("span", null, MARK[s][0] + " " + S.fmtDay(d)), h("span", { class: "more" }, "главных " + md + "/" + need + " · " + (day.xp >= 0 ? "+" : "") + Math.round(day.xp) + " XP")));
      det.appendChild(h("div", { class: "body" },
        h("div", { class: "muted" }, "День: " + MARK[s][1] + ". Золото: " + (day.g >= 0 ? "+" : "") + Math.round(day.g) + " ◆."),
        evs.length ? h("ul", { class: "conds hs-list" }, evs.map((e) => h("li", { class: (e.xp || 0) < 0 ? "red" : "" },
          h("span", null, String(e.t || e.k).replace(/^Блок закрыт: /, "★ ")), h("small", { class: "muted" }, " " + ((e.xp || 0) > 0 ? "+" : "") + Math.round(e.xp || 0) + " XP"))))
          : h("div", { class: "muted" }, "Ничего не отмечено.")));
      wrap.appendChild(det);
    });
    root.appendChild(S.win("По дням", "★ — главное дело. Нажми на день, чтобы раскрыть.", wrap,
      days.length > n ? h("button", { class: "btn ghost wide", type: "button", onclick: () => { ui.histN = n + 30; S.render(true); } }, "Показать ещё") : null));
  };

  /* меню: история первой строкой */
  const more0 = V.more;
  V.more = function (root) {
    root.appendChild(h("div", { class: "menu" }, h("button", { class: "mi", type: "button", onclick: () => S.go("history") }, h("b", null, "История"), h("small", null, "Что сделано по дням, серия, пропуски"))));
    more0(root);
  };

  /* ================= ЗАЧЕМ + ГЛАВЫ ================= */
  const CHAPTERS = ["Пробуждение", "Первая кровь", "Ритм", "Закалка", "Свой голос", "Хозяин дня", "Прорыв", "Легенда района", "Мастер", "Миф"];
  function whyCard() {
    const why = PL().why || APP.why || {}, c = S.streakCalc(), ch = Math.min(c.tens, CHAPTERS.length - 1);
    const goals = (why.goals || []).filter(Boolean);
    const edit = () => {
      const inp = h("textarea", { class: "inp", rows: 2, placeholder: "Ради чего ты это делаешь — одной фразой" }); inp.value = why.text || "";
      const gs = [0, 1, 2].map((i) => { const x = h("input", { class: "inp", placeholder: "Цель " + (i + 1) + " до конца года" }); x.value = goals[i] || ""; return x; });
      const m = S.FX.modal([h("div", { class: "m-sys" }, "ЗАЧЕМ"), inp].concat(gs, [h("div", { class: "m-btns" },
        h("button", { class: "btn", type: "button", onclick: () => { S.setPlayer({ why: { text: inp.value.trim(), goals: gs.map((x) => x.value.trim()).filter(Boolean) } }); m.close(); } }, "Сохранить"),
        h("button", { class: "btn ghost", type: "button", onclick: () => m.close() }, "Отмена"))]));
    };
    return h("section", { class: "win why" },
      h("div", { class: "win-title" }, "Глава " + (ch + 1) + " · " + CHAPTERS[ch]),
      h("div", { class: "why-t", onclick: edit }, why.text ? "«" + why.text + "»" : "Ради чего ты это делаешь? Нажми и напиши одной фразой."),
      goals.length ? h("div", { class: "muted" }, "Цели: " + goals.join(" · ")) : null,
      h("div", { class: "muted why-n" }, ch < CHAPTERS.length - 1 ? "До главы «" + CHAPTERS[ch + 1] + "» — " + (10 - c.inTen) + " дн. в серию." : "Последняя глава.",
        h("button", { class: "lnk", type: "button", onclick: edit }, "изменить")));
  }

  /* ================= ВЫБОР ИЗ 3 ЗАДАНИЙ ================= */
  function pickCard() {
    const t = S.today(), pools = ((S.D.pools || {}).pools) || {}, all = [];
    Object.keys(pools).forEach((p) => (pools[p] || []).forEach((x) => { if (x && x.t && (x.r === "E" || x.r === "D")) all.push(Object.assign({ p }, x)); }));
    if (all.length < 3) return null;
    const used = new Set(), opts = []; let k = hash(t + (APP.me || ""));
    while (opts.length < 3 && used.size < all.length) { const i = k % all.length; k = hash(String(k)); if (used.has(i)) continue; used.add(i); if (opts.some((o) => o.p === all[i].p)) continue; opts.push(all[i]); }
    const pk = PL().pick || {};
    if (pk.date === t) { const o = opts[pk.i] || {}; return S.win("Задание на выбор", "Сегодня ты выбрал: " + (o.t || "—") + ". Оно в твоих делах — закрой и получи опыт.", null); }
    return S.win("Задание на выбор", "Выбери одно из трёх — сам решаешь, что взять. Оно уйдёт в твои дела со средним приоритетом.",
      h("div", { class: "menu" }, opts.map((o, i) => h("button", { class: "mi", type: "button", onclick: () => {
        S.FX.confirm("Берёшь?", o.t + (o.how ? " — " + o.how : ""), "Беру").then((ok) => {
          if (!ok) return;
          S.setPlayer({ pick: { date: t, i } });
          S.ttCreate({ title: "🎲 " + o.t, projectId: (S.D.config || {}).ticktickProjectId || "sys", priority: 3, content: (o.how || "") + " Взял сам — задание на выбор дня.", dueDate: t + "T23:59:00+0400" }).catch(() => {});
        });
      } }, h("b", null, (S.BY[o.p] ? S.BY[o.p].name + " · " : "") + o.t), h("small", null, o.how || "")))));
  }

  /* ================= ОКНО ×2 ================= */
  // один час в день, общий для всех троих: всё, что закрыл в этот час, даёт опыт ещё раз (до 60 XP за дело)
  const x2Hour = (d) => 9 + (hash("x2" + d) % 12);
  function x2Card() {
    const t = S.today(), hr = x2Hour(t), now = new Date(Date.now() + 4 * 3600e3).getUTCHours();
    const on = now === hr, past = now > hr;
    return h("div", { class: "plate" + (on ? " hot" : "") }, h("b", null, on ? "⚡ Окно ×2 открыто до " + (hr + 1) + ":00! " : "⚡ Окно ×2 сегодня: " + hr + ":00–" + (hr + 1) + ":00. "),
      on ? "Всё, что закроешь сейчас, даст опыт дважды." : past ? "Уже прошло — завтра будет другой час." : "Закрой дела в этот час — опыт удвоится. Час общий у всех троих.");
  }
  function x2Scan() {
    if (!S.X || !S.db) return;
    const t = S.today(), hr = x2Hour(t);
    S.X.list.forEach((e) => {
      if ((e.d || S.dayOf(e.ts)) !== t || !(e.k === "blk" || S.QUEST_KINDS[e.k]) || !((e.xp || 0) > 0)) return;
      const hh = new Date((e.ts || 0) + 4 * 3600e3).getUTCHours();
      if (hh !== hr || S.has("x2-" + e._id)) return;
      S.writeEv("x2-" + e._id, { k: "gift", t: "Окно ×2: " + String(e.t || "").slice(0, 60), xp: Math.min(60, Math.round(e.xp)), g: 0, p: e.p || "osnova", d: t });
    });
  }

  /* ================= РЕЙД НЕДЕЛИ НА ТРОИХ ================= */
  const RAIDS = [
    { id: "voice1", from: "2026-10-24", to: "2026-11-01", title: "Гайд по голосу", text: "Образы → навык «Голос», ступень I. Каждый применяет гайд у себя.",
      steps: ["Посмотреть или прочитать «Гайд по голосу» (Навыки → Образы → Голос)", "5 дней из 7 — утро голоса: клапаны + 3 минуты мычания", "Скинуть в общий чат голосовое на минуту: до и после"] },
    { id: "out1", title: "Выйти наружу", text: "Каждый выпускает одну вещь в мир: трек, видео, пост, демку.", steps: ["Выбрать, что выпускаешь", "Доделать до конца", "Выложить и скинуть ссылку в чат"] },
    { id: "rep7", title: "7 отчётов из 7", text: "Каждый вечер всю неделю — отчёт в общий чат. Пропустил хоть один — рейд провален у всех.", steps: ["Отчёты пн–вс", "В воскресенье — общий итог: что получилось за неделю"] },
    { id: "body1", title: "Тысяча", text: "Каждый за неделю делает 1000 повторений: отжимания + приседания + пресс, в любом сочетании.", steps: ["Вести счёт в отчёте", "Добить 1000 до воскресенья"] }
  ];
  S.raidNow = function () {
    const t = S.today(), first = RAIDS[0];
    if (t <= first.to) return Object.assign({ key: first.id + "-" + first.from, until: first.to }, first);
    const ws = S.weekStart(t), n = Math.round((Date.parse(ws) - Date.parse(S.addDays(first.to, 1))) / 6048e5);
    const r = RAIDS[1 + (((n % (RAIDS.length - 1)) + RAIDS.length - 1) % (RAIDS.length - 1))];
    return Object.assign({ key: r.id + "-" + ws, until: S.addDays(ws, 6) }, r);
  };

  /* ================= РЕСПЕКТ ================= */
  // в своих данных для дуэли передаём: рейд (сделал / нет) и кому сегодня дал респект
  const mine0 = S.duelMine;
  if (mine0) S.duelMine = function () {
    const x = mine0.apply(this, arguments), p = PL(), r = S.raidNow();
    x.raid = { key: r.key, done: !!(p.raid && p.raid[r.key]) };
    x.resp = p.resp || {};
    x.why = (p.why && p.why.text) || "";
    return x;
  };
  function rivalsLive() {
    let a = {}; try { a = JSON.parse(localStorage.getItem(APP.rivalKey || "sys_rivals")) || {}; } catch (e) {}
    const b = ((S.D.duelDoc || {}).rivals) || {}, out = {};
    new Set(Object.keys(a).concat(Object.keys(b))).forEach((k) => { out[k] = (a[k] && (!b[k] || (a[k].at || 0) >= (b[k].at || 0))) ? a[k] : b[k]; });
    return out;
  }
  function respScan() {
    if (!S.X || !S.db) return;
    const live = rivalsLive(), t = S.today(), y = S.addDays(t, -1);
    (APP.rivals || []).forEach((r) => {
      const d = live[r.id]; if (!d || !d.resp) return;
      [t, y].forEach((day) => { const got = (d.resp[day] || []).indexOf(APP.me) >= 0; if (got && !S.has("resp-" + r.id + "-" + day)) S.writeEv("resp-" + r.id + "-" + day, { k: "gift", t: "Респект от " + r.name, xp: 15, g: 5, p: "socium", d: day }); });
    });
    const r = S.raidNow(), me = PL().raid && PL().raid[r.key];
    if (me && !S.has("raid-" + r.key)) {
      const all = (APP.rivals || []).every((x) => live[x.id] && live[x.id].raid && live[x.id].raid.key === r.key && live[x.id].raid.done);
      if (all) { S.writeEv("raid-" + r.key, { k: "gift", t: "Рейд пройден всеми: " + r.title, xp: 200, g: 150, p: "osnova" }); S.FX && S.FX.banner("[ РЕЙД ПРОЙДЕН ]", r.title + " — все трое сделали. +200 XP, +150 ◆ каждому."); }
    }
  }
  function raidCard() {
    const r = S.raidNow(), live = rivalsLive(), p = PL(), meDone = !!(p.raid && p.raid[r.key]);
    const who = [{ name: "Ты", done: meDone }].concat((APP.rivals || []).map((x) => ({ name: x.name, done: !!(live[x.id] && live[x.id].raid && live[x.id].raid.key === r.key && live[x.id].raid.done) })));
    const won = S.has("raid-" + r.key);
    return S.win("⚔ Рейд на троих · " + r.title, r.text + " Срок — до " + S.fmtDay(r.until) + ". Награда, только если сделали все трое: +200 XP и +150 ◆ каждому.",
      h("ul", { class: "conds" }, r.steps.map((s) => h("li", null, s))),
      h("div", { class: "raid-who" }, who.map((w) => h("span", { class: "raid-p" + (w.done ? " on" : "") }, (w.done ? "✓ " : "· ") + w.name))),
      won ? h("div", { class: "plate" }, h("b", null, "Рейд пройден. "), "Награда получена.")
        : meDone ? h("div", { class: "muted" }, "Ты отметился. Ждём остальных — подтолкни их в чате.")
          : h("button", { class: "btn wide", type: "button", onclick: () => S.FX.confirm("Сделал рейд?", "Отмечай, только если правда сделал все шаги. Пацаны увидят.", "Сделал").then((ok) => { if (!ok) return; S.setPlayer({ raid: Object.assign({}, p.raid || {}, { [r.key]: Date.now() }) }); setTimeout(() => S.duelSync && S.duelSync(true), 400); }) }, "Я сделал свою часть"));
  }
  function respCard() {
    const t = S.today(), p = PL(), given = (p.resp || {})[t] || [], live = rivalsLive();
    const gotToday = (APP.rivals || []).filter((r) => live[r.id] && live[r.id].resp && (live[r.id].resp[t] || []).indexOf(APP.me) >= 0).map((r) => r.name);
    return S.win("👊 Респект", "Видишь, что соперник сегодня пахал, — дай респект. Ему +15 XP. Один респект в день каждому." + (gotToday.length ? " Тебе сегодня дали: " + gotToday.join(", ") + "." : ""),
      h("div", { class: "raid-who" }, (APP.rivals || []).map((r) => {
        const on = given.indexOf(r.id) >= 0;
        return h("button", { class: "btn" + (on ? " ghost" : ""), type: "button", disabled: on ? true : null, onclick: () => {
          const resp = Object.assign({}, p.resp || {}); Object.keys(resp).forEach((d) => { if (d < S.addDays(t, -3)) delete resp[d]; });
          resp[t] = (resp[t] || []).concat([r.id]); S.setPlayer({ resp }); S.FX.toast("👊 Респект " + r.name); setTimeout(() => S.duelSync && S.duelSync(true), 400);
        } }, on ? "✓ " + r.name : "👊 " + r.name);
      })));
  }

  /* ================= ВСТАВКА В ЭКРАНЫ ================= */
  const today0 = V.today;
  V.today = function (root) {
    today0(root);
    try {
      const top = root.firstChild;
      root.insertBefore(whyCard(), top);
      root.insertBefore(x2Card(), top);
      const pc = pickCard(), hs = root.querySelector(".hs");
      if (pc) { if (hs && hs.parentNode) hs.parentNode.appendChild(pc); else root.appendChild(pc); }
    } catch (e) { if (window.console) console.error(e); }
  };
  V.quests = V.today;
  const duel0 = V.duel;
  if (duel0) V.duel = function (root) {
    try { root.appendChild(raidCard()); root.appendChild(respCard()); } catch (e) { if (window.console) console.error(e); }
    duel0(root);
  };
  const tick0 = S.tick;
  S.tick = function () { tick0.apply(this, arguments); try { x2Scan(); respScan(); } catch (e) { if (window.console) console.error(e); } };
})();
