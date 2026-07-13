const imageInput = document.getElementById('imageInput');
const spacingInput = document.getElementById('spacing');
const maxDotsInput = document.getElementById('maxDots');
const lightCutoffInput = document.getElementById('lightCutoff');
const dotDelayInput = document.getElementById('dotDelay');
const drawModeInput = document.getElementById('drawMode');
const colorModeInput = document.getElementById('colorMode');
const paletteLevelsInput = document.getElementById('paletteLevels');
const selectAreaButton = document.getElementById('selectArea');
const startDrawingButton = document.getElementById('startDrawing');
const exportPlanButton = document.getElementById('exportPlan');
const stopDrawingButton = document.getElementById('stopDrawing');
const continueColorButton = document.getElementById('continueColor');
const statusBadge = document.getElementById('statusBadge');
const imageDetails = document.getElementById('imageDetails');
const areaDetails = document.getElementById('areaDetails');
const planDetails = document.getElementById('planDetails');
const colorDetails = document.getElementById('colorDetails');
const previewCanvas = document.getElementById('previewCanvas');
const previewContext = previewCanvas.getContext('2d', { willReadFrequently: true });

let sourceImage = null;
let sourceImageUrl = null;
let drawArea = null;
let currentPlan = [];
let continueColorResolver = null;

function setStatus(message) {
  statusBadge.textContent = message;
}

function numericValue(input, fallback, minimum, maximum) {
  const value = Number(input.value);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, value));
}

function getSettings() {
  return {
    spacing: numericValue(spacingInput, 6, 1, 40),
    maxDots: numericValue(maxDotsInput, 5000, 10, 60000),
    lightCutoff: numericValue(lightCutoffInput, 245, 0, 255),
    dotDelay: numericValue(dotDelayInput, 1, 0, 100),
    mode: drawModeInput.value === 'drag' ? 'drag' : 'click',
    colorMode: colorModeInput.value === 'passes' ? 'passes' : 'single',
    paletteLevels: numericValue(paletteLevelsInput, 6, 2, 12)
  };
}

function luminance(red, green, blue) {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function quantizeChannel(value, levels) {
  if (levels <= 2) return value < 128 ? 0 : 255;
  const step = 255 / (levels - 1);
  return Math.round(Math.round(value / step) * step);
}

function quantizeColor(red, green, blue, levels) {
  return {
    red: quantizeChannel(red, levels),
    green: quantizeChannel(green, levels),
    blue: quantizeChannel(blue, levels)
  };
}

function colorKey(color) {
  return `${color.red},${color.green},${color.blue}`;
}

function colorCss(color) {
  return `rgb(${color.red}, ${color.green}, ${color.blue})`;
}

function drawEmptyPreview() {
  previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewContext.fillStyle = '#010409';
  previewContext.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewContext.fillStyle = '#8b949e';
  previewContext.font = '22px Segoe UI, Arial';
  previewContext.fillText('Load an image to begin.', 32, 54);
}

function drawPreview() {
  if (!sourceImage) {
    drawEmptyPreview();
    return;
  }

  previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewContext.fillStyle = '#010409';
  previewContext.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  const scale = Math.min(previewCanvas.width / sourceImage.width, previewCanvas.height / sourceImage.height);
  const width = sourceImage.width * scale;
  const height = sourceImage.height * scale;
  const left = (previewCanvas.width - width) / 2;
  const top = (previewCanvas.height - height) / 2;

  previewContext.imageSmoothingEnabled = false;
  previewContext.drawImage(sourceImage, left, top, width, height);
  previewContext.strokeStyle = '#58a6ff';
  previewContext.lineWidth = 2;
  previewContext.strokeRect(left, top, width, height);
}

function buildDrawingPlan() {
  if (!sourceImage || !drawArea) return [];

  const settings = getSettings();
  const sampleWidth = Math.max(1, Math.floor(drawArea.width / settings.spacing));
  const sampleHeight = Math.max(1, Math.floor(drawArea.height / settings.spacing));
  const sampler = document.createElement('canvas');
  sampler.width = sampleWidth;
  sampler.height = sampleHeight;
  const samplerContext = sampler.getContext('2d', { willReadFrequently: true });
  samplerContext.drawImage(sourceImage, 0, 0, sampleWidth, sampleHeight);

  const pixels = samplerContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const plan = [];

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const offset = (y * sampleWidth + x) * 4;
      const alpha = pixels[offset + 3];
      if (alpha < 32) continue;

      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const shade = luminance(red, green, blue);
      if (shade >= settings.lightCutoff) continue;

      const compatibleColor = settings.colorMode === 'passes'
        ? quantizeColor(red, green, blue, settings.paletteLevels)
        : { red, green, blue };
      plan.push({
        x: drawArea.x + Math.round((x + 0.5) * settings.spacing),
        y: drawArea.y + Math.round((y + 0.5) * settings.spacing),
        delay: settings.dotDelay,
        mode: settings.mode,
        shade,
        color: { ...compatibleColor, alpha },
        colorKey: colorKey(compatibleColor)
      });
    }
  }

  return plan
    .sort((first, second) => first.shade - second.shade || first.colorKey.localeCompare(second.colorKey))
    .slice(0, settings.maxDots)
    .map(({ x, y, delay, mode, color, colorKey: key }) => ({ x, y, delay, mode, color, colorKey: key }));
}

