/* Reframe — CBT thought-record companion. 100% local, localStorage only. */
"use strict";

const LS_KEY = "reframe.data.v1";
const EMOTIONS = ["Anxious", "Worried", "Angry", "Irritated", "Sad", "Down", "Lonely", "Ashamed", "Guilty", "Hurt", "Frustrated", "Disappointed", "Nervous", "Embarrassed"];

const store = {
  load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
  },
  save(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); },
};

let state = {
  tab: "home",
  records: [],
  draftId: null,
  editingId: null,
  privacy: false,
  settingsOpen: false,
  search: "",
  expandedId: null,
  confirmDelete: null,
};
let flow = null; // guided-flow draft being edited

function loadAll() {
  const d = store.load();
  state.records = Array.isArray(d.records) ? d.records : [];
  state.privacy = !!d.privacy;
}
function persist() {
  store.save({ records: state.records, privacy: state.privacy });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d} ${months[(+m) - 1]} ${y}`;
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function $(sel, el) { return (el || document).querySelector(sel); }
function getQ(n) { return QUESTIONS.find(q => q.n === n); }

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("hide"), 2200);
  setTimeout(() => t.remove(), 2600);
}

/* ---------- Voice (Web Speech API) ---------- */
const micSVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>`;
const speechOK = typeof webkitSpeechRecognition !== "undefined" || typeof SpeechRecognition !== "undefined";
let recActive = null;

function startDictation(id, btn) {
  if (recActive) { try { recActive.stop(); } catch {} recActive = null; }
  const Ctor = typeof webkitSpeechRecognition !== "undefined" ? webkitSpeechRecognition : SpeechRecognition;
  const rec = new Ctor();
  rec.lang = navigator.language || "en-US";
  rec.interimResults = false;
  rec.continuous = false;
  recActive = rec;
  btn.classList.add("rec");
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const el = document.getElementById(id);
    if (el) {
      el.value = (el.value ? el.value.trim() + " " : "") + text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };
  rec.onend = () => { btn.classList.remove("rec"); if (recActive === rec) recActive = null; };
  rec.onerror = () => { btn.classList.remove("rec"); if (recActive === rec) recActive = null; toast("Dictation unavailable"); };
  try { rec.start(); } catch { btn.classList.remove("rec"); }
}

function micHTML(id) {
  if (!speechOK) return "";
  return `<button type="button" class="mic-btn" title="Dictate" aria-label="Dictate into this field" onclick="startDictation('${id}', this)">${micSVG}</button>`;
}
window.startDictation = startDictation;

/* ---------- Guided flow ---------- */
function newFlow(fromRecord) {
  const base = fromRecord || {};
  flow = {
    step: 1,
    date: base.date || todayISO(),
    situation: base.situation || "",
    emotion: base.emotion || "",
    emotionIntensity: base.emotionIntensity ?? 50,
    autoThoughts: base.autoThoughts || "",
    hotThought: base.hotThought || "",
    feelsTrue: base.feelsTrue ?? 50,
    questions: {},           // { n: answer }
    suggested: base.suggested || null,
    feelsTrueAfter: base.feelsTrueAfter ?? base.feelsTrue ?? 50,
    newThought: base.newThought || "",
    emotionAfter: base.emotionAfter || base.emotion || "",
    emotionAfterIntensity: base.emotionAfterIntensity ?? base.emotionIntensity ?? 50,
    actionPlan: base.actionPlan || "",
    editingId: base.id || null,
    fromDraft: !!fromRecord && !!fromRecord.draft,
  };
  state.editingId = base.id || null;
  state.tab = "flow";
  render();
}

function flowRecord() {
  return {
    id: flow.editingId || uid(),
    date: flow.date,
    situation: flow.situation.trim(),
    emotion: flow.emotion.trim(),
    emotionIntensity: Number(flow.emotionIntensity),
    autoThoughts: flow.autoThoughts.trim(),
    hotThought: flow.hotThought.trim(),
    feelsTrue: Number(flow.feelsTrue),
    questions: { ...flow.questions },
    suggested: flow.suggested || [],
    newThought: flow.newThought.trim(),
    feelsTrueAfter: Number(flow.feelsTrueAfter),
    emotionAfter: flow.emotionAfter.trim(),
    emotionAfterIntensity: Number(flow.emotionAfterIntensity),
    actionPlan: flow.actionPlan.trim(),
    draft: false,
    createdAt: Date.now(),
  };
}

function saveFlowRecord() {
  const rec = flowRecord();
  if (!rec.situation && !rec.hotThought && !rec.emotion) {
    toast("Add at least a situation, thought or emotion first");
    return;
  }
  const idx = state.records.findIndex(r => r.id === rec.id);
  if (idx >= 0) {
    rec.createdAt = state.records[idx].createdAt;
    rec.date = rec.date || state.records[idx].date;
    state.records[idx] = rec;
  } else {
    state.records.unshift(rec);
  }
  state.records.sort((a, b) => (b.date + "").localeCompare(a.date) || b.createdAt - a.createdAt);
  persist();
  flow = null;
  state.editingId = null;
  state.tab = "history";
  state.expandedId = rec.id;
  render();
  toast("Saved to history");
}

