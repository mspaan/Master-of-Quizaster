let DB;
let selectedCat = null;
let lastKey = null;

const catsEl = document.getElementById("cats");
const metaEl = document.getElementById("meta");
const qEl = document.getElementById("q");
const aEl = document.getElementById("a");
const showABtn = document.getElementById("showA");
const newQBtn = document.getElementById("newQ");
const fearBtn = document.getElementById("fearBtn");

function pick(arr){return arr[Math.floor(Math.random()*arr.length)]}

function uniquePick(arr, keyFn){
  let item, key;
  do{
    item = pick(arr);
    key = keyFn(item);
  }while(key === lastKey && arr.length > 1);
  lastKey = key;
  return item;
}

function renderCats(){
  catsEl.innerHTML = "";
  DB.categories.forEach((c,i)=>{
    const btn = document.createElement("button");
    btn.className = "cat";
    btn.type = "button";
    btn.style.setProperty("--tilt", (i%2?1:-1)+"deg");
    btn.style.setProperty("--blob", c.blob);

    btn.innerHTML = `
      <div class="row">
        <div>
          <div class="name">${c.name}</div>
          <div class="tag">${c.tag}</div>
        </div>
        <div class="badge">${c.icon}</div>
      </div>
    `;

    btn.onclick = ()=>{
      selectedCat = c.id;
      document.querySelectorAll(".cat").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      metaEl.textContent = `Category: ${c.name}`;
      newQBtn.disabled = false;
      showABtn.disabled = true;
      qEl.textContent = "—";
      aEl.hidden = true;
      nextQuestion(false);
    };

    catsEl.appendChild(btn);
  });
}

function showQuestion(q, label){
  metaEl.textContent = label;
  qEl.textContent = q.q;
  aEl.textContent = q.a;
  aEl.hidden = true;
  showABtn.disabled = false;
}

function nextQuestion(isFear){
  if(isFear){
    const q = uniquePick(DB.fearQuestions, x=>"F"+x.q);
    showQuestion(q, "🪤 FEAR QUESTION");
    return;
  }
  if(!selectedCat) return;
  const pool = DB.questions.filter(q=>q.cat===selectedCat);
  const q = uniquePick(pool, x=>x.cat+x.q);
  showQuestion(q, `Category: ${DB.categories.find(c=>c.id===selectedCat).name}`);
}

showABtn.onclick = ()=>{aEl.hidden=false};
newQBtn.onclick = ()=>{nextQuestion(false)};
fearBtn.onclick = ()=>{nextQuestion(true)};

async function init(){
  const res = await fetch("questions.json");
  DB = await res.json();
  renderCats();
}
init();
