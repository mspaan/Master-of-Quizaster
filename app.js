let DB = null;
let selectedCat = null;
let fearMode = false;
let difficulty = "medium";

// no-repeat tracking
const used = new Map(); // Map<string, Set<string>>
const usedFear = new Set();

let timerId = null;
let timeLeft = 0;
const TOTAL_TIME = 20;

// audio (WebAudio)
let audioCtx = null;
let audioUnlocked = false;

const appEl = document.getElementById("app");
const catsEl = document.getElementById("cats");
const metaEl = document.getElementById("meta");
const qEl = document.getElementById("q");
const aEl = document.getElementById("a");
const showABtn = document.getElementById("showA");
const newQBtn = document.getElementById("newQ");
const fearBtn = document.getElementById("fearBtn");
const panelEl = document.getElementById("panel");
const difficultySelect = document.getElementById("difficultySelect");

// NEW: timer UI
const timeFillEl = document.getElementById("timeFill");
const timeNumEl = document.getElementById("timeNum");

function pickRandom(arr){
  return arr[Math.floor(Math.random() * arr.length)];
}

function tremble(){
  panelEl.classList.remove("tremble");
  void panelEl.offsetWidth;
  panelEl.classList.add("tremble");
}

function normalizeCat(x){
  return String(x ?? "").trim().toUpperCase();
}
function normalizeDiff(x){
  return String(x ?? "").trim().toLowerCase();
}

/* -------------------- AUDIO -------------------- */
function ensureAudio(){
  // Call this only after a user gesture (click/tap)
  if (!audioCtx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === "suspended"){
    audioCtx.resume().catch(() => {});
  }
  audioUnlocked = !!audioCtx;
}

function beep({freq=800, duration=0.05, type="sine", gain=0.04} = {}){
  if (!audioUnlocked || !audioCtx) return;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(g);
  g.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function tickSound(){
  // light “tick”
  beep({freq: 1100, duration: 0.03, type: "square", gain: 0.02});
}

function timeUpSound(){
  // “time up” double-beep
  beep({freq: 520, duration: 0.10, type: "sine", gain: 0.05});
  setTimeout(() => beep({freq: 380, duration: 0.12, type: "sine", gain: 0.05}), 120);
}

/* -------------------- TIMER -------------------- */
function stopTimer(){
  if (timerId) clearInterval(timerId);
  timerId = null;
  timeLeft = 0;
  updateTimeUI(0);
}

function updateTimeUI(seconds){
  const s = Math.max(0, Math.min(TOTAL_TIME, seconds));
  timeNumEl.textContent = String(s);
  const pct = (s / TOTAL_TIME) * 100;
  timeFillEl.style.width = `${pct}%`;
}

function startTimer(){
  stopTimer();
  timeLeft = TOTAL_TIME;
  updateMetaTimer();
  updateTimeUI(timeLeft);

  // immediate tick feel? (no, start on first second)
  timerId = setInterval(() => {
    timeLeft -= 1;

    // tick for each second while time remains
    if (timeLeft > 0) tickSound();

    updateMetaTimer();
    updateTimeUI(timeLeft);

    if (timeLeft <= 0){
      clearInterval(timerId);
      timerId = null;

      // time-up sound + auto reveal answer
      timeUpSound();
      aEl.hidden = false;
    }
  }, 1000);
}

function updateMetaTimer(){
  const base = metaEl.dataset.base || metaEl.textContent || "";
  // keep same style, just append seconds
  metaEl.textContent = `${base} • ${String(timeLeft).padStart(2,"0")}s`;
}

function setMetaBase(text){
  metaEl.dataset.base = text;
  metaEl.textContent = text;
}

/* -------------------- GAME -------------------- */
function setFearMode(on){
  fearMode = on;
  appEl.classList.toggle("fearMode", on);
  fearBtn.classList.toggle("isOn", on);
  fearBtn.setAttribute("aria-pressed", on ? "true" : "false");
  tremble();

  if (on) nextQuestion();
  else if (selectedCat) nextQuestion();
  else resetQuestionText();
}

function resetQuestionText(){
  stopTimer();
  setMetaBase("Pick a category.");
  qEl.textContent = "—";
  aEl.hidden = true;
  showABtn.disabled = true;
  newQBtn.disabled = selectedCat ? false : true;
  updateTimeUI(TOTAL_TIME);
  timeNumEl.textContent = String(TOTAL_TIME);
}

function ensureUsedSet(key){
  if (!used.has(key)) used.set(key, new Set());
  return used.get(key);
}

function getNonRepeating(pool, keyFn, usedSet){
  if (pool.length === 0) return null;
  if (usedSet.size >= pool.length) usedSet.clear();

  let tries = 0;
  while (tries < 200){
    const item = pickRandom(pool);
    const k = keyFn(item);
    if (!usedSet.has(k)){
      usedSet.add(k);
      return item;
    }
    tries++;
  }
  const item = pickRandom(pool);
  usedSet.add(keyFn(item));
  return item;
}

function renderCats(){
  catsEl.innerHTML = "";

  DB.categories.forEach(c => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat";
    btn.dataset.c = c.id;

    btn.innerHTML = `
      <div class="left">
        <div class="name">${c.name}</div>
        <div class="tag">${c.tag}</div>
      </div>
      <div class="iconWrap">${c.icon}</div>
    `;

    btn.addEventListener("click", () => {
      ensureAudio();
      selectedCat = c.id;
      document.querySelectorAll(".cat").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      newQBtn.disabled = false;
      nextQuestion();
    });

    catsEl.appendChild(btn);
  });
}

