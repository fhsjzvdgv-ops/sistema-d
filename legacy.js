/* Система v6 — перенесено из окна v5: навыки в работе, квесты навыков, знания, Ил */
(function () {
  "use strict";
  const S = window.SYS, h = (...a) => S.h(...a), R = () => S.R();
  const DAYS = () => ((R().habits || {}).daysToMaster) || 21;
  const block = (label, text) => h("div", null, h("span", { class: "lbl" }, label), text);

  S.skBranches = (sk, p) => { const b = sk && Array.isArray(sk.branches) && sk.branches.length ? sk.branches.filter((k) => S.BY[k]) : []; return b.length ? b : [p.key]; };
  const splitPct = () => Math.round(100 * (((R().branchSplit || {}).second) || 0.3));
  S.branchNode = function (sk, p) {
    const br = S.skBranches(sk, p), two = br.length > 1, sp = splitPct();
    return h("span", { class: "br" }, h("em", null, "качает:"), br.map((k, j) => { const q = S.BY[k]; const d = h("i"); d.style.background = q.color; return h("span", null, d, q.name + (two ? " " + (j === 0 ? 100 - sp : sp) + "%" : "")); }));
  };
  S.branchText = function (sk, p) {
    const br = S.skBranches(sk, p), sp = splitPct();
    if (br.length < 2) return "Только путь «" + S.BY[br[0]].name + "» — весь опыт идёт туда.";
    return "Основная ветвь — «" + S.BY[br[0]].name + "» (" + (100 - sp) + "% опыта), вторая — «" + S.BY[br[1]].name + "» (" + sp + "%).";
  };
  function chapterBox(title, items, key, startNo) {
    const gd = S.keep(h("details", { class: "scroll" }), key);
    gd.appendChild(h("summary", null, h("span", { class: "scroll-t" }, title), h("span", { class: "more" }, S.plural(items.length, "шаг", "шага", "шагов") + " · открыть")));
    gd.appendChild(h("div", { class: "scroll-b" }, items.map((x, i) => h("div", { class: "gs" }, h("div", { class: "gn" }, String(startNo + i)), h("div", null, h("div", { class: "gt" }, x.title), x.text ? h("div", null, x.text) : null, x.practice ? h("div", { class: "pr" }, h("span", { class: "lbl" }, "Практика"), x.practice) : null, x.check ? h("div", { class: "ck" }, x.check) : null)))));
    return gd;
  }
  function watchBox(list) {
    return h("div", { class: "watch" }, h("span", { class: "lbl" }, "▶ Сначала посмотри"), list.map((v) => [h("span", { class: "wv" }, "«" + v.title + "»"), [v.min ? "≈" + v.min + " мин" : null, v.note || null, v.where || null].filter(Boolean).length ? h("span", { class: "wm" }, [v.min ? "≈" + v.min + " мин" : null, v.note || null, v.where || null].filter(Boolean).join(" · ")) : null]));
  }
  function nextInfo(sk, n, p) {
    const cur = (sk.tiers || [])[n - 1], t = (sk.tiers || [])[n]; if (!t) return null;
    const lvl = S.X.pl[p.key].level;
    let cond = "Откроется, когда освоишь нынешнюю ступень" + (cur && cur.kind !== "quest" ? " (" + DAYS() + " день практики)" : "");
    if (t.req > lvl) cond += " и путь «" + p.name + "» дорастёт до ур. " + t.req;
    if (!S.rankOk(t)) cond += ", после рангового испытания " + t.rank;
    if (!S.afterOk(t)) cond += ", после «" + (t.after.name || t.after.skill) + "»";
    return { t, cond: cond + "." };
  }
  S.legacyActive = function () {
    const box = h("div"), list = S.activeTracks();
    if (!list.length) box.appendChild(h("div", { class: "empty" }, Object.keys(S.D.codex).length ? "Навыков в работе нет. Нажми «Система предлагает навык»." : "Загружается…"));
    list.forEach((a) => {
      const sk = a.sk, st = a.st, t = a.tier, days = st.days || 0, quest = t.kind === "quest";
      const det = S.keep(h("details", { class: "row" }), "trk-" + sk.id);
      const right = quest ? [h("b", null, "квест")] : [h("b", null, days + "/" + DAYS()), S.bar(Math.round((100 * days) / DAYS()), "mini")];
      det.appendChild(h("summary", null, S.dot(a.p.key), h("div", null, h("span", { class: "rt" }, sk.name), h("span", { class: "rs" }, "Ступень " + S.ROMAN[t.n] + " из " + (sk.tiers || []).length + " · " + t.title), S.branchNode(sk, a.p)), h("div", { class: "rr" }, right)));
      det.appendChild(S.trackBody(a)); box.appendChild(det);
    });
    const paused = S.allSkills().filter((x) => (S.D.skills[x.sk.id] || {}).paused).map((x) => x.sk.name);
    if (paused.length) box.appendChild(h("div", { class: "note" }, "На паузе: " + paused.join(", ") + ". Вернутся после фазы «Энергия»."));
    return box;
  };
  // что делать сейчас по навыку в работе: задание, зачем, свиток, дальше
  S.trackBody = function (a) {
      const sk = a.sk, t = a.tier, quest = t.kind === "quest";
      const b = h("div", { class: "rb" });
      if (t.watch && t.watch.length) b.appendChild(watchBox(t.watch));
      b.appendChild(h("div", { class: "now" }, h("span", { class: "lbl" }, quest ? "Сейчас: задание ступени" : "Каждый день"), t.daily || t.how || t.title, t.goal ? h("div", { class: "src" }, "цель ступени: " + t.goal) : null));
      if (sk.why) b.appendChild(block("Зачем", sk.why));
      b.appendChild(block("Ветви силы", S.branchText(sk, a.p)));
      const ch = t.chapter || []; let before = 0;
      for (let i = 0; i < t.n - 1; i++) before += ((sk.tiers[i] && sk.tiers[i].chapter) || []).length;
      if (ch.length) b.appendChild(chapterBox("Свиток · ступень " + S.ROMAN[t.n], ch, "ch-" + sk.id + "-" + t.n, before + 1));
      let past = []; for (let j = 0; j < t.n - 1; j++) past = past.concat((sk.tiers[j] && sk.tiers[j].chapter) || []);
      if (past.length) b.appendChild(chapterBox("Прошлые ступени", past, "chp-" + sk.id, 1));
      const nx = nextInfo(sk, t.n, a.p);
      b.appendChild(block("Дальше", nx ? "ступень " + S.ROMAN[nx.t.n] + " — " + nx.t.title + ". " + nx.cond : "это последняя ступень навыка"));
      if (sk.src) b.appendChild(h("div", { class: "src" }, "источник: " + sk.src));
      return b;
  };
  S.legacyQuests = function () {
    const list = (S.D.quests || []).filter((q) => q.status !== "later").sort((a, b) => (a.status === "done") - (b.status === "done") || (a.order || 0) - (b.order || 0));
    if (!list.length) return null;
    const box = h("div");
    list.forEach((q) => {
      const done = q.status === "done", filled = done ? q.stepsTotal || 0 : Math.max(0, (q.stepNo || 1) - 1);
      const w = h("div", { class: "quest" }, h("div", { class: "qh" }, h("span", { class: "kind" + (done ? " done" : "") }, done ? (q.kind || "Квест") + " · пройден" : q.kind || "Квест"), h("span", { class: "cnt" }, (q.stepNo || 0) + " / " + (q.stepsTotal || 0))), h("div", { class: "qt" }, q.title || ""));
      if (!done && q.watch && q.watch.length && (q.stepNo || 1) <= 1) w.appendChild(watchBox(q.watch));
      if (!done && q.step) w.appendChild(h("div", { class: "step" }, h("span", { class: "lbl" }, "Текущий шаг"), q.step));
      w.appendChild(h("div", { class: "pips" }, Array.from({ length: q.stepsTotal || 0 }, (_, i) => h("span", { class: i < filled ? "on" : "" }))));
      if (q.why || q.gain) { const det = S.keep(h("details"), "q-" + q._id); det.appendChild(h("summary", null, h("span", { class: "more" }, "зачем этот квест"))); det.appendChild(h("div", { class: "body" }, q.why ? block("Зачем", q.why) : null, q.gain ? block("Что даст", q.gain) : null, q.src ? h("div", { class: "src" }, "источник: " + q.src) : null)); w.appendChild(det); }
      box.appendChild(w);
    });
    return S.win("Квесты навыков", "Сделал текущий шаг — жми «Шаг сделан»", box);
  };

  /* ---------- знания ---------- */
  function srcNames(ids) { const reg = S.D.codex.sources && S.D.codex.sources.items; if (!reg || !ids || !ids.length) return ""; return ids.map((id) => { const x = reg.find((r) => r.id === id); return x ? x.author : id; }).join(", "); }
  S.knowWin = function () {
    const box = h("div"), k = S.D.knowledge;
    const groups = k && Array.isArray(k.groups) ? k.groups : k && Array.isArray(k.items) ? [{ group: "Правила", items: k.items }] : [];
    if (!groups.length) { box.appendChild(h("div", { class: "empty" }, "Загружается…")); return S.win("Знания", null, box); }
    const reg = S.D.codex.sources && S.D.codex.sources.items;
    if (reg && reg.length) box.appendChild(h("div", { class: "kgroup" }, h("h3", null, "Базы в игре"), reg.map((x, i) => { const det = S.keep(h("details", { class: "kn" }), "src-" + i); det.appendChild(h("summary", null, h("span", null, x.author + " — " + x.name), h("span", { class: "more" }, "открыть"))); det.appendChild(h("div", { class: "body" }, x.role ? block("Что даёт игре", x.role) : null, x.status ? h("div", { class: "src" }, "статус: " + x.status) : null)); return det; })));
    groups.forEach((g, gi) => box.appendChild(h("div", { class: "kgroup" }, h("h3", null, g.group || ""), (g.items || []).map((it, i) => { const det = S.keep(h("details", { class: "kn" }), "kn-" + gi + "-" + i); det.appendChild(h("summary", null, h("span", null, it.title), h("span", { class: "more" }, "открыть"))); const sn = srcNames(it.sources) || it.src; det.appendChild(h("div", { class: "body" }, h("div", null, it.text), sn ? h("div", { class: "src" }, "источник: " + sn) : null)); return det; }))));
    return S.win("Знания", "Понятия из базы, на которых стоит игра", box);
  };

  /* ---------- Ил (архив выгрузки) ---------- */
  const ST_LABEL = { todo: ["не пройден", "st-todo"], feb: ["было в феврале", "st-feb"], done: ["пройден", "st-done"] };
  const IL_ORDER = [0, 1, 2, 6, 7, 8, 3, 4, 5];
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let ilRoot = null, ilSig = "", refs = {}, order = [], blkRefs = {}, secRefs = {}, saveState = {}, rec = null, recId = null, micBlocked = false, counter = null;
  const aid = (b, s, i) => "a" + b + "_" + s + "_" + i;
  const ans = (id) => { const a = S.D.answers[id]; return typeof a === "string" ? a : ""; };
  const autosize = (ta) => { ta.style.height = "auto"; ta.style.height = Math.max(46, ta.scrollHeight + 2) + "px"; };
  const setSt = (id, text, cls) => { const r = refs[id]; if (r) { r.st.textContent = text; r.st.className = "ast" + (cls ? " " + cls : ""); } };
  function queueSave(id, now) { const ss = saveState[id] || (saveState[id] = {}); ss.dirty = true; clearTimeout(ss.timer); ss.timer = setTimeout(() => { ss.timer = null; doSave(id); }, now ? 0 : 900); }
  function doSave(id) {
    const ss = saveState[id] || (saveState[id] = {}), r = refs[id]; if (!r) return;
    if (!S.db) { setSt(id, "нет связи — ответ не сохранён", "err"); return; }
    if (ss.busy) { ss.again = true; return; }
    const text = r.ta.value.trim(), saved = ss.last != null ? ss.last : ans(id);
    if (text === saved) { ss.dirty = false; setSt(id, text ? "сохранено" : "", "ok"); return; }
    ss.busy = true; setSt(id, "сохраняю…", "");
    const ref = S.db.doc("answers/" + id);
    (text ? ref.set({ text, q: r.q, block: r.b, section: r.s, n: r.i, updated: new Date().toISOString() }) : ref.delete()).then(() => {
      ss.last = text; ss.busy = false; if (r.ta.value.trim() === text) { ss.dirty = false; setSt(id, text ? "сохранено" : "", "ok"); } count(); if (ss.again) { ss.again = false; doSave(id); }
    }, () => { ss.busy = false; setSt(id, "не сохранилось — нажми в поле и выйди ещё раз", "err"); });
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) return; Object.keys(saveState).forEach((id) => { const ss = saveState[id]; if (ss.timer) { clearTimeout(ss.timer); ss.timer = null; doSave(id); } }); });
  function startMic(id, btn) {
    if (rec) { const was = recId; try { rec.stop(); } catch (e) {} if (was === id) return; }
    const r = new SR(); r.lang = "ru-RU"; r.continuous = true; r.interimResults = false; rec = r; recId = id; btn.classList.add("on"); btn.textContent = "стоп";
    r.onresult = (ev) => { let add = ""; for (let k = ev.resultIndex; k < ev.results.length; k++) if (ev.results[k].isFinal) add += ev.results[k][0].transcript; if (!add) return; const ta = refs[id].ta; ta.value = (ta.value ? ta.value.replace(/\s+$/, "") + " " : "") + add.trim(); autosize(ta); queueSave(id); };
    r.onerror = (ev) => { if (ev.error === "not-allowed" || ev.error === "service-not-allowed" || ev.error === "audio-capture") { micBlocked = true; ilRoot && ilRoot.querySelectorAll(".mic").forEach((b) => (b.hidden = true)); } };
    r.onend = () => { btn.classList.remove("on"); btn.textContent = "голосом"; if (rec === r) { rec = null; recId = null; } queueSave(id, true); };
    try { r.start(); } catch (e) { r.onend(); }
  }
  function build(blocks) {
    ilRoot = h("div"); refs = {}; order = []; blkRefs = {}; secRefs = {};
    counter = { done: h("b", null, "0"), total: h("span", null, "0"), bar: h("i") };
    ilRoot.appendChild(h("div", { class: "how" }, h("div", null, "Выгрузка всего, что висит в голове, по методу Ваагна. Ваагн советует повторять её раз в несколько месяцев."), h("div", null, "Всё сохраняется само. Закончишь — напиши Claude «готово»."),
      h("div", { class: "xp" }, h("div", { class: "meta" }, h("span", null, "Отвечено вопросов"), h("span", null, counter.done, " / ", counter.total)), h("div", { class: "bar thin" }, counter.bar))));
    blocks.forEach((b) => {
      const det = S.keep(h("details", { class: "blk il" }), "ilb-" + b.n);
      const bs = h("span", { class: "bs" }), sl = ST_LABEL[b.status] || ST_LABEL.todo, chip = h("span", { class: "st-chip " + sl[1] }, sl[0]);
      det.appendChild(h("summary", null, h("span", { class: "bn" }, String(b.n)), h("div", null, h("span", { class: "bt" }, b.title), bs), chip));
      blkRefs[b.n] = { bs, chip, st: b.status, ids: [] };
      const body = h("div");
      if (b.note) body.appendChild(h("div", { class: "bnote" }, b.note));
      (b.sections || []).forEach((s) => {
        const ok = h("span", { class: "ok", hidden: true }, "✓");
        const sec = h("div", { class: "sec" }, h("h4", null, h("span", null, b.n + "." + s.n), s.title, ok));
        secRefs[b.n + "." + s.n] = { ok, ids: [] };
        const ol = h("ol");
        (s.q || []).forEach((q, i) => {
          const id = aid(b.n, s.n, i + 1);
          const ta = h("textarea", { class: "ans", rows: "1", placeholder: "Ответ — текстом или голосом", "aria-label": "Ответ на вопрос " + b.n + "." + s.n + "." + (i + 1) });
          ta.value = ans(id);
          ta.addEventListener("input", () => { autosize(ta); queueSave(id); });
          ta.addEventListener("blur", () => { if (saveState[id] && saveState[id].dirty) queueSave(id, true); });
          const st = h("span", { class: "ast" });
          const row = h("div", { class: "arow" }, st);
          if (SR && !micBlocked) { const mb = h("button", { class: "mic", type: "button" }, "голосом"); mb.addEventListener("click", () => startMic(id, mb)); row.appendChild(mb); }
          ol.appendChild(h("li", null, h("span", { class: "qn" }, b.n + "." + s.n + "." + (i + 1)), h("div", null, h("div", null, q), ta, row)));
          refs[id] = { ta, st, q, b: b.n, s: s.n, i: i + 1 }; order.push(id); blkRefs[b.n].ids.push(id); secRefs[b.n + "." + s.n].ids.push(id);
        });
        sec.appendChild(ol); body.appendChild(sec);
      });
      det.appendChild(body);
      det.addEventListener("toggle", () => { if (det.open) det.querySelectorAll("textarea.ans").forEach(autosize); });
      ilRoot.appendChild(det);
    });
  }
  function count() {
    let total = 0, done = 0; const has = (id) => !!(refs[id] && refs[id].ta.value.trim());
    Object.keys(blkRefs).forEach((n) => { const br = blkRefs[n], d = br.ids.filter(has).length; total += br.ids.length; done += d; br.bs.textContent = br.ids.length + " вопр. · отвечено " + d; if (br.ids.length && d === br.ids.length) { br.chip.textContent = "готово"; br.chip.className = "st-chip st-done"; } else if (d) { br.chip.textContent = "в процессе"; br.chip.className = "st-chip st-todo"; } });
    Object.keys(secRefs).forEach((k) => { const sr = secRefs[k]; sr.ok.hidden = !(sr.ids.length && sr.ids.every(has)); });
    if (counter) { counter.done.textContent = done; counter.total.textContent = total; counter.bar.style.width = (total ? Math.round((100 * done) / total) : 0) + "%"; }
  }
  function sync() {
    order.forEach((id) => { const r = refs[id], ss = saveState[id], v = ans(id); if (document.activeElement === r.ta || (ss && (ss.dirty || ss.busy))) return; if (r.ta.value !== v) { r.ta.value = v; autosize(r.ta); } if (ss) ss.last = null; });
    count();
  }
  S.ilWin = function () {
    const blocks = (S.D.unload || []).slice().sort((a, b) => { const ia = IL_ORDER.indexOf(a.n), ib = IL_ORDER.indexOf(b.n); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.n - b.n; });
    if (!blocks.length) return S.win("Ил · архив", null, h("div", { class: "empty" }, "Вопросы загружаются…"));
    const sig = JSON.stringify(blocks.map((b) => [b.n, b.title, b.status, b.note, (b.sections || []).map((s) => [s.n, s.title, s.q])]));
    if (sig !== ilSig || !ilRoot) { build(blocks); ilSig = sig; }
    sync();
    const w = S.win("Ил · архив", "Выгрузка по Ваагну", ilRoot);
    setTimeout(() => ilRoot && ilRoot.querySelectorAll("details[open] textarea.ans").forEach(autosize), 0);
    return w;
  };
  S.ilSync = () => { if (ilRoot) sync(); };
})();