function buildColorPasses(plan) {
  const passes = new Map();
  for (const point of plan) {
    const key = point.colorKey || 'single';
    if (!passes.has(key)) passes.set(key, { color: point.color, points: [] });
    passes.get(key).points.push(point);
  }
  return [...passes.values()].sort((first, second) => {
    const firstShade = luminance(first.color.red, first.color.green, first.color.blue);
    const secondShade = luminance(second.color.red, second.color.green, second.color.blue);
    return firstShade - secondShade;
  });
}

function refreshPlanDetails() {
  currentPlan = buildDrawingPlan();
  const settings = getSettings();
  const passes = settings.colorMode === 'passes' ? buildColorPasses(currentPlan) : [];
  planDetails.textContent = currentPlan.length
    ? `${currentPlan.length.toLocaleString()} dots planned, sorted darkest to lightest.`
    : 'No drawing plan generated.';
  colorDetails.textContent = settings.colorMode === 'passes'
    ? `${passes.length.toLocaleString()} color passes planned. The app pauses before each color so you can set the brush, then press F7.`
    : 'Color compatibility is in single-brush mode.';
}

async function loadImageFile(file) {
  if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
  sourceImageUrl = URL.createObjectURL(file);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('Could not load that image file.'));
    image.src = sourceImageUrl;
  });
  sourceImage = image;
  imageDetails.textContent = `${file.name} • ${image.width}×${image.height}`;
  setStatus('Image loaded');
  drawPreview();
  refreshPlanDetails();
}

imageInput.addEventListener('change', async () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  try {
    await loadImageFile(file);
  } catch (error) {
    setStatus(error.message);
  }
});

for (const input of [spacingInput, maxDotsInput, lightCutoffInput, dotDelayInput, drawModeInput, colorModeInput, paletteLevelsInput]) {
  input.addEventListener('input', refreshPlanDetails);
}

selectAreaButton.addEventListener('click', async () => {
  if (!window.manualDrawer?.selectDrawArea) {
    setStatus('Run with Electron to select a real screen area.');
    return;
  }

  setStatus('Drag a draw-space box on the overlay');
  const selectedArea = await window.manualDrawer.selectDrawArea();
  if (!selectedArea) {
    setStatus('Area selection cancelled');
    return;
  }

  drawArea = selectedArea;
  areaDetails.textContent = `x ${drawArea.x}, y ${drawArea.y}, ${drawArea.width}×${drawArea.height}`;
  setStatus('Draw space selected');
  refreshPlanDetails();
});

function waitForColorContinue() {
  return new Promise((resolve) => {
    continueColorResolver = resolve;
  });
}

function continueColorPass() {
  if (!continueColorResolver) return false;
  continueColorResolver();
  continueColorResolver = null;
  return true;
}

startDrawingButton.addEventListener('click', async () => {
  if (!window.manualDrawer?.drawPlan) {
    setStatus('Run with Electron to control the mouse.');
    return;
  }

  currentPlan = buildDrawingPlan();
  if (!currentPlan.length) {
    setStatus('Load an image and select a draw space first.');
    return;
  }

  const settings = getSettings();
  try {
    if (settings.colorMode === 'passes') {
      const passes = buildColorPasses(currentPlan);
      for (let index = 0; index < passes.length; index += 1) {
        const pass = passes[index];
        colorDetails.innerHTML = `Set brush color to <span class=\"swatch\" style=\"background:${colorCss(pass.color)}\"></span> ${colorCss(pass.color)} for pass ${index + 1}/${passes.length}, then press F7 or Continue.`;
        setStatus(`Waiting for color pass ${index + 1}/${passes.length}`);
        await waitForColorContinue();
        setStatus(`Drawing color pass ${index + 1}/${passes.length}`);
        const result = await window.manualDrawer.drawPlan({ points: pass.points });
        if (result.stopped) {
          setStatus('Stopped during color drawing');
          return;
        }
      }
      setStatus('Finished all color passes');
      return;
    }

    setStatus(`Drawing ${currentPlan.length.toLocaleString()} dots`);
    const result = await window.manualDrawer.drawPlan({ points: currentPlan });
    setStatus(result.stopped
      ? `Stopped after sending ${result.drawn.toLocaleString()} dots`
      : `Finished ${result.drawn.toLocaleString()} dots`);
  } catch (error) {
    setStatus(error.message);
  }
});

continueColorButton.addEventListener('click', () => {
  if (!continueColorPass()) setStatus('No color pass is waiting');
});

stopDrawingButton.addEventListener('click', async () => {
  if (!window.manualDrawer?.stopDrawing) {
    setStatus('Run with Electron to stop an active drawing job.');
    return;
  }

  const result = await window.manualDrawer.stopDrawing();
  setStatus(result.stopped ? 'Stop requested' : 'No drawing job is running');
});

window.manualDrawer?.onDrawingStopped?.(() => {
  setStatus('Stopped by F8 emergency key');
});

window.manualDrawer?.onColorContinue?.(() => {
  if (!continueColorPass()) setStatus('F7 received, but no color pass is waiting');
});

exportPlanButton.addEventListener('click', () => {
  currentPlan = buildDrawingPlan();
  const blob = new Blob([JSON.stringify({ drawArea, points: currentPlan }, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'manual-image-drawer-plan.json';
  link.click();
  URL.revokeObjectURL(link.href);
});

drawEmptyPreview();
