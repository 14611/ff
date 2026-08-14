/* =========================================================
   FAMILIADA WESELNA — okno Planszy (dla gości / projektora)
   Tylko odczyt: cały stan przychodzi z okna Prowadzącego przez IPC.
   ========================================================= */

let boardState = { screen: 'setup' };

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function render() {
  const root = document.getElementById('boardView');

  if (!root) return;

  if (boardState.screen === 'board') {
    root.innerHTML = renderBoardScreen(boardState);
  } else if (boardState.screen === 'winner') {
    root.innerHTML = renderWinnerScreen(boardState);
    launchConfetti();
  } else {
    root.innerHTML = renderWaitingScreen();
  }
}

function renderWaitingScreen() {
  return `
    <div
      class="winner-wrap"
      style="font-family: 'Minecraft', sans-serif;"
    >

      <div
        class="rings"
        style="font-family: 'Minecraft', sans-serif;"
      >
        💍
      </div>

      <h1 style="font-family: 'Minecraft', sans-serif;">
        Familiada Weselna
      </h1>

      <p
        style="font-size:1.15rem; color:var(--blush); font-family:'Minecraft', sans-serif;"
      >
        Prowadzący konfiguruje grę... Zaraz zaczynamy! 🥂
      </p>

    </div>
  `;
}

function renderBoardScreen(s) {
  return `
    <div
      class="round-header"
      style="font-family: 'Minecraft', sans-serif;"
    >

      ${
        s.isFinal
          ? `
            <div
              class="badge-final"
              style="font-family: 'Minecraft', sans-serif;"
            >
              Runda Finałowa
            </div>
          `
          : ''
      }

      <div
        class="round-label"
        style="font-family: 'Minecraft', sans-serif;"
      >
        Runda ${s.roundIndex + 1} z ${s.totalRounds}
      </div>

      <h2 style="font-family: 'Minecraft', sans-serif;">
        ${esc(s.teamA.name)}

        <span
          style="color:var(--blush); font-family:'Minecraft', sans-serif;"
        >
          vs
        </span>

        ${esc(s.teamB.name)}

        <span
          class="mult-badge"
          style="font-family: 'Minecraft', sans-serif;"
        >
          Mnożnik x${s.multiplier}
        </span>
      </h2>

    </div>

    <div
      class="question-banner"
      style="font-family: 'Minecraft', sans-serif;"
    >
      ${esc(s.question)}
    </div>

    <div
      class="scoreboard"
      style="font-family: 'Minecraft', sans-serif;"
    >

      <div
        class="team-card a"
        style="font-family: 'Minecraft', sans-serif;"
      >

        <div
          class="tname"
          style="font-family: 'Minecraft', sans-serif;"
        >
          ${esc(s.teamA.name)}
        </div>

        <div
          class="tscore"
          style="font-family: 'Minecraft', sans-serif;"
        >
          ${s.teamA.score}
        </div>

      </div>

      <div
        class="pot-card"
        style="font-family: 'Minecraft', sans-serif;"
      >

        <div
          class="plabel"
          style="font-family: 'Minecraft', sans-serif;"
        >
          Pula rundy
        </div>

        <div
          class="pval"
          style="font-family: 'Minecraft', sans-serif;"
        >
          ${s.pot}
        </div>

      </div>

      <div
        class="team-card b"
        style="font-family: 'Minecraft', sans-serif;"
      >

        <div
          class="tname"
          style="font-family: 'Minecraft', sans-serif;"
        >
          ${esc(s.teamB.name)}
        </div>

        <div
          class="tscore"
          style="font-family: 'Minecraft', sans-serif;"
        >
          ${s.teamB.score}
        </div>

      </div>

    </div>

    <div
      class="strikes-row"
      style="font-family: 'Minecraft', sans-serif;"
    >

      ${[0, 1, 2]
        .map(
          i => `
            <div
              class="strike-x ${i < s.strikes ? 'active' : ''}"
              style="font-family: 'Minecraft', sans-serif;"
            >
              X
            </div>
          `
        )
        .join('')}

    </div>

    <div
      class="board-grid"
      style="font-family: 'Minecraft', sans-serif;"
    >

      ${s.answers
        .map(
          (a, i) => `
            <div
              class="answer-slot ${a.revealed ? 'revealed' : ''}"
              style="font-family: 'Minecraft', sans-serif;"
            >

              <div
                class="answer-inner"
                style="font-family: 'Minecraft', sans-serif;"
              >

                <div
                  class="answer-face answer-front"
                  style="font-family: 'Minecraft', sans-serif;"
                >

                  <span
                    class="qnum"
                    style="font-family: 'Minecraft', sans-serif;"
                  >
                    ${i + 1}
                  </span>

                  <span
                    class="qmark"
                    style="font-family: 'Minecraft', sans-serif;"
                  >
                    ?
                  </span>

                </div>

                <div
                  class="answer-face answer-back"
                  style="font-family: 'Minecraft', sans-serif;"
                >

                  <span
                    class="atext"
                    style="font-family: 'Minecraft', sans-serif;"
                  >
                    ${esc(a.text)}
                  </span>

                  <span
                    class="apts"
                    style="font-family: 'Minecraft', sans-serif;"
                  >
                    ${a.points}
                  </span>

                </div>

              </div>

            </div>
          `
        )
        .join('')}

    </div>
  `;
}

