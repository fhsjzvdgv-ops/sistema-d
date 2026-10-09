/* Система для Дария — дуэль недели с Эдуардом: цифры обновляются сами */
(function () {
  "use strict";
  const S = window.SYS, h = (...a) => S.h(...a), V = S.V;
  const BOX = "https://textdb.dev/api/data/e70f9805-330d-4735-8cec-187972f073c2-";
  const ME = "dariy", RIVAL = "eduard";
  const DISC = [
    ["xp", "Опыт за неделю", "Весь опыт с понедельника: дела, квесты, навыки, испытания. Штрафы вычитаются."],
    ["streak", "Дней подряд", "Сколько дней подряд закрыты главные дела дня (у Дария: 3 из 6 главных первые 10 дней, потом на одно больше каждую десятку). Один пропуск в неделю прощается, заморозка тоже спасает."],
    ["deeds", "Дела за неделю", "Сколько дел и квестов отмечено с понедельника. Каждая галочка — одно дело."],
    ["perfect", "Идеальные дни", "Дни этой недели, когда закрыты все главные дела дня."]
  ];
  S.duelMine = function () {
    const X = S.X, ws = S.weekStart(S.today());
    let xp = 0, deeds = 0, perfect = 0;
    X.list.forEach((e) => { if ((e.d || "") < ws) return; xp += +e.xp || 0; if (S.QUEST_KINDS[e.k]) deeds++; if (e.k === "allblk") perfect++; });
    return { name: (S.D.player || {}).nick || "Игрок", week: ws, xp, streak: (function(){ const c = S.streakCalc ? S.streakCalc() : { tens: 0, inTen: 0 }; return c.tens * 10 + c.inTen; })(), deeds, perfect, level: X.level, at: Date.now() };
  };
  let rival = null, lastPush = 0, lastPull = 0, err = null;
  try { rival = JSON.parse(localStorage.getItem("sysD_rival")); } catch (e) {}
  S.duelSync = function (force) {
    if (!S.X) return;
    const now = Date.now();
    if (force || now - lastPush > 10 * 60000) {
      lastPush = now;
      fetch(BOX + ME, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(S.duelMine()) }).catch(() => {});
    }
    if (force || now - lastPull > 10 * 60000) {
      lastPull = now;
      fetch(BOX + RIVAL, { cache: "no-store" }).then((r) => r.text()).then((t) => { try { const x = JSON.parse(t); if (x && x.name) { rival = x; err = null; localStorage.setItem("sysD_rival", t); S.render(); } } catch (e) {} }).catch(() => { err = "Нет связи — покажу последние цифры"; });
    }
  };
  const tick0 = S.tick;
  S.tick = function () { tick0.apply(this, arguments); S.duelSync(); };

  const PUN = ["Пицца за счёт проигравшего", "50 отжиманий при победителе", "Задание от победителя", "Кальян за счёт проигравшего", "Проигравший убирает после посиделок", "Неделю называть победителя «босс»"];
  V.duel = function (root) {
    S.duelSync();
    const me = S.duelMine(), ws = me.week;
    const r = rival && rival.week === ws ? rival : null;
    let a = 0, b = 0;
    const box = h("div", { class: "duel" });
    box.appendChild(h("div", { class: "duel-h" }, h("span", null, me.name), h("span", null, "VS"), h("span", null, r ? r.name : (rival && rival.name) || "Эдуард")));
    DISC.forEach(([k, n, how]) => {
      const x = me[k], y = r ? r[k] : null;
      if (y != null) { if (x > y) a++; else if (y > x) b++; }
      const det = h("details", { class: "kn" });
      det.appendChild(h("summary", null, h("span", { class: "dl-n" }, n), h("b", { class: y != null && x > y ? "win" : "" }, String(x)), h("b", { class: y != null && y > x ? "win" : "" }, y == null ? "—" : String(y))));
      det.appendChild(h("div", { class: "body" }, how));
      box.appendChild(det);
    });
    const verdict = !r ? "Ждём цифры соперника — они обновляются сами каждый вечер" : a === b ? "Ничья " + a + ":" + b : (a > b ? "Ты ведёшь " : "Соперник ведёт ") + Math.max(a, b) + ":" + Math.min(a, b);
    root.appendChild(S.win("Дуэль недели", "До воскресенья 23:59. Нажми на строку — увидишь, как считается.", h("div", { class: "m-t" }, verdict), box,
      h("div", { class: "muted" }, "Ничего вносить не надо: отмечаешь дела — цифры уходят сопернику сами. " + (rival ? "Его данные обновлены " + S.fmtTime(rival.at) + "." : "") + (err ? " " + err : ""))));
    const out = h("div", { class: "m-t" }, "");
    root.appendChild(S.win("Наказание проигравшему", "В воскресенье вечером проигравший крутит рулетку", out,
      h("button", { class: "btn wide", type: "button", onclick: () => { let i = 0; const n = 16 + Math.floor(Math.random() * PUN.length); const go = () => { out.textContent = PUN[i % PUN.length]; S.FX.sound(i >= n ? "level" : "tick"); if (i++ < n) setTimeout(go, 60 + i * 12); }; go(); } }, "Крутить рулетку")));
  };
})();
