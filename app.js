// Brain Battle core logic (no questions included here).
// - Selecting a category does NOT trigger a question
// - "New Question" triggers the next question + starts a 30s timer
// - No repeats within the same session (reload resets)
// - Brainfreezer button draws from fearQuestions

let data = null;
let questions = [];
let fearQuestions = [];
let categories = [];

let selectedCategoryId = null;
let selectedDifficulty = "easy";
let currentQuestion = null;

let usedQuestionKeys = new Set();      // session-only
let usedFearKeys = new Set();          // session-only

let timerInterval = null;
let timeLeft = 30;

// --- DOM
const categoryGrid = document.getElementById("categoryGrid");
const difficultySelect = document.getElementById("difficultySelect");
const newQuestionBtn = document.getElementById("newQuestionBtn");
const revealBtn = document.getElementById("revealBtn");
const brainfreezeBtn = document.getElementById("brainfreezeBtn");

const questionText = document.getElementById("questionText");
const answerText = document.getElementById("answerText");
const timerEl = document.getElementById("timer");
const poolStatus = document.getElementById("poolStatus");
const cardMeta = document.getElementById("cardMeta");

// --- Helpers
function keyFor(qObj) {
  // Good-enough unique key: cat|diff|question text
  return `${qObj.cat || "BF"}|${qObj.diff || "bf"}|${qObj.q}`;
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  timeLeft = 30;
  updateTimerUI();
}

function startTimer(seconds = 30) {
  stopTimer();
  timeLeft = seconds;
  updateTimerUI();

  timerInterval = setInterval(() => {
    timeLeft -= 1;
    updateTimerUI();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      onTimeUp();
    }
  }, 1000);
}

function updateTimerUI() {
  if (timerEl) timerEl.textContent = String(Math.max(0, timeLeft));
}

function onTimeUp() {
  // Mark answer field red and reveal if you want:
  answerText.classList.add("timeup");
  // Optional: auto reveal
  if (currentQuestion) {
    answerText.textContent = currentQuestion.a;
  }
}

function clearQA(message = "Pick a category, then press “New Question”.") {
  currentQuestion = null;
  questionText.textContent = message;
  answerText.textContent = "—";
  answerText.classList.remove("timeup");
  revealBtn.disabled = true;
  stopTimer();
  cardMeta.textContent = "—";
}

function setMeta(text) {
  cardMeta.textContent = text;
}

function highlightSelectedCategory(catId) {
  document.querySelectorAll(".catBtn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.catId === catId);
  });
}

function updatePoolStatus() {
  if (!poolStatus) return;

  if (!selectedCategoryId) {
    poolStatus.textContent = "";
    return;
  }

  const total = questions.filter(q => q.cat === selectedCategoryId && q.diff === selectedDifficulty).length;
  const left = questions.filter(q =>
    q.cat === selectedCategoryId &&
    q.diff === selectedDifficulty &&
    !usedQuestionKeys.has(keyFor(q))
  ).length;

  poolStatus.textContent = `• ${left}/${total} left`;
}

function getRandomFromPool(pool) {
  if (!pool.length) return null;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

function getNextQuestion() {
  if (!selectedCategoryId) return null;

  const pool = questions.filter(q =>
    q.cat === selectedCategoryId &&
    q.diff === selectedDifficulty &&
    !usedQuestionKeys.has(keyFor(q))
  );

  return getRandomFromPool(pool);
}

function getNextBrainfreezer() {
  const pool = fearQuestions.filter(q => !usedFearKeys.has(keyFor(q)));
  return getRandomFromPool(pool);
}

function renderQuestion(qObj, mode = "category") {
  currentQuestion = qObj;
  answerText.classList.remove("timeup");
  questionText.textContent = qObj.q;
  answerText.textContent = "—";
  revealBtn.disabled = false;

  if (mode === "category") {
    setMeta(`${selectedCategoryId} • ${selectedDifficulty}`);
  } else {
    setMeta(`BRAINFREEZER`);
  }
}

// --- Events
difficultySelect?.addEventListener("change", (e) => {
  selectedDifficulty = e.target.value;
  updatePoolStatus();
  // Do not auto-trigger a question; keep state
  clearQA("Difficulty set. Press “New Question”.");
  // keep newQuestionBtn enabled if category selected
  newQuestionBtn.disabled = !selectedCategoryId;
});

newQuestionBtn?.addEventListener("click", () => {
  if (!selectedCategoryId) return;

  const q = getNextQuestion();
  if (!q) {
    clearQA("No questions left for this category + difficulty (this session).");
    updatePoolStatus();
    return;
  }

  usedQuestionKeys.add(keyFor(q));
  renderQuestion(q, "category");
  startTimer(30);
  updatePoolStatus();
});

revealBtn?.addEventListener("click", () => {
  if (!currentQuestion) return;
  answerText.textContent = currentQuestion.a;
});

brainfreezeBtn?.addEventListener("click", () => {
  const q = getNextBrainfreezer();
  if (!q) {
    clearQA("No Brainfreezers left (this session). Reload to reset.");
    return;
  }
  usedFearKeys.add(keyFor(q));
  renderQuestion(q, "bf");
  startTimer(30);
});

// --- Category UI
function renderCategories() {
  categoryGrid.innerHTML = "";
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "catBtn";
    btn.dataset.catId = cat.id;

    btn.innerHTML = `
      <div class="catLeft">
        <div class="catName">${cat.name}</div>
        <div class="catTag">${cat.tag || ""}</div>
      </div>
      <div class="catIcon">${cat.icon || "❓"}</div>
    `;

    btn.addEventListener("click", () => {
      selectedCategoryId = cat.id;
      highlightSelectedCategory(cat.id);
      newQuestionBtn.disabled = false;
      clearQA("Category selected. Press “New Question”.");
      updatePoolStatus();
    });

    categoryGrid.appendChild(btn);
  });
}

// --- Boot
async function loadData() {
  const res = await fetch("questions.json", { cache: "no-store" });
  data = await res.json();

  categories = Array.isArray(data.categories) ? data.categories : [];
  questions = Array.isArray(data.questions) ? data.questions : [];
  fearQuestions = Array.isArray(data.fearQuestions) ? data.fearQuestions : [];

  renderCategories();
  clearQA();
  updatePoolStatus();

  // If there are zero categories, show a hint
  if (!categories.length) {
    questionText.textContent = "No categories found. Add them in questions.json.";
  }
}

loadData().catch(err => {
  console.error(err);
  questionText.textContent = "Failed to load questions.json. Check file name/path.";
});
