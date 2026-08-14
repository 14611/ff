/* =========================================================
   FAMILIADA WESELNA — okno Planszy (dla gości / projektora)
   Tylko odczyt: cały stan przychodzi z okna Prowadzącego przez IPC.
   ========================================================= */

let boardState = { screen: 'setup' };

function esc(s){ const d=document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

function render(){
  const root = document.getElementById('boardView');
  if(boardState.screen === 'board'){
    root.innerHTML = renderBoardScreen(boardState);
  } else if(boardState.screen === 'winner'){
    root.innerHTML = renderWinnerScreen(boardState);
    launchConfetti();
  } else {
    root.innerHTML = renderWaitingScreen();
  }
}

function renderWaitingScreen(){
  return `
    <div class="winner-wrap">
      <div class="rings">💍</div>
      <h1>Familiada Weselna</h1>
      <p style="font-size:1.15rem;color:var(--blush);">Prowadzący konfiguruje grę... Zaraz zaczynamy! 🥂</p>
    </div>
  `;
}

function renderBoardScreen(s){
  return `
    <div class="round-header">
      ${s.isFinal ? '<div class="badge-final">Runda Finałowa</div>' : ''}
      <div class="round-label">Runda ${s.roundIndex+1} z ${s.totalRounds}</div>
      <h2>${esc(s.teamA.name)} <span style="color:var(--blush);">vs</span> ${esc(s.teamB.name)} <span class="mult-badge">Mnożnik x${s.multiplier}</span></h2>
    </div>

    <div class="question-banner">${esc(s.question)}</div>

    <div class="scoreboard">
      <div class="team-card a">
        <div class="tname">${esc(s.teamA.name)}</div>
        <div class="tscore">${s.teamA.score}</div>
      </div>
      <div class="pot-card">
        <div class="plabel">Pula rundy</div>
        <div class="pval">${s.pot}</div>
      </div>
      <div class="team-card b">
        <div class="tname">${esc(s.teamB.name)}</div>
        <div class="tscore">${s.teamB.score}</div>
      </div>
    </div>

    <div class="strikes-row">
      ${[0,1,2].map(i=>`<div class="strike-x ${i<s.strikes?'active':''}">X</div>`).join('')}
    </div>

    <div class="board-grid">
      ${s.answers.map((a,i)=>`
        <div class="answer-slot ${a.revealed?'revealed':''}">
          <div class="answer-inner">
            <div class="answer-face answer-front">
              <span class="qnum">${i+1}</span><span class="qmark">?</span>
            </div>
            <div class="answer-face answer-back">
              <span class="atext">${esc(a.text)}</span>
              <span class="apts">${a.points}</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderWinnerScreen(s){
  const tie = s.teamA.score === s.teamB.score;
  const aWins = s.teamA.score > s.teamB.score;
  const winnerName = tie ? null : (aWins ? s.teamA.name : s.teamB.name);
  return `
    <div class="winner-wrap">
      <div class="rings">💍 🥂 💍</div>
      <h1>${tie ? 'Remis!' : 'Gratulacje!'}</h1>
      <p style="font-size:1.15rem;color:var(--blush);">${tie ? 'Obie drużyny grały równo do samego końca.' : `${esc(winnerName)} wygrywa Familiadę Weselną!`}</p>
      <div class="scoreboard" style="margin-top:24px;">
        <div class="team-card a" style="${!tie && aWins ? 'box-shadow:0 0 30px rgba(212,175,55,.6);':''}">
          <div class="tname">${esc(s.teamA.name)}</div>
          <div class="tscore">${s.teamA.score}</div>
        </div>
        <div class="team-card b" style="${!tie && !aWins ? 'box-shadow:0 0 30px rgba(212,175,55,.6);':''}">
          <div class="tname">${esc(s.teamB.name)}</div>
          <div class="tscore">${s.teamB.score}</div>
        </div>
      </div>
    </div>
  `;
}

let confettiLaunched = false;
function launchConfetti(){
  if(confettiLaunched) return; // odpalamy raz, żeby nie zasypać ekranu przy każdej aktualizacji
  confettiLaunched = true;
  const colors = ['#d4af37','#f3d998','#e7b9c2','#f7f1e4','#9c7a1e'];
  for(let i=0;i<80;i++){
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

if(window.familiadaAPI){
  window.familiadaAPI.onBoardUpdate((data)=>{
    if(data.screen !== 'winner') confettiLaunched = false; // reset, gdyby rozpoczęto nową grę
    boardState = data;
    render();
  });
}

render();
