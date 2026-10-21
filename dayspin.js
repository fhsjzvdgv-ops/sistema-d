/* Колесо дня (Octalysis: непредсказуемость и награда). Закрыл 3 главных дела — один спин в день. */
(function () {
  "use strict";
  const S = window.SYS, h = (...a) => S.h(...a), V = S.V;
  const NEED = 3;
  const SEG = [
    ["💰", "+30 ◆", { g: 30 }], ["💰", "+60 ◆", { g: 60 }], ["💎", "+120 ◆", { g: 120 }],
    ["⚡", "+40 XP", { xp: 40 }], ["⚡", "+80 XP", { xp: 80 }],
    ["✖2", "×2 на следующий квест", { items: ["x2next"] }], ["❄", "Заморозка серии", { items: ["freeze"] }], ["🎁", "Малый сундук", { items: ["chest_small"] }]
  ];
  const blocks = () => Object.keys((S.D.config || {}).dailyBlocks || {});
  const closedN = (d) => blocks().filter((k) => S.has("blk-" + d + "-" + k)).length;
  function wheel(onDone) {
    const n = SEG.length, seg = 360 / n, cols = ["#1b3a66", "#22497A"];
    const grad = SEG.map((w, i) => cols[i % 2] + " " + (i * seg) + "deg " + ((i + 1) * seg) + "deg").join(",");
    const disc = h("div", { class: "wh-disc", style: { background: "conic-gradient(" + grad + ")" } }, SEG.map((w, i) => h("span", { class: "wh-lab", style: { transform: "rotate(" + (i * seg + seg / 2) + "deg)" } }, h("i", null, w[0]), h("small", null, w[1]))));
    const out = h("div", { class: "wh-res" });
    const btn = h("button", { class: "btn wide", type: "button" }, "Крутить колесо дня");
    btn.addEventListener("click", () => {
      btn.disabled = true;
      const pick = Math.floor(Math.random() * n), turns = 6 * 360 + (360 - (pick * seg + seg / 2));
      disc.style.transition = "transform 5s cubic-bezier(.12,.8,.18,1)"; disc.style.transform = "rotate(" + turns + "deg)";
      let k = 0; const tk = setInterval(() => { S.FX.sound("tick"); if (++k > 22) clearInterval(tk); }, 200);
      setTimeout(() => { S.FX.sound("level"); out.textContent = ""; out.appendChild(h("b", null, SEG[pick][0] + " " + SEG[pick][1])); setTimeout(() => onDone(pick), 1200); }, 5200);
    });
    return h("div", { class: "wh" }, h("div", { class: "wh-box" }, h("div", { class: "wh-ptr" }), disc), out, btn);
  }
  function card() {
    const t = S.today(), id = "dspin-" + t, ev = S.D.ev[id], n = closedN(t);
    if (ev) return S.win("Колесо дня", "Сегодняшний спин уже сыгран. Завтра — новый.", h("div", { class: "m-t" }, ev.t.replace(/^Колесо дня: /, "🎡 ")));
    if (n < NEED) return S.win("Колесо дня", "Закрой " + NEED + " главных дела — получишь спин с наградой. Сегодня закрыто " + n + " из " + NEED + ".",
      h("div", { class: "mind" }, Array.from({ length: NEED }, (_, i) => h("span", { class: i < n ? "on" : "" }))));
    return S.win("Колесо дня — спин готов!", NEED + " главных дела закрыты. Крути: золото, опыт, множитель, заморозка или сундук.",
      wheel((pick) => { const r = SEG[pick][2]; S.writeEv(id, { k: "gift", t: "Колесо дня: " + SEG[pick][0] + " " + SEG[pick][1], xp: r.xp || 0, g: r.g || 0, p: "osnova", m: { items: r.items || [], wheel: 1 } }); }));
  }
  const today0 = V.today;
  V.today = function (root) {
    today0(root);
    try {
      const c = card(), hs = root.querySelector(".hs");
      if (hs && hs.parentNode) hs.parentNode.insertBefore(c, hs.nextSibling); else root.insertBefore(c, root.firstChild);
    } catch (e) { if (window.console) console.error(e); }
  };
  V.quests = V.today;
})();
