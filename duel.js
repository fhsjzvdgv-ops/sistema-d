/* Система для Дария — дуэль недели с Эдуардом: честный счёт (доля от своего плана) + отчёт по дням */
(function () {
  "use strict";
  const S = window.SYS, h = (...a) => S.h(...a), V = S.V;
  const BOX = "https://textdb.dev/api/data/e70f9805-330d-4735-8cec-187972f073c2-";
  const ME = "dariy", RIVAL = "eduard";
  const MAINN = 6;
  const DISC = [
    ["mainPct", "Главные дела, % недели", "Сколько главных дел сделано с понедельника от всех возможных. У каждого свой список главных: у Дария 6 дел в день, у Эдуарда его опорные блоки. Сравнивается доля, поэтому честно.", "%"],
    ["perfect", "Идеальные дни", "Дни этой недели, когда закрыто всё главное дня.", ""],
    ["closed", "Дни в серию", "Дни этой недели, которые засчитаны в серию по своим правилам: у Дария — нужное число главных дел (3 из 6, каждая десятка дней +1), у Эдуарда — минимум дня.", ""]
  ];
  const KINDS = S.QUEST_KINDS;
  function daysReport(n) {
    const out = {}, t = S.today();
    for (let i = 0; i < n; i++) {
      const d = S.addDays(t, -i), list = [];
      if (d < (((S.D.ledger || {}).start) || t)) break;
      S.X.list.forEach((e) => { if (e.d !== d || !KINDS[e.k]) return; list.push({ t: String(e.t || "").replace(/^(Курс «[^»]+»: |Испытание: )/, "").slice(0, 70), xp: e.xp || 0 }); });
      out[d] = { main: S.mainDone ? S.mainDone(d) : 0, ok: S.dayClosed ? S.dayClosed(d) : false, items: list };
    }
    return out;
  }
  S.duelMine = function () {
    const X = S.X, t = S.today(), ws = S.weekStart(t), nd = S.diffDays(ws, t) + 1;
    let main = 0, perfect = 0, closed = 0;
    for (let d = ws; d <= t; d = S.addDays(d, 1)) {
      const m = S.mainDone ? S.mainDone(d) : 0; main += m;
      if (m >= MAINN) perfect++;
      if (S.dayClosed && S.dayClosed(d)) closed++;
    }
    return { name: (S.D.player || {}).nick || "Игрок", week: ws, mainPct: Math.round((100 * main) / (MAINN * nd)), perfect, closed, level: X.level, at: Date.now(), days: daysReport(7) };
  };
  let rival = null, lastPush = 0, lastPull = 0, err = null;
  try { rival = JSON.parse(localStorage.getItem("sysD_rival")); } catch (e) {}
  S.duelSync = function (force) {
    if (!S.X) return;
    const now = Date.now();
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (!local && (force || now - lastPush > 10 * 60000)) {
      lastPush = now;
      fetch(BOX + ME, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(S.duelMine()) }).catch(() => {});
    }
    if (force || now - lastPull > 10 * 60000) {
      lastPull = now;
      fetch(BOX + RIVAL, { cache: "no-store" }).then((r) => r.text()).then((t) => { try { const x = JSON.parse(t); if (x && x.name) { rival = x; err = null; localStorage.setItem("sysD_rival", t); S.render(); } } catch (e) {} }).catch(() => { err = "Нет связи — показываю последние цифры"; });
    }
  };
  const tick0 = S.tick;
  S.tick = function () { tick0.apply(this, arguments); S.duelSync(); };

  function dayCol(name, d) {
    if (!d) return h("div", { class: "rp-col" }, h("b", null, name), h("div", { class: "muted" }, "нет данных"));
    const xp = d.items.reduce((a, x) => a + (x.xp || 0), 0);
    return h("div", { class: "rp-col" }, h("b", null, name),
      h("div", { class: "muted" }, (d.ok ? "✓ в серию" : "✗ не в серию") + " · главных " + (d.main != null ? d.main : "—") + " · +" + xp + " XP"),
      d.items.length ? h("ul", { class: "conds" }, d.items.map((x) => h("li", null, x.t))) : h("div", { class: "muted" }, "ничего не отмечено"));
  }
  V.duel = function (root) {
    S.duelSync();
    const me = S.duelMine(), ws = me.week;
    const r = rival && rival.week === ws ? rival : null, rn = (rival && rival.name) || "Эдуард";
    const meN = me.name;
    let a = 0, b = 0;
    const rows = DISC.map(([k, n, how, u]) => {
      u = u || ""; const x = me[k], y = r && r[k] != null ? r[k] : null, mx = Math.max(x || 0, y || 0, 1);
      if (y != null) { if (x > y) a++; else if (y > x) b++; }
      const wa = y != null && x > y, wb = y != null && y > x;
      const hw = h("div", { class: "vs-how", hidden: true }, how);
      const row = h("button", { class: "vs-row", type: "button", onclick: () => { hw.hidden = !hw.hidden; } },
        h("div", { class: "vs-l" }, n),
        h("div", { class: "vs-line" },
          h("b", { class: "vs-a" + (wa ? " won" : "") }, x + u),
          h("span", { class: "vs-bar a" }, h("i", { class: wa ? "won" : "", style: { width: Math.round(100 * (x || 0) / mx) + "%" } })),
          h("span", { class: "vs-bar b" }, h("i", { class: wb ? "won" : "", style: { width: y == null ? "0%" : Math.round(100 * y / mx) + "%" } })),
          h("b", { class: "vs-b" + (wb ? " won" : "") }, y == null ? "—" : y + u)));
      return [row, hw];
    });
    const verdict = !r ? "Ждём цифры соперника — придут сами" : a === b ? "Пока ничья" : a > b ? meN + " впереди" : rn + " впереди";
    const board = h("div", { class: "vs" },
      h("div", { class: "vs-top" },
        h("div", { class: "vs-p" + (r && a > b ? " lead" : "") }, h("small", null, meN), h("b", { class: "vs-s" }, r ? String(a) : "–")),
        h("div", { class: "vs-mid" }, ":"),
        h("div", { class: "vs-p" + (r && b > a ? " lead" : "") }, h("small", null, rn), h("b", { class: "vs-s" }, r ? String(b) : "–"))),
      h("div", { class: "vs-v" }, verdict), rows);
    root.appendChild(S.win("Дуэль недели", "Доля от своего плана, неделя до вс 23:59. Нажми на строку — как считается.", board,
      h("div", { class: "muted vs-note" }, (rival ? "Данные соперника: " + S.fmtTime(rival.at) + ". " : "") + "Ничего вносить не надо — цифры уходят сами." + (err ? " " + err : ""))));
    // отчёт по дням
    const rep = h("div");
    const rd = (rival && rival.days) || {};
    Object.keys(me.days).sort().reverse().forEach((d, i) => {
      const det = h("details", { class: "kn" }); if (i === 0) det.open = true;
      const m = me.days[d], o = rd[d];
      det.appendChild(h("summary", null, h("span", null, S.fmtDay(d)), h("span", { class: "more" }, (m.ok ? "✓" : "✗") + " / " + (o ? (o.ok ? "✓" : "✗") : "—"))));
      det.appendChild(h("div", { class: "body rp" }, dayCol(me.name, m), dayCol(rn, o)));
      rep.appendChild(det);
    });
    root.appendChild(S.win("Отчёт по дням", "Кто что сделал за последние 7 дней. ✓ — день в серию.", rep));
    const sunday = S.dow(S.today()) === 6;
    const lead = !r ? null : a > b ? me.name : b > a ? rn : null;
    root.appendChild(S.win("Ставка недели", "Проигравший недели покупает пиццу или табак на кальян. Что именно — выбирает победитель.",
      h("div", { class: "m-t" }, !r ? "Счёт появится, когда придут цифры соперника" : lead ? (sunday ? "Итог недели: покупает " + (lead === me.name ? rn : me.name) : "Сейчас покупал бы: " + (lead === me.name ? rn : me.name)) : "Пока ничья — никто не покупает"),
      h("div", { class: "muted" }, "Неделя закрывается в воскресенье в 23:59. Ничья — никто не покупает.")));
  };
})();
