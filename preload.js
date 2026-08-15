const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('familiadaAPI', {
  // Dialogi plików (edytor pytań)
  exportJson: (jsonString) => ipcRenderer.invoke('export-json', jsonString),
  importJson: () => ipcRenderer.invoke('import-json'),

  // Autozapis / autoodczyt banku pytań (bez okna dialogowego, przeżywa restart aplikacji)
  saveBank: (jsonString) => ipcRenderer.invoke('save-bank', jsonString),
  loadBank: () => ipcRenderer.invoke('load-bank'),

  // Ustawienia ekranu: lista monitorów, wczytanie/zapisanie i natychmiastowe zastosowanie wyboru
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  loadDisplaySettings: () => ipcRenderer.invoke('load-display-settings'),
  applyDisplaySettings: (settings) => ipcRenderer.invoke('apply-display-settings', settings),

  // Okno Prowadzącego -> Okno Planszy: wysyła aktualny stan gry
  syncBoard: (payload) => ipcRenderer.send('board-sync', payload),

  // Okno Planszy: nasłuchuje aktualizacji stanu gry
  onBoardUpdate: (callback) => ipcRenderer.on('board-state-update', (_event, data) => callback(data)),

  // Okno Prowadzącego: przywraca / przełącza fokus na okno Planszy, jeśli zostało zamknięte
  focusOrReopenBoard: () => ipcRenderer.invoke('focus-or-reopen-board'),

  platform: process.platform
});