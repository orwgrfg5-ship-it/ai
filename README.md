# ORPHEUS

ORPHEUS is a lightweight OpenAI-powered creative studio with an ARG-inspired transmission interface. It can:

- make messages and written content
- generate images
- build websites
- create mini browser games
- render generated HTML in a built-in web display

## Stack

- Node.js
- Express
- OpenAI API
- Plain HTML/CSS/JavaScript frontend

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and add your OpenAI key:

   ```bash
   cp .env.example .env
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

## Environment variables

- `OPENAI_API_KEY`: required for chat and image generation.
- `PORT`: optional, defaults to `3000`.
- `OPENAI_TEXT_MODEL`: optional, defaults to `gpt-4.1-mini`.
- `OPENAI_IMAGE_MODEL`: optional, defaults to `gpt-image-1`.

## API routes

- `GET /api/health` — returns app status and model configuration.
- `POST /api/chat` — generates text and optionally runnable HTML.
- `POST /api/image` — generates an image using the OpenAI image API.

## Tone and message base

The UI and generation prompt are now based on the provided ORPHEUS transmissions, official statements, rule lists, and command hints so generated content feels closer to an in-universe system interface.

## How the web display works

When ORPHEUS returns fenced `html` code in `/api/chat`, the frontend extracts it and renders it directly inside the preview iframe. That gives you a fast built-in display for generated websites, games, and prototypes.
