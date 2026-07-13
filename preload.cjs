const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('manualDrawer', {
  selectDrawArea: () => ipcRenderer.invoke('select-draw-area'),
  drawPlan: (payload) => ipcRenderer.invoke('draw-plan', payload),
  finishAreaSelection: (area) => ipcRenderer.send('finish-area-selection', area),
  platform: process.platform
});
