# Manual Image Drawer for Windows 11

This branch intentionally replaces the previous ORPHEUS/static-site work with a focused Windows desktop app.

Manual Image Drawer lets you load an image, select a rectangular area anywhere on your Windows screen, and then manually reproduce the image by sending normal mouse clicks into that selected area. The generated plan sorts sampled pixels from darkest to lightest first.

## Features

- Imports any image format supported by Chromium/Electron.
- Provides a full-screen transparent overlay so you can drag a box around the exact draw space.
- Samples the loaded image to fit the selected area.
- Draws darker pixels first by sorting points by luminance.
- Skips transparent and very light pixels to reduce extra mouse clicks.
- Includes spacing, max-dot, light-cutoff, delay, click/drag mode, and palette controls for compatibility.
- Adds a color-pass mode that groups similar colors. It can either pause before each color or automatically send the color to Krita through the bundled plugin.
- Exports the generated dark-first drawing plan as JSON for debugging or reuse.
- Stops an active drawing run with the global `F8` emergency hotkey or the in-app stop button.
- Packages as a portable Windows `.exe` through Electron Builder.

## Run locally

```bash
npm install
npm start
```

## Build the Windows executable

```bash
npm install
npm run build:win
```

Electron Builder writes the portable `.exe` into `dist/`.

## Krita automatic color setup

The app includes a small Krita Python plugin in `krita-plugin/`. To let Manual Image Drawer automatically change Krita's foreground brush color:

1. Copy `krita_auto_color.desktop` and `krita_auto_color.py` from `krita-plugin/` into Krita's `pykrita` plugin folder.
2. Restart Krita.
3. In Krita, enable **Manual Image Drawer Auto Color** from Python Plugin Manager if it is not already enabled.
4. Open a Krita document and keep it active.
5. In Manual Image Drawer, set **Color compatibility** to color passes and **Krita auto color** to on.

The plugin listens only on `127.0.0.1:17491` by default and updates Krita's active view foreground color.

## Compatibility notes

The app avoids native Node mouse-driver addons. On Windows it writes a temporary PowerShell script that uses the standard `user32.dll` mouse API, so the generated executable remains simple and broadly compatible with Windows 11 machines that allow regular mouse automation.

Start with high spacing and a low maximum-dot count while testing. The app sends real mouse input, so keep the target drawing surface focused and do not touch the mouse until drawing finishes. If you use manual color-pass mode, set your target app brush to the shown RGB color before each pass, then press `F7` to continue. If Krita auto color is enabled and the plugin is running, the app sends each pass color to Krita automatically instead. If you need to stop a run, press `F8` or return to the app and click **Stop drawing now**.
