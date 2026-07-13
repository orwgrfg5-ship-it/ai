const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('manualDrawer', {
  selectDrawArea: () => ipcRenderer.invoke('select-draw-area'),
  drawPlan: (payload) => ipcRenderer.invoke('draw-plan', payload),
  stopDrawing: () => ipcRenderer.invoke('stop-drawing'),
  onDrawingStopped: (callback) => {
    ipcRenderer.removeAllListeners('drawing-stopped');
    ipcRenderer.on('drawing-stopped', () => callback());
  },
  finishAreaSelection: (area) => ipcRenderer.send('finish-area-selection', area),
  platform: process.platform
});
