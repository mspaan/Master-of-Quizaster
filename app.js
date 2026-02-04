let DB = null;
let selectedCat = null;
let fearMode = false;
let difficulty = "medium";

// no-repeat tracking (Session)
const used = new Map();     // key: diff|cat -> Set(keys)
const usedFear = new Set(); // Brainfreezer session set

let timerId = null;
let timeLeft = 0;
const TOTAL_TIME = 30;

// WebAudio
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
const randomCatBtn = document.getElementById("randomCatBtn");

// Timer UI
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

function normalizeCat(x){ return String(x ?? "").trim().toUpperCase(); }
function normalizeDiff(x){ return String(x ?? "").trim().toLowerCase(); }

/* -------------------- AUDIO (WebAudio) -------------------- */
function ensureAudio(){
  try{
    if (!audioCtx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended"){
      audioCtx.resume().catch(()=>{});
    }
    audioUnlocked = true;
    return true;
  } catch {
    audioUnlocked = false;
    return false;
  }
}

function unlockAudioHard(){
  if (!ensureAudio() || !audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.frequency.value = 440;
  g.gain.value = 0.00001; // almost silent
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.02);
}

function beep({freq=800, duration=0.06, type="triangle", gain=0.08} = {}){
  if (!audioUnlocked || !audioCtx) return;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(g);
  g.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.03);
}

function tickSound(){
  beep({freq: 1400, duration: 0.035, type: "square", gain: 0.06});
}

function timeUpSound(){
  beep({freq: 660, duration: 0.14, type: "sine", gain: 0.10});
  setTimeout(() => beep({freq: 440, duration: 0.16, type: "sine", gain: 0.10}), 150);
}

function installAudioUnlock(){
  const unlock = () => {
    unlockAudioHard();
    document.removeEventListener("pointerdown", unlock);
    document.removeEventListener("touchstart", unlock);
    document.removeEventListener("mousedown", unlock);
  };
  document.addEventListener("pointerdown", unlock, { once: true });
  document.addEventListener("touchstart", unlock, { once: true, passive: true });
  document.addEventListener("mousedown", unlock, { once: true });
}

/* -------------------- TIMER -------------------- */
function updateTimeUI(seconds){
  const s = Math.max(0, Math.min(TOTAL_TIME, seconds));
  timeNumEl.textContent = String(s);
  const pct = (s / TOTAL_TIME) * 100;
  timeFillEl.style.width = `${pct}%`;
}

function stopTimer(){
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function startTimer(){
  stopTimer();
  timeLeft = TOTAL_TIME;
  updateMetaTimer();
  updateTimeUI(timeLeft);

  timerId = setInterval(() => {
    timeLeft -= 1;

    if (timeLeft > 0) tickSound();

    updateMetaTimer();
    updateTimeUI(timeLeft);

    if (timeLeft <= 0){
      clearInterval(timerId);
      timerId = null;

      timeUpSound();
      aEl.hidden = false; // auto reveal
    }
  }, 1000);
}

function updateMetaTimer(){
  const base = metaEl.dataset.base || metaEl.textContent || "";
  metaEl.textContent = `${base} • ${String(timeLeft).padStart(2,"0")}s`;
}

function setMetaBase(text){
  metaEl.dataset.base = text;
  metaEl.textContent = text;
}

/* -------------------- UI RESET -------------------- */
function deselectCategoryAndStop(){
  stopTimer();

  selectedCat = null;
  document.querySelectorAll(".cat").forEach(x => x.classList.remove("active"));

  setMetaBase("Pick a category.");
  qEl.textContent = "—";
  aEl.hidden = true;
  showABtn.disabled = true;

  // New question only enabled when Brainfreezer is on (because it doesn't need category)
  newQBtn.disabled = fearMode ? false : true;

  updateTimeUI(TOTAL_TIME);
}

function showReadyState(){
  stopTimer();
  showABtn.disabled = true;
  aEl.hidden = true;
  qEl.textContent = "Ready. Tap “New question”.";
  updateTimeUI(TOTAL_TIME);
}

/* -------------------- NO-REPEAT (SESSION HARD) -------------------- */
function ensureUsedSet(key){
  if (!used.has(key)) used.set(key, new Set());
  return used.get(key);
}

function getNonRepeating(pool, keyFn, usedSet){
  if (pool.length === 0) return null;

  // Hard session rule: no repeats; if exhausted, stop
  if (usedSet.size >= pool.length) return null;

  let tries = 0;
  while (tries < 250){
    const item = pickRandom(pool);
    const k = keyFn(item);
    if (!usedSet.has(k)){
      usedSet.add(k);
      return item;
    }
    tries++;
  }

  // If we couldn't find a new one, consider it exhausted
  return null;
}

/* -------------------- GAME -------------------- */
function setFearMode(on){
  fearMode = on;
  appEl.classList.toggle("fearMode", on);
  fearBtn.classList.toggle("isOn", on);
  fearBtn.setAttribute("aria-pressed", on ? "true" : "false");
  tremble();

  if (on){
    // Brainfreezer doesn't need category
    newQBtn.disabled = false;
    showReadyState();
    setMetaBase("BRAINFREEZER");
  } else {
    // leaving brainfreezer: require a category again
    if (selectedCat){
      newQBtn.disabled = false;
      showReadyState();
      // meta already handled by category selection; keep it
    } else {
      deselectCategoryAndStop();
    }
  }
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

    // NEW: selecting a category does NOT auto-draw a question
    btn.addEventListener("click", () => {
      ensureAudio();
      if (fearMode) setFearMode(false);

      selectedCat = c.id;

      document.querySelectorAll(".cat").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");

      newQBtn.disabled = false;

      // Update meta with pool size for current difficulty
      const diffNeedle = normalizeDiff(difficulty);
      const catNeedle = normalizeCat(selectedCat);
      const allQs = Array.isArray(DB.questions) ? DB.questions : [];
      const poolCount = allQs.filter(q => {
        const qc = normalizeCat(q.cat);
        const qd = normalizeDiff(q.diff);
        const catMatch = (qc === catNeedle) || qc.includes(catNeedle) || catNeedle.includes(qc);
        return catMatch && (qd === diffNeedle);
      }).length;

      setMetaBase(`Category: ${c.name} • ${diffNeedle.toUpperCase()} (${poolCount})`);
      showReadyState();
    });

    catsEl.appendChild(btn);
  });
}

