const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('familiadaAPI', {
  // Dialogi plików (edytor pytań)
  exportJson: (jsonString) => ipcRenderer.invoke('export-json', jsonString),
  importJson: () => ipcRenderer.invoke('import-json'),

  // Okno Prowadzącego -> Okno Planszy: wysyła aktualny stan gry
  syncBoard: (payload) => ipcRenderer.send('board-sync', payload),

  // Okno Planszy: nasłuchuje aktualizacji stanu gry
  onBoardUpdate: (callback) => ipcRenderer.on('board-state-update', (_event, data) => callback(data)),

  // Okno Prowadzącego: przywraca / przełącza fokus na okno Planszy, jeśli zostało zamknięte
  focusOrReopenBoard: () => ipcRenderer.invoke('focus-or-reopen-board'),

  platform: process.platform
});
