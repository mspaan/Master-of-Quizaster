let DB = null;
let selectedCat = null;
let fearMode = false;
let difficulty = "medium";

// no-repeat tracking: key = `${diff}|${cat}` -> Set(questionKey)
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

  // show timer in meta (without redesign)
  updateMetaTimer();

  timerId = setInterval(() => {
    timeLeft -= 1;
    updateMetaTimer();

    if (timeLeft <= 0){
      stopTimer();
      // auto reveal answer
      aEl.hidden = false;
    }
  }, 1000);
}

function updateMetaTimer(){
  // keep existing meta text + add countdown
  const base = metaEl.dataset.base || metaEl.textContent || "";
  metaEl.textContent = `${base} • ${String(timeLeft).padStart(2,"0")}s`;
}

function setMetaBase(text){
  metaEl.dataset.base = text;
  metaEl.textContent = text;
}

function setFearMode(on){
  fearMode = on;
  appEl.classList.toggle("fearMode", on);
  fearBtn.classList.toggle("isOn", on);
  fearBtn.setAttribute("aria-pressed", on ? "true" : "false");
  tremble();

  // draw immediately if possible
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
  // fallback
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
    const pool = DB.fearQuestions;
    item = getNonRepeating(pool, i => `FEAR:${i.q}`, usedFear);
    setMetaBase("FEAR QUESTION");
    tremble();
  } else {
    if (!selectedCat){
      resetQuestionText();
      return;
    }

    const pool = DB.questions.filter(q => q.cat === selectedCat && q.diff === difficulty);
    const key = `${difficulty}|${selectedCat}`;
    const usedSet = ensureUsedSet(key);

    item = getNonRepeating(pool, i => `${i.cat}|${i.diff}|${i.q}`, usedSet);

    const catObj = DB.categories.find(c => c.id === selectedCat);
    const catName = catObj ? catObj.name : selectedCat;
    setMetaBase(`Category: ${catName} • ${difficulty.toUpperCase()}`);
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
  // stop timer when manually revealed (feels fair)
  stopTimer();
  // keep meta base text without countdown
  metaEl.textContent = metaEl.dataset.base || metaEl.textContent;
});

difficultySelect.addEventListener("change", () => {
  difficulty = difficultySelect.value;
  // do not change design, but refresh question pool
  if (!fearMode && selectedCat) nextQuestion();
});

async function init(){
  const res = await fetch("questions.json");
  DB = await res.json();
  renderCats();
  resetQuestionText();
}
init().catch(() => {
  setMetaBase("Error: could not load questions.json");
});
