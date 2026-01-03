let DB = null;
let selectedCat = null;
let lastKey = null;

const catsEl = document.getElementById("cats");
const metaEl = document.getElementById("meta");
const qEl = document.getElementById("q");
const aEl = document.getElementById("a");
const showABtn = document.getElementById("showA");
const newQBtn = document.getElementById("newQ");
const fearBtn = document.getElementById("fearBtn");

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uniquePick(list, makeKey, maxTries = 30) {
  for (let i = 0; i < maxTries; i++) {
    const item = pickRandom(list);
    const key = makeKey(item);
    if (key !== lastKey) {
      lastKey = key;
      return item;
    }
  }
  return pickRandom(list);
}

function catById(id) {
  return DB.categories.find(c => c.id === id);
}

function renderCats() {
  catsEl.innerHTML = "";

  DB.categories.forEach((c, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat";
    btn.style.setProperty("--tilt", (idx % 2 === 0 ? -1.2 : 1.1) + "deg");
    btn.style.setProperty("--blob", c.blob || "rgba(59,130,255,.16)");

    btn.innerHTML = `
      <div class="row">
        <div>
          <div class="name">${c.name}</div>
          <div class="tag">${c.tag}</div>
        </div>
        <div class="badge">${c.icon}</div>
      </div>
    `;

    btn.addEventListener("click", () => {
      selectedCat = c.id;

      document.querySelectorAll(".cat").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");

      metaEl.textContent = `Category: ${c.name}`;
      newQBtn.disabled = false;
      showABtn.disabled = true;

      qEl.textContent = "—";
      aEl.hidden = true;
      aEl.textContent = "—";

      nextQuestion(false);
    });

    catsEl.appendChild(btn);
  });
}

function showQuestion(item, label) {
  metaEl.textContent = label;
  qEl.textContent = item.q;
  aEl.textContent = item.a;

  aEl.hidden = true;
  showABtn.disabled = false;
}

function nextQuestion(isFear) {
  if (!DB) return;

  if (isFear) {
    if (!DB.fearQuestions || DB.fearQuestions.length === 0) {
      qEl.textContent = "No fear questions found in questions.json.";
      aEl.hidden = true;
      showABtn.disabled = true;
      return;
    }
    const item = uniquePick(DB.fearQuestions, it => `FEAR:${it.q}`);
    showQuestion(item, "🪤 FEAR QUESTION");
    return;
  }

  if (!selectedCat) return;

  const pool = DB.questions.filter(q => q.cat === selectedCat);
  if (pool.length === 0) {
    qEl.textContent = "No questions for this category yet.";
    aEl.hidden = true;
    showABtn.disabled = true;
    return;
  }

  const item = uniquePick(pool, it => `${it.cat}:${it.q}`);
  showQuestion(item, `Category: ${catById(selectedCat).name}`);
}

showABtn.addEventListener("click", () => {
  aEl.hidden = false;
});

newQBtn.addEventListener("click", () => {
  nextQuestion(false);
});

fearBtn.addEventListener("click", () => {
  // Fear questions do NOT require a selected category
  nextQuestion(true);
});

async function init() {
  const res = await fetch("questions.json");
  DB = await res.json();

  // Defensive checks
  if (!DB.categories || !Array.isArray(DB.categories)) DB.categories = [];
  if (!DB.questions || !Array.isArray(DB.questions)) DB.questions = [];
  if (!DB.fearQuestions || !Array.isArray(DB.fearQuestions)) DB.fearQuestions = [];

  renderCats();
  metaEl.textContent = "Pick a category.";
}

init().catch(() => {
  metaEl.textContent = "Error: Could not load questions.json (check file name + JSON syntax).";
});
