const { app, BrowserWindow, ipcMain, dialog, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let hostWindow = null;
let boardWindow = null;
let lastBoardState = null; // cache, żeby okno Planszy dostało stan zaraz po (ponownym) otwarciu

/* ---------- Trwały zapis banku pytań (autozapis, przeżywa restart aplikacji) ---------- */
// Zapisywane w katalogu danych użytkownika (np. %APPDATA%\familiada-weselna na Windows),
// czyli NIE w folderze instalacyjnym aplikacji (tam zapis mógłby się nie udać po instalacji).
function getBankFilePath() {
  return path.join(app.getPath('userData'), 'pytania-bank.json');
}

/* ---------- Trwały zapis ustawień ekranu (monitor / tryb dla każdego okna) ---------- */
function getDisplaySettingsFilePath() {
  return path.join(app.getPath('userData'), 'display-settings.json');
}

const DEFAULT_DISPLAY_SETTINGS = {
  mode: 'auto', // 'auto' = dotychczasowe automatyczne wykrywanie, 'manual' = wybór poniżej
  host: { displayId: null, fullscreen: false },   // Panel Prowadzącego (tryb admin)
  board: { displayId: null, fullscreen: true }    // Plansza (tryb widz)
};

function loadDisplaySettingsFromDisk() {
  try {
    const filePath = getDisplaySettingsFilePath();
    if (!fs.existsSync(filePath)) return { ...DEFAULT_DISPLAY_SETTINGS };
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return {
      mode: raw.mode === 'manual' ? 'manual' : 'auto',
      host: { displayId: raw.host?.displayId ?? null, fullscreen: !!raw.host?.fullscreen },
      board: { displayId: raw.board?.displayId ?? null, fullscreen: raw.board?.fullscreen !== false }
    };
  } catch (err) {
    return { ...DEFAULT_DISPLAY_SETTINGS };
  }
}

let currentDisplaySettings = loadDisplaySettingsFromDisk();

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
 * - TRYB AUTOMATYCZNY (domyślny): jeśli wykryto drugi ekran (np. projektor) -> Prowadzący
 *   na głównym ekranie, Plansza na pełnym ekranie drugiego monitora; jeśli jest tylko jeden
 *   ekran -> okna ustawione obok siebie (Prowadzący po lewej, Plansza po prawej),
 * - TRYB RĘCZNY: każde okno idzie na wybrany przez użytkownika monitor, w wybranym trybie
 *   (pełny ekran / okno).
 */
function computeLayout(settings) {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  settings = settings || currentDisplaySettings;

  if (settings.mode === 'manual') {
    const findDisplay = (id) => displays.find(d => d.id === id);
    const hostDisplay = findDisplay(settings.host.displayId) || primary;
    // Dla Planszy domyślnie preferujemy inny monitor niż Prowadzący, jeśli użytkownik nic nie wybrał.
    const boardDisplay =
      findDisplay(settings.board.displayId) ||
      displays.find(d => d.id !== hostDisplay.id) ||
      primary;

    const hostArea = settings.host.fullscreen ? hostDisplay.bounds : hostDisplay.workArea;
    return {
      host: {
        x: settings.host.fullscreen ? hostArea.x : hostArea.x + 40,
        y: settings.host.fullscreen ? hostArea.y : hostArea.y + 40,
        width: settings.host.fullscreen ? hostArea.width : Math.min(1040, hostArea.width - 80),
        height: settings.host.fullscreen ? hostArea.height : Math.min(760, hostArea.height - 80),
        fullscreen: !!settings.host.fullscreen
      },
      board: {
        x: boardDisplay.bounds.x,
        y: boardDisplay.bounds.y,
        width: boardDisplay.bounds.width,
        height: boardDisplay.bounds.height,
        fullscreen: !!settings.board.fullscreen
      }
    };
  }

  // ---- Tryb automatyczny (jak dotychczas) ----
  const secondary = displays.find(d => d.id !== primary.id);

  if (secondary) {
    return {
      host: {
        x: primary.workArea.x + 40,
        y: primary.workArea.y + 40,
        width: Math.min(1040, primary.workArea.width - 80),
        height: Math.min(760, primary.workArea.height - 80),
        fullscreen: false
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
    host: { x: wa.x, y: wa.y, width: hostWidth, height: wa.height, fullscreen: false },
    board: { x: wa.x + hostWidth, y: wa.y, width: boardWidth, height: wa.height, fullscreen: false }
  };
}

function createHostWindow(bounds) {
  hostWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
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

  hostWindow.once('ready-to-show', () => {
    if (!hostWindow) return;
    if (bounds.fullscreen) hostWindow.setFullScreen(true);
  });

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
    icon: path.join(__dirname, 'assets', 'icon.ico'),
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

/* ---------- IPC: autozapis / autoodczyt banku pytań (bez okna dialogowego) ---------- */

ipcMain.handle('save-bank', async (_event, jsonString) => {
  try {
    fs.writeFileSync(getBankFilePath(), jsonString, 'utf-8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('load-bank', async () => {
  try {
    const filePath = getBankFilePath();
    if (!fs.existsSync(filePath)) return { ok: false, notFound: true };
    const content = fs.readFileSync(filePath, 'utf-8');
    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

/* ---------- IPC: ustawienia ekranu (monitor / rozdzielczość / tryb dla każdego okna) ---------- */

ipcMain.handle('get-displays', () => {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map(d => ({
    id: d.id,
    isPrimary: d.id === primary.id,
    width: d.bounds.width,
    height: d.bounds.height,
    label: `${d.bounds.width}×${d.bounds.height}${d.id === primary.id ? ' (główny)' : ''}`
  }));
});

ipcMain.handle('load-display-settings', () => {
  currentDisplaySettings = loadDisplaySettingsFromDisk();
  return currentDisplaySettings;
});

ipcMain.handle('apply-display-settings', (_event, settings) => {
  try {
    const clean = {
      mode: settings?.mode === 'manual' ? 'manual' : 'auto',
      host: { displayId: settings?.host?.displayId ?? null, fullscreen: !!settings?.host?.fullscreen },
      board: { displayId: settings?.board?.displayId ?? null, fullscreen: settings?.board?.fullscreen !== false }
    };
    currentDisplaySettings = clean;
    fs.writeFileSync(getDisplaySettingsFilePath(), JSON.stringify(clean, null, 2), 'utf-8');

    const layout = computeLayout(clean);

    // Okno Prowadzącego: zmieniamy rozmiar/pozycję i tryb pełnoekranowy na żywo, bez restartu.
    if (hostWindow && !hostWindow.isDestroyed()) {
      hostWindow.setFullScreen(false);
      hostWindow.setBounds({ x: layout.host.x, y: layout.host.y, width: layout.host.width, height: layout.host.height });
      if (layout.host.fullscreen) hostWindow.setFullScreen(true);
    }

    // Okno Planszy: to samo, a jeśli było zamknięte — otwieramy je od nowa w nowym miejscu.
    if (boardWindow && !boardWindow.isDestroyed()) {
      boardWindow.setFullScreen(false);
      boardWindow.setBounds({ x: layout.board.x, y: layout.board.y, width: layout.board.width, height: layout.board.height });
      if (layout.board.fullscreen) boardWindow.setFullScreen(true);
      boardWindow.showInactive();
      if (hostWindow && !hostWindow.isDestroyed()) hostWindow.focus();
    } else {
      createBoardWindow(layout.board);
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});