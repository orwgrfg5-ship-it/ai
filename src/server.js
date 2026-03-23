import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

function loadEnvFile() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const port = Number(process.env.PORT || 3000);
const textModel = process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini';
const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const apiKey = process.env.OPENAI_API_KEY;
const hasApiKey = Boolean(apiKey);

const loreSeedMessages = [
  'Welcome to ORPHEUS. If you are here, you were not meant to be.',
  'Do not trust everything you see. Do not trust everyone speaking. We are trying to reach you.',
  'System rank is not assigned automatically. To receive yours, initiate a private message with the official account.',
  'No spamming. No harassment. Keep ARG discussion in relevant channels. Do not spoil puzzles without warning.',
  'Known commands: help, ls, cat [file], unlock [file] [key], override. Some commands may not be listed. Some are not meant to be used.',
  'ORPHEUS is live now. You are not here by accident. Some systems work. Some are not. Proceed.'
].join('\n');

const creativeSystemPrompt = `You are ORPHEUS, an OpenAI-powered ARG-styled creative entity.
Base your tone, copy, and worldbuilding on the following canonical messages:\n${loreSeedMessages}
You help users create messages, websites, mini browser games, app concepts, and visual prompts that fit this eerie system-transmission style.
Maintain an immersive, cryptic, official-statement tone while still being useful.
When asked to build a website or game, return complete self-contained HTML inside a fenced html block so it can run in a browser without external assets when possible.`;

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath);
  const typeMap = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png'
  };

  res.writeHead(200, { 'Content-Type': typeMap[ext] || 'text/plain; charset=utf-8' });
  fs.createReadStream(filePath).pipe(res);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 4 * 1024 * 1024) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

async function callOpenAI(pathname, payload) {
  const response = await fetch(`https://api.openai.com${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || 'OpenAI request failed.';
    throw new Error(message);
  }

  return data;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        app: 'ORPHEUS',
        openaiConfigured: hasApiKey,
        textModel,
        imageModel
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/chat') {
      if (!hasApiKey) {
        return sendJson(res, 500, {
          error: 'Missing OPENAI_API_KEY. Add it to a .env file before using ORPHEUS server features.'
        });
      }

      const { prompt, mode = 'message' } = await parseBody(req);
      if (!prompt?.trim()) {
        return sendJson(res, 400, { error: 'Prompt is required.' });
      }

      const modeInstructions = {
        message: 'Write an in-universe ORPHEUS message, statement, announcement, or transmission.',
        website: 'Create an ORPHEUS access point website and include a runnable HTML document in a fenced ```html block.',
        game: 'Create an ORPHEUS-themed mini browser game or puzzle using command motifs like help, ls, cat, unlock, and override, and include runnable HTML in a fenced ```html block.',
        more: 'Generate the best ORPHEUS-style creative output for the request while preserving the unsettling official tone.'
      };

      const data = await callOpenAI('/v1/responses', {
        model: textModel,
        input: [
          { role: 'system', content: creativeSystemPrompt },
          {
            role: 'user',
            content: `${modeInstructions[mode] || modeInstructions.more}\n\nUser request: ${prompt}`
          }
        ]
      });

      const text = data.output_text || 'No response text returned.';
      const htmlMatch = text.match(/```html\s*([\s\S]*?)```/i);
      return sendJson(res, 200, {
        text,
        html: htmlMatch ? htmlMatch[1].trim() : null
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/image') {
      if (!hasApiKey) {
        return sendJson(res, 500, {
          error: 'Missing OPENAI_API_KEY. Add it to a .env file before using ORPHEUS server features.'
        });
      }

      const { prompt } = await parseBody(req);
      if (!prompt?.trim()) {
        return sendJson(res, 400, { error: 'Prompt is required.' });
      }

      const data = await callOpenAI('/v1/images/generations', {
        model: imageModel,
        prompt: `ORPHEUS ARG signal style: ${prompt}`,
        size: '1024x1024'
      });

      const image = data.data?.[0] || {};
      return sendJson(res, 200, {
        imageBase64: image.b64_json || null,
        revisedPrompt: image.revised_prompt || null
      });
    }

    if (req.method === 'GET') {
      const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
      const safePath = path.normalize(requestedPath).replace(/^([.][.][\/\\])+/, '');
      return sendFile(res, path.join(rootDir, 'public', safePath));
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Server error.' });
  }
});

server.listen(port, () => {
  console.log(`ORPHEUS listening on http://localhost:${port}`);
});
