const { app, BrowserWindow, ipcMain, dialog, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let hostWindow = null;
let boardWindow = null;
let lastBoardState = null; // cache, żeby okno Planszy dostało stan zaraz po (ponownym) otwarciu

function attachFullscreenShortcuts(win) {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
    }
    if (input.type === 'keyDown' && input.key === 'Escape' && win.isFullScreen()) {
      win.setFullScreen(false);
    }
  });
}

/**
 * Wylicza rozmieszczenie obu okien tak, żeby NIGDY się nie nakładały:
 * - jeśli wykryto drugi ekran (np. projektor) -> Prowadzący na głównym ekranie,
 *   Plansza na pełnym ekranie drugiego monitora,
 * - jeśli jest tylko jeden ekran -> okna ustawione obok siebie (bez zachodzenia),
 *   Prowadzący po lewej, Plansza po prawej.
 */
function computeLayout() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const secondary = displays.find(d => d.id !== primary.id);

  if (secondary) {
    return {
      host: {
        x: primary.workArea.x + 40,
        y: primary.workArea.y + 40,
        width: Math.min(1040, primary.workArea.width - 80),
        height: Math.min(760, primary.workArea.height - 80)
      },
      board: {
        x: secondary.bounds.x,
        y: secondary.bounds.y,
        width: secondary.bounds.width,
        height: secondary.bounds.height,
        fullscreen: true
      }
    };
  }

  // Tylko jeden ekran: dzielimy go na dwie części obok siebie, żeby okna się nie nakładały.
  const wa = primary.workArea;
  const hostWidth = Math.max(720, Math.floor(wa.width * 0.42));
  const boardWidth = wa.width - hostWidth;
  return {
    host: { x: wa.x, y: wa.y, width: hostWidth, height: wa.height },
    board: { x: wa.x + hostWidth, y: wa.y, width: boardWidth, height: wa.height, fullscreen: false }
  };
}

function createHostWindow(bounds) {
  hostWindow = new BrowserWindow({
    ...bounds,
    title: 'Familiada Weselna — Panel Prowadzącego',
    backgroundColor: '#0b1730',
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  hostWindow.loadFile(path.join(__dirname, 'src', 'host.html'));
  attachFullscreenShortcuts(hostWindow);

  // Zamknięcie okna prowadzącego kończy całą aplikację (razem z oknem planszy).
  hostWindow.on('closed', () => {
    hostWindow = null;
    app.quit();
  });
}

function createBoardWindow(bounds) {
  // show:false na starcie — pokazujemy je świadomie przez showInactive(),
  // żeby NIE zabierało fokusu klawiatury oknu Prowadzącego.
  boardWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    title: 'Familiada Weselna — Plansza',
    backgroundColor: '#0b1730',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  boardWindow.loadFile(path.join(__dirname, 'src', 'board.html'));
  attachFullscreenShortcuts(boardWindow);

  boardWindow.once('ready-to-show', () => {
    if (!boardWindow) return;
    boardWindow.showInactive(); // pokaż okno BEZ przejmowania fokusu
    if (bounds.fullscreen) boardWindow.setFullScreen(true);
    // Fokus i tak musi zostać przy Prowadzącym, żeby dało się od razu pisać.
    if (hostWindow && !hostWindow.isDestroyed()) hostWindow.focus();
  });

  // Gdy okno planszy skończy się ładować (albo przeładuje), od razu wysyłamy mu ostatni znany stan.
  boardWindow.webContents.on('did-finish-load', () => {
    if (lastBoardState && boardWindow && !boardWindow.isDestroyed()) {
      boardWindow.webContents.send('board-state-update', lastBoardState);
    }
  });

  boardWindow.on('closed', () => {
    boardWindow = null;
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const layout = computeLayout();
  createHostWindow(layout.host);
  createBoardWindow(layout.board);

  // Upewniamy się, że to okno Prowadzącego ma fokus klawiatury zaraz po starcie.
  hostWindow.once('ready-to-show', () => {
    hostWindow.show();
    hostWindow.focus();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const l = computeLayout();
      createHostWindow(l.host);
      createBoardWindow(l.board);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ---------- IPC: synchronizacja stanu gry Prowadzący -> Plansza ---------- */

ipcMain.on('board-sync', (_event, payload) => {
  lastBoardState = payload;
  if (boardWindow && !boardWindow.isDestroyed()) {
    boardWindow.webContents.send('board-state-update', payload);
  }
});

ipcMain.handle('focus-or-reopen-board', () => {
  if (boardWindow && !boardWindow.isDestroyed()) {
    boardWindow.showInactive();
    if (hostWindow && !hostWindow.isDestroyed()) hostWindow.focus();
    return { ok: true, reopened: false };
  }
  const layout = computeLayout();
  createBoardWindow(layout.board);
  return { ok: true, reopened: true };
});

/* ---------- IPC: natywne dialogi zapisu / wczytywania pytań (JSON) ---------- */

ipcMain.handle('export-json', async (_event, jsonString) => {
  const { canceled, filePath } = await dialog.showSaveDialog(hostWindow, {
    title: 'Zapisz zestaw pytań',
    defaultPath: 'familiada-pytania.json',
    filters: [{ name: 'Plik JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false };
  try {
    fs.writeFileSync(filePath, jsonString, 'utf-8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('import-json', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(hostWindow, {
    title: 'Wczytaj zestaw pytań',
    filters: [{ name: 'Plik JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled || filePaths.length === 0) return { ok: false };
  try {
    const content = fs.readFileSync(filePaths[0], 'utf-8');
    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});
