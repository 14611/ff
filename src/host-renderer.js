/* =========================================================
   FAMILIADA WESELNA — logika gry
   ========================================================= */

/* ---------- Domyślny zestaw pytań ---------- */
const DEFAULT_QUESTIONS = [
  { question:"Co najczęściej gubią goście na weselu?", answers:[
    {text:"Telefon", points:28},{text:"Klucze", points:22},{text:"Torebkę", points:15},
    {text:"But / obcas", points:12},{text:"Portfel", points:10},{text:"Marynarkę", points:8},
    {text:"Okulary", points:3},{text:"Trzeźwość", points:2}
  ]},
  { question:"Jakie jest najpopularniejsze danie na polskim weselu?", answers:[
    {text:"Rosół", points:30},{text:"Schabowy", points:25},{text:"Żurek", points:15},
    {text:"Bigos", points:10},{text:"Kaczka", points:8},{text:"Pierogi", points:7},
    {text:"Sernik", points:3},{text:"Tort", points:2}
  ]},
  { question:"Co Pan Młody usłyszy najczęściej tej nocy?", answers:[
    {text:"Kocham Cię", points:25},{text:"Zatańczmy!", points:20},{text:"Zdrowie młodej pary!", points:18},
    {text:"Gdzie jest toaleta?", points:15},{text:"Super wesele!", points:12},{text:"Kiedy tort?", points:6},
    {text:"Jeszcze jeden toast", points:3},{text:"Idź spać", points:1}
  ]},
  { question:"Jaki prezent ślubny jest wybierany najczęściej?", answers:[
    {text:"Koperta z pieniędzmi", points:40},{text:"Zestaw naczyń", points:15},{text:"Pościel", points:12},
    {text:"Sprzęt AGD", points:10},{text:"Voucher na wyjazd", points:10},{text:"Alkohol", points:8},
    {text:"Kwiaty", points:3},{text:"Coś z listy prezentów", points:2}
  ]},
  { question:"Co najczęściej psuje się na weselu?", answers:[
    {text:"Fryzura", points:25},{text:"Obcas", points:20},{text:"Nastrój teściowej", points:15},
    {text:"Głos wodzireja", points:12},{text:"Pogoda", points:10},{text:"Suknia", points:8},
    {text:"Klimatyzacja", points:6},{text:"Nerwy Pana Młodego", points:4}
  ]},
  { question:"[FINAŁ] Co robią goście, gdy DJ puści disco polo?", answers:[
    {text:"Idą tańczyć", points:35},{text:"Śpiewają na cały głos", points:25},{text:"Idą po drinka", points:15},
    {text:"Wychodzą na papierosa", points:10},{text:"Nagrywają na telefon", points:8},
    {text:"Krzywią się", points:5},{text:"Proszą DJ-a o zmianę", points:2}
  ]}
];

/* ---------- Stan aplikacji ---------- */
let bank = JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));
let editorDraft = null; // kopia robocza pytań podczas edycji

let game = {
  screen: 'setup', // setup | board | winner
  teamA:{ name:'Drużyna Pary Młodej', score:0 },
  teamB:{ name:'Drużyna Gości', score:0 },
  playlist: [],       // indeksy z bank[] wybrane do gry, w kolejności
  roundIndex: 0,
  pot: 0,
  strikes: 0,
  revealed: [],       // bool[] wg liczby odpowiedzi w bieżącym pytaniu
  multiplier: 1,
  soundOn: true
};

/* ---------- Dźwięki ---------- */
// Własne dźwięki z assets/, z fallbackiem na prosty syntezator gdyby plik się nie wczytał.
const SOUND_FILES = {
  correct: '../assets/dobra-familiada.mp3',
  wrong: '../assets/bledna-familiada.mp3'
};
const soundCache = {};
function getSound(key){
  if(!soundCache[key]){
    const el = new Audio(SOUND_FILES[key]);
    el.preload = 'auto';
    soundCache[key] = el;
  }
  return soundCache[key];
}
function playFile(key, fallback){
  if(!game.soundOn) return;
  const base = getSound(key);
  const el = base.cloneNode(); // klon, żeby szybkie kolejne kliknięcia mogły grać na raz
  el.play().catch(()=>{ if(fallback) fallback(); });
}