/* ---------- Quick capture ---------- */
function quickCapture(e) {
  e.preventDefault();
  const emotion = $("#qc-emotion").value.trim();
  const note = $("#qc-note").value.trim();
  if (!emotion) { toast("Name the emotion first"); return; }
  const rec = {
    id: uid(),
    date: todayISO(),
    draft: true,
    createdAt: Date.now(),
    situation: note,
    emotion,
    emotionIntensity: Number($("#qc-intensity").value),
  };
  state.records.unshift(rec);
  persist();
  e.target.reset();
  $("#qc-intensity").value = 50;
  setSliderVal($("#qc-intensity"));
  toast("Draft saved — find it in History");
}
window.quickCapture = quickCapture;

function setSliderVal(input) {
  input.style.setProperty("--val", input.value + "%");
  const out = input.parentElement.querySelector(".slider-val");
  if (out) out.textContent = input.value + "%";
}

/* ---------- Records ops ---------- */
function deleteRecord(id) {
  state.records = state.records.filter(r => r.id !== id);
  persist();
  render();
  toast("Deleted");
}
window.deleteRecord = deleteRecord;

function completeDraft(id) {
  const rec = state.records.find(r => r.id === id);
  if (!rec) return;
  newFlow({ ...rec });
}
window.completeDraft = completeDraft;

