/* Система v6 — разделы: рост, испытания, помощники, журнал */
(function () {
  "use strict";
  const S = window.SYS, h = (...a) => S.h(...a), V = (S.V = S.V || {});
  const R = () => S.R(), G = () => S.D.growth || {}, W = () => S.D.world || {}, P = () => S.D.pools || {};
  const ui = S.ui;

  /* ---------- меню «Ещё» ---------- */
  const GROUPS = [["growth", "Рост"], ["trials", "Испытания"], ["more", "Помощники и журнал"]];
  V.more = function (root) {
    const lv = S.X.level;
    GROUPS.forEach(([g, name]) => {
      const secs = (G().sections || []).filter((s) => s.group === g);
      root.appendChild(S.win(name, null, h("div", { class: "menu" }, secs.map((s) => {
        const open = lv >= s.level, fresh = open && !S.seenSec(s.key);
        return h("button", { class: "mi" + (open ? "" : " off") + (fresh ? " fresh" : ""), type: "button", onclick: () => (open ? S.go(s.key) : S.FX.toast("[ СИСТЕМА ] «" + s.name + "» откроется на уровне " + (s.level > 900 ? "— позже, с корешами" : s.level))) },
          h("b", null, s.name), h("small", null, open ? (fresh ? "новое" : "") : s.level > 900 ? "позже" : "ур. " + s.level));
      }))));
    });
  };
  S.seenSec = (k) => ((S.D.player && S.D.player.seen) || []).indexOf(k) >= 0;
  S.markSeen = (k) => { if (!S.D.player || S.seenSec(k)) return false; S.setPlayer({ seen: ((S.D.player.seen) || []).concat([k]) }); return true; };

  /* ---------- главный квест (ИИ) ---------- */
  V.main = function (root) {
    const b = (S.D.state || {}).beacon; const goals = (b && b.goals) || [];
    if (!goals.length) { root.appendChild(S.win("Главный квест", null, h("div", { class: "empty" }, "Цели месяца нет."))); return; }
    goals.forEach((g) => {
      const mq = S.D.main[g.id];
      const box = h("div");
      if (!mq || !mq.steps || !mq.steps.length) {
        box.appendChild(h("div", { class: "muted" }, "Система разобьёт цель «" + g.name + "» на маленькие шаги. Видно будет только текущий."));
        box.appendChild(h("button", { class: "btn wide", type: "button", disabled: S.sample ? null : true, onclick: (e) => S.mainBreak(g, e.currentTarget) }, S.sample ? "Разбить с помощью ИИ" : "ИИ недоступен в этом окне"));
      } else {
        const done = mq.cur, total = mq.steps.length, pct = Math.round((100 * done) / total);
        box.appendChild(h("div", { class: "crystal", style: { "--p": pct + "%" } }, h("i"), h("b", null, pct + "%")));
        box.appendChild(h("div", { class: "stat-grid" }, h("div", { class: "tile" }, h("small", null, "всего"), h("b", null, String(total))), h("div", { class: "tile" }, h("small", null, "пройдено"), h("b", null, String(done))), h("div", { class: "tile" }, h("small", null, "осталось"), h("b", null, String(total - done)))));
        if (done < total) {
          box.appendChild(h("div", { class: "curstep" }, h("span", { class: "lbl" }, "Шаг " + (done + 1)), mq.steps[done]));
          box.appendChild(h("div", { class: "fogsteps" }, Array.from({ length: Math.min(5, total - done - 1) }, () => h("span", null, "?"))));
          box.appendChild(h("button", { class: "btn wide", type: "button", onclick: () => S.mainStep(g, mq) }, "Отметить выполненным · " + S.preview("D", "materia")));
        } else box.appendChild(h("div", { class: "okline" }, "Все шаги пройдены. Отметь цель в чате с Claude."));
        box.appendChild(h("button", { class: "btn ghost sm", type: "button", onclick: () => S.FX.confirm("Сбросить разбивку?", "Шаги удалятся, опыт за пройденные останется.", "Сбросить").then((ok) => ok && S.db.doc("main/" + g.id).delete()) }, "Сбросить разбивку"));
      }
      root.appendChild(S.win("Главный квест · " + g.name, "До " + S.fmtDay(b.until), box));
    });
  };
  S.mainBreak = function (g, btn) {
    btn.disabled = true; btn.textContent = "Система думает…";
    const st = S.D.state || {}, prompt = "Ты — «Система» из игры роста. Разбей цель игрока на 60–120 очень маленьких конкретных шагов (каждый — действие на 5–30 минут, глагол в начале, по-русски, без нумерации). Цель: «" + g.name + "» до " + (st.beacon && st.beacon.until) + ". Контекст: игрок — маркетолог, ищет работу; отклики и формы за него делают Claude и Offerly, он сам пишет тем, кому нужно ответить, готовится и проходит собеседования, делает тестовые. Сейчас: " + (g.now || "") + ". Первые шаги — самые лёгкие. Верни JSON {\"steps\": [строки]}.";
    S.sample.json(prompt, { modelTier: "default" }).then((res) => {
      const steps = (res && res.steps || []).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim().slice(0, 200)).slice(0, 1000);
      if (!steps.length) throw { message: "пустой ответ" };
      return S.db.doc("main/" + g.id).set({ goal: g.id, title: g.name, steps, cur: 0, created: Date.now() });
    }).catch((e) => { btn.disabled = false; btn.textContent = "Разбить с помощью ИИ"; S.FX.toast("[ СИСТЕМА ] Не получилось: " + ((e && e.message) || e.code || "ошибка")); });
  };
  S.mainStep = function (g, mq) {
    const n = mq.cur;
    S.award({ id: "main-" + g.id + "-" + n, k: "main", t: mq.steps[n], p: "materia", r: "D", m: { goal: g.id, n } }).then(() => {
      S.db.doc("main/" + g.id).update({ cur: n + 1 });
      if ((n + 1) % 10 === 0) S.award({ id: "mainm-" + g.id + "-" + (n + 1), k: "mainm", t: "Веха: " + (n + 1) + " шагов", p: "materia", r: "B", noExtras: true });
    });
  };

  /* ---------- Спросить Систему ---------- */
  V.ask = function (root) {
    const today = S.today(), used = (S.D.ask || []).filter((a) => a.d === today).length, lim = 10;
    const ta = h("textarea", { class: "inp ta", rows: "3", placeholder: "Например: что мне сделать сегодня, чтобы подтянуть Тело?", "aria-label": "Вопрос Системе" });
    ta.value = ui.askDraft || ""; ta.addEventListener("input", () => (ui.askDraft = ta.value));
    const out = h("div", { class: "answer" }, ui.askAnswer || "");
    const btn = h("button", { class: "btn", type: "button", disabled: !S.sample || used >= lim ? true : null, onclick: () => S.askSystem(ta.value, out, btn) }, S.sample ? "Спросить" : "ИИ недоступен");
    root.appendChild(S.win("Спросить Систему", "Видит твои пути, цели, квесты и базу знаний. Осталось сегодня: " + Math.max(0, lim - used) + " из " + lim, ta, h("div", { class: "m-btns" }, btn), out));
    const hist = (S.D.ask || []).slice(-8).reverse();
    if (hist.length) root.appendChild(S.win("Прошлые вопросы", null, hist.map((a) => { const d = S.keep(h("details", { class: "kn" }), "ask-" + a.ts); d.appendChild(h("summary", null, h("span", null, a.q.slice(0, 80)), h("span", { class: "more" }, S.fmtDay(a.d)))); d.appendChild(h("div", { class: "body" }, a.a)); return d; })));
  };
  S.context = function () {
    const X = S.X, st = S.D.state || {}, kn = S.D.knowledge;
    const paths = S.ALLP.map((p) => p.name + " ур." + X.pl[p.key].level + " (" + Math.round(X.paths[p.key]) + " XP)").join(", ");
    const act = S.activeTracks().map((a) => a.sk.name + " ст." + a.tier.n).join(", ");
    const goals = ((st.beacon && st.beacon.goals) || []).map((g) => g.name + (g.now ? " — " + g.now : "")).join("; ");
    const week = Object.keys(X.days).filter((d) => S.diffDays(d, S.today()) < 7).map((d) => d + ": " + X.days[d].q + " квестов, +" + X.days[d].xp + " XP").join("; ");
    const know = kn && kn.groups ? kn.groups.map((g) => (g.items || []).map((i) => (i.t || i.title || i.name) + ": " + String(i.text || i.x || i.d || "").slice(0, 120)).join(" | ")).join(" | ").slice(0, 3500) : "";
    return "Игрок: уровень " + X.level + ", ранг " + (st.rank || "E") + ", серия " + (st.streak || 0) + ", фаза " + ((st.phase && st.phase.name) || "—") + ". Пути: " + paths + ". Навыки в работе: " + (act || "нет") + ". Цель месяца: " + goals + ". Последние 7 дней: " + week + ". База знаний (Арсен Маркарян, Ваагн, Лимарев): " + know;
  };
  S.askSystem = function (q, out, btn) {
    q = String(q || "").trim(); if (!q || !S.sample) return;
    btn.disabled = true; out.textContent = "Система думает…";
    const sys = "Ты — «Система» из игры роста Эдуарда (в духе «Поднятия уровня в одиночку»). Отвечай по-русски, коротко (до 8 строк), просто, конкретно, без эмодзи и морали. Опирайся на его данные и базу. Никаких советов про давление или манипуляции в адрес женщин; тема женщин — только после ранга D. Если вопрос про здоровье — предлагай врача. Данные игрока: " + S.context();
    S.sample([{ role: "user", content: sys + "\n\nВопрос: " + q }], { onText: (u) => (out.textContent = u.text), modelTier: "default", cache: false }).then((r) => {
      out.textContent = r.text; ui.askAnswer = r.text; ui.askDraft = "";
      const rec = { d: S.today(), ts: Date.now(), q: q.slice(0, 500), a: r.text.slice(0, 4000) };
      S.db.collection("ask").doc("a" + rec.ts).set(rec);
      btn.disabled = false;
    }, (e) => { out.textContent = e && e.code === "not_granted" ? "ИИ не разрешён в этом окне." : "Не получилось: " + ((e && e.message) || ""); btn.disabled = false; });
  };

  /* ---------- Достижения и титулы ---------- */
  V.achieve = function (root) {
    const all = S.achState(), got = all.filter((x) => x.got);
    const pl = S.D.player || {}, titles = S.titles();
    root.appendChild(S.win("Титул", "Активный титул показывается под ником", h("div", { class: "chips" }, titles.map((t) => h("button", { class: "tchip" + ((pl.title || (S.D.state || {}).title) === t ? " on" : ""), type: "button", onclick: () => S.setPlayer({ title: t }) }, t)))));
    const vis = all.filter((x) => !x.a.hidden), hid = all.filter((x) => x.a.hidden);
    root.appendChild(S.win("Достижения", "Получено " + got.length + " из " + all.length + " (скрытых — " + hid.length + ")",
      h("div", { class: "ach" }, vis.map((x) => h("div", { class: "ac" + (x.got ? " got" : "") }, h("b", null, x.a.name), h("small", null, x.a.text), !x.got ? S.bar(Math.round((100 * Math.min(x.v, x.a.n)) / x.a.n), "thin") : x.a.title ? h("small", { class: "tt" }, "титул «" + x.a.title + "»") : null))),
      h("div", { class: "win-title", style: { marginTop: "14px" } }, "Скрытые"),
      h("div", { class: "ach" }, hid.map((x) => h("div", { class: "ac" + (x.got ? " got" : " hid") }, h("b", null, x.got ? x.a.name : "???"), h("small", null, x.got ? x.a.text : "Узнаешь, когда получишь"))))));
  };
  V.pact = (root) => root.appendChild(S.pactWin());

  /* ---------- Цепочки ---------- */
  V.chains = function (root) {
    (W().chains || []).forEach((ch) => {
      const cs = S.chainState(ch), p = S.BY[ch.path];
      const box = h("div", { class: "chain" }, h("div", { class: "muted" }, ch.lore),
        h("div", { class: "pips" }, cs.steps.map((s) => h("span", { class: s.ev ? "on" : "" }))));
      if (cs.complete) box.appendChild(h("div", { class: "okline" }, "Пройдена. Титул «" + ch.title + "»"));
      else if (cs.next) box.appendChild(S.questCard({ t: "Шаг " + (cs.next.i + 1) + ": " + cs.next.t, p: ch.path, r: cs.next.r, lock: cs.canToday ? null : "Следующий шаг — завтра", onDo: (c) => S.doQuest({ id: "chain-" + ch.key + "-" + cs.next.i, k: "chain", t: ch.name + ": " + cs.next.t, p: ch.path, r: cs.next.r }, c).then(() => { if (cs.doneN + 1 >= cs.steps.length) S.writeEv("chaindone-" + ch.key, { k: "chaindone", t: "Цепочка: " + ch.name, xp: 0, g: 100, m: { title: ch.title } }); }) }));
      root.appendChild(S.win(ch.name, p.name + " · титул «" + ch.title + "»", box));
    });
  };

  /* ---------- Перки ---------- */
  V.perks = function (root) {
    const X = S.X;
    (G().perks || []).forEach((pk) => {
      const p = S.BY[pk.path], cur = X.perks[pk.path] || 0;
      const box = h("div", { class: "perks" }, pk.tiers.map((t) => {
        const have = cur >= t.n, next = t.n === cur + 1;
        return h("div", { class: "pk" + (have ? " have" : next ? " next" : "") }, h("b", null, t.name), h("small", null, t.text),
          have ? h("span", { class: "ok" }, "есть") : next ? h("button", { class: "btn sm", type: "button", disabled: X.gold < t.cost ? true : null, onclick: () => S.FX.confirm("Купить перк?", t.name + " — " + t.cost + " ◆", "Купить").then((ok) => ok && S.writeEv(S.uid("perk"), { k: "perk", t: t.name, xp: 0, g: -t.cost, m: { path: pk.path, tier: t.n } }).then((x) => x && S.FX.banner("[ ПЕРК ]", t.name + ": " + t.text))) }, t.cost + " ◆") : h("span", { class: "muted" }, t.cost + " ◆"));
      }));
      root.appendChild(S.win("Перки · " + p.name, null, box));
    });
  };

  /* ---------- Марафоны ---------- */
  V.marathons = function (root) {
    (W().marathons || []).forEach((mr) => {
      const ms = S.marState(mr), p = S.BY[mr.path];
      const box = h("div");
      if (!ms.start || ms.done) {
        if (ms.done) box.appendChild(h("div", { class: "okline" }, "Пройден. Титул «" + mr.title + "». Можно пройти снова."));
        box.appendChild(h("button", { class: "btn wide", type: "button", onclick: () => S.writeEv(S.uid("marstart"), { k: "marstart", t: "Старт: " + mr.name, xp: 0, g: 0, m: { mar: mr.key } }).then(() => S.FX.banner("[ МАРАФОН НАЧАТ ]", mr.name + ". Отмечай каждый день.")) }, "Начать"));
      } else {
        box.appendChild(h("div", { class: "mar" }, Array.from({ length: mr.days }, (_, i) => h("span", { class: i < ms.streak ? "on" : "" }))));
        box.appendChild(h("div", { class: "muted" }, "Подряд: " + ms.streak + " из " + mr.days + (ms.broken ? " · цепочка прервалась — начни заново" : "")));
        if (ms.broken) box.appendChild(h("button", { class: "btn ghost wide", type: "button", onclick: () => S.writeEv(S.uid("marreset"), { k: "marreset", t: "Перезапуск: " + mr.name, xp: 0, g: 0, m: { mar: mr.key } }).then(() => S.writeEv(S.uid("marstart"), { k: "marstart", t: "Старт: " + mr.name, xp: 0, g: 0, m: { mar: mr.key } })) }, "Начать заново"));
        else if (!ms.todayMarked) box.appendChild(h("button", { class: "btn wide", type: "button", onclick: () => S.award({ id: "mar-" + mr.key + "-" + S.today(), k: "mar", t: mr.name + " — день " + (ms.streak + 1), p: mr.path, r: "E", m: { mar: mr.key, start: ms.start._id } }).then(() => { if (ms.streak + 1 >= mr.days) S.award({ id: "mardone-" + mr.key + "-" + ms.start._id, k: "mardone", t: "Марафон: " + mr.name, p: mr.path, r: mr.rank, mult: 3, noExtras: true, m: { title: mr.title } }); }) }, "Отметить сегодня"));
        else box.appendChild(h("div", { class: "okline" }, "Сегодня отмечено."));
      }
      root.appendChild(S.win(mr.name, p.name + " · награда ранга " + mr.rank + " ×3 · титул «" + mr.title + "»", box));
    });
  };

  /* ---------- Питомец ---------- */
  V.pet = function (root) {
    const pl = S.D.player || {}, pi = S.petInfo(), cfg = G().pet || {};
    if (!pl.pet) {
      const top = S.ALLP.slice().sort((a, b) => S.X.paths[b.key] - S.X.paths[a.key])[0];
      root.appendChild(S.win("Питомец", cfg.text, h("div", { class: "egg" }, "🥚"), h("div", { class: "muted" }, "Вид определится по самому сильному пути: сейчас это «" + top.name + "» → " + ((cfg.species || {})[top.key] || ["?"])[0] + "."),
        h("button", { class: "btn wide", type: "button", onclick: () => S.FX.prompt("Имя питомца", "Можно оставить пустым.", "Имя").then((v) => { if (v === null) return; S.setPlayer({ pet: { born: Date.now(), path: top.key, name: v || null } }).then(() => S.FX.banner("[ ЯЙЦО ПОЛУЧЕНО ]", "Покорми его " + (cfg.hatchFeeds || 3) + " раза, чтобы вылупился.")); }) }, "Взять яйцо")));
      return;
    }
    const X = S.X;
    const pct = pi.next ? Math.round((100 * (pi.xp - (cfg.stages[pi.stage] || [0, 0])[1])) / (pi.next[1] - cfg.stages[pi.stage][1])) : 100;
    root.appendChild(S.win(pi.name, pi.species + " · " + pi.stageName + (pi.sad ? " · грустит" : ""), h("div", { class: "pet" + (pi.sad ? " sad" : "") + " st" + pi.stage }, pi.hatched ? pi.icon : "🥚"),
      pi.hatched ? S.bar(pct, "thin") : h("div", { class: "muted" }, "Кормлений до вылупления: " + Math.max(0, (cfg.hatchFeeds || 3) - pi.feeds)),
      h("div", { class: "muted" }, pi.hatched ? "Опыт питомца: " + pi.xp + (pi.next ? " · до «" + pi.next[0] + "»: " + (pi.next[1] - pi.xp) : "") + " · бонус: +" + Math.round(pi.bonus * 100) + "% опыта" : ""),
      h("div", { class: "m-btns" }, ["food", "treat"].map((id) => { const it = S.shopItem(id); const have = X.inv[id] || 0; return h("button", { class: "btn sm", type: "button", onclick: () => (have ? S.applyItem(id) : S.buy(id).then((ok) => ok && S.applyItem(id))) }, it.name + (have ? " (" + have + ")" : " · " + it.cost + " ◆")); })),
      h("div", { class: "note" }, cfg.text)));
  };

  /* ---------- Класс ---------- */
  V.class = function (root) {
    const pl = S.D.player || {}, cn = S.classNodes();
    if (!cn) {
      root.appendChild(S.win("Выбор класса", (G().classRules || {}).text, h("div", { class: "classes" }, (G().classes || []).map((c) => h("button", { class: "cls", type: "button", onclick: () => S.FX.confirm("Стать: " + c.name + "?", c.about + " Бонус: " + c.bonusText + ".", "Выбрать").then((ok) => ok && S.setPlayer({ cls: { key: c.key, since: Date.now() } }).then(() => S.FX.banner("[ КЛАСС ]", "Ты — " + c.name))) }, h("b", null, c.name), h("small", null, c.bonusText), h("span", null, c.about))))));
      return;
    }
    const box = h("div", { class: "graph" });
    for (let ti = 0; ti < 5; ti++) {
      box.appendChild(h("div", { class: "grow" }, cn.nodes.filter((n) => n.tier === ti).map((nd) => h("button", { class: "node" + (nd.done ? " done" : nd.open ? " open" : "") + (nd.fog ? " fog" : ""), type: "button", "aria-label": nd.fog ? "Скрыто туманом" : nd.t, onclick: () => {
        if (nd.fog) return S.FX.toast("[ СИСТЕМА ] Финал скрыт туманом. Пройди остальные 24 узла.");
        if (nd.done) return S.FX.toast("Пройдено: " + nd.t);
        if (!nd.open) return S.FX.toast("[ СИСТЕМА ] Сначала пройди любой узел ступенью ниже.");
        if (cn.todayDone) return S.FX.toast("[ СИСТЕМА ] Один узел в день. Следующий — завтра.");
        S.doQuest({ id: "cls-" + cn.c.key + "-" + nd.n + "-" + (pl.cls.since || 0), k: "cls", t: nd.t, p: nd.p, r: nd.finale ? "S" : "B", mult: nd.finale ? 3 : 1, m: { cls: cn.c.key, node: nd.n } });
      } }, h("span", null, nd.fog ? "?" : S.ROMAN[ti + 1]), h("small", null, nd.fog ? "туман" : nd.t.slice(0, 26))))));
    }
    root.appendChild(S.win("Класс: " + cn.c.name, cn.c.bonusText + " · узлов " + cn.count + " из 25" + (cn.todayDone ? " · сегодня уже пройден" : ""), box,
      h("button", { class: "btn ghost sm", type: "button", onclick: () => S.FX.confirm("Сменить класс?", "Прогресс узлов обнулится.", "Сменить").then((ok) => ok && S.setPlayer({ cls: null, classChanged: true })) }, "Сменить класс")));
  };

  /* ---------- Наставники ---------- */
  V.mentors = function (root) {
    const pl = S.D.player || {}, ms = P().mentors || [], ws = S.weekStart(S.today());
    const cur = ms.find((m) => pl.mentor && m.key === pl.mentor.key);
    if (cur) {
      const talked = S.has("talk-" + ws), adv = S.pick(cur.advice, "adv" + ws), wq = S.pick(cur.tasks, "wq" + ws);
      root.appendChild(S.win("Наставник: " + cur.name, cur.role + " · " + cur.bonusText, h("div", { class: "muted" }, cur.about),
        talked ? h("div", null, h("div", { class: "quote" }, adv), S.questCard({ t: "Задание недели: " + wq.t, p: wq.p, r: "B", done: S.has("menw-" + ws), label: "Наставник " + cur.name, onDo: (c) => S.doQuest({ id: "menw-" + ws, k: "menw", t: wq.t, p: wq.p, r: "B" }, c) }))
          : h("button", { class: "btn wide", type: "button", onclick: () => S.writeEv("talk-" + ws, { k: "talk", t: "Разговор с наставником", xp: 0, g: 0, m: { mentor: cur.key } }).then(() => S.FX.banner("[ " + cur.name.toUpperCase() + " ]", adv)) }, "Разговор недели")));
    }
    root.appendChild(S.win("Наставники", "Один активный. Смена — в любой момент", h("div", { class: "classes" }, ms.map((m) => h("button", { class: "cls" + (cur && cur.key === m.key ? " on" : ""), type: "button", onclick: () => { if (cur && cur.key === m.key) return; S.setPlayer({ mentor: { key: m.key, since: Date.now() }, mentorsTried: Array.from(new Set((pl.mentorsTried || []).concat([m.key]))) }).then(() => S.FX.banner("[ НАСТАВНИК ]", m.name + ": " + m.bonusText)); } }, h("b", null, m.name), h("small", null, m.role + " · " + m.bonusText), h("span", null, m.about))))));
  };

  /* ---------- Босс ---------- */
  function bossView(root, type) {
    const bs = S.bossState(type); if (!bs) return;
    const b = bs.boss, br = W().bossRules || {};
    const pct = Math.round((100 * bs.hp) / bs.maxHp);
    const box = h("div", { class: "boss" + (bs.killed ? " dead" : "") + (bs.sealed ? " sealed" : "") },
      h("div", { class: "bname" }, b.name), h("div", { class: "muted" }, b.lore),
      h("div", { class: "hpbar" }, S.bar(pct, "boss"), h("span", null, bs.hp + " / " + bs.maxHp)),
      bs.guards.length ? h("div", { class: "guards" }, bs.guards.map((g) => h("div", { class: "guard" + (g.hp <= 0 ? " dead" : "") }, h("small", null, "Страж · " + (S.BY[g.p] || {}).name), S.bar(Math.round((100 * g.hp) / g.max), "thin", (S.BY[g.p] || {}).color)))) : null,
      h("div", { class: "bstat" },
        h("span", null, "Слабость: " + (S.BY[b.weak] || {}).name + " ×" + (br.weakMult || 1.5)),
        h("span", null, "Разведка: " + (bs.scout > 1 ? "×" + bs.scout : bs.mondayQ + "/" + (br.scoutQuests || 3) + " в понедельник")),
        bs.sealed ? h("span", { class: "red" }, "ПЕЧАТЬ: " + bs.sealHits + "/" + (br.sealQuests || 3) + " ударов в слабость") : null,
        h("span", null, "Твоё здоровье: " + bs.php + "/" + bs.phpMax)),
      h("div", { class: "note" }, "Подсказка: " + b.hint));
    if (bs.killed && !bs.claimed) box.appendChild(h("button", { class: "btn wide", type: "button", onclick: () => S.bossClaim(bs) }, "Забрать награду"));
    else if (bs.claimed) box.appendChild(h("div", { class: "okline" }, "Повержен. Новый враг — " + (type === "week" ? "в понедельник" : "в новом месяце") + "."));
    else if (bs.dead) box.appendChild(h("div", { class: "warn" }, "Ты выбыл до конца " + (type === "week" ? "недели" : "месяца") + ". Отдохни и вернись сильнее."));
    root.appendChild(S.win(type === "week" ? "Босс недели" : "Босс месяца", S.fmtDay(bs.from) + " — " + S.fmtDay(bs.to), box));
    root.appendChild(S.win("Как это работает", null, h("div", { class: "muted" }, br.text || "")));
  }
  V.boss = (root) => bossView(root, "week");
  V.bossmonth = (root) => bossView(root, "month");

  /* ---------- Карта мира ---------- */
  V.map = function (root) {
    const lv = S.X.level, t = S.today();
    const box = h("div", { class: "map" });
    (W().locations || []).forEach((l) => {
      const open = lv >= l.level, id = "loc-" + l.id + "-" + t, visits = (S.X.byKind.loc || []).filter((e) => e.m && e.m.loc === l.id).length;
      const det = S.keep(h("details", { class: "loc" + (open ? "" : " off") }), "loc-" + l.id);
      det.appendChild(h("summary", null, S.dot(l.path), h("span", { class: "tx" }, open ? l.name : "??? · ур. " + l.level), h("small", null, open ? S.plural(visits, "визит", "визита", "визитов") : "")));
      if (open) det.appendChild(h("div", { class: "body" }, h("div", { class: "muted" }, l.lore), S.questCard({ t: l.quest, p: l.path, r: "C", done: S.has(id), label: "Квест локации", onDo: (c) => S.doQuest({ id, k: "loc", t: l.name + ": " + l.quest, p: l.path, r: "C", m: { loc: l.id } }, c) })));
      box.appendChild(det);
    });
    root.appendChild(S.win("Карта мира", "20 локаций. Квест каждой — раз в день", box));
  };

  /* ---------- Сезон ---------- */
  V.season = function (root) {
    const ss = S.seasonState(), sc = W().seasons || {};
    const nx = ss.next; const pct = nx ? Math.round((100 * (ss.pts - sc.tiers[ss.tier][1])) / (nx[1] - sc.tiers[ss.tier][1])) : 100;
    root.appendChild(S.win(ss.name, sc.text, h("div", { class: "stat-grid" }, h("div", { class: "tile" }, h("small", null, "очки"), h("b", null, String(ss.pts))), h("div", { class: "tile" }, h("small", null, "ранг"), h("b", null, ss.tierName)), h("div", { class: "tile" }, h("small", null, "награда"), h("b", { class: "gold" }, "◆ " + ((sc.reward || [])[ss.tier] || 0)))),
      S.bar(pct, "thin"), nx ? h("div", { class: "muted" }, "До «" + nx[0] + "»: " + (nx[1] - ss.pts) + " очков") : h("div", { class: "okline" }, "Высший ранг сезона"),
      h("div", { class: "ranks" }, (sc.tiers || []).map((x, i) => h("span", { class: i <= ss.tier ? "on" : "" }, x[0] + " " + x[1])))));
  };
  V.challenge = function (root) {
    const ch = S.challengeWeek(), now = Date.now();
    const txt = ch.done ? "Вызов недели пройден." : now < ch.start ? "Вызов этой недели ещё впереди. Время — сюрприз." : now < ch.end ? "Вызов идёт прямо сейчас — во вкладке «Квесты»." : "Вызов этой недели прошёл.";
    root.appendChild(S.win("Суточный вызов", (W().challengeRules || {}).text, h("div", { class: "qc-t" }, txt), now >= ch.start && now < ch.end && !ch.done ? h("button", { class: "btn wide", type: "button", onclick: () => S.go("quests") }, "К вызову") : null));
  };

  /* ---------- Чистилище ---------- */
  V.purgatory = function (root) {
    const t = S.today(), X = S.X;
    // практика разума
    const pr = S.pick(W().practices || ["—"], "prac" + t), pid = "prac-" + t;
    root.appendChild(S.win("Практика разума", "Одна в день", S.questCard({ t: pr, p: "osnova", r: "D", done: S.has(pid), label: "Практика", onDo: (c) => S.doQuest({ id: pid, k: "prac", t: pr, p: "osnova", r: "D" }, c) })));
    // модули
    const mods = h("div", { class: "qlist" });
    (W().modules || []).forEach((md) => {
      const passed = S.has("mod-" + md.key);
      mods.appendChild(h("div", { class: "qc" + (passed ? " done" : ""), style: { "--pc": (S.BY[md.path] || {}).color } }, h("div", { class: "qc-h" }, S.rankBadge("B"), h("span", { class: "qc-p" }, (S.BY[md.path] || {}).name), h("span", { class: "qc-x" }, passed ? "пройден" : "тест, проходной 80%")), h("div", { class: "qc-t" }, md.name),
        h("div", { class: "qc-b" }, h("button", { class: "btn sm" + (passed ? " ghost" : ""), type: "button", onclick: () => S.runModule(md) }, passed ? "Повторить" : "Открыть"))));
    });
    root.appendChild(S.win("Модули", "Прочитай и сдай тест. Броня — отсюда", mods));
    // ставки
    const sr = W().stakeRules || {}, list = S.stakes();
    const sbox = h("div", { class: "qlist" });
    list.filter((s) => !s.res).forEach((s) => {
      const lines = h("div", { class: "muted" }, "Ставка " + s.stake + " ◆ · день " + Math.min(s.days, s.doneDays + (s.marks.has(t) ? 0 : 1)) + " из " + s.days + " · держал " + s.doneDays);
      const row = h("div", { class: "qc-b" });
      if (s.missed) row.appendChild(h("button", { class: "btn sm ghost", type: "button", onclick: () => S.writeEv("stakef-" + s.id, { k: "stakef", t: "Ставка сгорела: " + s.t, xp: 0, g: 0 }) }, "Признать провал"));
      else if (s.finished) row.appendChild(h("button", { class: "btn sm", type: "button", onclick: () => S.writeEv("stakew-" + s.id, { k: "stakew", t: "Выдержал: " + s.t, xp: 0, g: s.stake * (sr.winMult || 2), p: "osnova" }).then((ok) => ok && S.FX.chest("Испытание выдержано", ["+" + s.stake * (sr.winMult || 2) + " ◆"])) }, "Забрать ×" + (sr.winMult || 2)));
      else {
        if (!s.marks.has(t)) row.appendChild(h("button", { class: "btn sm", type: "button", onclick: () => S.writeEv("stk-" + s.id + "-" + t, { k: "stk", t: "Держу: " + s.t, xp: 0, g: 0, m: { stake: s.id } }) }, "Сегодня держу"));
        row.appendChild(h("button", { class: "btn sm ghost", type: "button", onclick: () => S.FX.confirm("Сдаться?", "Вернётся " + Math.round((sr.surrenderBack || 0.3) * 100) + "% ставки.", "Сдаться").then((ok) => ok && S.writeEv("stakes-" + s.id, { k: "stakes", t: "Сдался: " + s.t, xp: 0, g: Math.round(s.stake * (sr.surrenderBack || 0.3)) })) }, "Сдаться"));
      }
      sbox.appendChild(h("div", { class: "qc" }, h("div", { class: "qc-t" }, s.t), lines, row));
    });
    const sel = h("select", { class: "inp sel", "aria-label": "Испытание" }, (W().willTrials || []).map((x, i) => h("option", { value: String(i) }, x.t + " (" + x.days + " дн.)")), h("option", { value: "own" }, "Своё испытание…"));
    const amt = h("input", { class: "inp", type: "number", min: String(sr.min || 50), max: String(Math.min(sr.max || 2000, X.gold)), value: String(Math.min(100, X.gold)), "aria-label": "Ставка" });
    sbox.appendChild(h("div", { class: "own" }, h("div", { class: "own-r" }, sel, amt, h("button", { class: "btn sm", type: "button", onclick: () => S.newStake(sel.value, +amt.value) }, "Поставить")), h("small", { class: "muted" }, sr.text)));
    root.appendChild(S.win("Испытания воли", "Ставка золотом на себя", sbox));
    const hist = list.filter((s) => s.res).slice(-5).reverse();
    if (hist.length) root.appendChild(S.win("История", null, hist.map((s) => h("div", { class: "lrow" }, h("span", { class: "ln" }, s.t), h("span", { class: "ll" + (s.res === "win" ? " ok" : "") }, { win: "выдержал", surrender: "сдался", fail: "сгорело" }[s.res])))));
  };
  S.newStake = function (v, amount) {
    const sr = W().stakeRules || {}, X = S.X;
    amount = Math.round(amount || 0);
    if (amount < (sr.min || 50) || amount > (sr.max || 2000)) return S.FX.toast("[ СИСТЕМА ] Ставка от " + (sr.min || 50) + " до " + (sr.max || 2000) + " ◆");
    if (amount > X.gold) return S.FX.toast("[ СИСТЕМА ] Не хватает золота");
    const go = (t, days) => S.writeEv(S.uid("stake"), { k: "stake", t: "Ставка: " + t, xp: 0, g: -amount, m: { t, days } }).then((ok) => ok && S.FX.banner("[ СТАВКА ПРИНЯТА ]", t + " · " + amount + " ◆"));
    if (v === "own") return S.FX.prompt("Своё испытание", "Что и сколько дней (например: «5 дней без сахара»).", "Испытание").then((t) => { if (!t) return; const m = t.match(/(\d+)/); go(t, Math.max(1, Math.min(30, m ? +m[1] : 3))); });
    const wt = (W().willTrials || [])[+v]; if (wt) go(wt.t, wt.days);
  };
  S.runModule = function (md) {
    let i = 0, right = 0, m;
    const body = h("div");
    const show = () => {
      body.textContent = "";
      if (i === 0 && !body.dataset.read) {
        body.appendChild(h("ol", { class: "rules" }, md.points.map((x) => h("li", null, x))));
        body.appendChild(h("div", { class: "m-btns" }, h("button", { class: "btn", type: "button", onclick: () => { body.dataset.read = "1"; show(); } }, "К тесту")));
        return;
      }
      if (i >= md.test.length) {
        const pass = right / md.test.length >= (W().modulePass || 0.8);
        body.appendChild(h("div", { class: "m-t" }, (pass ? "Сдано: " : "Не сдано: ") + right + " из " + md.test.length));
        if (pass && !S.has("mod-" + md.key)) S.award({ id: "mod-" + md.key, k: "mod", t: "Модуль: " + md.name, p: md.path, r: "B", noExtras: true });
        body.appendChild(h("div", { class: "m-btns" }, h("button", { class: "btn", type: "button", onclick: () => m.close() }, "Закрыть")));
        return;
      }
      const q = md.test[i];
      body.appendChild(h("div", { class: "m-sys" }, "Вопрос " + (i + 1) + " из " + md.test.length));
      body.appendChild(h("div", { class: "m-t" }, q.q));
      const why = h("div", { class: "why", hidden: true });
      const opts = q.o.map((o, k) => h("button", { class: "opt", type: "button", onclick: () => {
        opts.forEach((b, j) => { b.disabled = true; if (j === q.a) b.classList.add("right"); else if (j === k) b.classList.add("wrong"); });
        if (k === q.a) right++;
        why.hidden = false; why.textContent = q.why; next.hidden = false;
      } }, o));
      const next = h("button", { class: "btn", type: "button", hidden: true, onclick: () => { i++; show(); } }, "Дальше");
      body.appendChild(h("div", { class: "opts" }, opts)); body.appendChild(why); body.appendChild(h("div", { class: "m-btns" }, next));
    };
    m = S.FX.modal([h("div", { class: "m-sys" }, "ЧИСТИЛИЩЕ · МОДУЛЬ"), h("div", { class: "m-t" }, md.name), body], { cls: "sheet" });
    show();
  };

  /* ---------- Путь Легенды, наставник 30 дней ---------- */
  V.legend = function (root) {
    const L = W().legend || [], done = (S.X.byKind.leg || []).length, last = (S.X.byKind.leg || []).slice(-1)[0];
    const can = !last || last.d < S.today();
    const box = h("div");
    box.appendChild(h("div", { class: "pips wide" }, L.map((_, i) => h("span", { class: i < done ? "on" : "" }))));
    if (done < L.length) box.appendChild(S.questCard({ t: "Испытание " + (done + 1) + ": " + L[done], p: "osnova", r: "S", lock: can ? null : "Следующее — завтра", label: "Путь Легенды", onDo: (c) => S.doQuest({ id: "leg-" + done, k: "leg", t: L[done], p: "osnova", r: "S" }, c) }));
    else box.appendChild(h("div", { class: "okline" }, "Путь Легенды пройден."));
    box.appendChild(h("div", { class: "ranks" }, (W().legendMilestones || []).map((m) => h("span", { class: done >= m[0] ? "on" : "" }, m[0] + " → «" + m[1] + "»"))));
    root.appendChild(S.win("Путь Легенды", "50 испытаний ранга S, по одному в день. Пройдено " + done, box));
  };
  V.creator = function (root) {
    const pl = S.D.player || {}, C = W().creator || {};
    if (!pl.creator || !C[pl.creator]) {
      root.appendChild(S.win("30 дней с наставником", "Выбери, с кем идти", h("div", { class: "classes" }, Object.keys(C).map((k) => h("button", { class: "cls", type: "button", onclick: () => S.setPlayer({ creator: k }) }, h("b", null, C[k].name), h("small", null, "титул «" + C[k].title + "»"), h("span", null, C[k].days[0] + " → … → " + C[k].days[29]))))));
      return;
    }
    const c = C[pl.creator], evs = (S.X.byKind.cre || []).filter((e) => e.m && e.m.who === pl.creator), n = evs.length, last = evs.slice(-1)[0];
    const can = !last || last.d < S.today();
    const box = h("div", h("div", { class: "pips wide" }, c.days.map((_, i) => h("span", { class: i < n ? "on" : "" }))));
    const box2 = h("div", null, h("div", { class: "pips wide" }, c.days.map((_, i) => h("span", { class: i < n ? "on" : "" }))));
    if (n < 30) box2.appendChild(S.questCard({ t: "День " + (n + 1) + ": " + c.days[n], p: "osnova", r: "B", lock: can ? null : "Следующий день — завтра", label: c.name, onDo: (cd) => S.doQuest({ id: "cre-" + pl.creator + "-" + n, k: "cre", t: c.days[n], p: "osnova", r: "B", m: { who: pl.creator } }, cd).then(() => { if (n + 1 >= 30) S.writeEv("credone-" + pl.creator, { k: "credone", t: c.name + " пройден", xp: 0, g: 1000, m: { title: c.title } }); }) }));
    else box2.appendChild(h("div", { class: "okline" }, "Пройдено. Титул «" + c.title + "»."));
    box2.appendChild(h("button", { class: "btn ghost sm", type: "button", onclick: () => S.setPlayer({ creator: null }) }, "Выбрать другого"));
    root.appendChild(S.win(c.name, "День " + Math.min(30, n + 1) + " из 30", box2));
    void box;
  };

  /* ---------- Артефакты ---------- */
  V.artifacts = function (root) {
    const X = S.X, pl = S.D.player || {}, slots = S.artSlots(), eq = pl.arts || [];
    const own = Object.keys(X.arts).map((id) => (G().artifacts || []).find((a) => a.id === id)).filter(Boolean);
    root.appendChild(S.win("Слоты", "Надето " + eq.length + " из " + slots + " (слоты: ур. 10, 20, 30)", h("div", { class: "slots" }, Array.from({ length: 3 }, (_, i) => { const a = (G().artifacts || []).find((x) => x.id === eq[i]); return h("div", { class: "slot" + (i < slots ? "" : " off") + (a ? " r-" + a.rar : "") }, a ? a.name : i < slots ? "пусто" : "закрыт"); }))));
    const box = h("div", { class: "qlist" });
    if (!own.length) box.appendChild(h("div", { class: "empty" }, "Артефакты выпадают с боссов, из сундука 28-го дня серии и из шкатулки в магазине."));
    own.forEach((a) => { const on = eq.indexOf(a.id) >= 0; box.appendChild(h("div", { class: "qc r-" + a.rar }, h("div", { class: "qc-h" }, h("span", { class: "qc-p" }, ((G().rarity || {})[a.rar] || [""])[0]), h("span", { class: "qc-x" }, a.path === "all" ? "+" + Math.round(a.bonus * 100) + "% ко всему" : a.path === "boss" ? "урон по боссам" : "+" + Math.round(a.bonus * 100) + "% " + ((S.BY[a.path] || {}).name || ""))), h("div", { class: "qc-t" }, a.name), h("div", { class: "qc-how" }, a.lore),
      h("div", { class: "qc-b" }, on ? h("button", { class: "btn sm ghost", type: "button", onclick: () => S.setPlayer({ arts: eq.filter((x) => x !== a.id) }) }, "Снять") : h("button", { class: "btn sm", type: "button", disabled: eq.length >= slots ? true : null, onclick: () => S.setPlayer({ arts: eq.concat([a.id]) }) }, "Надеть")))); });
    root.appendChild(S.win("Мои артефакты", null, box));
  };

  /* ---------- Зал славы ---------- */
  V.fame = function (root) {
    const X = S.X, rows = [];
    (X.byKind.lvl || []).filter((e) => e.m && e.m.level % 5 === 0).forEach((e) => rows.push([e.d, "Уровень " + e.m.level]));
    (X.byKind.boss || []).forEach((e) => rows.push([e.d, e.t]));
    (X.byKind.mardone || []).forEach((e) => rows.push([e.d, e.t]));
    (X.byKind.chaindone || []).forEach((e) => rows.push([e.d, e.t]));
    (X.byKind.stakew || []).forEach((e) => rows.push([e.d, e.t]));
    (X.byKind.season || []).forEach((e) => rows.push([e.d, e.t]));
    rows.sort((a, b) => (a[0] < b[0] ? 1 : -1));
    root.appendChild(S.win("Зал Славы", "Твои большие победы", rows.length ? rows.map((r) => h("div", { class: "lrow" }, h("span", { class: "ln" }, r[1]), h("span", { class: "ll" }, S.fmtDay(r[0])))) : h("div", { class: "empty" }, "Пока пусто. Первая победа — впереди.")));
  };

  /* ---------- Поздняя игра ---------- */
  V.dark = function (root) {
    const d = G().dark || {}, t = S.today(), hr = S.hourOf(Date.now());
    const chosen = S.has("dark-" + t) || S.has("light-" + t);
    const offer = hr >= (d.hour || 23) && S.hash("dark" + t) % 100 < (d.chance || 0.25) * 100;
    const box = h("div", null, h("div", { class: "quote" }, d.text));
    if (S.shadowActive()) box.appendChild(h("div", { class: "warn" }, "Ты в тени. " + d.shadowText));
    else if (chosen) box.appendChild(h("div", { class: "muted" }, "Выбор этой ночи сделан."));
    else if (!offer) box.appendChild(h("div", { class: "muted" }, "Тень приходит ночью, после " + (d.hour || 23) + ":00, и не каждую ночь."));
    else box.appendChild(h("div", { class: "m-btns" },
      h("button", { class: "btn ghost", type: "button", onclick: () => S.writeEv("light-" + t, { k: "light", t: "Остался на свету", xp: 0, g: 0 }).then(() => S.FX.banner("[ СВЕТ ]", "Дисциплина — не клетка, если ты сам выбрал её.")) }, d.light),
      h("button", { class: "btn red", type: "button", onclick: () => S.FX.confirm("Шагнуть в тень?", d.shadowText, "Шагнуть").then((ok) => ok && S.writeEv("dark-" + t, { k: "dark", t: "Шаг в тень", xp: -Math.round(S.needL(S.X.level) * (d.xpLossPct || 0.03)), g: 0 })) }, d.shadow)));
    root.appendChild(S.win("Тёмная сторона", null, box));
  };
  V.player2 = function (root) {
    const p2 = G().player2 || {}, ans = (S.D.journal || []).filter((j) => j.kind === "p2").sort((a, b) => a.ts - b.ts);
    const n = ans.length, last = ans.slice(-1)[0], can = !last || last.d < S.today();
    const box = h("div", null, h("div", { class: "muted" }, p2.text));
    if (n < (p2.questions || []).length) {
      if (!can) box.appendChild(h("div", { class: "muted" }, "Следующий вопрос — завтра."));
      else { const ta = h("textarea", { class: "inp ta", rows: "4", "aria-label": "Ответ" }); box.appendChild(h("div", { class: "quote" }, p2.questions[n])); box.appendChild(ta); box.appendChild(h("div", { class: "m-btns" }, h("button", { class: "btn", type: "button", onclick: () => { if (!ta.value.trim()) return; S.addJournal("p2", ta.value.trim(), { q: p2.questions[n] }).then(() => { if (n + 1 >= p2.questions.length) S.writeEv("p2done", { k: "p2done", t: "Игрок №2: Покой открыт", p: "osnova", xp: 300, g: 300 }); }); } }, "Ответить"))); }
    } else box.appendChild(h("div", { class: "okline" }, "«" + p2.unlock + "» открыт: квесты Основы без спешки, +5% опыта Основы."));
    root.appendChild(S.win("Игрок №2", "Вопрос " + Math.min(n + 1, 7) + " из 7", box));
  };
  V.archive = function (root) {
    const a = G().archive || {};
    const box = h("div", null, (a.diary || []).map((x) => h("div", { class: "quote" }, x)));
    if (!S.has("riddle")) {
      const inp = h("input", { class: "inp", type: "text", placeholder: "Ответ", "aria-label": "Ответ на загадку" });
      box.appendChild(h("div", { class: "m-t" }, a.riddle)); box.appendChild(inp);
      box.appendChild(h("div", { class: "m-btns" }, h("button", { class: "btn", type: "button", onclick: () => { const v = inp.value.trim().toLowerCase(); if ((a.answers || []).indexOf(v) >= 0) S.writeEv("riddle", { k: "riddle", t: "Загадка Архива", xp: 0, g: (a.reward || {}).g || 1000 }).then(() => S.FX.banner("[ АРХИВ ОТКРЫТ ]", "Титул «" + ((a.reward || {}).title || "") + "»")); else { S.FX.sound("err"); S.FX.toast("[ АРХИВ ] Не то. Подумай ещё."); } } }, "Ответить")));
    } else box.appendChild(h("div", { class: "okline" }, "Загадка разгадана."));
    root.appendChild(S.win("Архив", "Старая комната", box));
    root.appendChild(S.win("Твой Ил", "Старые ответы выгрузки — в «Журнал → Ил»", h("button", { class: "btn ghost wide", type: "button", onclick: () => { ui.journalTab = "il"; S.go("journal"); } }, "Открыть Ил")));
  };
  V.friends = function (root) {
    root.appendChild(S.win("Кореша", "Включим, когда позовёшь 2–3 корешей", h("ul", { class: "rules" }, ((R().multiplayer || {}).planned || []).map((x) => h("li", null, x))), h("div", { class: "note" }, "Устройство уже готово: у каждого своя игра, общие — серия, пакт, кооп-квест и босс месяца.")));
  };

  /* ---------- Помодоро ---------- */
  let pomo = null;
  V.focus = function (root) {
    const modes = [["work", "Работа", 25], ["short", "Короткий перерыв", 5], ["long", "Длинный перерыв", 15]];
    const st = pomo || { mode: "work", left: 25 * 60, run: false };
    const mm = String(Math.floor(st.left / 60)).padStart(2, "0"), ss = String(st.left % 60).padStart(2, "0");
    const cool = S.load("sys-pomo-cool"); const coolLeft = cool ? Math.max(0, Math.round((+cool - Date.now()) / 1000)) : 0;
    root.appendChild(S.win("Помодоро", "Сегодня: " + (S.X.td.pomos || 0) + " · всего: " + (S.X.stats.pomodoros || 0),
      h("div", { class: "ptabs" }, modes.map((m) => h("button", { class: "ptab" + (st.mode === m[0] ? " on" : ""), type: "button", onclick: () => { if (st.run) return; pomo = { mode: m[0], left: m[2] * 60, run: false }; S.render(true); } }, m[1]))),
      h("div", { class: "timer", id: "pomo-t" }, mm + ":" + ss),
      h("div", { class: "m-btns" },
        h("button", { class: "btn", type: "button", disabled: coolLeft > 0 && st.mode === "work" && !st.run ? true : null, onclick: () => S.pomoToggle() }, st.run ? "Пауза" : "Старт"),
        h("button", { class: "btn ghost", type: "button", onclick: () => { S.pomoStop(); const m = modes.find((x) => x[0] === st.mode); pomo = { mode: st.mode, left: m[2] * 60, run: false }; S.render(true); } }, "Сброс")),
      coolLeft > 0 && st.mode === "work" ? h("div", { class: "muted" }, "Перерыв между сессиями: ещё " + Math.ceil(coolLeft / 60) + " мин") : null,
      h("div", { class: "note" }, "Сессия «Работа» до конца — квест ранга E в Ментал. Фокус засчитывается подсчётом.")));
  };
  let pomoTimer = null;
  S.pomoToggle = function () {
    pomo = pomo || { mode: "work", left: 25 * 60, run: false };
    pomo.run = !pomo.run;
    if (pomo.run) { pomo.end = Date.now() + pomo.left * 1000; pomoTimer = setInterval(S.pomoTick, 1000); }
    else S.pomoStop();
    S.render(true);
  };
  S.pomoStop = function () { clearInterval(pomoTimer); pomoTimer = null; if (pomo) pomo.run = false; };
  S.pomoTick = function () {
    if (!pomo || !pomo.run) return;
    pomo.left = Math.max(0, Math.round((pomo.end - Date.now()) / 1000));
    const el = document.getElementById("pomo-t"); if (el) el.textContent = String(Math.floor(pomo.left / 60)).padStart(2, "0") + ":" + String(pomo.left % 60).padStart(2, "0");
    if (pomo.left <= 0) {
      S.pomoStop();
      if (pomo.mode === "work") { S.award({ id: S.uid("pomo"), k: "pomo", t: "Помодоро 25 минут", p: "mental", r: "E" }); pomo = { mode: "short", left: 5 * 60, run: false }; }
      else { S.store("sys-pomo-cool", String(Date.now() + 2 * 60000)); pomo = { mode: "work", left: 25 * 60, run: false }; S.FX.toast("[ ПОМОДОРО ] Перерыв окончен."); S.FX.sound("tick"); }
      S.render(true);
    }
  };

  /* ---------- Дневник ---------- */
  S.addJournal = function (kind, text, extra) {
    const ts = Date.now(), d = S.today();
    const rec = Object.assign({ kind, text: String(text).slice(0, 8000), ts, d }, extra || {});
    return S.db.collection("journal").doc("j" + ts).set(rec).then(() => {
      if (kind === "entry") S.award({ id: "jr-" + d, k: "jr", t: "Запись в дневнике", p: "mental", r: "E" });
      if (kind === "grat") S.award({ id: "gr-" + d, k: "gr", t: "Благодарности", p: "osnova", r: "E" });
      return true;
    });
  };
  V.diary = function (root) {
    const J = S.D.journal || [], d = S.today();
    const ta = h("textarea", { class: "inp ta", rows: "5", placeholder: "Что сегодня было. Можно голосом — микрофон на клавиатуре.", "aria-label": "Запись" });
    ta.value = ui.diaryDraft || ""; ta.addEventListener("input", () => (ui.diaryDraft = ta.value));
    root.appendChild(S.win("Дневник", "Записи не редактируются — только новые. Первая запись дня — квест E", ta, h("div", { class: "m-btns" }, h("button", { class: "btn", type: "button", onclick: () => { const v = ta.value.trim(); if (!v) return; S.addJournal("entry", v).then(() => { ui.diaryDraft = ""; ta.value = ""; S.FX.toast("[ ДНЕВНИК ] Записано."); }); } }, "Записать"))));
    const g = [0, 1, 2].map((i) => h("input", { class: "inp", type: "text", placeholder: "За что благодарен #" + (i + 1), maxlength: "300", "aria-label": "Благодарность " + (i + 1) }));
    const gDone = J.some((j) => j.kind === "grat" && j.d === d);
    root.appendChild(S.win("Благодарности", gDone ? "Сегодня уже записаны" : "Три поля. Раз в день — квест E в Основу", gDone ? null : g, gDone ? null : h("div", { class: "m-btns" }, h("button", { class: "btn", type: "button", onclick: () => { const v = g.map((x) => x.value.trim()).filter(Boolean); if (!v.length) return; S.addJournal("grat", v.join("\n")); } }, "Записать"))));
    const lt = h("textarea", { class: "inp ta", rows: "3", placeholder: "Письмо себе в будущее", "aria-label": "Письмо" });
    const dt = h("input", { class: "inp", type: "date", value: S.addDays(d, 30), "aria-label": "Когда открыть" });
    const letters = J.filter((j) => j.kind === "letter");
    root.appendChild(S.win("Письмо себе", "Откроется в выбранный день", lt, h("div", { class: "own-r" }, dt, h("button", { class: "btn sm", type: "button", onclick: () => { const v = lt.value.trim(); if (!v || !dt.value) return; S.addJournal("letter", v, { openOn: dt.value }).then(() => { lt.value = ""; S.FX.toast("[ ПИСЬМО ] Запечатано до " + S.fmtDay(dt.value)); }); } }, "Запечатать")),
      letters.map((l) => h("div", { class: "letter" + (l.openOn <= d ? " open" : "") }, h("small", null, "от " + S.fmtDay(l.d) + " · " + (l.openOn <= d ? "открыто" : "запечатано до " + S.fmtDay(l.openOn))), l.openOn <= d ? h("div", null, l.text) : null))));
    const list = J.filter((j) => j.kind === "entry" || j.kind === "grat").sort((a, b) => b.ts - a.ts).slice(0, 30);
    root.appendChild(S.win("Записи", null, list.length ? list.map((j) => h("div", { class: "jentry" }, h("small", null, S.fmtDay(j.d) + " · " + S.fmtTime(j.ts) + (j.kind === "grat" ? " · благодарности" : "")), h("div", null, j.text))) : h("div", { class: "empty" }, "Пока пусто.")));
  };

  /* ---------- Журнал ---------- */
  const JT = [["days", "Итоги"], ["stats", "Статистика"], ["track", "Трекеры"], ["rules", "Правила"], ["know", "Знания"], ["il", "Ил"], ["set", "Настройки"]];
  V.journal = function (root) {
    root.appendChild(h("div", { class: "ptabs wrapt" }, JT.map((t) => h("button", { class: "ptab" + (ui.journalTab === t[0] ? " on" : ""), type: "button", onclick: () => { ui.journalTab = t[0]; S.render(true); } }, t[1]))));
    const f = { days: S.logWin, stats: S.statsWin, track: S.trackWin, rules: S.rulesWin, know: S.knowWin, il: S.ilWin, set: S.settingsWin }[ui.journalTab] || S.logWin;
    const r = f(); if (Array.isArray(r)) r.forEach((x) => root.appendChild(x)); else if (r) root.appendChild(r);
  };
  S.logWin = function () {
    const box = h("div");
    (S.D.log || []).forEach((e) => box.appendChild(h("div", { class: "entry" }, h("div", { class: "eh" }, h("span", { class: "ed" }, S.fmtDay(e.date)), h("span", { class: "ex" }, "+" + (e.xp || 0) + " XP")), h("div", { class: "headline" }, e.headline || ""), h("div", { class: "etext" }, e.text || ""))));
    if (!S.D.log.length) box.appendChild(h("div", { class: "empty" }, "Итог дня Система подводит в 22:00."));
    return S.win("Итоги дней", "Вечерний подсчёт Системы", box);
  };
  S.statsWin = function () {
    const X = S.X, n = ui.statsN || 7, t = S.today(), days = [];
    for (let i = n - 1; i >= 0; i--) days.push(S.addDays(t, -i));
    const max = Math.max(50, ...days.map((d) => (X.days[d] || {}).xp || 0));
    const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 320 150"); svg.setAttribute("class", "chart"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Опыт по дням");
    const bw = 300 / n;
    days.forEach((d, i) => {
      const day = X.days[d] || { byPath: {} }; let y = 130;
      S.ALLP.forEach((p) => { const v = day.byPath[p.key] || 0; if (!v) return; const hh = (110 * v) / max; const r = document.createElementNS(NS, "rect"); r.setAttribute("x", 10 + i * bw + 1); r.setAttribute("y", y - hh); r.setAttribute("width", Math.max(2, bw - 2)); r.setAttribute("height", hh); r.setAttribute("fill", p.hex); y -= hh; svg.appendChild(r); });
      if (n <= 7 || i % 5 === 0) { const tx = document.createElementNS(NS, "text"); tx.setAttribute("x", 10 + i * bw + bw / 2); tx.setAttribute("y", 145); tx.setAttribute("text-anchor", "middle"); tx.setAttribute("class", "ct"); tx.textContent = d.slice(8); svg.appendChild(tx); }
    });
    const sum = (k) => days.reduce((a, d) => a + ((X.days[d] || {})[k] || 0), 0);
    const wk = days.slice(-7), prev = []; for (let i = 13; i >= 7; i--) prev.push(S.addDays(t, -i));
    const byP = (ds) => { const o = {}; S.ALLP.forEach((p) => (o[p.key] = ds.reduce((a, d) => a + (((X.days[d] || {}).byPath || {})[p.key] || 0), 0))); return o; };
    const a = byP(wk), b = byP(prev);
    const rep = S.ALLP.map((p) => h("div", { class: "brow" }, h("span", null, p.name), h("b", null, a[p.key] + " XP " + (a[p.key] >= b[p.key] ? "▲" : "▼") + " (было " + b[p.key] + ")")));
    const coach = h("div", { class: "answer" }, ui.coach || "");
    return [S.win("Статистика", null,
      h("div", { class: "ptabs" }, [7, 30].map((k) => h("button", { class: "ptab" + (n === k ? " on" : ""), type: "button", onclick: () => { ui.statsN = k; S.render(true); } }, k + " дней"))),
      svg, h("div", { class: "stat-grid" }, h("div", { class: "tile" }, h("small", null, "опыт"), h("b", null, String(sum("xp")))), h("div", { class: "tile" }, h("small", null, "квестов"), h("b", null, String(sum("q")))), h("div", { class: "tile" }, h("small", null, "золото"), h("b", { class: "gold" }, String(sum("g")))))),
    S.win("Отчёт недели", "Эта неделя против прошлой", h("div", { class: "bonus" }, rep),
      h("button", { class: "btn ghost wide", type: "button", disabled: S.sample ? null : true, onclick: (e) => { const btn = e.currentTarget; btn.disabled = true; coach.textContent = "Коуч смотрит…"; S.sample("Ты — ИИ-коуч «Системы». По данным за неделю назови 1 сильный и 1 слабый путь и дай 3 конкретных шага на следующую неделю. Коротко, по-русски, без эмодзи. Данные: эта неделя " + JSON.stringify(a) + ", прошлая " + JSON.stringify(b) + ". " + S.context(), { modelTier: "quick" }).then((r) => { coach.textContent = r.text; ui.coach = r.text; btn.disabled = false; }, () => { coach.textContent = "Коуч недоступен."; btn.disabled = false; }); } }, "Разбор от ИИ-коуча"), coach)];
  };
  S.trackWin = function () {
    const c = S.D.config || {}, X = S.X, t = S.today(), box = h("div");
    Object.keys(c.dailyBlocks || {}).forEach((key) => {
      const b = c.dailyBlocks[key], cells = []; let cur = 0, best = 0, run = 0;
      for (let i = 29; i >= 0; i--) { const d = S.addDays(t, -i); const ok = S.has("blk-" + d + "-" + key); const pre = d < S.cutoffDay(); cells.push(h("i", { class: ok ? "ok" : pre ? "pre" : d === t ? "now" : "no", title: d })); if (ok) { run++; best = Math.max(best, run); } else if (d !== t) run = 0; }
      cur = run;
      const ms = [7, 30, 100, 365].map((m) => h("span", { class: best >= m ? "on" : "" }, m));
      box.appendChild(h("div", { class: "trk" }, h("div", { class: "bh" }, h("span", { class: "bn" }, b.name), h("span", { class: "bv" }, "сейчас " + cur + " · лучшая " + best)), h("div", { class: "cells" }, cells), h("div", { class: "ranks" }, ms)));
    });
    return S.win("Трекеры блоков", "30 дней: зелёный — закрыт, серый — до старта v6", box);
  };
  S.rulesWin = function () {
    const r = R();
    return [S.win("Сколько дают", null, h("table", { class: "rtab" }, (r.table || []).map((row) => h("tr", null, h("td", null, row[0]), h("td", null, row[1])))), h("p", { class: "note" }, ((r.level || {}).text || "") + ". " + ((r.pathLevel || {}).text || "") + "."), h("p", { class: "note" }, (r.penalty || {}).text || ""),
      h("div", { class: "ranks" }, (r.ranks || []).map((x) => h("span", null, h("b", null, x.r), " с ур. " + x.from + " · " + x.title))), h("p", { class: "note" }, r.rankRule || ""))];
  };
  S.settingsWin = function () {
    const pl = S.D.player || {};
    return S.win("Настройки", null,
      h("div", { class: "brow" }, h("span", null, "Тема"), h("span", null, h("button", { class: "btn sm" + ((pl.theme || "system") === "system" ? "" : " ghost"), type: "button", onclick: () => S.setPlayer({ theme: "system" }) }, "Система"), " ", h("button", { class: "btn sm" + (pl.theme === "awake" ? "" : " ghost"), type: "button", onclick: () => S.setPlayer({ theme: "awake" }) }, "Пробуждение"))),
      h("div", { class: "brow" }, h("span", null, "Звук"), h("button", { class: "btn sm ghost", type: "button", onclick: () => S.setPlayer({ sound: pl.sound === false }) }, pl.sound === false ? "выключен" : "включён")),
      h("div", { class: "brow" }, h("span", null, "Ник"), h("span", null, (pl.nick || "—") + " · сменить — «Свиток прошлого» в магазине")),
      h("div", { class: "brow" }, h("span", null, "Обучение"), h("button", { class: "btn sm ghost", type: "button", onclick: () => S.onboard(true) }, "Показать снова")),
      h("div", { class: "brow danger" }, h("span", null, "Сброс прогресса"), h("button", { class: "btn sm red", type: "button", onclick: () => S.FX.confirm("Вернуться к началу?", "Уровень, золото и всё купленное обнулятся. История останется в базе.", "Да, сбросить").then((ok) => ok && S.FX.confirm("Точно?", "Это второе подтверждение.", "Сбросить всё").then((ok2) => ok2 && S.writeEv(S.uid("reset"), { k: "reset", t: "Сброс прогресса", xp: 0, g: 0 }))) }, "Сбросить")));
  };
})();