let audioCtx = null;
function ctx(){ if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); return audioCtx; }
function tone(freq, start, dur, type='sine', gain=0.25){
  const c = ctx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type; osc.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime+start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime+start+0.02);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime+start+dur);
  osc.connect(g); g.connect(c.destination);
  osc.start(c.currentTime+start); osc.stop(c.currentTime+start+dur+0.05);
}
function playCorrectSynth(){
  tone(523.25,0,.16,'triangle',.28);
  tone(659.25,.12,.16,'triangle',.28);
  tone(783.99,.24,.28,'triangle',.3);
}
function playWrongSynth(){
  tone(180,0,.28,'sawtooth',.28);
  tone(120,.14,.32,'sawtooth',.3);
}
function playCorrect(){ playFile('correct', playCorrectSynth); }
function playWrong(){ playFile('wrong', playWrongSynth); }
function playAward(){ playFile('correct', ()=>{ [523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(f,i*.09,.22,'triangle',.25)); }); }

/* ---------- Utilidades ---------- */
function esc(s){ const d=document.createElement('div'); d.textContent=s ?? ''; return d.innerHTML; }
function currentQuestion(){
  const qIdx = game.playlist[game.roundIndex];
  return bank[qIdx];
}
function isLastRound(){ return game.roundIndex >= game.playlist.length-1; }
function defaultMultiplierForRound(i, total){
  if(i === total-1 && total>1) return 3; // finał
  return i < 2 ? 1 : 2;
}

/* =========================================================
   RENDER: TOPBAR
   ========================================================= */
function renderTopbar(){
  const el = document.getElementById('topbarActions');
  if(game.screen !== 'board'){ el.innerHTML=''; return; }
  el.innerHTML = `
    <button class="btn-outline btn-small" id="btnShowBoard">🖥️ Pokaż okno Planszy</button>
    <button class="btn-outline btn-small" id="btnSound">${game.soundOn ? '🔊 Dźwięk' : '🔇 Wyciszono'}</button>
    <button class="btn-outline btn-small" id="btnEditorTop">✏️ Edytor pytań</button>
    <button class="btn-outline btn-small" id="btnEndGame">🏁 Zakończ grę</button>
  `;
  document.getElementById('btnShowBoard').onclick = async ()=>{
    if(window.familiadaAPI) await window.familiadaAPI.focusOrReopenBoard();
  };
  document.getElementById('btnSound').onclick = ()=>{ game.soundOn=!game.soundOn; renderAll(); };
  document.getElementById('btnEditorTop').onclick = openEditor;
  document.getElementById('btnEndGame').onclick = ()=>{
    if(confirm('Zakończyć grę i przejść do ekranu wyników?')){ game.screen='winner'; renderAll(); }
  };
}

/* =========================================================
   RENDER: SETUP SCREEN
   ========================================================= */