function confirmModal(text, onYes) {
  const root = $("#modal-root");
  root.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>Are you sure?</h3>
        <p>${esc(text)}</p>
        <div class="btn-row">
          <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button class="btn btn-danger" id="modal-yes">Delete</button>
        </div>
      </div>
    </div>`;
  $("#modal-yes").onclick = () => { closeModal(); onYes(); };
}
window.confirmModal = confirmModal;
function closeModal() { $("#modal-root").innerHTML = ""; }
window.closeModal = closeModal;

function askDelete(id) {
  confirmModal("This record will be permanently removed from this browser. This cannot be undone.", () => deleteRecord(id));
}
window.askDelete = askDelete;

function askDeleteAll() {
  confirmModal("All thought records, drafts and settings stored in this browser will be permanently deleted. This cannot be undone.", () => {
    state.records = [];
    persist();
    closeModal();
    render();
    toast("All data deleted");
  });
}
window.askDeleteAll = askDeleteAll;

/* ---------- Export ---------- */
function recordText(r) {
  const lines = [
    "THOUGHT RECORD",
    `Date: ${fmtDate(r.date)}`,
    "",
    "Situation:",
    r.situation || "—",
    "",
    `Emotion: ${r.emotion || "—"} (${r.emotionIntensity ?? "?"}% intensity)`,
    "",
    "Automatic thoughts that caused the emotion:",
    r.autoThoughts || "—",
    "",
    `Hot thought: ${r.hotThought || "—"}`,
    `Feels true: ${r.feelsTrue ?? "?"}%`,
    "",
    "Challenges (critical questions):",
  ];
  const qa = Object.entries(r.questions || {}).filter(([, a]) => (a || "").trim());
  if (qa.length === 0) lines.push("—");
  qa.forEach(([n, a]) => {
    const q = getQ(Number(n));
    lines.push(`${n}. ${q ? q.text : ""}`);
    lines.push(`   Answer: ${a}`);
    lines.push("");
  });
  lines.push("New, more helpful thought(s):", r.newThought || "—", `Feels true: ${r.feelsTrueAfter ?? "?"}%`, "");
  lines.push(`Emotion after: ${r.emotionAfter || "—"} (${r.emotionAfterIntensity ?? "?"}% intensity)`, "");
  lines.push("Action plan / needed behaviour:", r.actionPlan || "—");
  return lines.join("\n");
}
function copyRecord(id, btn) {
  const r = state.records.find(x => x.id === id);
  if (!r) return;
  const text = recordText(r);
  const done = () => { toast("Copied as text"); };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch { toast("Copy failed"); }
  ta.remove();
}
window.copyRecord = copyRecord;

function exportPDF(id) {
  const r = state.records.find(x => x.id === id);
  if (!r) return;
  const qa = Object.entries(r.questions || {}).filter(([, a]) => (a || "").trim())
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  $("#print-root").innerHTML = `
    <div class="pr-head"><h1>Thought record</h1><span class="pr-date">Date: ${esc(fmtDate(r.date))}</span></div>
    <div class="pr-sec"><div class="pr-label">Situation</div><div class="pr-value">${esc(r.situation || "—")}</div></div>
    <div class="pr-two">
      <div class="pr-sec"><div class="pr-label">Emotion</div><div class="pr-value">${esc(r.emotion || "—")} — intensity ${r.emotionIntensity ?? "?"}%</div></div>
    </div>
    <div class="pr-sec"><div class="pr-label">Automatic thoughts that caused the emotion</div><div class="pr-value">${esc(r.autoThoughts || "—")}</div></div>
    <div class="pr-sec"><div class="pr-label">Hot thought (most important, in one sentence)</div><div class="pr-value">${esc(r.hotThought || "—")}</div><div class="pr-value">Feels true for ${r.feelsTrue ?? "?"}%</div></div>
    <div class="pr-sec"><div class="pr-label">Challenging — critical questions and answers</div>
      ${qa.length ? qa.map(([n, a]) => {
        const q = getQ(Number(n));
        return `<div class="pr-qa"><div class="pr-q">${n}. ${esc(q ? q.text : "")}</div><div class="pr-a">→ ${esc(a)}</div></div>`;
      }).join("") : '<div class="pr-value">—</div>'}
    </div>
    <div class="pr-sec"><div class="pr-label">New, more helpful thought(s)</div><div class="pr-value">${esc(r.newThought || "—")}</div><div class="pr-value">Feels true for ${r.feelsTrueAfter ?? "?"}%</div></div>
    <div class="pr-two">
      <div class="pr-sec"><div class="pr-label">Emotion after</div><div class="pr-value">${esc(r.emotionAfter || "—")} — intensity ${r.emotionAfterIntensity ?? "?"}%</div></div>
      <div class="pr-sec"><div class="pr-label">Action plan / needed behaviour</div><div class="pr-value">${esc(r.actionPlan || "—")}</div></div>
    </div>
    <div class="pr-footer">Reframe — thought record companion · All data stays in this browser</div>`;
  window.print();
}
window.exportPDF = exportPDF;

/* ---------- Views ---------- */
function viewHeader() {
  return `
  <header class="header">
    <div class="header-row">
      <h1><span class="logo">🧠</span> Reframe</h1>
      <span class="privacy-label">Privacy blur</span>
      <button class="toggle-wrap" id="privacy-toggle" role="switch" aria-pressed="${state.privacy}" aria-label="Privacy blur" title="Privacy blur"
        onclick="togglePrivacy()"><span class="toggle-knob"></span></button>
    </div>
    <nav class="tabs">
      ${["home", "history", "insights", "settings"].map(t => `
        <button class="tab ${state.tab === t ? "active" : ""}" onclick="goTab('${t}')">${
          ({ home: "Home", history: "History", insights: "Insights", settings: "Settings" })[t]
        }</button>`).join("")}
    </nav>
  </header>`;
}
function togglePrivacy() {
  state.privacy = !state.privacy;
  document.body.classList.toggle("privacy-on", state.privacy);
  $("#privacy-toggle").setAttribute("aria-pressed", state.privacy);
  persist();
}
window.togglePrivacy = togglePrivacy;
function goTab(t) {
  if (state.tab === "flow" && flow && t !== "flow") {
    const hasData = flow.situation || flow.hotThought || flow.emotion;
    if (hasData && !flow.saved) {
      const ok = confirm("Leave the thought record? Unsaved answers will be lost.");
      if (!ok) return;
    }
    flow = null;
  }
  state.tab = t;
  render();
}
window.goTab = goTab;

function viewHome() {
  return `
  <section class="quick-hero">
    <h2>Feeling something right now?</h2>
    <p>Log it in under 15 seconds — you can complete the full record later.</p>
    <button class="btn btn-primary btn-lg" onclick="focusQuick()">⚡ Quick capture</button>
  </section>

  <form class="card" id="quick-card" onsubmit="quickCapture(event)">
    <h2>Quick capture</h2>
    <p class="hint">Just the emotion and how strong it is. Saved as a draft you can finish later.</p>
    <label class="field" for="qc-emotion">Emotion</label>
    <input id="qc-emotion" list="qc-emotions" autocomplete="off" placeholder="e.g. Anxious" />
    <datalist id="qc-emotions">${EMOTIONS.map(e => `<option value="${e}">`).join("")}</datalist>
    <div class="chips">${EMOTIONS.slice(0, 7).map(e => `<button type="button" class="chip" onclick="pickChip(this)">${e}</button>`).join("")}</div>
    <label class="field">Intensity <span class="field-note">how strong is it?</span></label>
    <div class="slider-row">
      <input type="range" id="qc-intensity" min="0" max="100" value="50" />
      <output class="slider-val">50%</output>
    </div>
    <label class="field" for="qc-note">Note <span class="field-note">(optional — a word about the situation)</span></label>
    <textarea id="qc-note" rows="2" placeholder="What happened?"></textarea>
    <button class="btn btn-primary btn-block" style="margin-top:14px" type="submit">Save draft</button>
  </form>

  <div class="home-actions">
    <button class="btn btn-secondary" onclick="newFlow()">📝 Start a full thought record</button>
  </div>

  ${state.records.some(r => r.draft) ? `
  <div class="card">
    <h2>Pick up a draft</h2>
    ${state.records.filter(r => r.draft).map(r => `
      <div class="recurring-item" style="display:flex;align-items:center;gap:10px">
        <span style="flex:1" class="sensitive">${esc(r.emotion)} · ${fmtDate(r.date)} ${fmtTime(r.createdAt)}</span>
        <button class="btn btn-quiet" onclick="completeDraft('${r.id}')">Complete →</button>
      </div>`).join("")}
  </div>` : ""}

  <div class="card">
    <h2>How a thought record works</h2>
    <p class="hint" style="margin-bottom:4px">1. Describe the situation and the emotion you felt.</p>
    <p class="hint" style="margin-bottom:4px">2. Catch the automatic thoughts — especially the hot one.</p>
    <p class="hint" style="margin-bottom:4px">3. Challenge the hot thought with critical questions.</p>
    <p class="hint" style="margin-bottom:0">4. Write a new, more helpful thought and see how the feeling shifts.</p>
  </div>`;
}
function focusQuick() { const el = $("#quick-card"); if (el) { el.scrollIntoView({ behavior: "smooth" }); $("#qc-emotion").focus(); } }
window.focusQuick = focusQuick;
function pickChip(btn) {
  const input = btn.closest(".card").querySelector("input[list]");
  input.value = btn.textContent;
  btn.parentElement.querySelectorAll(".chip").forEach(c => c.classList.toggle("selected", c === btn));
}
window.pickChip = pickChip;

/* ----- Flow steps ----- */
function sliderField(id, label, val, note) {
  return `
  <label class="field">${label}${note ? ` <span class="field-note">${note}</span>` : ""}</label>
  <div class="slider-row">
    <input type="range" id="${id}" min="0" max="100" value="${val}" oninput="flowInput('${id}')"/>
    <output class="slider-val" id="${id}-out">${val}%</output>
  </div>`;
}

function viewFlow() {
  if (!flow) return viewHome();
  const s = flow.step;
  const canNext = s !== 1 || flow.situation.trim() || flow.emotion.trim();
  const last = Object.keys(flow.questions).length;
  const rec = flowRecord();
  const delta = Number(flow.feelsTrue) - Number(flow.feelsTrueAfter);
  const lastQ = flow.suggested && flow.suggested.length ?
    flow.suggested.find(n => !(flow.questions[n] || "").trim()) : null;

  const steps = [viewStep1, viewStep2, viewStep3, viewStep4];
  return `
  <section class="card">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h2 style="font-size:16px">${flow.fromDraft ? "Completing draft" : "Thought record"}</h2>
      <span style="font-size:12.5px;color:var(--slate-400);font-weight:600">Step ${s} of 4</span>
    </div>
    <div style="display:flex;gap:5px;margin:10px 0 4px">
      ${[1, 2, 3, 4].map(i => `<div style="flex:1;height:5px;border-radius:3px;background:${i <= s ? "var(--teal-600)" : "var(--slate-200)"}"></div>`).join("")}
    </div>
    ${steps[s - 1]()}
    <div class="btn-row">
      ${s > 1 ? `<button class="btn btn-ghost" onclick="flowStep(-1)">Back</button>` : ""}
      ${s < 4
        ? `<button class="btn btn-primary" onclick="flowStep(1)" ${canNext ? "" : "disabled"}>Continue</button>`
        : `<button class="btn btn-primary" onclick="saveFlowRecord()">Save record</button>`}
    </div>
    ${flow.editingId && !flow.fromDraft ? `<button class="btn btn-quiet" style="width:100%;margin-top:6px" onclick="cancelEdit()">Cancel editing</button>` : ""}
  </section>`;
}
function flowStep(d) {
  if (d === 1 && flow.step === 1 && !(flow.situation.trim() || flow.emotion.trim())) return;
  if (d === 1 && flow.step === 2) {
    if (!flow.suggested) flow.suggested = suggestQuestions(flow.hotThought, flow.emotion);
  }
  flow.step = Math.min(4, Math.max(1, flow.step + d));
  window.scrollTo({ top: 0 });
  render();
}
window.flowStep = flowStep;
function cancelEdit() { flow = null; state.editingId = null; state.tab = "history"; render(); }
window.cancelEdit = cancelEdit;
window.__flow = () => flow;
window.__setFlow = f => { flow = f; };

function viewStep1() {
  return `
  <h2><span class="stepnum">1</span>Situation & emotion</h2>
  <p class="hint">What happened, where, who was there? Just the facts.</p>
  <label class="field" for="fl-date">Date</label>
  <input type="date" id="fl-date" value="${flow.date}" max="${todayISO()}" onchange="flowInput('fl-date')"/>
  <div class="field-head"><label for="fl-situation">Situation</label></div>
  <div class="input-with-mic">
    <textarea id="fl-situation" rows="3" placeholder="Describe the situation..." oninput="flowInput('fl-situation')">${esc(flow.situation)}</textarea>
    ${micHTML("fl-situation")}
  </div>
  <label class="field" for="fl-emotion">Emotion</label>
  <input id="fl-emotion" list="fl-emotions" autocomplete="off" placeholder="e.g. Anxious" value="${esc(flow.emotion)}" oninput="flowInput('fl-emotion')"/>
  <datalist id="fl-emotions">${EMOTIONS.map(e => `<option value="${e}">`).join("")}</datalist>
  <div class="chips">${EMOTIONS.map(e => `<button type="button" class="chip ${flow.emotion === e ? "selected" : ""}" onclick="flowEmotionChip('${e}')">${e}</button>`).join("")}</div>
  ${sliderField("fl-intensity", "Intensity of the emotion", flow.emotionIntensity)}
  <p class="hint" style="margin-top:6px">Everything is saved only in this browser.</p>`;
}
function flowEmotionChip(e) {
  flow.emotion = e;
  render();
  const el = $("#fl-emotion"); if (el) el.value = e;
}
window.flowEmotionChip = flowEmotionChip;

function viewStep2() {
  return `
  <h2><span class="stepnum">2</span>Thoughts</h2>
  <p class="hint">What went through your mind? Which thoughts stirred the emotion up?</p>
  <div class="field-head"><label for="fl-auto">Automatic thoughts that caused the emotion</label></div>
  <div class="input-with-mic">
    <textarea id="fl-auto" rows="4" placeholder="I thought..." oninput="flowInput('fl-auto')">${esc(flow.autoThoughts)}</textarea>
    ${micHTML("fl-auto")}
  </div>
  <div class="field-head"><label for="fl-hot">Hot thought <span class="field-note">the one thought most responsible for the emotion, in one sentence</span></label></div>
  <div class="input-with-mic">
    <input id="fl-hot" placeholder="e.g. I'm going to fail and everyone will see" value="${esc(flow.hotThought)}" oninput="flowInput('fl-hot')"/>
    ${micHTML("fl-hot")}
  </div>
  ${sliderField("fl-true", "Feels true", flow.feelsTrue)}
  <p class="hint" style="margin-top:6px">How much do you believe this thought right now?</p>`;
}

function viewStep3() {
  if (!flow.suggested) flow.suggested = suggestQuestions(flow.hotThought, flow.emotion);
  const sug = flow.suggested;
  const answered = Object.keys(flow.questions).filter(n => (flow.questions[n] || "").trim()).length;
  const rest = QUESTIONS.filter(q => !sug.includes(q.n));
  return `
  <h2><span class="stepnum">3</span>Challenge with critical questions</h2>
  <p class="hint">Pick questions that fit your hot thought — we've suggested a few. Answer them in your own words. <strong class="sensitive" style="color:var(--slate-800)">“${esc(flow.hotThought)}”</strong></p>
  <p class="hint" style="margin-top:-6px">${answered ? `${answered} question${answered > 1 ? "s" : ""} answered` : "Tap a question to select it."}</p>
  ${sug.map(n => qItem(n, true)).join("")}
  <details class="all-questions">
    <summary>All questions (${rest.length} more)</summary>
    <div class="q-list-mini">${rest.map(q => qItem(q.n, false)).join("")}</div>
  </details>`;
}
function qItem(n, recommended) {
  const q = getQ(n);
  const sel = (n in flow.questions);
  const open = sel;
  return `
  <div class="q-item ${sel ? "selected" : ""} ${recommended ? "recommended" : ""}" id="qi-${n}">
    <div class="q-head" onclick="toggleQ(${n})">
      <span class="q-num">${n}</span>
      <div>
        <div class="q-text">${esc(q.text)}</div>
        <span class="q-tag">${esc(q.style)}</span>
        ${recommended && !sel ? `<span class="q-tag" style="background:#fef3c7;color:#92400e">suggested</span>` : ""}
      </div>
    </div>
    ${open ? `
    <textarea class="sensitive" style="margin-top:10px" rows="3" placeholder="Your answer..." oninput="answerQ(${n}, this.value)">${esc(flow.questions[n] || "")}</textarea>` : ""}
  </div>`;
}
function toggleQ(n) {
  if (n in flow.questions) delete flow.questions[n];
  else flow.questions[n] = "";
  render();
}
window.toggleQ = toggleQ;
function answerQ(n, v) { flow.questions[n] = v; }
window.answerQ = answerQ;

function viewStep4() {
  const before = Number(flow.feelsTrue);
  const after = Number(flow.feelsTrueAfter);
  const delta = before - after;
  const answeredSug = (flow.suggested || []).filter(n => (flow.questions[n] || "").trim());
  const missing = (flow.suggested || []).find(n => !(flow.questions[n] || "").trim());
  const good = delta >= 10;
  return `
  <h2><span class="stepnum">4</span>New thought & re-rate</h2>
  <p class="hint">Looking back at your answers, what's a more balanced, helpful way to think about this?</p>
  <label class="field" for="fl-new">New, more helpful thought(s)</label>
  <textarea id="fl-new" rows="3" placeholder="A more helpful thought is..." oninput="flowInput('fl-new')">${esc(flow.newThought)}</textarea>
  ${sliderField("fl-true-after", "Feels true (new thought)", flow.feelsTrueAfter)}
  <label class="field" for="fl-emo-after">Emotion after <span class="field-note">same or a new one</span></label>
  <input id="fl-emo-after" list="fl-emotions" value="${esc(flow.emotionAfter)}" oninput="flowInput('fl-emo-after')"/>
  ${sliderField("fl-int-after", "Intensity of the emotion", flow.emotionAfterIntensity)}
  <label class="field" for="fl-plan">Action plan / needed behaviour <span class="field-note">(optional)</span></label>
  <textarea id="fl-plan" rows="2" placeholder="What will you do?" oninput="flowInput('fl-plan')">${esc(flow.actionPlan)}</textarea>

  <div class="feedback-box ${good ? "good" : "nudge"}">
    <h3>${good ? "🌱 Nice shift" : "💡 Gentle nudge"}</h3>
    ${good
      ? `<p>Your belief in the hot thought went <strong>true for ${before}% → ${after}%</strong> (−${delta} points). Notice how the new thought sits beside the old one, not against it.</p>`
      : `<p>Your belief moved <strong>true for ${before}% → ${after}%</strong> (−${Math.max(0, delta)} points). Sometimes one more question helps the shift land. ${missing ? `You haven't answered suggested question ${missing} yet — <button class="btn-quiet" style="display:inline;padding:0 2px" onclick="gotoQ(${missing})">take a look?</button>` : "Maybe re-read your answers to the questions you did answer — is there one you only half believe?"}</p>`}
  </div>`;
}
function gotoQ(n) {
  flow.step = 3;
  render();
  setTimeout(() => { const el = $(`#qi-${n}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 50);
}
window.gotoQ = gotoQ;

function flowInput(id) {
  const el = $("#" + id);
  if (!el) return;
  const map = {
    "fl-date": "date", "fl-situation": "situation", "fl-emotion": "emotion",
    "fl-auto": "autoThoughts", "fl-hot": "hotThought", "fl-new": "newThought",
    "fl-emo-after": "emotionAfter", "fl-plan": "actionPlan",
  };
  if (map[id]) flow[map[id]] = el.value;
  else if (id === "fl-intensity") { flow.emotionIntensity = Number(el.value); setSliderVal(el); }
  else if (id === "fl-true") { flow.feelsTrue = Number(el.value); setSliderVal(el); }
  else if (id === "fl-true-after") { flow.feelsTrueAfter = Number(el.value); setSliderVal(el); if (flow.step === 4) refreshFeedback(); }
  else if (id === "fl-int-after") { flow.emotionAfterIntensity = Number(el.value); setSliderVal(el); }
  if (id === "fl-emotion" || id === "fl-hot") { if (!flow.editingId) persistFlowDraft(); }
}
window.flowInput = flowInput;

function persistFlowDraft() {
  // keep a lightweight autosave of the in-progress flow so accidental refresh doesn't lose work
  try { sessionStorage.setItem("reframe.flow", JSON.stringify(flow)); } catch {}
}
function refreshFeedback() {
  const before = Number(flow.feelsTrue), after = Number(flow.feelsTrueAfter);
  const delta = before - after;
  const good = delta >= 10;
  const box = $("#app .feedback-box");
  if (!box) return;
  box.className = "feedback-box " + (good ? "good" : "nudge");
  box.querySelector("h3").textContent = good ? "🌱 Nice shift" : "💡 Gentle nudge";
  box.querySelector("p").innerHTML = good
    ? `Your belief in the hot thought went <strong>true for ${before}% → ${after}%</strong> (−${delta} points). Notice how the new thought sits beside the old one, not against it.`
    : `Your belief moved <strong>true for ${before}% → ${after}%</strong> (−${Math.max(0, delta)} points). Sometimes one more question helps the shift land. ${missingHtml()}`;
}
function missingHtml() {
  const missing = (flow.suggested || []).find(n => !(flow.questions[n] || "").trim());
  return missing ? `You haven't answered suggested question ${missing} yet — <button class="btn-quiet" style="display:inline;padding:0 2px" onclick="gotoQ(${missing})">take a look?</button>` : "Maybe re-read your answers to the questions you did answer — is there one you only half believe?";
}

/* ----- History ----- */
function viewHistory() {
  const q = state.search.trim().toLowerCase();
  const records = state.records.filter(r => {
    if (!q) return true;
    return [r.situation, r.autoThoughts, r.hotThought, r.newThought, r.emotion, r.emotionAfter, r.actionPlan]
      .some(f => (f || "").toLowerCase().includes(q));
  });
  return `
  <section>
    <input class="search-input" type="search" placeholder="🔍 Search situation, thoughts, emotion..." value="${esc(state.search)}"
      oninput="searchInput(this.value)"/>
    <div id="history-list">${historyList(records)}</div>
  </section>`;
}
function historyList(records) {
  if (records.length === 0) {
    return `<div class="empty"><div class="big">🗒️</div>${state.records.length === 0 ? "No records yet. Your thought records will appear here." : "Nothing matches that search."}</div>`;
  }
  return records.map(r => recordItem(r)).join("");
}
function searchInput(v) { state.search = v; renderList(); }
window.searchInput = searchInput;
function renderList() {
  const q = state.search.trim().toLowerCase();
  const records = state.records.filter(r => !q || [r.situation, r.autoThoughts, r.hotThought, r.newThought, r.emotion, r.emotionAfter].some(f => (f || "").toLowerCase().includes(q)));
  $("#history-list").innerHTML = historyList(records);
}
window.renderList = renderList;

function recordItem(r) {
  const open = state.expandedId === r.id;
  const title = r.draft ? (r.situation || "Quick note") : (r.hotThought || r.situation || "Thought record");
  const sub = r.draft ? `Draft · ${fmtTime(r.createdAt)}` : `${r.emotion || "?"} ${r.emotionIntensity ?? "?"}% → ${r.emotionAfter || "?"} ${r.emotionAfterIntensity ?? "?"}%`;
  return `
  <article class="record-item ${open ? "open" : ""}">
    <div class="record-head" onclick="toggleRecord('${r.id}')">
      <span class="chev">›</span>
      <div class="record-title">
        <div class="r-date">${fmtDate(r.date)}${r.draft ? " · DRAFT" : ""}</div>
        <div class="r-main sensitive">${esc(title)}</div>
        <div class="r-sub">${esc(sub)}</div>
      </div>
      <span class="badge ${r.draft ? "draft" : "complete"}">${r.draft ? "DRAFT" : "DONE"}</span>
    </div>
    ${open ? `<div class="record-body open">${recordBody(r)}</div>` : ""}
  </article>`;
}
function toggleRecord(id) {
  state.expandedId = state.expandedId === id ? null : id;
  render();
}
window.toggleRecord = toggleRecord;

function recordBody(r) {
  const qa = Object.entries(r.questions || {}).filter(([, a]) => (a || "").trim()).sort((a, b) => a[0] - b[0]);
  return `
  ${r.draft ? `
    <div class="detail-sec"><div class="d-value sensitive">${esc(r.situation || "")}</div></div>
    <div class="detail-sec"><div class="d-label">Emotion</div>
      <div class="intensity-line"><span class="sensitive">${esc(r.emotion)}</span><span class="intensity-pill">${r.emotionIntensity}%</span></div></div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="completeDraft('${r.id}')">Complete</button>
      <button class="btn btn-ghost" onclick="askDelete('${r.id}')">Delete</button>
    </div>
  ` : `
    ${sec("Date", esc(fmtDate(r.date)))}
    ${r.situation ? sec("Situation", esc(r.situation)) : ""}
    ${r.emotion ? sec("Emotion", `<div class="intensity-line"><span class="sensitive">${esc(r.emotion)}</span><span class="intensity-pill">${r.emotionIntensity}%</span></div>`) : ""}
    ${r.autoThoughts ? sec("Automatic thoughts", esc(r.autoThoughts)) : ""}
    ${r.hotThought ? sec("Hot thought", esc(r.hotThought) + `<div class="intensity-line" style="margin-top:4px"><span class="intensity-pill">feels true ${r.feelsTrue}%</span></div>`) : ""}
    ${qa.length ? `<div class="detail-sec"><div class="d-label">Challenges</div>${qa.map(([n, a]) => {
      const q = getQ(Number(n));
      return `<div class="qa-block"><div class="qa-q">${n}. ${esc(q ? q.text : "")}</div><div class="qa-a sensitive">${esc(a)}</div></div>`;
    }).join("")}</div>` : ""}
    ${r.newThought ? sec("New thought", esc(r.newThought) + `<div class="intensity-line" style="margin-top:4px"><span class="intensity-pill">feels true ${r.feelsTrueAfter}%</span></div>`) : ""}
    ${r.emotionAfter ? sec("Emotion after", `<div class="intensity-line"><span class="sensitive">${esc(r.emotionAfter)}</span><span class="intensity-pill">${r.emotionAfterIntensity}%</span></div>`) : ""}
    ${r.actionPlan ? sec("Action plan", esc(r.actionPlan)) : ""}
    <div class="btn-row" style="flex-wrap:nowrap">
      <button class="btn btn-secondary" onclick="exportPDF('${r.id}')">🖨️ PDF</button>
      <button class="btn btn-secondary" onclick="copyRecord('${r.id}')">📋 Copy</button>
      <button class="btn btn-ghost" onclick="editRecord('${r.id}')">✏️ Edit</button>
      <button class="btn btn-ghost" onclick="askDelete('${r.id}')">🗑️</button>
    </div>
  `}`;
}
function sec(label, value) {
  return `<div class="detail-sec"><div class="d-label">${label}</div><div class="d-value sensitive">${value}</div></div>`;
}
function editRecord(id) {
  const r = state.records.find(x => x.id === id);
  if (!r) return;
  newFlow({ ...r, draft: false, fromDraft: false });
}
window.editRecord = editRecord;

/* ----- Insights ----- */
function viewInsights() {
  const done = state.records.filter(r => !r.draft);
  const drops = done.filter(r => r.emotionIntensity != null && r.emotionAfterIntensity != null);
  const emoDrop = drops.length ? Math.round(drops.reduce((s, r) => s + (r.emotionIntensity - r.emotionAfterIntensity), 0) / drops.length) : 0;
  const beliefDrops = done.filter(r => r.feelsTrue != null && r.feelsTrueAfter != null);
  const beliefDrop = beliefDrops.length ? Math.round(beliefDrops.reduce((s, r) => s + (r.feelsTrue - r.feelsTrueAfter), 0) / beliefDrops.length) : 0;

  // streak
  const days = new Set(state.records.map(r => r.date));
  let streak = 0;
  const d = new Date();
  while (days.has(toISO(d))) { streak++; d.setDate(d.getDate() - 1); }
  // allow today missing but yesterday present
  if (streak === 0) {
    d.setDate(new Date().getDate() - 1);
    while (days.has(toISO(d))) { streak++; d.setDate(d.getDate() - 1); }
  }

  const chart = done.slice(0, 8).reverse();
  const maxI = 100;
  const styleCounts = {};
  done.forEach(r => {
    Object.entries(r.questions || {}).forEach(([n, a]) => {
      if ((a || "").trim()) {
        const q = getQ(Number(n));
        if (q) styleCounts[q.style] = (styleCounts[q.style] || 0) + 1;
      }
    });
  });
  const styleArr = Object.entries(styleCounts).sort((a, b) => b[1] - a[1]);
  const maxStyle = styleArr.length ? styleArr[0][1] : 1;

  const hotMap = new Map();
  done.forEach(r => {
    const k = (r.hotThought || "").trim().toLowerCase();
    if (!k) return;
    const list = hotMap.get(k) || [];
    list.push(r);
    hotMap.set(k, list);
  });
  const recurring = [...hotMap.entries()].filter(([k, list]) => list.length >= 2)
    .sort((a, b) => b[1].length - a[1].length).slice(0, 6);

  // 28-day activity strip
  const today = new Date();
  const dots = [];
  for (let i = 27; i >= 0; i--) {
    const dd = new Date(today);
    dd.setDate(today.getDate() - i);
    const iso = toISO(dd);
    const n = state.records.filter(r => r.date === iso).length;
    dots.push(`<span class="dot ${n === 0 ? "" : n === 1 ? "l1" : n <= 3 ? "l2" : "l3"}" title="${iso}: ${n} record${n === 1 ? "" : "s"}"></span>`);
  }

  return `
  <section>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Records</div><div class="stat-value">${state.records.length}</div><div class="stat-sub">${state.records.filter(r => r.draft).length} drafts</div></div>
      <div class="stat-card"><div class="stat-label">Avg emotion drop</div><div class="stat-value">${emoDrop ? "−" + emoDrop + "pt" : "—"}</div><div class="stat-sub">intensity before → after</div></div>
      <div class="stat-card"><div class="stat-label">Avg belief drop</div><div class="stat-value">${beliefDrop ? "−" + beliefDrop + "pt" : "—"}</div><div class="stat-sub">feels-true before → after</div></div>
      <div class="stat-card"><div class="stat-label">Streak</div><div class="stat-value">${streak}d</div><div class="stat-sub">consecutive days</div></div>
    </div>

    <div class="card chart-card">
      <h2>Emotion intensity before → after</h2>
      ${chart.length ? `
      <div class="bar-group">
        ${chart.map(r => {
          const hb = Math.round((r.emotionIntensity / maxI) * 100);
          const ha = Math.round(((r.emotionAfterIntensity ?? 0) / maxI) * 100);
          return `<div class="bar-pair" title="${esc(fmtDate(r.date))}: ${r.emotionIntensity}% → ${r.emotionAfterIntensity ?? "?"}%">
            <div class="bars">
              <div class="bar before" style="height:${hb}%"></div>
              <div class="bar after" style="height:${ha}%"></div>
            </div>
            <span class="bar-label">${esc((r.date || "").slice(5))}</span>
          </div>`;
        }).join("")}
      </div>
      <div class="legend"><span class="l-before">Before</span><span class="l-after">After</span></div>` : `<p class="hint">Complete a thought record to see this chart.</p>`}
    </div>

    <div class="card chart-card">
      <h2>Most frequent thinking styles</h2>
      ${styleArr.length ? `<div class="style-bars">${styleArr.map(([s, c]) => `
        <div class="style-row">
          <div class="style-name"><span>${esc(s)}</span><span>${c}</span></div>
          <div class="style-track"><div class="style-fill" style="width:${Math.round((c / maxStyle) * 100)}%"></div></div>
        </div>`).join("")}</div>` : `<p class="hint">Answer critical questions and the styles you challenge most will show up here.</p>`}
    </div>

    <div class="card chart-card">
      <h2>Top recurring hot thoughts</h2>
      ${recurring.length ? recurring.map(([k, list]) => `
        <div class="recurring-item"><span class="count">${list.length}×</span><span class="sensitive">${esc(list[0].hotThought)}</span></div>`).join("")
        : `<p class="hint">Hot thoughts that show up 2 or more times will appear here.</p>`}
    </div>

    <div class="card chart-card">
      <h2>Last 28 days</h2>
      <div class="strip">${dots.join("")}</div>
    </div>
  </section>`;
}
function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ----- Settings ----- */
function viewSettings() {
  return `
  <section class="card">
    <h2>Settings</h2>
    <div class="set-row">
      <div><div class="s-label">Privacy blur</div><div class="s-sub">Blur all personal text until you hover it</div></div>
      <button class="toggle-wrap" style="background:${state.privacy ? "var(--teal-700)" : "var(--slate-200)"}" aria-pressed="${state.privacy}" onclick="togglePrivacy()"><span class="toggle-knob" style="${state.privacy ? "transform:translateX(16px)" : ""}"></span></button>
    </div>
    <div class="set-row">
      <div><div class="s-label">Voice input</div><div class="s-sub">${speechOK ? "Available — tap the 🎙️ button next to a field" : "Not available in this browser"}</div></div>
    </div>
    <div class="set-row">
      <div><div class="s-label">Records stored</div><div class="s-sub">${state.records.length} in this browser</div></div>
    </div>
    <div class="set-row">
      <div><div class="s-label">Delete all data</div><div class="s-sub">Permanently removes every record and draft from this browser</div></div>
      <button class="btn btn-danger" onclick="askDeleteAll()">Delete</button>
    </div>
    <p class="hint" style="margin-top:16px">Reframe is a self-help companion, not a substitute for professional care. If you're in crisis, please contact a local crisis line or professional.</p>
    <p class="hint">Based on the Psyvel thought-record schema and critical questions list.</p>
  </section>`;
}

/* ---------- Render ---------- */
function render() {
  const views = { home: viewHome, history: viewHistory, insights: viewInsights, settings: viewSettings, flow: viewFlow };
  const app = $("#app");
  app.innerHTML = viewHeader() + (views[state.tab] || viewHome)();
  app.querySelectorAll('input[type="range"]').forEach(setSliderVal);
  document.body.classList.toggle("privacy-on", state.privacy);
}

loadAll();
if (!flow) {
  try {
    const saved = sessionStorage.getItem("reframe.flow");
    if (saved) {
      const f = JSON.parse(saved);
      if (f && f.situation) { flow = f; state.tab = "flow"; }
      sessionStorage.removeItem("reframe.flow");
    }
  } catch {}
}
render();
