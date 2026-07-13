const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let mainWindow;
let selectionWindow;
let selectionResolver;
let currentDrawingChild = null;
let stopRequested = false;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#0d1117',
    title: 'Manual Image Drawer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

function closeSelectionWindow(area = null) {
  if (selectionResolver) {
    selectionResolver(area);
    selectionResolver = null;
  }
  if (selectionWindow && !selectionWindow.isDestroyed()) {
    selectionWindow.close();
  }
  selectionWindow = null;
}

function sendColorContinue() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('drawing-continue');
  }
}

function stopActiveDrawing() {
  if (!currentDrawingChild) return false;
  stopRequested = true;
  currentDrawingChild.kill();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('drawing-stopped');
  }
  return true;
}

function getSelectionOverlayHtml() {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; cursor: crosshair; background: rgba(0,0,0,.16); font-family: Segoe UI, Arial, sans-serif; }
  #help { position: fixed; top: 20px; left: 20px; max-width: 520px; color: white; background: rgba(13,17,23,.9); border: 1px solid #58a6ff; border-radius: 14px; padding: 14px 16px; box-shadow: 0 16px 60px rgba(0,0,0,.35); }
  #box { position: fixed; display: none; border: 2px solid #58a6ff; background: rgba(88,166,255,.13); box-shadow: 0 0 0 9999px rgba(0,0,0,.2); }
</style>
</head>
<body>
  <div id="help">Drag a box over the exact Windows screen area to draw inside. Press Esc to cancel.</div>
  <div id="box"></div>
<script>
  const box = document.getElementById('box');
  let start = null;
  function updateBox(event) {
    if (!start) return;
    const left = Math.min(start.clientX, event.clientX);
    const top = Math.min(start.clientY, event.clientY);
    const width = Math.abs(event.clientX - start.clientX);
    const height = Math.abs(event.clientY - start.clientY);
    Object.assign(box.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' });
  }
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') window.manualDrawer.finishAreaSelection(null);
  });
  window.addEventListener('mousedown', (event) => {
    start = { screenX: event.screenX, screenY: event.screenY, clientX: event.clientX, clientY: event.clientY };
    box.style.display = 'block';
    updateBox(event);
  });
  window.addEventListener('mousemove', updateBox);
  window.addEventListener('mouseup', (event) => {
    if (!start) return;
    const area = {
      x: Math.min(start.screenX, event.screenX),
      y: Math.min(start.screenY, event.screenY),
      width: Math.abs(event.screenX - start.screenX),
      height: Math.abs(event.screenY - start.screenY)
    };
    window.manualDrawer.finishAreaSelection(area.width > 8 && area.height > 8 ? area : null);
  });
</script>
</body>
</html>`;
}

app.whenReady().then(() => {
  createMainWindow();
  globalShortcut.register('F8', stopActiveDrawing);
  globalShortcut.register('F7', sendColorContinue);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopActiveDrawing();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-draw-area', () => new Promise((resolve) => {
  closeSelectionWindow(null);
  selectionResolver = resolve;

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  selectionWindow = new BrowserWindow({
    ...display.bounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  selectionWindow.setAlwaysOnTop(true, 'screen-saver');
  selectionWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getSelectionOverlayHtml())}`);
}));

ipcMain.on('finish-area-selection', (_event, area) => {
  closeSelectionWindow(area);
});

function normalizePoints(points) {
  return points.slice(0, 60000).map((point) => ({
    x: Math.round(Number(point.x) || 0),
    y: Math.round(Number(point.y) || 0),
    delay: Math.max(0, Math.min(100, Math.round(Number(point.delay) || 0))),
    mode: point.mode === 'drag' ? 'drag' : 'click'
  }));
}

function buildPowerShellScript(jsonPath) {
  const safePath = jsonPath.replace(/'/g, "''");
  return `Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class MouseInput {
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
}
'@
$points = Get-Content -Raw '${safePath}' | ConvertFrom-Json
foreach ($point in $points) {
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point([int]$point.x, [int]$point.y)
  [MouseInput]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  if ($point.mode -eq 'drag') {
    Start-Sleep -Milliseconds 2
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(([int]$point.x + 1), [int]$point.y)
  }
  [MouseInput]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  if ($point.delay -gt 0) { Start-Sleep -Milliseconds $point.delay }
}
`;
}

ipcMain.handle('stop-drawing', () => ({ stopped: stopActiveDrawing() }));

ipcMain.handle('draw-plan', async (_event, payload) => {
  if (process.platform !== 'win32') {
    throw new Error('Manual mouse drawing is only available on Windows.');
  }

  const points = Array.isArray(payload?.points) ? normalizePoints(payload.points) : [];
  if (!points.length) return { drawn: 0 };

  const stamp = Date.now();
  const jsonPath = path.join(os.tmpdir(), `manual-image-drawer-${stamp}.json`);
  const scriptPath = path.join(os.tmpdir(), `manual-image-drawer-${stamp}.ps1`);
  fs.writeFileSync(jsonPath, JSON.stringify(points), 'utf8');
  fs.writeFileSync(scriptPath, buildPowerShellScript(jsonPath), 'utf8');

  stopRequested = false;

  await new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], { windowsHide: true });
    currentDrawingChild = child;
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      for (const file of [jsonPath, scriptPath]) {
        try { fs.unlinkSync(file); } catch {}
      }
      currentDrawingChild = null;
      if (stopRequested) resolve();
      else if (code === 0) resolve();
      else reject(new Error(stderr || `Drawing process exited with code ${code}`));
    });
  });

  const wasStopped = stopRequested;
  stopRequested = false;
  return { drawn: wasStopped ? 0 : points.length, stopped: wasStopped };
});