function renderSetup(){
  const el = document.getElementById('setupScreen');
  if(game.screen!=='setup'){ el.classList.add('hidden'); el.innerHTML=''; return; }
  el.classList.remove('hidden');

  const rows = bank.map((q,i)=>{
    const selected = game.playlist.includes(i);
    const pos = game.playlist.indexOf(i);
    return `
    <div class="q-picker-item ${selected?'selected':''}" data-idx="${i}">
      <input type="checkbox" ${selected?'checked':''} data-action="toggle-q" data-idx="${i}">
      <div class="qtext">${esc(q.question)}</div>
      <div class="qmeta">${q.answers.length} odp.</div>
      ${selected ? `<div class="order-btns">
        <button data-action="q-up" data-idx="${i}" title="Wyżej">▲</button>
        <button data-action="q-down" data-idx="${i}" title="Niżej">▼</button>
      </div>` : ''}
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="setup-wrap">
      <div class="setup-hero">
        <div class="rings">💍</div>
        <h1>Familiada Weselna</h1>
        <p>Skonfiguruj drużyny i rundy, a potem rozpocznij zabawę!</p>
      </div>

      <div class="card">
        <h2><span class="num">1</span> Drużyny</h2>
        <div class="teams-grid">
          <div class="team-input a">
            <label>Nazwa Drużyny A</label>
            <input id="teamAInput" value="${esc(game.teamA.name)}" maxlength="30">
          </div>
          <div class="team-input b">
            <label>Nazwa Drużyny B</label>
            <input id="teamBInput" value="${esc(game.teamB.name)}" maxlength="30">
          </div>
        </div>
      </div>

      <div class="card">
        <h2><span class="num">2</span> Wybierz pytania i kolejność rund</h2>
        <div class="topbar-actions" style="margin-bottom:14px;">
          <button class="btn-outline btn-small" id="btnLoadDefaults">📋 Wczytaj domyślne pytania weselne</button>
          <button class="btn-outline btn-small" id="btnOpenEditorSetup">✏️ Edytor pytań</button>
          <button class="btn-outline btn-small" id="btnSelectAll">☑️ Zaznacz wszystkie</button>
          <button class="btn-outline btn-small" id="btnSelectNone">◻️ Odznacz wszystkie</button>
        </div>
        ${bank.length ? `<div class="q-picker-list">${rows}</div>` : `<div class="empty-hint">Brak pytań w bazie. Wczytaj domyślny zestaw lub dodaj własne w Edytorze.</div>`}
        <p class="muted" style="margin-top:12px;">Zaznaczone pytania zagrają w kolejności ustawionej strzałkami ▲▼. Wybrano: <strong>${game.playlist.length}</strong> rund.</p>
      </div>

      <div class="setup-footer">
        <span class="pill">🥂 Gotowe do startu: ${game.playlist.length>0 ? 'TAK' : 'wybierz min. 1 pytanie'}</span>
        <button class="btn-gold" id="btnStartGame" ${game.playlist.length===0?'disabled style="opacity:.5;cursor:not-allowed;"':''}>Rozpocznij Grę 🎉</button>
      </div>
    </div>
  `;

  document.getElementById('teamAInput').oninput = e=>{ game.teamA.name = e.target.value; };
  document.getElementById('teamBInput').oninput = e=>{ game.teamB.name = e.target.value; };
  document.getElementById('btnLoadDefaults').onclick = ()=>{
    if(bank.length===0 || confirm('To doda domyślne pytania weselne do obecnej bazy. Kontynuować?')){
      DEFAULT_QUESTIONS.forEach(q=>bank.push(JSON.parse(JSON.stringify(q))));
      renderAll();
    }
  };
  document.getElementById('btnOpenEditorSetup').onclick = openEditor;
  document.getElementById('btnSelectAll').onclick = ()=>{ game.playlist = bank.map((_,i)=>i); renderAll(); };
  document.getElementById('btnSelectNone').onclick = ()=>{ game.playlist = []; renderAll(); };

  el.querySelectorAll('[data-action="toggle-q"]').forEach(cb=>{
    cb.onchange = ()=>{
      const idx = parseInt(cb.dataset.idx);
      if(cb.checked){ game.playlist.push(idx); }
      else { game.playlist = game.playlist.filter(x=>x!==idx); }
      renderAll();
    };
  });
  el.querySelectorAll('[data-action="q-up"]').forEach(b=>{
    b.onclick = ()=>{
      const idx = parseInt(b.dataset.idx);
      const pos = game.playlist.indexOf(idx);
      if(pos>0){ [game.playlist[pos-1],game.playlist[pos]] = [game.playlist[pos],game.playlist[pos-1]]; renderAll(); }
    };
  });
  el.querySelectorAll('[data-action="q-down"]').forEach(b=>{
    b.onclick = ()=>{
      const idx = parseInt(b.dataset.idx);
      const pos = game.playlist.indexOf(idx);
      if(pos>=0 && pos<game.playlist.length-1){ [game.playlist[pos+1],game.playlist[pos]] = [game.playlist[pos],game.playlist[pos+1]]; renderAll(); }
    };
  });
  const startBtn = document.getElementById('btnStartGame');
  if(startBtn && game.playlist.length>0){
    startBtn.onclick = startGame;
  }
}

function startGame(){
  game.roundIndex = 0;
  game.teamA.score = 0; game.teamB.score = 0;
  loadRound(0);
  game.screen = 'board';
  renderAll();
}

function loadRound(i){
  game.roundIndex = i;
  const q = currentQuestion();
  game.revealed = q.answers.map(()=>false);
  game.pot = 0;
  game.strikes = 0;
  game.multiplier = defaultMultiplierForRound(i, game.playlist.length);
}

/* =========================================================
   RENDER: HOST PANEL (panel prowadzącego)
   ========================================================= */
function renderHost(){
  const el = document.getElementById('hostPanel');
  if(game.screen!=='board'){ el.classList.add('hidden'); el.innerHTML=''; return; }
  el.classList.remove('hidden');

  const q = currentQuestion();
  const total = game.playlist.length;
  const allRevealed = game.revealed.every(Boolean);
  const roundOver = allRevealed || game.strikes>=3;

  el.innerHTML = `
    <div class="round-header" style="margin-bottom:20px;">
      <div class="round-label">🎙️ Panel Prowadzącego — Runda ${game.roundIndex+1}/${total}</div>
      <h2 style="font-size:1.4rem;">${esc(q.question)}</h2>
    </div>

    <div class="host-grid">
      <div>
        <div class="card" style="margin-bottom:16px;">
          <h2><span class="num">?</span>Odpowiedzi — kliknij aby odsłonić</h2>
          ${q.answers.map((a,i)=>`
            <div class="host-answer-row ${game.revealed[i]?'done':''}">
              <div class="anum">${i+1}</div>
              <div class="atxt">${esc(a.text)}</div>
              <div class="apts">${a.points*game.multiplier} pkt</div>
              <button class="btn-gold btn-small" data-reveal="${i}" ${game.revealed[i]?'disabled style="opacity:.4;"':''}>
                ${game.revealed[i] ? 'Odsłonięte ✓' : 'Odsłoń'}
              </button>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <h2><span class="num">✕</span>Błędy drużyny</h2>
          <div class="strike-btns">
            <button class="btn-red" id="btnAddStrike" ${game.strikes>=3?'disabled style="opacity:.5;"':''}>Dodaj X (${game.strikes}/3)</button>
            <button class="btn-outline btn-small" id="btnResetStrikes">Wyzeruj błędy</button>
          </div>
          <div class="strikes-row" style="margin-top:14px;margin-bottom:0;justify-content:flex-start;">
            ${[0,1,2].map(i=>`<div class="strike-x ${i<game.strikes?'active':''}" style="width:38px;height:38px;font-size:1.2rem;">X</div>`).join('')}
          </div>
        </div>
      </div>

      <div>
        <div class="card host-controls-block">
          <h3>Pula rundy</h3>
          <div class="pot-card" style="width:100%;">
            <div class="plabel">Do zdobycia</div>
            <div class="pval">${game.pot}</div>
          </div>
          <div class="award-row">
            <button class="btn-green" id="btnAwardA">✔️ Przyznaj: ${esc(game.teamA.name)}</button>
            <button class="btn-green" id="btnAwardB">✔️ Przyznaj: ${esc(game.teamB.name)}</button>
          </div>
          <p class="muted" style="margin-top:10px;">${roundOver ? 'Runda zakończona — przyznaj punkty i przejdź dalej.' : 'Odsłaniaj odpowiedzi lub dodawaj błędy. Po 3 błędach lub odsłonięciu wszystkich odpowiedzi przyznaj punkty.'}</p>
        </div>

        <div class="card host-controls-block">
          <h3>Mnożnik punktów tej rundy</h3>
          <div class="mult-controls">
            ${[1,2,3].map(m=>`<button class="${game.multiplier===m?'active':''}" data-mult="${m}">x${m}</button>`).join('')}
          </div>
        </div>

        <div class="card host-controls-block">
          <h3>Wyniki drużyn (ręczna korekta)</h3>
          <div class="host-score-edit">
            <span class="lbl">${esc(game.teamA.name)}: <strong>${game.teamA.score}</strong></span>
            <div class="adj">
              <button data-adj="A-" data-val="-10">-10</button>
              <button data-adj="A-" data-val="-1">-1</button>
              <button data-adj="A+" data-val="1">+1</button>
              <button data-adj="A+" data-val="10">+10</button>
            </div>
          </div>
          <div class="host-score-edit">
            <span class="lbl">${esc(game.teamB.name)}: <strong>${game.teamB.score}</strong></span>
            <div class="adj">
              <button data-adj="B-" data-val="-10">-10</button>
              <button data-adj="B-" data-val="-1">-1</button>
              <button data-adj="B+" data-val="1">+1</button>
              <button data-adj="B+" data-val="10">+10</button>
            </div>
          </div>
        </div>

        <div class="card host-controls-block">
          <h3>Nawigacja rund</h3>
          <div class="round-nav">
            <button class="btn-outline btn-small" id="btnPrevRound" ${game.roundIndex===0?'disabled style="opacity:.4;"':''}>◀ Poprzednia</button>
            <span class="pill">Runda ${game.roundIndex+1} / ${total}</span>
            <button class="btn-gold btn-small" id="btnNextRound">${isLastRound() ? 'Zakończ grę 🏁' : 'Następna rundy ▶'}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Reveal
  el.querySelectorAll('[data-reveal]').forEach(b=>{
    b.onclick = ()=>{
      const i = parseInt(b.dataset.reveal);
      if(game.revealed[i]) return;
      game.revealed[i] = true;
      game.pot += q.answers[i].points * game.multiplier;
      playCorrect();
      renderAll();
    };
  });
  document.getElementById('btnAddStrike').onclick = ()=>{
    if(game.strikes<3){ game.strikes++; playWrong(); renderAll(); }
  };
  document.getElementById('btnResetStrikes').onclick = ()=>{ game.strikes=0; renderAll(); };
  document.getElementById('btnAwardA').onclick = ()=>{
    game.teamA.score += game.pot; playAward();
    advanceRound();
  };
  document.getElementById('btnAwardB').onclick = ()=>{
    game.teamB.score += game.pot; playAward();
    advanceRound();
  };
  el.querySelectorAll('[data-mult]').forEach(b=>{
    b.onclick = ()=>{ game.multiplier = parseInt(b.dataset.mult); renderAll(); };
  });
  el.querySelectorAll('[data-adj]').forEach(b=>{
    b.onclick = ()=>{
      const which = b.dataset.adj[0];
      const val = parseInt(b.dataset.val);
      if(which==='A') game.teamA.score = Math.max(0, game.teamA.score+val);
      else game.teamB.score = Math.max(0, game.teamB.score+val);
      renderAll();
    };
  });
  document.getElementById('btnPrevRound').onclick = ()=>{
    if(game.roundIndex>0){ loadRound(game.roundIndex-1); renderAll(); }
  };
  document.getElementById('btnNextRound').onclick = ()=>{
    if(isLastRound()){ game.screen='winner'; renderAll(); }
    else { loadRound(game.roundIndex+1); renderAll(); }
  };
}

function advanceRound(){
  // po przyznaniu punktów zostajemy w tej samej rundzie (host może dalej doprecyzować),
  // ale pula i błędy się nie zerują automatycznie — host klika "Następna runda" gdy gotowy
  renderAll();
}

/* =========================================================
   RENDER: WINNER SCREEN
   ========================================================= */
function renderWinner(){
  const el = document.getElementById('winnerScreen');
  if(game.screen!=='winner'){ el.classList.add('hidden'); el.innerHTML=''; return; }
  el.classList.remove('hidden');

  const aWins = game.teamA.score > game.teamB.score;
  const tie = game.teamA.score === game.teamB.score;
  const winnerName = tie ? null : (aWins ? game.teamA.name : game.teamB.name);

  el.innerHTML = `
    <div class="winner-wrap">
      <div class="rings">💍 🥂 💍</div>
      <h1>${tie ? 'Remis!' : 'Gratulacje!'}</h1>
      <p style="font-size:1.15rem;color:var(--blush);">${tie ? 'Obie drużyny grały równo do samego końca.' : `${esc(winnerName)} wygrywa Familiadę Weselną!`}</p>
      <div class="final-score">
        <div class="scoreboard" style="margin-top:24px;">
          <div class="team-card a" style="${!tie && aWins ? 'box-shadow:0 0 30px rgba(212,175,55,.6);':''}">
            <div class="tname">${esc(game.teamA.name)}</div>
            <div class="tscore">${game.teamA.score}</div>
          </div>
          <div class="team-card b" style="${!tie && !aWins ? 'box-shadow:0 0 30px rgba(212,175,55,.6);':''}">
            <div class="tname">${esc(game.teamB.name)}</div>
            <div class="tscore">${game.teamB.score}</div>
          </div>
        </div>
      </div>
      <div class="topbar-actions" style="justify-content:center;">
        <button class="btn-gold" id="btnPlayAgain">🔄 Nowa gra</button>
        <button class="btn-outline" id="btnBackToSetup">⚙️ Wróć do konfiguracji</button>
      </div>
    </div>
  `;
  document.getElementById('btnPlayAgain').onclick = ()=>{ startGame(); };
  document.getElementById('btnBackToSetup').onclick = ()=>{ game.screen='setup'; renderAll(); };

  if(!tie) launchConfetti();
}

function launchConfetti(){
  const colors = ['#d4af37','#f3d998','#e7b9c2','#f7f1e4','#9c7a1e'];
  for(let i=0;i<60;i++){
    const c = document.createElement('div');
    c.className='confetti';
    const size = 6+Math.random()*8;
    c.style.width = size+'px';
    c.style.height = (size*0.4)+'px';
    c.style.left = Math.random()*100+'vw';
    c.style.background = colors[Math.floor(Math.random()*colors.length)];
    c.style.opacity = 0.9;
    document.body.appendChild(c);
    const duration = 2500+Math.random()*2000;
    const rotate = Math.random()*720-360;
    c.animate([
      { transform:`translateY(0) rotate(0deg)`, opacity:1 },
      { transform:`translateY(105vh) rotate(${rotate}deg)`, opacity:0.9 }
    ], { duration, easing:'ease-in', delay: Math.random()*400 });
    setTimeout(()=>c.remove(), duration+500);
  }
}

/* =========================================================
   EDYTOR PYTAŃ
   ========================================================= */
function openEditor(){
  editorDraft = JSON.parse(JSON.stringify(bank));
  renderEditor();
}
function closeEditor(save){
  if(save){ bank = editorDraft; }
  editorDraft = null;
  document.getElementById('editorModal').classList.add('hidden');
  document.getElementById('editorModal').innerHTML='';
  renderAll();
}
function renderEditor(){
  const overlay = document.getElementById('editorModal');

  // Zapamiętujemy przewinięcie modala oraz aktywne pole, żeby po re-renderze
  // (np. po kliknięciu "Dodaj odpowiedź") ekran nie skakał z powrotem na górę.
  const prevBox = overlay.querySelector('.modal-box');
  const prevScrollTop = prevBox ? prevBox.scrollTop : 0;
  const active = document.activeElement;
  const activeInfo = (active && active.dataset && overlay.contains(active)) ? {
    field: active.dataset.field, qi: active.dataset.qi, ai: active.dataset.ai,
    selStart: active.selectionStart, selEnd: active.selectionEnd
  } : null;

  overlay.classList.remove('hidden');

  const qCards = editorDraft.map((q,qi)=>`
    <div class="editor-q-card" data-qi="${qi}">
      <input class="qtitle" value="${esc(q.question)}" data-field="question" data-qi="${qi}" placeholder="Treść pytania...">
      ${q.answers.map((a,ai)=>`
        <div class="editor-ans-row">
          <input class="atext" value="${esc(a.text)}" data-field="atext" data-qi="${qi}" data-ai="${ai}" placeholder="Odpowiedź">
          <input class="apts" type="number" min="0" value="${a.points}" data-field="apts" data-qi="${qi}" data-ai="${ai}" placeholder="Pkt">
          <button class="btn-red btn-small" data-action="del-answer" data-qi="${qi}" data-ai="${ai}" title="Usuń odpowiedź">✕</button>
        </div>
      `).join('')}
      <div class="editor-q-actions">
        <button class="btn-outline btn-small" data-action="add-answer" data-qi="${qi}" ${q.answers.length>=8?'disabled style="opacity:.4;"':''}>+ Dodaj odpowiedź</button>
        <button class="btn-red btn-small" data-action="del-question" data-qi="${qi}">🗑️ Usuń pytanie</button>
      </div>
    </div>
  `).join('');

  overlay.innerHTML = `
    <div class="modal-box">
      <h2>✏️ Edytor Pytań i Odpowiedzi</h2>
      <div class="editor-topbar">
        <button class="btn-gold btn-small" id="btnAddQuestion">+ Nowe pytanie</button>
        <button class="btn-outline btn-small" id="btnLoadDefaultsEditor">📋 Wczytaj domyślne (dodaj)</button>
        <button class="btn-outline btn-small" id="btnExportJson">⬇️ Eksportuj JSON</button>
        <button class="btn-outline btn-small" id="btnImportJson">⬆️ Importuj JSON</button>
      </div>
      ${editorDraft.length ? qCards : '<div class="empty-hint">Brak pytań. Dodaj nowe lub wczytaj domyślny zestaw.</div>'}
      <div class="modal-close-row">
        <button class="btn-outline" id="btnCancelEditor">Anuluj</button>
        <button class="btn-gold" id="btnSaveEditor">💾 Zapisz zmiany</button>
      </div>
    </div>
  `;

  overlay.querySelectorAll('[data-field="question"]').forEach(inp=>{
    inp.oninput = ()=>{ editorDraft[parseInt(inp.dataset.qi)].question = inp.value; };
  });
  overlay.querySelectorAll('[data-field="atext"]').forEach(inp=>{
    inp.oninput = ()=>{ editorDraft[parseInt(inp.dataset.qi)].answers[parseInt(inp.dataset.ai)].text = inp.value; };
  });
  overlay.querySelectorAll('[data-field="apts"]').forEach(inp=>{
    inp.oninput = ()=>{ editorDraft[parseInt(inp.dataset.qi)].answers[parseInt(inp.dataset.ai)].points = parseInt(inp.value)||0; };
  });
  overlay.querySelectorAll('[data-action="del-answer"]').forEach(b=>{
    b.onclick = ()=>{
      const qi=parseInt(b.dataset.qi), ai=parseInt(b.dataset.ai);
      editorDraft[qi].answers.splice(ai,1);
      renderEditor();
    };
  });
  overlay.querySelectorAll('[data-action="add-answer"]').forEach(b=>{
    b.onclick = ()=>{
      const qi=parseInt(b.dataset.qi);
      if(editorDraft[qi].answers.length<8){ editorDraft[qi].answers.push({text:'', points:1}); renderEditor(); }
    };
  });
  overlay.querySelectorAll('[data-action="del-question"]').forEach(b=>{
    b.onclick = ()=>{
      const qi=parseInt(b.dataset.qi);
      if(confirm('Usunąć to pytanie?')){ editorDraft.splice(qi,1); renderEditor(); }
    };
  });
  document.getElementById('btnAddQuestion').onclick = ()=>{
    editorDraft.push({ question:'Nowe pytanie...', answers:[{text:'Odpowiedź 1', points:10}] });
    renderEditor();
  };
  document.getElementById('btnLoadDefaultsEditor').onclick = ()=>{
    DEFAULT_QUESTIONS.forEach(q=>editorDraft.push(JSON.parse(JSON.stringify(q))));
    renderEditor();
  };
  document.getElementById('btnExportJson').onclick = async ()=>{
    const json = JSON.stringify(editorDraft, null, 2);
    if(window.familiadaAPI){
      const res = await window.familiadaAPI.exportJson(json);
      if(res.ok) alert('Zapisano pytania: '+res.filePath);
      else if(res.error) alert('Nie udało się zapisać pliku: '+res.error);
    } else {
      const blob = new Blob([json], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'familiada-pytania.json';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }
  };
  document.getElementById('btnImportJson').onclick = async ()=>{
    if(!window.familiadaAPI){ alert('Import dostępny tylko w aplikacji desktopowej.'); return; }
    const res = await window.familiadaAPI.importJson();
    if(!res.ok){ if(res.error) alert('Nie udało się wczytać pliku: '+res.error); return; }
    try{
      const data = JSON.parse(res.content);
      if(!Array.isArray(data)) throw new Error('Nieprawidłowy format (oczekiwano tablicy pytań)');
      const valid = data.every(q=>q.question && Array.isArray(q.answers));
      if(!valid) throw new Error('Nieprawidłowa struktura pytań');
      if(confirm(`Zaimportować ${data.length} pytań? (zostaną dodane do obecnej listy)`)){
        data.forEach(q=>editorDraft.push(q));
        renderEditor();
      }
    }catch(err){
      alert('Nie udało się wczytać pliku JSON: '+err.message);
    }
  };
  document.getElementById('btnCancelEditor').onclick = ()=>closeEditor(false);
  document.getElementById('btnSaveEditor').onclick = ()=>{
    // czyścimy puste pytania/odpowiedzi
    editorDraft = editorDraft.filter(q=>q.question.trim() && q.answers.length>0);
    editorDraft.forEach(q=> q.answers = q.answers.filter(a=>a.text.trim()));
    closeEditor(true);
  };

  // Przywracamy przewinięcie modala i fokus na tym samym polu co przed re-renderem.
  const box = overlay.querySelector('.modal-box');
  if(box) box.scrollTop = prevScrollTop;
  if(activeInfo && activeInfo.field){
    const sel = `[data-field="${activeInfo.field}"][data-qi="${activeInfo.qi}"]` + (activeInfo.ai!=null ? `[data-ai="${activeInfo.ai}"]` : '');
    const el = overlay.querySelector(sel);
    if(el){
      el.focus();
      if(typeof activeInfo.selStart==='number' && el.setSelectionRange){
        try{ el.setSelectionRange(activeInfo.selStart, activeInfo.selEnd); }catch(e){}
      }
    }
  }
}

/* =========================================================
   SYNCHRONIZACJA Z OKNEM PLANSZY (osobny proces renderera)
   ========================================================= */
function pushBoardState(){
  if(!window.familiadaAPI) return;
  const total = game.playlist.length;
  let payload;
  if(game.screen === 'board' && total>0){
    const q = currentQuestion();
    payload = {
      screen: 'board',
      teamA: game.teamA,
      teamB: game.teamB,
      pot: game.pot,
      strikes: game.strikes,
      multiplier: game.multiplier,
      roundIndex: game.roundIndex,
      totalRounds: total,
      isFinal: isLastRound() && total>1,
      question: q.question,
      answers: q.answers.map((a,i)=>({ text:a.text, points:a.points*game.multiplier, revealed: !!game.revealed[i] }))
    };
  } else if(game.screen === 'winner'){
    payload = { screen:'winner', teamA: game.teamA, teamB: game.teamB };
  } else {
    payload = { screen:'setup' };
  }
  window.familiadaAPI.syncBoard(payload);
}

/* =========================================================
   MAIN RENDER
   ========================================================= */
function renderAll(){
  const scrollY = window.scrollY;
  renderTopbar();
  renderSetup();
  renderHost();
  renderWinner();
  pushBoardState();
  window.scrollTo(0, scrollY);
}

renderAll();