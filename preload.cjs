const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('manualDrawer', {
  selectDrawArea: () => ipcRenderer.invoke('select-draw-area'),
  drawPlan: (payload) => ipcRenderer.invoke('draw-plan', payload),
  stopDrawing: () => ipcRenderer.invoke('stop-drawing'),
  setKritaColor: (payload) => ipcRenderer.invoke('set-krita-color', payload),
  onDrawingStopped: (callback) => {
    ipcRenderer.removeAllListeners('drawing-stopped');
    ipcRenderer.on('drawing-stopped', () => callback());
  },
  onColorContinue: (callback) => {
    ipcRenderer.removeAllListeners('drawing-continue');
    ipcRenderer.on('drawing-continue', () => callback());
  },
  finishAreaSelection: (area) => ipcRenderer.send('finish-area-selection', area),
  platform: process.platform
});