function randomCategoryPick(){
  if (!DB) return null;

  const diffNeedle = normalizeDiff(difficulty);
  const allQs = Array.isArray(DB.questions) ? DB.questions : [];

  const catsWithQs = (Array.isArray(DB.categories) ? DB.categories : [])
    .map(c => c.id)
    .filter(catId => {
      const catNeedle = normalizeCat(catId);
      return allQs.some(q => {
        const qc = normalizeCat(q.cat);
        const qd = normalizeDiff(q.diff);
        const catMatch = (qc === catNeedle) || qc.includes(catNeedle) || catNeedle.includes(qc);
        return catMatch && (qd === diffNeedle);
      });
    });

  if (catsWithQs.length === 0) return null;
  return pickRandom(catsWithQs);
}

function randomCategoryQuestion(){
  if (!DB) return;
  if (fearMode) setFearMode(false);

  const pick = randomCategoryPick();
  if (!pick){
    deselectCategoryAndStop();
    qEl.textContent = "No questions found for this difficulty.";
    return;
  }

  selectedCat = pick;

  document.querySelectorAll(".cat").forEach(x => {
    x.classList.toggle("active", normalizeCat(x.dataset.c) === normalizeCat(pick));
  });

  newQBtn.disabled = false;

  // Update meta with pool size and show ready state (NO auto question)
  const diffNeedle = normalizeDiff(difficulty);
  const catNeedle = normalizeCat(selectedCat);
  const allQs = Array.isArray(DB.questions) ? DB.questions : [];
  const poolCount = allQs.filter(q => {
    const qc = normalizeCat(q.cat);
    const qd = normalizeDiff(q.diff);
    const catMatch = (qc === catNeedle) || qc.includes(catNeedle) || catNeedle.includes(qc);
    return catMatch && (qd === diffNeedle);
  }).length;

  const catObj = DB.categories.find(c => normalizeCat(c.id) === normalizeCat(selectedCat));
  const catName = catObj ? catObj.name : selectedCat;

  setMetaBase(`Category: ${catName} • ${diffNeedle.toUpperCase()} (${poolCount})`);
  showReadyState();
}

function nextQuestion(){
  if (!DB) return;

  stopTimer();

  let item = null;

  if (fearMode){
    const pool = Array.isArray(DB.fearQuestions) ? DB.fearQuestions : [];
    item = getNonRepeating(pool, i => `BF:${i.q}`, usedFear);

    setMetaBase(`BRAINFREEZER (${pool.length})`);
    tremble();

    if (!item){
      qEl.textContent = "All Brainfreezer questions used (this session).";
      aEl.hidden = true;
      showABtn.disabled = true;
      newQBtn.disabled = true;
      updateTimeUI(TOTAL_TIME);
      return;
    }
  } else {
    if (!selectedCat){
      deselectCategoryAndStop();
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

    item = getNonRepeating(
      pool,
      i => `${normalizeCat(i.cat)}|${normalizeDiff(i.diff)}|${i.q}`,
      usedSet
    );

    const catObj = DB.categories.find(c => c.id === selectedCat);
    const catName = catObj ? catObj.name : selectedCat;
    setMetaBase(`Category: ${catName} • ${diffNeedle.toUpperCase()} (${pool.length})`);

    if (!item){
      qEl.textContent = "All questions used for this category & difficulty (this session).";
      aEl.hidden = true;
      showABtn.disabled = true;
      newQBtn.disabled = true;
      updateTimeUI(TOTAL_TIME);
      return;
    }
  }

  // Render Q/A
  qEl.textContent = item.q;
  aEl.textContent = item.a;
  aEl.hidden = true;
  showABtn.disabled = false;

  // Start the 30s timer only when a question is actually drawn
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

randomCatBtn.addEventListener("click", () => {
  ensureAudio();
  randomCategoryQuestion();
});

showABtn.addEventListener("click", () => {
  ensureAudio();
  aEl.hidden = false;
  stopTimer();
  metaEl.textContent = metaEl.dataset.base || metaEl.textContent;
  updateTimeUI(0);
});

/*
  As soon as difficulty dropdown is touched/opened:
  deselect category + stop timer + do NOT draw a new question.
*/
difficultySelect.addEventListener("pointerdown", () => {
  deselectCategoryAndStop();
});
difficultySelect.addEventListener("focus", () => {
  deselectCategoryAndStop();
});
difficultySelect.addEventListener("change", () => {
  ensureAudio();
  difficulty = difficultySelect.value;
  deselectCategoryAndStop();
});

/* -------------------- INIT -------------------- */
async function init(){
  installAudioUnlock();

  const res = await fetch("questions.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} loading questions.json`);
  DB = await res.json();

  renderCats();
  deselectCategoryAndStop();
  updateTimeUI(TOTAL_TIME);
}

init().catch((e) => {
  console.error(e);
  setMetaBase("Error: could not load questions.json");
  qEl.textContent = String(e?.message || e);
});
