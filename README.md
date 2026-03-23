# ORPHEUS

ORPHEUS is now a **static GitHub-friendly website** with an ARG-inspired transmission interface. It can:

- make messages and written content
- generate images
- build websites
- create mini browser games
- render generated HTML in a built-in web display
- run directly from GitHub Pages without a backend

## How it works on GitHub

This version is designed for GitHub Pages or any static host:

- `index.html` is the entrypoint
- `app.js` calls the OpenAI API directly from the browser
- `styles.css` contains the full site styling
- your OpenAI API key is entered in the UI and stored only in your browser `localStorage`

## Files

- `index.html` — the ORPHEUS interface
- `app.js` — client-side OpenAI calls, previews, settings storage, and command presets
- `styles.css` — the signal/terminal UI styling

## GitHub Pages setup

1. Push this repository to GitHub.
2. In your repository settings, enable **Pages**.
3. Set the source to the repository root branch.
4. Open the generated GitHub Pages URL.
5. Enter your OpenAI API key in the site UI.

## Important note

Because this is a static site, the OpenAI API key is used in the browser. That makes it convenient for personal prototypes on GitHub Pages, but it is **not appropriate for public production use with a shared secret**.

If you want to make ORPHEUS public for many users, the safer next step would be adding a backend proxy outside GitHub Pages.
