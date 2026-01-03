let DB = null;
let selectedCat = null;
let fearMode = false;
let difficulty = "medium";

// no-repeat tracking
const used = new Map(); // Map<string, Set<string>>
const usedFear = new Set();

let timerId = null;
let timeLeft = 0;

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

function pickRandom(arr){
  return arr[Math.floor(Math.random() * arr.length)];
}

function tremble(){
  panelEl.classList.remove("tremble");
  void panelEl.offsetWidth;
  panelEl.classList.add("tremble");
}

function stopTimer(){
  if (timerId) clearInterval(timerId);
  timerId = null;
  timeLeft = 0;
}

function startTimer(){
  stopTimer();
  timeLeft = 20;
  updateMetaTimer();

  timerId = setInterval(() => {
    timeLeft -= 1;
    updateMetaTimer();
    if (timeLeft <= 0){
      stopTimer();
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

function normalizeCat(x){
  return String(x ?? "").trim().toUpperCase();
}
function normalizeDiff(x){
  return String(x ?? "").trim().toLowerCase();
}

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

      // allow slight mismatches like "THE GEEK" by checking containment too
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
    return;
  }

  qEl.textContent = item.q;
  aEl.textContent = item.a;
  aEl.hidden = true;
  showABtn.disabled = false;

  startTimer();
}

fearBtn.addEventListener("click", () => setFearMode(!fearMode));
newQBtn.addEventListener("click", () => nextQuestion());

showABtn.addEventListener("click", () => {
  aEl.hidden = false;
  stopTimer();
  metaEl.textContent = metaEl.dataset.base || metaEl.textContent;
});

difficultySelect.addEventListener("change", () => {
  difficulty = difficultySelect.value;
  if (!fearMode && selectedCat) nextQuestion();
});

async function init(){
  const res = await fetch("questions.json", { cache: "no-store" }); // helps against GitHub Pages caching
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
