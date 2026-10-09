/* Система v6 — экраны: HUD, Статус, Квесты, Навыки, Магазин */
(function () {
  "use strict";
  const S = window.SYS, h = (...a) => S.h(...a), V = (S.V = S.V || {});
  const R = () => S.R(), G = () => S.D.growth || {}, W = () => S.D.world || {};
  const ui = (S.ui = S.ui || { view: "status", open: {}, shopTab: "boost", skillPath: "osnova", journalTab: "days" });

  /* ---------- общие кусочки ---------- */
  S.win = (title, sub, ...kids) => h("section", { class: "win" }, title ? h("div", { class: "win-title" }, title) : null, sub ? h("div", { class: "win-sub" }, sub) : null, kids);
  S.keep = function (det, key) { det.open = !!ui.open[key]; det.addEventListener("toggle", () => (ui.open[key] = det.open)); return det; };
  S.bar = (pct, cls, color) => { const i = h("i"); i.style.width = Math.max(0, Math.min(100, pct)) + "%"; if (color) i.style.background = color; return h("div", { class: "bar" + (cls ? " " + cls : "") }, i); };
  S.rankBadge = (r) => h("span", { class: "rk rk-" + (r || "E") }, r || "E");
  S.dot = (p) => { const d = h("span", { class: "dot" }); const q = S.BY[p]; if (q) { d.style.background = q.color; d.style.boxShadow = "0 0 6px " + q.hex; } return d; };
  S.preview = function (r, p, mult) {
    const rr = S.rankReward(r), sc = S.levelScale(S.X.level), mu = S.mults(p);
    return "+" + Math.round(rr.xp * sc * (mult || 1) * mu.xp) + " XP · +" + Math.round(rr.g * sc * (mult || 1) * mu.g) + " ◆";
  };
  S.lockedCard = (sec) => S.win(sec.name, null, h("div", { class: "locked" }, h("div", { class: "lk-i" }, "⛓"), h("div", null, "Откроется на уровне " + sec.level), h("small", null, sec.intro || "")));
  S.questCard = function (o) {
    // o: {id, t, how, p, r, mult, done, onDo, onReroll, extra, lock, label}
    const q = S.BY[o.p] || S.PATHS[0];
    const card = h("div", { class: "qc" + (o.done ? " done" : "") + (o.lock ? " lock" : ""), style: { "--pc": q.color } });
    card.appendChild(h("div", { class: "qc-h" }, S.rankBadge(o.r), h("span", { class: "qc-p" }, o.label || q.name), h("span", { class: "qc-x" }, o.done ? "выполнено" : S.preview(o.r, o.p, o.mult))));
    card.appendChild(h("div", { class: "qc-t" }, o.t));
    if (o.how) card.appendChild(h("div", { class: "qc-how" }, o.how));
    if (o.extra) card.appendChild(o.extra);
    if (!o.done) {
      const row = h("div", { class: "qc-b" });
      if (o.lock) row.appendChild(h("span", { class: "muted" }, o.lock));
      else if (o.onDo) row.appendChild(h("button", { class: "btn sm", type: "button", onclick: (e) => { e.currentTarget.disabled = true; o.onDo(card); } }, o.doText || "Выполнить"));
      if (o.onReroll && !o.lock) row.appendChild(h("button", { class: "btn sm ghost", type: "button", title: "Заменить квест", "aria-label": "Заменить квест", onclick: () => o.onReroll(card) }, "↻"));
      card.appendChild(row);
    }
    return card;
  };
  S.doQuest = function (o, card) {
    return S.FX.confirm("Выполнить квест?", o.t + " — " + S.preview(o.r, o.p, o.mult)).then((ok) => {
      if (!ok) { S.render(true); return; }
      if (card) card.classList.add("vanish");
      setTimeout(() => S.award(o), card ? 350 : 0);
    });
  };

  /* ---------- HUD ---------- */
  S.renderHud = function () {
    const hud = document.getElementById("hud"); if (!hud || !S.X) return;
    const X = S.X, pl = S.D.player || {}, st = S.D.state || {};
    const nick = pl.nick || st.player || "Игрок";
    const frame = pl.frame ? "fr-" + pl.frame : "";
    const nfx = pl.nickFx ? "nfx-" + pl.nickFx : "";
    hud.textContent = "";
    const logo = h("button", { class: "logo", type: "button", "aria-label": "Система", onclick: S.logoTap }, "[ Система ]");
    const av = h("div", { class: "av " + frame }, h("span", null, nick.slice(0, 1).toUpperCase()));
    const pct = Math.round((100 * X.L.in) / X.L.need);
    const bs = S.unlocked("boss") && S.bossState ? S.bossState("week") : null;
    hud.appendChild(h("div", { class: "hud-row" }, logo, h("span", { class: "sync" + (S.tt.err ? " bad" : "") }, S.syncText())));
    hud.appendChild(h("div", { class: "hud-main" }, av,
      h("div", { class: "hud-id" }, h("div", { class: "nick " + nfx }, nick), h("div", { class: "ttl" }, (pl.title || st.title || "Пробуждённый") + " · ранг " + (st.rank || "E"))),
      h("div", { class: "hud-lvl" }, h("small", null, "УР"), h("b", null, String(X.level)))));
    hud.appendChild(h("div", { class: "hud-xp", id: "hud-xp" }, S.bar(pct, "xpbar"), h("span", null, X.L.in + " / " + X.L.need + " XP")));
    hud.appendChild(h("div", { class: "hud-chips" },
      h("span", { class: "chip gold", id: "hud-gold" }, "◆ " + X.gold),
      h("span", { class: "chip" }, "серия " + (st.streak || 0)),
      X.flowActive ? h("span", { class: "chip flow" }, "ПОТОК ×1.25") : null,
      S.activeBoost("xp15") ? h("span", { class: "chip boost" }, "XP ×1.5") : null,
      S.activeBoost("g15") ? h("span", { class: "chip boost" }, "◆ ×1.5") : null,
      S.activeBoost("x2next") ? h("span", { class: "chip boost" }, "×2 след.") : null,
      S.shadowActive() ? h("span", { class: "chip shadow" }, "ТЕНЬ") : null,
      bs && !bs.killed && !bs.dead ? h("span", { class: "chip hp" }, "HP " + bs.php + "/" + bs.phpMax) : null));
  };
  S.syncText = function () {
    if (!S.db) return S.ready.boot ? "нет связи с базой" : "подключаюсь…";
    if (S.tt.err) return S.tt.err;
    if (!S.mcp) return "в телефоне";
    if (!S.tt.at) return "загружаю…";
    return "сохранено · " + S.fmtTime(S.tt.at);
  };
  let taps = 0, tapT = 0;
  S.logoTap = function () {
    const now = Date.now(); if (now - tapT > 1500) taps = 0; tapT = now; taps++;
    if (taps >= 7 && !S.has("egg")) { taps = 0; S.writeEv("egg", { k: "egg", t: "Пасхалка", xp: 0, g: 500 }).then((ok) => ok && S.FX.banner("[ СКРЫТОЕ ]", "Ты нашёл то, что не искал. +500 ◆")); }
  };

  /* ---------- СТАТУС ---------- */
  V.status = function (root) {
    const X = S.X, st = S.D.state || {}, pl = S.D.player || {};
    // срочное сверху
    const pend = [];
    Object.keys(X.chests).forEach((id) => { const c = X.chests[id]; if (!c.opened) pend.push(h("button", { class: "pend", type: "button", onclick: () => S.openChest(id) }, "◈ Сундук серии " + ((c.ev.m && c.ev.m.n) || "") + " — открыть")); });
    (X.byKind.use || []).length; // no-op
    const surpr = (X.inv.chest_small || 0); if (surpr > 0) pend.push(h("button", { class: "pend", type: "button", onclick: () => S.openSmallChest() }, "◈ Малый сундук ×" + surpr + " — открыть"));
    const rev = S.revivalPending && S.revivalPending(); if (rev) pend.push(h("button", { class: "pend red", type: "button", onclick: () => S.go("quests") }, "✚ Квест «Возрождение» ждёт"));
    if (pend.length) root.appendChild(h("div", { class: "pends" }, pend));

    const res = h("button", { class: "btn ghost wide", type: "button", onclick: () => S.showResults(true) }, "Итоги вчерашнего дня");
    const ph = st.phase;
    root.appendChild(S.win("Статус", null,
      h("div", { class: "stat-grid" },
        h("div", { class: "tile" }, h("small", null, "уровень"), h("b", null, String(X.level))),
        h("div", { class: "tile" }, h("small", null, "всего опыта"), h("b", null, String(Math.round(X.xp)))),
        h("div", { class: "tile" }, h("small", null, "золото"), h("b", { class: "gold" }, "◆ " + X.gold)),
        h("div", { class: "tile" }, h("small", null, "квестов"), h("b", null, String(X.quests))),
        h("div", { class: "tile" }, h("small", null, "серия / лучшая"), h("b", null, (st.streak || 0) + " / " + (st.bestStreak || 0))),
        h("div", { class: "tile" }, h("small", null, "ранг"), h("b", null, st.rank || "E"))),
      ph && ph.name ? h("div", { class: "note" }, "Фаза «" + ph.name + "»" + (ph.until ? " до " + S.fmtDay(ph.until) : "") + ". " + (ph.text || "")) : null,
      h("div", { class: "note" }, S.penaltyNote()),
      res));

    // цель месяца
    const b = st.beacon;
    if (b && Array.isArray(b.goals) && b.goals.length) {
      const box = h("div");
      b.goals.forEach((g) => {
        let v, pct = null, ok = false;
        if (g.kind === "number") { ok = g.current != null && g.current >= g.target; v = (g.current == null ? "?" : g.current) + " / " + g.target; pct = g.current == null ? 0 : Math.round((100 * g.current) / g.target); }
        else { ok = !!g.done; v = ok ? "готово" : "в процессе"; }
        const mq = S.D.main[g.id];
        box.appendChild(h("div", { class: "bgoal" }, h("div", { class: "bh" }, h("span", { class: "bn" }, g.name), h("span", { class: "bv" + (ok ? " ok" : "") }, v)),
          pct != null ? S.bar(pct, "thin") : null, g.now ? h("div", { class: "bnow" }, g.now) : null,
          mq && mq.steps ? h("div", { class: "bnow" }, "Главный квест: шаг " + Math.min(mq.cur + 1, mq.steps.length) + " из " + mq.steps.length) : null));
      });
      const dl = S.diffDays(S.today(), b.until || S.today());
      root.appendChild(S.win("Цель месяца", "До " + S.fmtDay(b.until) + " · осталось " + S.plural(Math.max(0, dl), "день", "дня", "дней"), box,
        h("button", { class: "btn ghost wide", type: "button", onclick: () => S.go("main") }, "Главный квест — разбивка на шаги")));
    }

    // пути
    root.appendChild(S.pathsWin());

    // бонусы
    const mu = S.mults("mental"), seen = {}, rows = [];
    S.ALLP.forEach((p) => S.mults(p.key).list.forEach((x) => { const k = x.label; if (seen[k]) return; seen[k] = 1; rows.push(x); }));
    root.appendChild(S.win("Мои бонусы", "Все множители перемножаются", rows.length ? h("div", { class: "bonus" }, rows.map((x) => h("div", { class: "brow" }, h("span", null, x.label), h("b", null, (x.x !== 1 ? "XP ×" + x.x.toFixed(2) : "") + (x.x !== 1 && x.g !== 1 ? " · " : "") + (x.g !== 1 ? "◆ ×" + x.g.toFixed(2) : ""))))) : h("div", { class: "empty" }, "Пока без бонусов. Их дают класс, наставник, питомец, поток, бусты, перки и артефакты."), h("div", { class: "note" }, "Крит: " + Math.round(S.critChance() * 100) + "% · рост награды от уровня: ×" + S.levelScale(X.level).toFixed(2)), mu ? null : null));

    // скоро откроется
    const nu = S.nextUnlocks();
    if (nu.length) root.appendChild(h("div", { class: "plate" }, h("b", null, "Ещё " + S.plural(nu[0].level - X.level, "уровень", "уровня", "уровней") + " — откроется: "), nu.map((s) => s.name + " (ур. " + s.level + ")").join(", ")));

    // добыча за уровни
    root.appendChild(S.lootWin());
  };
  S.penaltyNote = function () {
    const pe = R().penalty || {}, t = S.today();
    if (pe.mode === "none") return pe.text || "";
    if (pe.softUntil && t <= pe.softUntil) return "Мягкий старт до " + S.fmtDay(pe.softUntil) + ": за пропущенный обязательный блок только −" + ((pe.soft || {}).missedBlockGold || 5) + " ◆. С " + S.fmtDay((pe.full || {}).from) + " — серия сгорает, 3 дня без блоков = минус уровень.";
    return pe.text || "";
  };
  S.pathsWin = function () {
    const X = S.X, lv = X.level, osn = R().osnova || {};
    const box = h("div", { class: "paths" });
    const hier = (R().hierarchy || {}).levels || [];
    const order = [];
    hier.forEach((l) => (l.paths || []).forEach((k) => order.push({ k, lvl: l })));
    S.PATHS.forEach((p) => { if (!order.some((o) => o.k === p.key)) order.push({ k: p.key, lvl: null }); });
    let lastL = null;
    order.forEach((o) => {
      const p = S.BY[o.k]; if (!p) return;
      if (o.lvl && o.lvl !== lastL) { box.appendChild(h("div", { class: "hlvl" }, h("b", null, o.lvl.n + " · " + o.lvl.name), h("span", null, o.lvl.why || ""))); lastL = o.lvl; }
      box.appendChild(S.pathRow(p));
    });
    const reveal = lv >= (osn.revealLevel || 5);
    box.appendChild(h("div", { class: "hlvl base" }, h("b", null, "0 · " + (reveal ? "Основа" : "???")), h("span", null, reveal ? (osn.text || "") : "Скрытый слой. Откроется на уровне " + (osn.revealLevel || 5) + ".")));
    box.appendChild(reveal ? S.pathRow(S.OSNOVA) : h("div", { class: "prow hidden" }, h("span", { class: "dot" }), h("span", { class: "pn" }, "???"), h("span", { class: "pl" }, "ур. ?")));
    const radar = S.radar();
    return S.win("Пути силы", "Фундамент первым: Основа → ядро → ресурсы → проявление", radar, box);
  };
  S.pathRow = function (p) {
    const X = S.X, pl = X.pl[p.key], pct = Math.round((100 * pl.in) / pl.need);
    const det = S.keep(h("details", { class: "prow-d" }), "path-" + p.key);
    det.appendChild(h("summary", { class: "prow" }, S.dot(p.key), h("span", { class: "pn" }, p.name), h("span", { class: "ps" }, p.stat), h("span", { class: "pl" }, "ур. " + pl.level), S.bar(pct, "thin", p.color)));
    const act = (S.activeTracks ? S.activeTracks() : []).filter((a) => a.p.key === p.key).map((a) => a.sk.name);
    det.appendChild(h("div", { class: "rb" },
      h("div", null, p.short + ". Опыт в пути: " + Math.round(X.paths[p.key]) + " · до ур. " + (pl.level + 1) + ": " + (pl.need - pl.in) + " XP"),
      h("div", null, "Квестов в пути: " + X.pathQ[p.key] + " · сегодня: +" + (X.td.byPath[p.key] || 0) + " XP"),
      act.length ? h("div", null, "Качаешь: " + act.join(", ")) : null));
    return det;
  };
  S.radar = function () {
    const NS = "http://www.w3.org/2000/svg", X = S.X, ps = S.PATHS;
    const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 300 214"); svg.setAttribute("class", "radar"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Уровни пяти путей");
    const cx = 150, cy = 112, Rr = 78, lv = ps.map((p) => X.pl[p.key].level), maxV = Math.max(5, Math.max.apply(null, lv));
    const pt = (i, r) => { const a = ((-90 + i * 72) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    [1, 0.66, 0.33].forEach((k) => { const pg = document.createElementNS(NS, "polygon"); pg.setAttribute("points", ps.map((_, i) => pt(i, Rr * k).join(",")).join(" ")); pg.setAttribute("fill", "none"); pg.setAttribute("stroke", "var(--line-soft)"); svg.appendChild(pg); });
    const sh = document.createElementNS(NS, "polygon"); sh.setAttribute("points", ps.map((_, i) => pt(i, (Rr * Math.min(1, lv[i] / maxV))).join(",")).join(" ")); sh.setAttribute("fill", "rgba(95,200,255,.18)"); sh.setAttribute("stroke", "var(--glow)"); sh.setAttribute("stroke-width", "1.5"); svg.appendChild(sh);
    ps.forEach((p, i) => { const e = pt(i, Rr + 20), tx = document.createElementNS(NS, "text"); tx.setAttribute("x", e[0]); tx.setAttribute("y", e[1]); tx.setAttribute("text-anchor", "middle"); tx.setAttribute("dominant-baseline", "middle"); tx.setAttribute("fill", p.hex); tx.setAttribute("font-size", "11"); tx.textContent = p.name + " " + lv[i]; svg.appendChild(tx); });
    return svg;
  };
  S.lootWin = function () {
    const X = S.X, rw = S.D.rewards;
    const lv = (X.byKind.lvl || []).filter((e) => e.m && e.m.loot).slice(-6).reverse();
    const claimed = new Set((X.byKind.lootc || []).map((e) => String((e.m && e.m.title) || "").replace(/^Добыча:\s*/, "")));
    const box = h("div");
    if (!lv.length) box.appendChild(h("div", { class: "empty" }, "За каждый новый уровень выпадает настоящая награда: малая, каждый 5-й — средняя, каждый 10-й — большая."));
    lv.forEach((e) => box.appendChild(h("div", { class: "lrow" }, h("span", { class: "ln" }, "Ур. " + e.m.level + " · " + e.m.loot), h("span", { class: "ll" + (claimed.has(e.m.loot) ? " ok" : "") }, claimed.has(e.m.loot) ? "забрал" : "забери"))));
    if (rw && rw.tiers) {
      const det = S.keep(h("details", { class: "kn" }), "loot-about");
      det.appendChild(h("summary", null, h("span", null, "Что может выпасть"), h("span", { class: "more" }, "открыть")));
      det.appendChild(h("div", { class: "body" }, rw.intro ? h("div", null, rw.intro) : null, rw.tiers.map((t) => h("div", null, h("span", { class: "lbl" }, t.name + " — " + ({ small: "каждый уровень", mid: "каждый 5-й уровень", big: "каждый 10-й уровень" }[t.key] || t.when)), (t.items || []).map((it) => h("div", { class: "ri" }, h("div", { class: "rn" }, it.name), it.why ? h("div", { class: "rw" }, it.why) : null)))),
        rw.not && rw.not.length ? h("div", null, h("span", { class: "lbl" }, "Чем обезьяну не кормим"), rw.not.map((it) => h("div", { class: "ri" }, h("div", { class: "rn" }, it.name), h("div", { class: "rw" }, it.why || "")))) : null));
      box.appendChild(det);
    }
    return S.win("Добыча за уровни", "Кормить внутреннюю обезьяну — за дело", box);
  };

  /* ---------- сундуки ---------- */
  S.openChest = function (id) {
    const c = S.X.chests[id]; if (!c || c.opened) return;
    const n = (c.ev.m && c.ev.m.n) || 7, cyc = ((((n - 1) % 28) + 28) % 28) + 1;
    const key = [7, 14, 21, 28].filter((x) => x <= cyc).pop() || 7;
    const rw = ((R().streak || {}).chestReward || {})[String(key)] || { g: 100, items: [] };
    let items = (rw.items || []).slice(), art = null;
    if (items.indexOf("art_roll") >= 0) { items = items.filter((x) => x !== "art_roll"); art = S.rollArtifact(); }
    const lines = ["+" + rw.g + " ◆"].concat(items.map((i) => (S.shopItem(i) || { name: i }).name)).concat(art ? ["Артефакт: " + art.name] : []);
    S.FX.chest("Сундук серии " + n + " дней", lines).then(() => S.writeEv("chesto-" + id, { k: "chesto", t: "Сундук серии " + n, xp: 0, g: rw.g, m: { chest: id, items, art: art ? art.id : null } }));
  };
  S.openSmallChest = function () {
    S.useItem("chest_small").then((ok) => {
      if (!ok) return;
      const g = 50 + Math.floor(Math.random() * 101), it = ["food", "reroll", "freeze", "xp15"][Math.floor(Math.random() * 4)];
      S.FX.chest("Малый сундук", ["+" + g + " ◆", (S.shopItem(it) || { name: it }).name]).then(() => S.writeEv(S.uid("chesto"), { k: "gift", t: "Малый сундук", xp: 0, g, m: { items: [it] } }));
    });
  };

  /* ---------- КВЕСТЫ ---------- */
  V.quests = function (root) {
    const X = S.X, t = S.today();
    root.appendChild(h("div", { class: "qtop" },
      h("div", null, h("b", null, "+" + X.td.xp), h("small", null, "XP сегодня")),
      h("div", null, h("b", null, String(X.td.q)), h("small", null, "квестов")),
      h("div", null, h("b", null, String(S.rerollsLeft())), h("small", null, "замен")),
      h("div", null, h("b", { class: "gold" }, "+" + X.td.g), h("small", null, "◆ сегодня"))));
    if (S.tt.err) root.appendChild(h("div", { class: "warn" }, S.tt.err));

    // Возрождение
    const rev = S.revivalPending && S.revivalPending();
    if (rev) root.appendChild(S.win("Возрождение", "Ты потерял уровень за 3+ дня без блоков. Вернись — квест даёт ×4", S.questCard({ t: "Возрождение: закрыть минимум дня", p: "osnova", r: rev.r, mult: 4, onDo: (c) => S.doQuest({ id: "rev-" + rev.id, k: "rev", t: "Возрождение", p: "osnova", r: rev.r, mult: 4 }, c) })));

    // суточный вызов
    if (S.unlocked("challenge")) {
      const ch = S.challengeWeek(), now = Date.now();
      if (!ch.done && now >= ch.start && now < ch.end) {
        const left = Math.max(0, Math.round((ch.end - now) / 60000));
        root.appendChild(S.win("⚠ Суточный вызов", "Осталось " + left + " мин", S.questCard({ t: ch.q.t, p: ch.q.p, r: "N", mult: 5, onDo: (c) => S.doQuest({ id: ch.id, k: "chal", t: ch.q.t, p: ch.q.p, r: "N", mult: 5, m: { fast: now - ch.start < 600000 ? 1 : 0 } }, c) })));
      }
    }

    // опорные блоки
    root.appendChild(S.blocksWin());

    // рекомендованные
    const rec = S.recToday();
    const recBox = h("div", { class: "qlist" });
    const fat = S.fatigued();
    if (!rec) recBox.appendChild(h("div", { class: "empty" }, "Система подбирает квесты дня…"));
    else rec.forEach((x) => {
      const q = S.recQuest(x.path, x.q); if (!q) return;
      const id = "rec-" + t + "-" + x.slot, done = S.has(id);
      if (x.path === "osnova" && X.level < ((R().osnova || {}).revealLevel || 5)) q.label = "???";
      recBox.appendChild(S.questCard({ t: q.t, how: q.how, p: x.path, r: q.r, done, label: x.path === "osnova" && X.level < ((R().osnova || {}).revealLevel || 5) ? "???" : null, lock: fat ? "Усталость после проваленного пакта — до 12:00" : null,
        extra: q.src ? h("div", { class: "src" }, "источник: " + q.src) : null,
        onDo: (c) => S.doQuest({ id, k: "rec", t: q.t, p: x.path, r: q.r, m: { q: q.id } }, c), onReroll: (c) => S.reroll(x.slot, c) }));
    });
    root.appendChild(S.win("Рекомендованные", "Из базы Арсена, Ваагна и Лимарева. Заменить: " + S.rerollsLeft() + " бесплатно, дальше " + ((R().rerolls || {}).cost || 30) + " ◆", recBox));

    // задания: наставник, сезон, легендарный недели, пакт
    const extra = h("div", { class: "qlist" });
    const pl = S.D.player || {};
    if (S.unlocked("mentors") && pl.mentor) {
      const men = ((S.D.pools || {}).mentors || []).find((m) => m.key === pl.mentor.key);
      if (men && men.tasks && men.tasks.length) { const mt = S.pick(men.tasks, "men" + t + men.key), id = "men-" + t; extra.appendChild(S.questCard({ t: mt.t, p: mt.p, r: mt.r, done: S.has(id), label: "Наставник " + men.name, onDo: (c) => S.doQuest({ id, k: "men", t: mt.t, p: mt.p, r: mt.r }, c) })); }
    }
    if (S.unlocked("season")) {
      const ss = S.seasonState(), id = "sea-" + t;
      extra.appendChild(S.questCard({ t: ss.daily.t, p: "osnova", r: ss.daily.r, done: S.has(id), label: ss.name, onDo: (c) => S.doQuest({ id, k: "sea", t: ss.daily.t, p: "osnova", r: ss.daily.r }, c) }));
    }
    if (X.level >= 3) {
      const ws = S.weekStart(t), wl = S.pick(W().weeklyLegendary || [{ t: "—", p: "osnova" }], "wkl" + ws), id = "wkl-" + ws;
      extra.appendChild(S.questCard({ t: wl.t, p: wl.p, r: "S", mult: 2, done: S.has(id), label: "Легендарный квест недели", onDo: (c) => S.doQuest({ id, k: "wkl", t: wl.t, p: wl.p, r: "S", mult: 2 }, c) }));
    }
    if (extra.childNodes.length) root.appendChild(S.win("Особые задания", null, extra));
    if (S.unlocked("pact")) root.appendChild(S.pactWin());

    // свои квесты из TickTick
    root.appendChild(S.ownWin());

    // квесты навыков
    if (S.legacyQuests) root.appendChild(S.legacyQuests());
  };

  S.taskToday = function (step) {
    const u = (S.tt.undone || []).find((x) => x.id === step.taskId) || (S.tt.undone || []).find((x) => S.stepMatch(x.title, step));
    const t = S.today();
    const d = (S.tt.done || []).find((x) => x.completedTime && S.stepMatch(x.title, step) && S.ttDay(x, S.ttClass(x)).d === t);
    return { u, d };
  };
  S.blocksWin = function () {
    const c = S.D.config || {}, t = S.today(), box = h("div", { class: "blocks" });
    if (!c.dailyBlocks) { box.appendChild(h("div", { class: "empty" }, "Загружается…")); return S.win("Опорные блоки", null, box); }
    const stt = S.tt.done ? S.blocksStatus(t) : {};
    const tm = (b) => { const m = String(b.time || "").match(/(\d\d):(\d\d)/); return m ? m[1] + m[2] : "1200"; };
    Object.keys(c.dailyBlocks).sort((a, b) => tm(c.dailyBlocks[a]).localeCompare(tm(c.dailyBlocks[b]))).forEach((key) => {
      const b = c.dailyBlocks[key], s = stt[key] || { done: 0, need: b.need || 1 };
      const closed = S.has("blk-" + t + "-" + key) || s.done >= s.need;
      const det = S.keep(h("details", { class: "blk" + (closed ? " done" : "") }), "blk-" + key);
      det.appendChild(h("summary", null, h("span", { class: "box" }, closed ? "✓" : ""), h("span", { class: "tx" }, (b.time ? b.time + " · " : "") + b.name, h("small", null, b.auto ? "засчитывается сам" : s.done + " из " + s.need + " шагов")), S.dot(b.path)));
      const body = h("div", { class: "body" });
      if (b.auto) body.appendChild(h("div", { class: "muted" }, b.auto.text || ""));
      (b.steps || []).forEach((st) => {
        const tk = S.taskToday(st), done = !!tk.d, busy = tk.u && S.tt.busy[tk.u.id];
        body.appendChild(h("div", { class: "step" + (done ? " done" : "") }, h("span", { class: "st-t" }, (st.time ? st.time + " · " : "") + st.title),
          done ? h("span", { class: "ok" }, "✓") : tk.u ? h("button", { class: "btn sm", type: "button", disabled: busy ? true : null, onclick: () => S.FX.confirm("Выполнить шаг?", st.title + " — " + S.preview((R().tt || {}).dailyStep || "E", b.path)).then((ok) => ok && S.ttComplete(tk.u)) }, busy ? "…" : "Выполнить") : h("span", { class: "muted" }, S.tt.undone ? "нет на сегодня" : "")));
      });
      const sk = S.findSkill && S.findSkill(b.skill);
      if (sk) body.appendChild(h("div", { class: "src" }, "навык «" + sk.name + "»" + (sk.why ? " — " + sk.why.slice(0, 160) + (sk.why.length > 160 ? "…" : "") : "")));
      det.appendChild(body);
      box.appendChild(det);
    });
    const anchors = (c.dailyAnchors || []).map((a) => { const tk = S.taskToday({ title: a.title }); return { a, tk }; });
    if (anchors.length) box.appendChild(h("div", { class: "anchors" }, h("small", null, "Опорные точки (без опыта):"), anchors.map((x) => h("button", { class: "anc" + (x.tk.d ? " done" : ""), type: "button", disabled: x.tk.d || !x.tk.u ? true : null, onclick: () => x.tk.u && S.ttComplete(x.tk.u) }, (x.tk.d ? "✓ " : "") + x.a.title))));
    const all = S.has("allblk-" + t);
    return S.win("Опорные блоки", all ? "Все блоки закрыты — идеальный день" : "Живут в «🌅 Мой день». Это бонус: в серию идёт минимум — любые 3 дела", box);
  };
  S.pactWin = function () {
    const pk = S.pactToday(), t = S.today(), hr = S.hourOf(Date.now()), pr = W().pactRules || {};
    const box = h("div");
    if (S.has("pact-" + t)) box.appendChild(h("div", { class: "okline" }, "Пакт выполнен: " + ((S.X.byId["pact-" + t] || {}).t || "")));
    else if (S.has("pactf-" + t)) box.appendChild(h("div", { class: "warn" }, "Пакт на сегодня не выполнен."));
    else if (!pk) {
      if (hr < 9) box.appendChild(h("div", { class: "muted" }, "Пакт можно заключить с 09:00."));
      else {
        const opts = (W().pacts || []).slice(); const three = [0, 1, 2].map((i) => opts[S.hash("pact" + t + i) % opts.length]).filter((v, i, a) => a.indexOf(v) === i);
        box.appendChild(h("div", { class: "muted" }, "Выбери договор на день. Итог — в 21:00."));
        three.forEach((o) => box.appendChild(h("button", { class: "btn ghost wide", type: "button", onclick: () => S.setDay({ pact: { id: o.id, t: o.t, check: o.check, at: Date.now() } }).then(() => S.FX.banner("[ ПАКТ ЗАКЛЮЧЁН ]", o.t)) }, o.t)));
      }
    } else {
      const auto = S.pactCheck(pk.id, t);
      box.appendChild(h("div", { class: "qc-t" }, pk.t));
      box.appendChild(h("div", { class: "muted" }, pk.check === "auto" ? (auto ? "Условие выполнено — награда в 21:00." : "Проверяется само по твоим квестам.") : "Отметь честно, когда выполнишь."));
      if (pk.check !== "auto" && !pk.manualDone) box.appendChild(h("button", { class: "btn", type: "button", onclick: () => S.FX.confirm("Пакт выполнен?", pk.t, "Да, выполнил").then((ok) => ok && S.setDay({ pact: Object.assign({}, pk, { manualDone: true }) }).then(() => S.pactSettle())) }, "Выполнил"));
      if (pk.manualDone) box.appendChild(h("div", { class: "okline" }, "Отмечено. Награда в 21:00."));
    }
    box.appendChild(h("div", { class: "note" }, "Серия пактов: " + S.pactStreak() + ". Награда: " + (pr.xp || 50) + " + " + (pr.perStreak || 10) + " за день серии (до " + (pr.cap || 200) + "). С " + S.fmtDay(pr.from || "2026-10-12") + " провал = усталость до 12:00."));
    return S.win("Пакт с Системой", null, box);
  };
  S.ownWin = function () {
    const c = S.D.config || {}, t = S.today(), box = h("div", { class: "qlist" });
    const undone = (S.tt.undone || []).filter((x) => x.projectId !== c.dailyListId && S.ttClass(x));
    if (S.tt.undone == null && !S.tt.err) box.appendChild(h("div", { class: "empty" }, "Загружаю дела…"));
    undone.forEach((task) => {
      const cls = S.ttClass(task) || { r: "E", p: "mental" };
      if (cls.kind === "loot") { box.appendChild(h("div", { class: "qc loot" }, h("div", { class: "qc-t" }, task.title), h("div", { class: "qc-how" }, "Награда — опыта не даёт. Забери без вины и поставь галочку."), h("div", { class: "qc-b" }, h("button", { class: "btn sm", type: "button", onclick: () => S.ttComplete(task) }, "Забрал")))); return; }
      const busy = S.tt.busy[task.id];
      box.appendChild(S.questCard({ t: task.title, p: cls.p, r: cls.r, label: (S.BY[cls.p] || {}).name + (cls.kind === "own" ? " · свой" : ""), doText: busy ? "…" : "Выполнить",
        how: task.startDate && !task.isAllDay ? "в " + S.fmtTime(S.parseTT(task.startDate)) : null,
        onDo: () => S.FX.confirm("Выполнить квест?", task.title + " — " + S.preview(cls.r, cls.p)).then((ok) => { if (ok) S.ttComplete(task); else S.render(true); }) }));
    });
    const doneToday = (S.X.list || []).filter((e) => (e.k === "tt" || e.k === "own") && e.d === t).reverse();
    if (doneToday.length) {
      const det = S.keep(h("details", { class: "kn" }), "own-done");
      det.appendChild(h("summary", null, h("span", null, "Выполнено сегодня: " + doneToday.length), h("span", { class: "more" }, "открыть")));
      det.appendChild(h("div", { class: "body" }, doneToday.map((e) => h("div", { class: "lrow" }, h("span", { class: "ln" }, e.t), h("span", { class: "ll ok" }, "+" + e.xp + " XP")))));
      box.appendChild(det);
    }
    // создать свой
    const mine = S.ownList().filter((o) => o.d === t).length, max = (R().own || {}).max || 8;
    const inp = h("input", { class: "inp", type: "text", placeholder: "Что нужно сделать?", maxlength: "160", "aria-label": "Новый свой квест" });
    const sel = h("select", { class: "inp sel", "aria-label": "Путь" }, S.ALLP.map((p) => h("option", { value: p.key }, p.name)));
    const go = () => { const v = inp.value.trim(); if (!v) return; inp.value = ""; S.ownCreate(v, sel.value); };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    box.appendChild(h("div", { class: "own" }, h("div", { class: "own-r" }, inp, sel, h("button", { class: "btn sm", type: "button", onclick: go }, "Создать")), h("small", { class: "muted" }, "Ранг поставит Система. Квест появится в «Сегодня». Можно ещё " + Math.max(0, max - mine) + " из " + max + " сегодня.")));
    return S.win("Свои квесты", "Свои дела на сегодня: без приоритета = E, средний = C, высокий = B", box);
  };
  S.revivalPending = function () {
    const downs = (S.X.byKind.lvldown || []);
    const last = downs[downs.length - 1]; if (!last) return null;
    if (S.has("rev-" + last._id)) return null;
    return { id: last._id, r: (last.m && last.m.rank) || "A" };
  };

  /* ---------- НАВЫКИ: созвездия ---------- */
  S.findSkill = function (id) { for (const k in S.D.codex) { const c = S.D.codex[k]; if (c && c.skills) for (const sk of c.skills) if (sk.id === id) return sk; } return null; };
  S.allSkills = function () { const out = []; S.ALLP.forEach((p) => { const cx = S.D.codex[p.key]; if (cx && cx.skills) cx.skills.forEach((sk) => out.push({ p, sk })); }); return out; };
  S.activeTracks = function () { return S.allSkills().map((x) => { const st = S.D.skills[x.sk.id] || {}; if (!st.active) return null; const tier = (x.sk.tiers || [])[st.active - 1]; return tier ? { p: x.p, sk: x.sk, st, tier } : null; }).filter(Boolean); };
  S.curPhase = function () { const r = R(), t = S.today(); return (r.phases || []).find((p) => (!p.from || p.from <= t) && (!p.until || p.until >= t)) || null; };
  S.rankOk = (t) => !t.rank || S.RANKS.indexOf((S.D.state && S.D.state.rank) || "E") >= S.RANKS.indexOf(t.rank);
  S.afterOk = (t) => !t.after || ((S.D.skills[t.after.skill] || {}).mastered || 0) >= t.after.tier;
  S.skillStatus = function (sk, p) {
    const st = S.D.skills[sk.id] || {}, mastered = st.mastered || 0, lvl = S.X.pl[p.key].level;
    if (st.paused) return { c: "paused", label: "на паузе" };
    if (st.active) return { c: "active", label: "в работе", tier: sk.tiers[st.active - 1] };
    if (mastered >= (sk.tiers || []).length) return { c: "mastered", label: "освоен" };
    const t = sk.tiers[mastered]; if (!t) return { c: "locked", label: "—" };
    if (t.req > lvl) return { c: "locked", label: "путь «" + p.name + "» ур. " + t.req, tier: t };
    if (!S.rankOk(t)) return { c: "locked", label: "после рангового испытания " + t.rank, tier: t };
    if (!S.afterOk(t)) return { c: "locked", label: "после «" + (t.after.name || t.after.skill) + "»", tier: t };
    const ph = S.curPhase();
    if (t.kind !== "quest" && ph && ph.newHabits === false) return { c: "held", label: "после фазы «" + ph.name + "»", tier: t };
    return { c: "avail", label: "доступно · ступень " + S.ROMAN[t.n], tier: t };
  };
  const QUEST_MAX = 2;
  S.slots = function () {
    const act = S.activeTracks().filter((a) => !(S.D.skills[a.sk.id] || {}).paused);
    const ph = S.curPhase(), hMax = (ph && ph.maxHabits) || ((R().habits || {}).max) || 7;
    const hab = act.filter((a) => a.tier.kind !== "quest").length, qst = act.filter((a) => a.tier.kind === "quest").length;
    return { hab, qst, hMax, qMax: QUEST_MAX, habFree: Math.max(0, hMax - hab), qFree: Math.max(0, QUEST_MAX - qst) };
  };
  S.slotFor = (tier) => { const sl = S.slots(); return tier.kind === "quest" ? sl.qFree > 0 : sl.habFree > 0; };
  V.skills = function (root) {
    const sl = S.slots(), free = sl.habFree + sl.qFree;
    const tabs = h("div", { class: "ptabs", role: "tablist" }, S.PATHS.map((p) => h("button", { class: "ptab" + (ui.skillPath === p.key ? " on" : ""), type: "button", role: "tab", "aria-selected": ui.skillPath === p.key ? "true" : "false", style: { "--pc": p.color }, onclick: () => { ui.skillPath = p.key; S.render(true); } }, p.name)));
    const p = S.BY[ui.skillPath] || S.PATHS[0];
    const cx = S.D.codex[p.key];
    root.appendChild(S.win("Созвездия", "Привычек: " + sl.hab + " из " + sl.hMax + " · квестов: " + sl.qst + " из " + sl.qMax + ". Нажми на звезду", tabs, cx && cx.skills ? S.constellation(p, cx.skills) : h("div", { class: "empty" }, "Загружается…"),
      h("div", { class: "legend" }, h("span", { class: "lg mastered" }, "освоен"), h("span", { class: "lg active" }, "в работе"), h("span", { class: "lg avail" }, "доступен"), h("span", { class: "lg held" }, "ждёт фазы"), h("span", { class: "lg locked" }, "закрыт")),
      free > 0 ? h("button", { class: "btn wide", type: "button", onclick: S.offerSkills }, "Система предлагает навык") : h("div", { class: "note" }, "Все места заняты. Освой ступень — место освободится.")));
    root.appendChild(S.win("В работе", "Нажми на навык: что делать сейчас, зачем и что дальше", S.legacyActive ? S.legacyActive() : null));
  };
  S.constellation = function (p, skills) {
    const NS = "http://www.w3.org/2000/svg", n = skills.length, W0 = 320, H0 = 240;
    const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 " + W0 + " " + H0); svg.setAttribute("class", "constel"); svg.setAttribute("role", "group"); svg.setAttribute("aria-label", "Созвездие пути " + p.name);
    const pts = skills.map((sk, i) => { const a = i * 2.39996, r = 22 + 92 * Math.sqrt((i + 0.6) / n); return [W0 / 2 + r * Math.cos(a) * 1.3, H0 / 2 + r * Math.sin(a) * 0.95]; });
    for (let i = 1; i < n; i++) {
      let j = 0, best = Infinity; for (let k = 0; k < i; k++) { const d = Math.hypot(pts[k][0] - pts[i][0], pts[k][1] - pts[i][1]); if (d < best) { best = d; j = k; } }
      const ln = document.createElementNS(NS, "line"); ln.setAttribute("x1", pts[j][0]); ln.setAttribute("y1", pts[j][1]); ln.setAttribute("x2", pts[i][0]); ln.setAttribute("y2", pts[i][1]); ln.setAttribute("class", "cl"); svg.appendChild(ln);
    }
    skills.forEach((sk, i) => {
      const s = S.skillStatus(sk, p), g = document.createElementNS(NS, "g");
      g.setAttribute("class", "star " + s.c); g.setAttribute("tabindex", "0"); g.setAttribute("role", "button"); g.setAttribute("aria-label", sk.name + ": " + s.label);
      g.style.setProperty("--pc", p.hex);
      const c = document.createElementNS(NS, "circle"); c.setAttribute("cx", pts[i][0]); c.setAttribute("cy", pts[i][1]); c.setAttribute("r", s.c === "active" ? 7 : s.c === "mastered" ? 6.5 : 5);
      g.appendChild(c);
      const tx = document.createElementNS(NS, "text"); tx.setAttribute("x", pts[i][0]); tx.setAttribute("y", pts[i][1] + 16); tx.setAttribute("text-anchor", "middle"); tx.textContent = sk.name.length > 16 ? sk.name.slice(0, 15) + "…" : sk.name;
      g.appendChild(tx);
      const open = () => S.skillSheet(sk, p);
      g.addEventListener("click", open); g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      svg.appendChild(g);
    });
    return svg;
  };
  S.skillSheet = function (sk, p) {
    const s = S.skillStatus(sk, p), st = S.D.skills[sk.id] || {};
    const tiers = (sk.tiers || []).map((t) => h("div", { class: "tier" + (t.n <= (st.mastered || 0) ? " m" : t.n === st.active ? " a" : "") }, h("b", null, "Ступень " + S.ROMAN[t.n] + " · " + t.title), h("small", null, (t.kind === "quest" ? "квест" : "каждый день, 21 день") + " · путь ур. " + t.req + (t.rank ? " · ранг " + t.rank : "")), t.daily ? h("div", null, t.daily) : null));
    let m;
    const btn = s.c === "avail" && S.slotFor(s.tier) ? h("button", { class: "btn", type: "button", onclick: () => { m.close(); S.activateSkill(sk, s.tier, p); } }, "Взять в работу") : null;
    m = S.FX.modal([h("div", { class: "m-sys" }, p.name + " · " + s.label), h("div", { class: "m-t" }, sk.name), sk.desc ? h("div", { class: "m-x" }, sk.desc) : null, sk.why ? h("div", { class: "m-x" }, h("span", { class: "lbl" }, "Зачем"), sk.why) : null,
      S.branchText ? h("div", { class: "m-x" }, h("span", { class: "lbl" }, "Ветви силы"), S.branchText(sk, p)) : null, h("div", { class: "tiers" }, tiers), sk.src ? h("div", { class: "src" }, "источник: " + sk.src) : null,
      h("div", { class: "m-btns" }, h("button", { class: "btn ghost", type: "button", onclick: () => m.close() }, "Закрыть"), btn)], { cls: "sheet" });
  };
  S.offerSkills = function () {
    const cand = [];
    S.allSkills().forEach((x) => { const s = S.skillStatus(x.sk, x.p); if (s.c === "avail" && S.slotFor(s.tier)) cand.push({ x, s }); });
    if (!cand.length) { S.FX.toast("[ СИСТЕМА ] Сейчас нечего предложить: ступени откроются с ростом путей или после фазы."); return; }
    const hi = (k) => { const lv = (R().hierarchy || {}).levels || []; const i = lv.findIndex((l) => (l.paths || []).indexOf(k) >= 0); return i < 0 ? 9 : i; };
    cand.sort((a, b) => (S.X.pl[a.x.p.key].level - S.X.pl[b.x.p.key].level) || (hi(a.x.p.key) - hi(b.x.p.key)));
    const opts = []; const seenP = {};
    cand.forEach((c) => { if (opts.length < 3 && !seenP[c.x.p.key]) { seenP[c.x.p.key] = 1; opts.push(c); } });
    cand.forEach((c) => { if (opts.length < 3 && opts.indexOf(c) < 0) opts.push(c); });
    S.FX.choice("Выбери навык", "Три звезды из разных путей. Фундамент первым.", opts.map((c) => ({ name: c.x.sk.name, sub: c.x.p.name + " · ступень " + S.ROMAN[c.s.tier.n] + " · " + (c.s.tier.kind === "quest" ? "квест" : "каждый день"), text: c.s.tier.title, color: c.x.p.color, c }))).then((o) => o && S.activateSkill(o.c.x.sk, o.c.s.tier, o.c.x.p));
  };
  S.activateSkill = function (sk, tier, p) {
    const c = S.D.config || {}, t = S.today();
    const writeSkill = (extra) => S.db.doc("game/skills").update({ [sk.id]: Object.assign({ active: tier.n, days: 0, started: t, mastered: (S.D.skills[sk.id] || {}).mastered || 0 }, extra) }).catch(() => S.db.doc("game/skills").set(Object.assign({}, S.D.skills, { [sk.id]: Object.assign({ active: tier.n, days: 0, started: t }, extra) })));
    if (tier.kind === "quest") {
      const items = (tier.steps && tier.steps.length ? tier.steps : (tier.chapter || []).map((x) => x.title)).slice(0, 12).map((x, i) => ({ title: typeof x === "string" ? x : x.title || String(x), status: 0, sortOrder: i }));
      return S.ttCreate({ title: sk.name + " — ступень " + S.ROMAN[tier.n] + " «" + tier.title + "»", projectId: c.ticktickProjectId, kind: "CHECKLIST", priority: 3, desc: (sk.why || "") + "\n" + (tier.how || ""), items }).then((id) => {
        if (id) S.db.doc("quests/" + id).set({ kind: "Навык", title: sk.name + " — ступень " + S.ROMAN[tier.n] + " «" + tier.title + "»", path: p.key, skill: sk.id, tier: tier.n, stepNo: 1, stepsTotal: items.length, step: items[0] ? items[0].title : "", status: "active", why: sk.why || "", src: sk.src || "", order: 9 });
        return writeSkill(id ? { taskId: id } : {});
      }).then(() => { S.FX.banner("[ НАВЫК ВЗЯТ ]", sk.name + " — ступень " + S.ROMAN[tier.n] + ". Квест появился в «Сегодня» → «Квесты навыков»."); }, (e) => S.FX.toast("[ СИСТЕМА ] " + S.ttErrText(e)));
    }
    const title = (tier.daily || tier.title).slice(0, 120);
    return S.ttCreate({ title, projectId: c.dailyListId, content: (tier.how || "") + "\n" + p.name + " · навык «" + sk.name + "»", repeatFlag: "RRULE:FREQ=DAILY;INTERVAL=1", startDate: t + "T19:00:00+04:00", dueDate: t + "T19:15:00+04:00", isAllDay: false, reminders: ["TRIGGER:PT0S"] }).then((id) => {
      const blk = { name: sk.name, path: p.key, skill: sk.id, time: "19:00", need: 1, steps: [{ taskId: id, title, time: "19:00–19:15" }] };
      return S.db.doc("game/config").update({ dailyBlocks: { [sk.id]: blk } }).then(() => writeSkill({ block: sk.id }));
    }).then(() => S.FX.banner("[ НАВЫК ВЗЯТ ]", sk.name + ": новое ежедневное дело на 19:00 в «Сегодня»."), (e) => S.FX.toast("[ СИСТЕМА ] " + S.ttErrText(e)));
  };

  /* ---------- МАГАЗИН ---------- */
  const SHOP_TABS = [["boost", "Бусты"], ["card", "Карты опыта"], ["frame", "Рамки"], ["nick", "Ник"], ["pet", "Питомец"], ["guide", "Контент"], ["artifact", "Артефакты"], ["lib", "Библиотека"]];
  V.shop = function (root) {
    const X = S.X;
    root.appendChild(h("div", { class: "qtop" }, h("div", null, h("b", { class: "gold" }, "◆ " + X.gold), h("small", null, "золото")), h("div", null, h("b", null, String(Object.keys(X.inv).filter((k) => X.inv[k] > 0).length)), h("small", null, "в библиотеке"))));
    root.appendChild(h("div", { class: "ptabs wrapt" }, SHOP_TABS.map((t) => h("button", { class: "ptab" + (ui.shopTab === t[0] ? " on" : ""), type: "button", onclick: () => { ui.shopTab = t[0]; S.render(true); } }, t[1]))));
    if (ui.shopTab === "lib") return root.appendChild(S.libraryWin());
    const box = h("div", { class: "shop" });
    if (ui.shopTab === "guide") {
      (G().guides || []).forEach((gd) => { const own = X.inv[gd.id] > 0 || (X.byKind.buy || []).some((e) => e.m && e.m.item === gd.id);
        box.appendChild(h("div", { class: "si" }, h("div", { class: "si-i" }, "❖"), h("div", { class: "si-b" }, h("b", null, gd.name), h("small", null, (S.BY[gd.path] || {}).name + " · гайд из базы, " + gd.points.length + " пунктов")),
          own ? h("button", { class: "btn sm ghost", type: "button", onclick: () => S.readGuide(gd) }, "Читать") : h("button", { class: "btn sm", type: "button", disabled: X.gold < gd.cost ? true : null, onclick: () => S.FX.confirm("Купить гайд?", gd.name + " — " + gd.cost + " ◆", "Купить").then((ok) => ok && S.buyGuide(gd)) }, gd.cost + " ◆"))); });
      return root.appendChild(S.win("Контент", "Гайды из базы Арсена, Ваагна и Лимарева", box));
    }
    (G().shop || []).filter((it) => it.cat === ui.shopTab).forEach((it) => {
      const lock = it.minLevel && X.level < it.minLevel;
      const owned = it.once && X.inv[it.id];
      const cosmeticOwned = (it.cat === "frame" || (it.cat === "nick" && it.css)) && X.inv[it.id] > 0;
      box.appendChild(h("div", { class: "si" }, h("div", { class: "si-i" + (it.css ? " prev-" + it.cat + "-" + it.css : "") }, it.icon || "◆"), h("div", { class: "si-b" }, h("b", null, it.name), h("small", null, it.text)),
        owned || cosmeticOwned ? h("span", { class: "ok" }, "есть") : h("button", { class: "btn sm", type: "button", disabled: lock || X.gold < it.cost ? true : null, onclick: () => S.FX.confirm("Купить?", it.name + " — " + it.cost + " ◆", "Купить").then((ok) => ok && S.buy(it.id)) }, lock ? "ур. " + it.minLevel : it.cost + " ◆")));
    });
    const titles = { boost: ["Бусты", "Заморозка, воскрешение, множители"], card: ["Карты опыта", "Сразу опыт в выбранный путь"], frame: ["Рамки аватара", "Косметика — надеваешь в библиотеке"], nick: ["Эффекты ника", "И «Свиток прошлого» для смены имени"], pet: ["Для питомца", "Корм и лакомства"], artifact: ["Артефакты", "Шкатулка с 10 уровня"] }[ui.shopTab] || ["", ""];
    root.appendChild(S.win(titles[0], titles[1], box));
  };
  S.buyGuide = function (gd) {
    const X = S.X; if (X.gold < gd.cost) return;
    S.writeEv(S.uid("buy"), { k: "buy", t: gd.name, xp: 0, g: -gd.cost, m: { item: gd.id, guide: 1 } }).then((ok) => ok && (S.FX.sound("coin"), S.readGuide(gd)));
  };
  S.readGuide = function (gd) { const m = S.FX.modal([h("div", { class: "m-sys" }, "БИБЛИОТЕКА"), h("div", { class: "m-t" }, gd.name), h("ol", { class: "rules" }, gd.points.map((x) => h("li", null, x))), h("div", { class: "m-btns" }, h("button", { class: "btn", type: "button", onclick: () => m.close() }, "Закрыть"))], { cls: "sheet" }); };
  S.libraryWin = function () {
    const X = S.X, pl = S.D.player || {}, box = h("div", { class: "shop" });
    const ids = Object.keys(X.inv).filter((k) => X.inv[k] > 0);
    if (!ids.length) box.appendChild(h("div", { class: "empty" }, "Пусто. Купленное и выпавшее лежит здесь — применяешь сам."));
    ids.forEach((id) => {
      const it = S.shopItem(id) || (G().guides || []).find((g) => g.id === id) || { id, name: id === "chest_small" ? "Малый сундук" : id, text: "" };
      let act = null;
      if (it.points) act = h("button", { class: "btn sm ghost", type: "button", onclick: () => S.readGuide(it) }, "Читать");
      else if (it.cat === "frame") act = pl.frame === it.css ? h("button", { class: "btn sm ghost", type: "button", onclick: () => S.setPlayer({ frame: null }) }, "Снять") : h("button", { class: "btn sm", type: "button", onclick: () => S.setPlayer({ frame: it.css }) }, "Надеть");
      else if (it.cat === "nick" && it.css) act = pl.nickFx === it.css ? h("button", { class: "btn sm ghost", type: "button", onclick: () => S.setPlayer({ nickFx: null }) }, "Снять") : h("button", { class: "btn sm", type: "button", onclick: () => S.setPlayer({ nickFx: it.css }) }, "Включить");
      else if (it.perm) act = h("span", { class: "ok" }, "работает");
      else act = h("button", { class: "btn sm", type: "button", onclick: () => S.applyItem(id) }, "Применить");
      box.appendChild(h("div", { class: "si" }, h("div", { class: "si-i" }, it.icon || "◆"), h("div", { class: "si-b" }, h("b", null, it.name + (X.inv[id] > 1 ? " ×" + X.inv[id] : "")), h("small", null, it.text || "")), act));
    });
    const arts = Object.keys(X.arts);
    if (arts.length) box.appendChild(h("div", { class: "note" }, "Артефакты — в разделе «Артефакты»."));
    return S.win("Библиотека", "Купленное и выпавшее. Применяешь сам", box);
  };
  S.applyItem = function (id) {
    const it = S.shopItem(id) || {};
    if (id === "chest_small") return S.openSmallChest();
    if (id === "scroll_name") return S.FX.prompt("Новое имя", "Старое уйдёт в архив.", "Ник").then((v) => { if (!v) return; S.useItem(id).then((ok) => { if (!ok) return; const pl = S.D.player || {}; S.setPlayer({ nick: v.slice(0, 24), nickHistory: (pl.nickHistory || []).concat([pl.nick || ""]) }); S.FX.banner("[ СВИТОК ПРОШЛОГО ]", "Отныне ты — " + v); }); });
    if (it.cat === "card") return S.FX.choice("Куда опыт?", "Карта даёт " + it.xp + " XP в выбранный путь", S.ALLP.map((p) => ({ name: p.name, color: p.color, p }))).then((o) => { if (!o) return; S.useItem(id, { path: o.p.key }).then((ok) => ok && S.writeEv(S.uid("card"), { k: "card", t: it.name, p: o.p.key, xp: it.xp, g: 0 }).then(() => { S.FX.banner("[ КАРТА ОПЫТА ]", "+" + it.xp + " XP в «" + o.p.name + "»"); S.checkLevel(); })); });
    if (id === "food" || id === "treat") { if (!(S.D.player || {}).pet) { S.FX.toast("[ СИСТЕМА ] Питомца пока нет — он появится на уровне 4."); return; } return S.useItem(id).then((ok) => ok && S.FX.toast("[ ПИТОМЕЦ ] Ням. Настроение отличное.")); }
    if (id === "revive") return S.FX.confirm("Воскресить серию?", "Сработает, если серия сгорела за последние 2 дня. Вечерний подсчёт вернёт её.", "Применить").then((ok) => ok && S.useItem(id).then((x) => x && S.FX.banner("[ СВИТОК ВОСКРЕШЕНИЯ ]", "Серия вернётся при вечернем подсчёте.")));
    if (id === "freeze") return S.FX.confirm("Заморозить сегодня?", "Пропуск сегодняшних блоков не порвёт серию.", "Заморозить").then((ok) => ok && S.useItem(id).then((x) => x && S.FX.banner("[ ЗАМОРОЗКА ]", "Сегодня серия под защитой.")));
    if (id === "art_roll" || id === "art_rare") { const a = S.rollArtifact(); return S.useItem(id).then((ok) => ok && S.writeEv(S.uid("art"), { k: "gift", t: "Артефакт: " + a.name, xp: 0, g: 0, m: { art: a.id } }).then(() => S.FX.chest("Артефакт", [a.name, ((G().rarity || {})[a.rar] || [""])[0], a.lore]))); }
    return S.useItem(id).then((ok) => ok && S.FX.banner("[ ПРИМЕНЕНО ]", it.name || id));
  };
})();
