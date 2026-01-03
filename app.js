let DB = null;
let selectedCat = null;
let fearMode = false;

// used tracking (no repeats until pool exhausted)
const usedByCat = new Map(); // catId -> Set(keys)
const usedFear = new Set();

const appEl = document.getElementById("app");
const catsEl = document.getElementById("cats");
const metaEl = document.getElementById("meta");
const qEl = document.getElementById("q");
const aEl = document.getElementById("a");
const showABtn = document.getElementById("showA");
const newQBtn = document.getElementById("newQ");
const fearBtn = document.getElementById("fearBtn");
const panelEl = document.getElementById("panel");

function pickRandom(arr){
  return arr[Math.floor(Math.random() * arr.length)];
}

function tremble(){
  panelEl.classList.remove("tremble");
  void panelEl.offsetWidth;
  panelEl.classList.add("tremble");
}

function setFearMode(on){
  fearMode = on;
  appEl.classList.toggle("fearMode", on);
  fearBtn.classList.toggle("isOn", on);
  fearBtn.setAttribute("aria-pressed", on ? "true" : "false");
  if (on) tremble();
  // if a category is already selected, immediately draw a fear question
  if (on) nextQuestion();
  else if (selectedCat) nextQuestion();
  else resetQuestionText();
}

function resetQuestionText(){
  metaEl.textContent = "Pick a category.";
  qEl.textContent = "—";
  aEl.hidden = true;
  showABtn.disabled = true;
  newQBtn.disabled = selectedCat ? false : true;
}

function getCatMeta(id){
  return DB.categories.find(c => c.id === id);
}

function ensureUsedSetForCat(catId){
  if (!usedByCat.has(catId)) usedByCat.set(catId, new Set());
  return usedByCat.get(catId);
}

function getNonRepeating(pool, keyFn, usedSet){
  if (pool.length === 0) return null;
  if (usedSet.size >= pool.length) usedSet.clear();

  let tries = 0;
  while (tries < 120){
    const item = pickRandom(pool);
    const key = keyFn(item);
    if (!usedSet.has(key)){
      usedSet.add(key);
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

  let item = null;

  if (fearMode){
    const pool = DB.fearQuestions;
    item = getNonRepeating(pool, (i) => `FEAR:${i.q}`, usedFear);
    metaEl.textContent = "FEAR QUESTION";
    tremble();
  } else {
    if (!selectedCat){
      resetQuestionText();
      return;
    }
    const pool = DB.questions.filter(q => q.cat === selectedCat);
    const usedSet = ensureUsedSetForCat(selectedCat);
    item = getNonRepeating(pool, (i) => `${i.cat}:${i.q}`, usedSet);

    const cm = getCatMeta(selectedCat);
    metaEl.textContent = cm ? `Category: ${cm.name}` : `Category: ${selectedCat}`;
  }

  if (!item){
    qEl.textContent = "No questions found.";
    return;
  }

  qEl.textContent = item.q;
  aEl.textContent = item.a;
  aEl.hidden = true;
  showABtn.disabled = false;
}

fearBtn.addEventListener("click", () => {
  setFearMode(!fearMode);
});

newQBtn.addEventListener("click", () => nextQuestion());

showABtn.addEventListener("click", () => {
  aEl.hidden = false;
});

async function init(){
  const res = await fetch("questions.json");
  DB = await res.json();
  renderCats();
  resetQuestionText();
}
init().catch(() => {
  metaEl.textContent = "Error: could not load questions.json";
});
