let DB = null;
let selectedCat = null;
let lastKey = null;

const catsEl = document.getElementById("cats");
const metaEl = document.getElementById("meta");
const qEl = document.getElementById("q");
const aEl = document.getElementById("a");
const showABtn = document.getElementById("showA");
const newQBtn = document.getElementById("newQ");
const fearToggle = document.getElementById("fearToggle");

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uniquePick(list, keyFn) {
  let item;
  do {
    item = pickRandom(list);
  } while (keyFn(item) === lastKey && list.length > 1);
  lastKey = keyFn(item);
  return item;
}

function renderCats() {
  catsEl.innerHTML = "";
  DB.categories.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "cat";
    btn.innerHTML = `<strong>${c.name}</strong><span>›</span>`;
    btn.onclick = () => {
      selectedCat = c.id;
      document.querySelectorAll(".cat").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      newQBtn.disabled = false;
      nextQuestion();
    };
    catsEl.appendChild(btn);
  });
}

function nextQuestion() {
  let item;
  if (fearToggle.checked) {
    item = uniquePick(DB.fearQuestions, i => "F:"+i.q);
    metaEl.textContent = "🪤 ANGSTFRAGE";
  } else {
    const pool = DB.questions.filter(q => q.cat === selectedCat);
    item = uniquePick(pool, i => i.cat+":"+i.q);
    metaEl.textContent = selectedCat;
  }
  qEl.textContent = item.q;
  aEl.textContent = item.a;
  aEl.hidden = true;
  showABtn.disabled = false;
}

showABtn.onclick = () => aEl.hidden = false;
newQBtn.onclick = nextQuestion;

fetch("questions.json")
  .then(r => r.json())
  .then(data => {
    DB = data;
    renderCats();
  });
