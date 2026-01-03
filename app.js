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

function uniquePick(list, makeKey, maxTries = 30) {
  // verhindert Wiederholung direkt hintereinander
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

function renderCats() {
  catsEl.innerHTML = "";
  DB.categories.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "cat";
    btn.type = "button";
    btn.innerHTML = `<div><div class="name">${c.name}</div><div class="tag">${c.tag}</div></div><div>›</div>`;
    btn.addEventListener("click", () => {
      selectedCat = c.id;
      document.querySelectorAll(".cat").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      metaEl.textContent = `Kategorie: ${c.name}${fearToggle.checked ? " • 🪤 ANGSTFRAGE aktiv" : ""}`;
      newQBtn.disabled = false;
      showABtn.disabled = true;
      qEl.textContent = "—";
      aEl.hidden = true;
      aEl.textContent = "—";
      nextQuestion();
    });
    catsEl.appendChild(btn);
  });
}

function nextQuestion() {
  if (!DB) return;

  const isFear = fearToggle.checked;
  let item;

  if (isFear) {
    item = uniquePick(DB.fearQuestions, it => `FEAR:${it.q}`);
    metaEl.textContent = `🪤 ANGSTFRAGE${selectedCat ? " • " + DB.categories.find(c=>c.id===selectedCat).name : ""}`;
  } else {
    if (!selectedCat) return;
    const pool = DB.questions.filter(q => q.cat === selectedCat);
    if (pool.length === 0) {
      qEl.textContent = "Keine Fragen in dieser Kategorie.";
      return;
    }
    item = uniquePick(pool, it => `${it.cat}:${it.q}`);
    metaEl.textContent = `Kategorie: ${DB.categories.find(c=>c.id===selectedCat).name}`;
  }

  qEl.textContent = item.q;
  aEl.textContent = item.a;
  aEl.hidden = true;
  showABtn.disabled = false;
}

showABtn.addEventListener("click", () => {
  aEl.hidden = false;
});

newQBtn.addEventListener("click", () => {
  nextQuestion();
});

fearToggle.addEventListener("change", () => {
  if (!DB) return;
  if (!selectedCat) {
    metaEl.textContent = fearToggle.checked ? "🪤 ANGSTFRAGE aktiv — wähle eine Kategorie (optional)." : "Wähle eine Kategorie.";
    return;
  }
  metaEl.textContent = `Kategorie: ${DB.categories.find(c=>c.id===selectedCat).name}${fearToggle.checked ? " • 🪤 ANGSTFRAGE aktiv" : ""}`;
  nextQuestion();
});

async function init() {
  const res = await fetch("questions.json");
  DB = await res.json();
  renderCats();
  metaEl.textContent = "Wähle eine Kategorie.";
}
init().catch(() => {
  metaEl.textContent = "Fehler: questions.json konnte nicht geladen werden.";
});