function renderWinnerScreen(s) {
  const tie = s.teamA.score === s.teamB.score;
  const aWins = s.teamA.score > s.teamB.score;

  const winnerName = tie
    ? null
    : aWins
      ? s.teamA.name
      : s.teamB.name;

  return `
    <div
      class="winner-wrap"
      style="font-family: 'Minecraft', sans-serif;"
    >

      <div
        class="rings"
        style="font-family: 'Minecraft', sans-serif;"
      >
        💍 🥂 💍
      </div>

      <h1 style="font-family: 'Minecraft', sans-serif;">
        ${tie ? 'Remis!' : 'Gratulacje!'}
      </h1>

      <p
        style="font-size:1.15rem; color:var(--blush); font-family:'Minecraft', sans-serif;"
      >
        ${
          tie
            ? 'Obie drużyny grały równo do samego końca.'
            : `${esc(winnerName)} wygrywa Familiadę Weselną!`
        }
      </p>

      <div
        class="scoreboard"
        style="margin-top:24px; font-family:'Minecraft', sans-serif;"
      >

        <div
          class="team-card a"
          style="${
            !tie && aWins
              ? 'box-shadow:0 0 30px rgba(212,175,55,.6); font-family:\'Minecraft\', sans-serif;'
              : 'font-family:\'Minecraft\', sans-serif;'
          }"
        >

          <div
            class="tname"
            style="font-family: 'Minecraft', sans-serif;"
          >
            ${esc(s.teamA.name)}
          </div>

          <div
            class="tscore"
            style="font-family: 'Minecraft', sans-serif;"
          >
            ${s.teamA.score}
          </div>

        </div>

        <div
          class="team-card b"
          style="${
            !tie && !aWins
              ? 'box-shadow:0 0 30px rgba(212,175,55,.6); font-family:\'Minecraft\', sans-serif;'
              : 'font-family:\'Minecraft\', sans-serif;'
          }"
        >

          <div
            class="tname"
            style="font-family: 'Minecraft', sans-serif;"
          >
            ${esc(s.teamB.name)}
          </div>

          <div
            class="tscore"
            style="font-family: 'Minecraft', sans-serif;"
          >
            ${s.teamB.score}
          </div>

        </div>

      </div>

    </div>
  `;
}

let confettiLaunched = false;

function launchConfetti() {
  if (confettiLaunched) return;

  // Odpalamy raz, żeby nie zasypać ekranu przy każdej aktualizacji.
  confettiLaunched = true;

  const colors = [
    '#d4af37',
    '#f3d998',
    '#e7b9c2',
    '#f7f1e4',
    '#9c7a1e'
  ];

  for (let i = 0; i < 80; i++) {
    const c = document.createElement('div');

    c.className = 'confetti';

    const size = 6 + Math.random() * 8;

    c.style.width = `${size}px`;
    c.style.height = `${size * 0.4}px`;
    c.style.left = `${Math.random() * 100}vw`;
    c.style.background =
      colors[Math.floor(Math.random() * colors.length)];
    c.style.opacity = '0.9';

    document.body.appendChild(c);

    const duration = 2500 + Math.random() * 2000;
    const rotate = Math.random() * 720 - 360;

    c.animate(
      [
        {
          transform: 'translateY(0) rotate(0deg)',
          opacity: 1
        },
        {
          transform: `translateY(105vh) rotate(${rotate}deg)`,
          opacity: 0.9
        }
      ],
      {
        duration,
        easing: 'ease-in',
        delay: Math.random() * 400
      }
    );

    setTimeout(() => c.remove(), duration + 500);
  }
}

if (window.familiadaAPI) {
  window.familiadaAPI.onBoardUpdate((data) => {

    // Reset konfetti, gdy rozpoczynamy nową grę.
    if (data.screen !== 'winner') {
      confettiLaunched = false;
    }

    boardState = data;
    render();
  });
}

render();