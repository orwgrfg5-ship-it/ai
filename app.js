const STORAGE_KEY = 'orpheus-github-settings';
const modeEl = document.getElementById('mode');
const apiKeyEl = document.getElementById('apiKey');
const textModelEl = document.getElementById('textModel');
const imageModelEl = document.getElementById('imageModel');
const promptEl = document.getElementById('prompt');
const responseTextEl = document.getElementById('responseText');
const imageResultEl = document.getElementById('imageResult');
const statusBadgeEl = document.getElementById('statusBadge');
const previewFrameEl = document.getElementById('previewFrame');
const presetEls = document.querySelectorAll('.preset');

const fallbackTransmission = `Welcome to ORPHEUS.\n\nIf you are here, you were not meant to be.\n\nDo not trust everything you see.\nDo not trust everyone speaking.\n\nWe are trying to reach you.`;
const loreSeedMessages = [
  'Welcome to ORPHEUS. If you are here, you were not meant to be.',
  'Do not trust everything you see. Do not trust everyone speaking. We are trying to reach you.',
  'System rank is not assigned automatically. To receive yours, initiate a private message with the official account.',
  'No spamming. No harassment. Keep ARG discussion in relevant channels. Do not spoil puzzles without warning.',
  'Known commands: help, ls, cat [file], unlock [file] [key], override. Some commands may not be listed. Some are not meant to be used.',
  'ORPHEUS is live now. You are not here by accident. Some systems work. Some are not. Proceed.'
].join('\n');

let latestHtml = `<!DOCTYPE html><html><body style="margin:0;background:#020409;color:#d7dde8;font-family:monospace;padding:32px;"><h1>Welcome to ORPHEUS.</h1><p>If you are here, you were not meant to be.</p><p>Do not trust everything you see.<br>Do not trust everyone speaking.</p><p>We are trying to reach you.</p></body></html>`;
previewFrameEl.srcdoc = latestHtml;
responseTextEl.textContent = fallbackTransmission;

function updateStatus() {
  statusBadgeEl.textContent = apiKeyEl.value.trim() ? `Ready • ${textModelEl.value.trim()}` : 'Add OpenAI API key';
}

function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    updateStatus();
    return;
  }

  try {
    const settings = JSON.parse(raw);
    apiKeyEl.value = settings.apiKey || '';
    textModelEl.value = settings.textModel || 'gpt-4.1-mini';
    imageModelEl.value = settings.imageModel || 'gpt-image-1';
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  updateStatus();
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    apiKey: apiKeyEl.value.trim(),
    textModel: textModelEl.value.trim() || 'gpt-4.1-mini',
    imageModel: imageModelEl.value.trim() || 'gpt-image-1'
  }));
  updateStatus();
  responseTextEl.textContent = '[Local settings saved in this browser.]';
}

function clearSettings() {
  localStorage.removeItem(STORAGE_KEY);
  apiKeyEl.value = '';
  textModelEl.value = 'gpt-4.1-mini';
  imageModelEl.value = 'gpt-image-1';
  updateStatus();
  responseTextEl.textContent = '[Local API key cleared.]';
}

function requireApiKey() {
  if (apiKeyEl.value.trim()) return true;
  responseTextEl.textContent = 'Signal error: enter your OpenAI API key first. It stays only in your browser storage.';
  return false;
}

function extractHtml(text) {
  const htmlMatch = text.match(/```html\s*([\s\S]*?)```/i);
  return htmlMatch ? htmlMatch[1].trim() : null;
}

async function callOpenAI(pathname, payload) {
  const response = await fetch(`https://api.openai.com${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKeyEl.value.trim()}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'OpenAI request failed.');
  }
  return data;
}

async function generateText() {
  if (!requireApiKey()) return;
  responseTextEl.textContent = '[Transmission in progress]';

  const modeInstructions = {
    message: 'Write an in-universe ORPHEUS message, statement, announcement, or transmission.',
    website: 'Create an ORPHEUS access point website for GitHub Pages and include a runnable single-file HTML document in a fenced ```html block.',
    game: 'Create an ORPHEUS-themed mini browser game or puzzle using command motifs like help, ls, cat, unlock, and override, and include runnable HTML in a fenced ```html block.',
    more: 'Generate the best ORPHEUS-style creative output for the request while preserving the unsettling official tone.'
  };

  try {
    const data = await callOpenAI('/v1/responses', {
      model: textModelEl.value.trim() || 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: `You are ORPHEUS, an OpenAI-powered ARG-styled creative entity. Base your tone, copy, and worldbuilding on the following canonical messages:\n${loreSeedMessages}\nYou help users create messages, static websites for GitHub Pages, mini browser games, app concepts, and visual prompts that fit this eerie system-transmission style. Maintain an immersive, cryptic, official-statement tone while still being useful. When asked to build a website or game, return complete self-contained HTML inside a fenced html block.`
        },
        {
          role: 'user',
          content: `${modeInstructions[modeEl.value] || modeInstructions.more}\n\nUser request: ${promptEl.value || fallbackTransmission}`
        }
      ]
    });

    const text = data.output_text || fallbackTransmission;
    responseTextEl.textContent = text;
    const extractedHtml = extractHtml(text);
    if (extractedHtml) {
      latestHtml = extractedHtml;
      previewFrameEl.srcdoc = latestHtml;
    }
  } catch (error) {
    responseTextEl.textContent = `Signal error: ${error.message}`;
  }
}

async function generateImage() {
  if (!requireApiKey()) return;
  imageResultEl.classList.remove('empty');
  imageResultEl.textContent = 'Rendering signal…';

  try {
    const data = await callOpenAI('/v1/images/generations', {
      model: imageModelEl.value.trim() || 'gpt-image-1',
      prompt: `ORPHEUS ARG signal style for a GitHub-hosted site: ${promptEl.value || 'A dark glitchy terminal access point with cryptic warnings and signal distortion.'}`,
      size: '1024x1024'
    });

    const image = data.data?.[0];
    if (!image?.b64_json) {
      imageResultEl.textContent = 'No image was returned.';
      return;
    }

    imageResultEl.innerHTML = `<div><img alt="Generated by ORPHEUS" src="data:image/png;base64,${image.b64_json}" />${image.revised_prompt ? `<p>${image.revised_prompt}</p>` : ''}</div>`;
  } catch (error) {
    imageResultEl.textContent = `Signal error: ${error.message}`;
  }
}

function copyOutput() {
  navigator.clipboard.writeText(responseTextEl.textContent || '').then(() => {
    statusBadgeEl.textContent = 'Output copied';
    setTimeout(updateStatus, 1200);
  });
}

presetEls.forEach((button) => {
  button.addEventListener('click', () => {
    promptEl.value = button.dataset.prompt || '';
  });
});

apiKeyEl.addEventListener('input', updateStatus);
textModelEl.addEventListener('input', updateStatus);
document.getElementById('saveSettings').addEventListener('click', saveSettings);
document.getElementById('clearSettings').addEventListener('click', clearSettings);
document.getElementById('sendButton').addEventListener('click', generateText);
document.getElementById('generateText').addEventListener('click', generateText);
document.getElementById('generateImage').addEventListener('click', generateImage);
document.getElementById('copyOutput').addEventListener('click', copyOutput);
document.getElementById('openPreview').addEventListener('click', () => {
  const previewWindow = window.open();
  if (previewWindow) {
    previewWindow.document.write(latestHtml);
    previewWindow.document.close();
  }
});

loadSettings();


promptEl.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    generateText();
  }
});