function nextQuestion(){
  if (!DB) return;

  stopTimer();

  let item = null;

  if (fearMode){
    const pool = Array.isArray(DB.fearQuestions) ? DB.fearQuestions : [];
    item = getNonRepeating(pool, i => `FEAR:${i.q}`, usedFear);
    setMetaBase(`FEAR QUESTION (${pool.length})`);
    tremble();
  } else {
    if (!selectedCat){
      resetQuestionText();
      return;
    }

    const catNeedle = normalizeCat(selectedCat);
    const diffNeedle = normalizeDiff(difficulty);

    const pool = (Array.isArray(DB.questions) ? DB.questions : []).filter(q => {
      const qc = normalizeCat(q.cat);
      const qd = normalizeDiff(q.diff);
      const catMatch = (qc === catNeedle) || qc.includes(catNeedle) || catNeedle.includes(qc);
      const diffMatch = (qd === diffNeedle);
      return catMatch && diffMatch;
    });

    const key = `${diffNeedle}|${catNeedle}`;
    const usedSet = ensureUsedSet(key);

    item = getNonRepeating(pool, i => `${normalizeCat(i.cat)}|${normalizeDiff(i.diff)}|${i.q}`, usedSet);

    const catObj = DB.categories.find(c => c.id === selectedCat);
    const catName = catObj ? catObj.name : selectedCat;
    setMetaBase(`Category: ${catName} • ${diffNeedle.toUpperCase()} (${pool.length})`);
  }

  if (!item){
    qEl.textContent = "No questions found for this difficulty.";
    aEl.hidden = true;
    showABtn.disabled = true;
    updateTimeUI(TOTAL_TIME);
    timeNumEl.textContent = String(TOTAL_TIME);
    return;
  }

  qEl.textContent = item.q;
  aEl.textContent = item.a;
  aEl.hidden = true;
  showABtn.disabled = false;

  startTimer();
}

/* -------------------- EVENTS -------------------- */
fearBtn.addEventListener("click", () => {
  ensureAudio();
  setFearMode(!fearMode);
});

newQBtn.addEventListener("click", () => {
  ensureAudio();
  nextQuestion();
});

showABtn.addEventListener("click", () => {
  ensureAudio();
  aEl.hidden = false;
  stopTimer();
  metaEl.textContent = metaEl.dataset.base || metaEl.textContent;
  updateTimeUI(0);
});

difficultySelect.addEventListener("change", () => {
  ensureAudio();
  difficulty = difficultySelect.value;
  if (!fearMode && selectedCat) nextQuestion();
});

/* -------------------- INIT -------------------- */
async function init(){
  const res = await fetch("questions.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} loading questions.json`);
  DB = await res.json();
  renderCats();
  resetQuestionText();
}

init().catch((e) => {
  console.error(e);
  setMetaBase("Error: could not load questions.json");
  qEl.textContent = String(e?.message || e);
});
