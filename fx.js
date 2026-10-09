/* Система v6 — эффекты: звук, всплывашки, повышение уровня, сундуки */
(function () {
  "use strict";
  const S = window.SYS, h = (...a) => S.h(...a);
  const FX = (S.FX = {});
  const layer = () => document.getElementById("fx");
  const reduce = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- звук (синтез, без файлов) ---------- */
  let ac = null;
  function ctx() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } if (ac && ac.state === "suspended") ac.resume(); return ac; }
  document.addEventListener("pointerdown", () => { if ((S.D.player || {}).sound !== false) ctx(); }, { once: true });
  function tone(f, t0, dur, type, vol) {
    const a = ctx(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, a.currentTime + t0);
    g.gain.setValueAtTime(0.0001, a.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, a.currentTime + t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
    o.connect(g); g.connect(a.destination); o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + 0.05);
  }
  FX.sound = function (kind) {
    if ((S.D.player || {}).sound === false) return;
    const T = {
      tick: () => tone(880, 0, 0.08, "square", 0.05),
      done: () => { tone(660, 0, 0.12, "triangle"); tone(990, 0.08, 0.16, "triangle"); tone(1320, 0.16, 0.22, "sine", 0.08); },
      coin: () => { tone(1568, 0, 0.08, "square", 0.05); tone(2093, 0.06, 0.18, "square", 0.05); },
      level: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.5, "sawtooth", 0.05)); tone(1568, 0.5, 0.9, "sine", 0.08); },
      err: () => tone(160, 0, 0.25, "sawtooth", 0.06),
      use: () => { tone(523, 0, 0.1, "sine"); tone(784, 0.07, 0.2, "sine"); },
      scan: () => { for (let i = 0; i < 6; i++) tone(400 + i * 120, i * 0.05, 0.06, "square", 0.03); },
      chest: () => { tone(300, 0, 0.1, "square", 0.05); tone(450, 0.12, 0.1, "square", 0.05); [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3 + i * 0.07, 0.3, "triangle", 0.06)); },
      open: () => { tone(220, 0, 0.3, "sine", 0.06); tone(440, 0.1, 0.4, "sine", 0.05); tone(880, 0.2, 0.5, "sine", 0.04); }
    };
    try { (T[kind] || T.tick)(); } catch (e) {}
  };

  /* ---------- тосты ---------- */
  FX.toast = function (text) {
    const box = document.getElementById("toasts"); if (!box) return;
    const t = h("div", { class: "toast", role: "status" }, text);
    box.appendChild(t);
    setTimeout(() => t.classList.add("out"), 3800);
    setTimeout(() => t.remove(), 4300);
  };
  S.toastErr = (e) => FX.toast("[ СИСТЕМА ] Не сохранилось: " + ((e && (e.message || e.code)) || "ошибка связи"));

  /* ---------- частицы ---------- */
  function particles(host, color, n) {
    if (reduce()) return;
    for (let i = 0; i < (n || 14); i++) {
      const p = h("i", { class: "pt" });
      p.style.setProperty("--dx", (Math.random() * 240 - 120).toFixed(0) + "px");
      p.style.setProperty("--dy", (-60 - Math.random() * 160).toFixed(0) + "px");
      p.style.background = color || "var(--glow)";
      p.style.animationDelay = (Math.random() * 0.15).toFixed(2) + "s";
      host.appendChild(p);
    }
  }

  /* ---------- квест выполнен ---------- */
  let qdTimer = null;
  FX.questDone = function (o) {
    const L = layer(); if (!L) return;
    const old = L.querySelector(".qdone"); if (old) old.remove();
    const col = (S.BY[o.p] || {}).hex || "#5FC8FF";
    const box = h("div", { class: "qdone" },
      h("div", { class: "qd-t" }, "[ КВЕСТ ВЫПОЛНЕН ]"),
      o.t ? h("div", { class: "qd-n" }, o.t) : null,
      h("div", { class: "qd-r" }, h("b", { class: "xp" }, "+" + o.xp + " XP"), h("b", { class: "gold" }, "+" + o.g + " ◆")),
      o.bonus && o.bonus.length ? h("div", { class: "qd-b" }, o.bonus.join(" · ")) : null);
    box.style.setProperty("--pc", col);
    particles(box, col, 16);
    L.appendChild(box);
    FX.sound(o.bonus && o.bonus.length ? "coin" : "done");
    clearTimeout(qdTimer);
    qdTimer = setTimeout(() => { box.classList.add("out"); setTimeout(() => box.remove(), 500); }, 1900);
    const hx = document.getElementById("hud-xp"); if (hx) { hx.classList.remove("pop"); void hx.offsetWidth; hx.classList.add("pop"); }
    const hg = document.getElementById("hud-gold"); if (hg) { hg.classList.remove("pop"); void hg.offsetWidth; hg.classList.add("pop"); }
  };
  FX.drop = function (t, g) {
    FX.toast("[ ДОБЫЧА ] " + t + (g ? " · +" + g + " ◆" : "") + " — в библиотеке");
    FX.sound("coin");
  };
  FX.banner = function (title, text) {
    const L = layer(); if (!L) return;
    const b = h("div", { class: "banner" }, h("div", { class: "bn-t" }, title), text ? h("div", { class: "bn-x" }, text) : null);
    L.appendChild(b); FX.sound("done");
    setTimeout(() => { b.classList.add("out"); setTimeout(() => b.remove(), 600); }, 3200);
  };

  /* ---------- модальные окна ---------- */
  FX.modal = function (nodes, opts) {
    opts = opts || {};
    const L = layer();
    const card = h("div", { class: "modal" + (opts.cls ? " " + opts.cls : ""), role: "dialog", "aria-modal": "true" }, nodes);
    const back = h("div", { class: "mback" }, card);
    let closed = false;
    const close = (dismiss) => { if (closed) return; closed = true; back.classList.add("out"); setTimeout(() => { back.remove(); FX.pump(); }, 250); document.removeEventListener("keydown", onKey); if (dismiss === true && opts.onClose) opts.onClose(); };
    function onKey(e) { if (e.key === "Escape" && !opts.sticky) close(true); }
    if (!opts.sticky) back.addEventListener("click", (e) => { if (e.target === back) close(true); });
    document.addEventListener("keydown", onKey);
    L.appendChild(back);
    const f = card.querySelector("button, textarea, input"); if (f && !opts.noFocus) setTimeout(() => f.focus(), 30);
    return { close, card };
  };
  FX.confirm = function (title, text, okText) {
    return new Promise((res) => {
      let m;
      const done = (v) => { m.close(); res(v); };
      m = FX.modal([
        h("div", { class: "m-sys" }, "ОПОВЕЩЕНИЕ"),
        h("div", { class: "m-t" }, title),
        text ? h("div", { class: "m-x" }, text) : null,
        h("div", { class: "m-btns" }, h("button", { class: "btn ghost", type: "button", onclick: () => done(false) }, "Отмена"), h("button", { class: "btn", type: "button", onclick: () => done(true) }, okText || "Выполнить"))
      ], { onClose: () => res(false) });
    });
  };
  FX.prompt = function (title, text, ph, okText) {
    return new Promise((res) => {
      let m; const inp = h("input", { class: "inp", type: "text", placeholder: ph || "", maxlength: "200" });
      const done = (v) => { m.close(); res(v); };
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") done(inp.value.trim()); });
      m = FX.modal([h("div", { class: "m-sys" }, "СИСТЕМА"), h("div", { class: "m-t" }, title), text ? h("div", { class: "m-x" }, text) : null, inp,
        h("div", { class: "m-btns" }, h("button", { class: "btn ghost", type: "button", onclick: () => done(null) }, "Отмена"), h("button", { class: "btn", type: "button", onclick: () => done(inp.value.trim()) }, okText || "Готово"))], { onClose: () => res(null) });
    });
  };

  /* ---------- повышение уровня ---------- */
  const lvlQueue = [];
  let lvlOpen = false;
  FX.levelUp = function (L, m, gold) { lvlQueue.push({ L, m, gold }); FX.pump(); };
  FX.pump = function () { if (!lvlOpen && !S.hold && !document.querySelector(".mback")) nextLevel(); };
  function nextLevel() {
    if (S.hold || document.querySelector(".mback")) { lvlOpen = false; return; }
    const it = lvlQueue.shift(); if (!it) { lvlOpen = false; return; }
    lvlOpen = true;
    const lay = layer();
    const tierCls = it.m && it.m.tier ? " t-" + it.m.tier : "";
    const ov = h("div", { class: "lvlup" + tierCls, role: "dialog", "aria-label": "Новый уровень" },
      h("i", { class: "c tl" }), h("i", { class: "c tr" }), h("i", { class: "c bl" }), h("i", { class: "c br" }),
      h("div", { class: "lu-sys" }, "[ СИСТЕМА ]"),
      h("div", { class: "lu-t" }, "УРОВЕНЬ " + it.L + " ДОСТИГНУТ"),
      h("div", { class: "lu-n" }, String(it.L)),
      h("div", { class: "lu-r" }, "+" + it.gold + " ◆"),
      it.m && it.m.loot ? h("div", { class: "lu-loot" }, h("span", null, (it.m.tierName || "Добыча") + " добыча"), h("b", null, it.m.loot), h("small", null, "Задача «Добыча» уже в списке дел — забери без вины")) : null,
      it.m && it.m.surprise ? h("div", { class: "lu-s" }, "СЮРПРИЗ: малый сундук в библиотеке") : null,
      S.unlockAt && S.unlockAt(it.L).length ? h("div", { class: "lu-u" }, "Открыто: " + S.unlockAt(it.L).map((s) => s.name).join(", ")) : null,
      h("div", { class: "lu-c" }, "нажми, чтобы продолжить"));
    particles(ov, "#FFD36B", 30);
    lay.appendChild(ov);
    FX.sound("level");
    const close = () => { ov.classList.add("out"); setTimeout(() => { ov.remove(); nextLevel(); }, 400); };
    setTimeout(() => ov.addEventListener("click", close), 600);
  }

  /* ---------- новый раздел ---------- */
  FX.newSection = function (sec) {
    const m = FX.modal([
      h("div", { class: "ns-t" }, "[ НОВЫЙ РАЗДЕЛ ]"),
      h("div", { class: "ns-n" }, sec.name),
      h("div", { class: "m-x" }, sec.intro || ""),
      h("div", { class: "m-btns" }, h("button", { class: "btn", type: "button", onclick: () => m.close() }, "Понятно"))
    ], { cls: "newsec" });
    FX.sound("open");
  };

  /* ---------- сундук ---------- */
  FX.chest = function (title, lines) {
    return new Promise((res) => {
      const chest = h("div", { class: "chest" }, h("i", { class: "lid" }), h("i", { class: "box" }));
      const out = h("div", { class: "chest-out", hidden: true }, lines.map((l) => h("div", null, l)));
      const btn = h("button", { class: "btn", type: "button" }, "Открыть");
      let m;
      btn.addEventListener("click", () => {
        if (chest.classList.contains("open")) { m.close(); res(true); return; }
        chest.classList.add("open"); out.hidden = false; FX.sound("chest"); particles(m.card, "#FFD36B", 24); btn.textContent = "Забрать";
      });
      m = FX.modal([h("div", { class: "m-sys" }, "НАГРАДА"), h("div", { class: "m-t" }, title), chest, out, h("div", { class: "m-btns" }, btn)], { cls: "chestm", onClose: () => res(true) });
    });
  };

  /* ---------- сканер замены ---------- */
  FX.scan = function (el) {
    if (!el) return Promise.resolve();
    FX.sound("scan");
    el.classList.add("scanning");
    const list = el.parentElement; if (list) list.classList.add("dim");
    return new Promise((r) => setTimeout(() => { el.classList.remove("scanning"); if (list) list.classList.remove("dim"); r(); }, reduce() ? 50 : 900));
  };

  /* ---------- выбор навыка ---------- */
  FX.choice = function (title, sub, options) {
    return new Promise((res) => {
      let m;
      const cards = options.map((o, i) => h("button", { class: "choice", type: "button", style: { "--pc": o.color || "var(--glow)", animationDelay: (0.12 * i) + "s" }, onclick: () => { cards.forEach((c) => c.classList.add(c === cards[i] ? "picked" : "gone")); FX.sound("level"); setTimeout(() => { m.close(); res(o); }, 900); } },
        h("span", { class: "ch-star" }, "✦"), h("b", null, o.name), o.sub ? h("small", null, o.sub) : null, o.text ? h("span", { class: "ch-x" }, o.text) : null));
      m = FX.modal([h("div", { class: "m-sys" }, "[ СИСТЕМА ПРЕДЛАГАЕТ ]"), h("div", { class: "m-t" }, title), sub ? h("div", { class: "m-x" }, sub) : null, h("div", { class: "choices" }, cards),
        h("div", { class: "m-btns" }, h("button", { class: "btn ghost", type: "button", onclick: () => { m.close(); res(null); } }, "Позже"))], { cls: "choicem", onClose: () => res(null) });
      FX.sound("open");
    });
  };
})();
