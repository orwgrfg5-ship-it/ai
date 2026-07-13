import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('standalone Windows drawing app files exist', () => {
  for (const file of ['index.html', 'app.js', 'styles.css', 'main.cjs', 'preload.cjs']) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  }
});

test('UI is focused on manual image drawing instead of the old site', () => {
  const html = read('index.html');
  assert.match(html, /Manual Image Drawer/);
  assert.match(html, /Select draw space/);
  assert.match(html, /Stop drawing now/);
  assert.match(html, /F8/);
  assert.match(html, /Color compatibility/);
  assert.match(html, /Continue color pass/);
  assert.doesNotMatch(html, /OpenAI API key/);
  assert.doesNotMatch(html, /ORPHEUS OFFICIAL STATEMENT/);
});

test('draw planner sorts darker pixels first and supports export', () => {
  const js = read('app.js');
  assert.match(js, /function buildDrawingPlan/);
  assert.match(js, /first\.shade - second\.shade/);
  assert.match(js, /function buildColorPasses/);
  assert.match(js, /quantizeColor/);
  assert.match(js, /manual-image-drawer-plan\.json/);
});

test('Electron main process provides selection overlay and Windows mouse bridge', () => {
  const main = read('main.cjs');
  assert.match(main, /select-draw-area/);
  assert.match(main, /finish-area-selection/);
  assert.match(main, /draw-plan/);
  assert.match(main, /stop-drawing/);
  assert.match(main, /globalShortcut\.register\('F8'/);
  assert.match(main, /globalShortcut\.register\('F7'/);
  assert.match(main, /powershell\.exe/);
  assert.match(main, /user32\.dll/);
});

test('package metadata can produce a portable Windows executable', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.main, 'main.cjs');
  assert.equal(pkg.scripts.start, 'electron .');
  assert.equal(pkg.scripts['build:win'], 'electron-builder --win portable --x64');
  assert.deepEqual(pkg.build.win.target, ['portable']);
});
