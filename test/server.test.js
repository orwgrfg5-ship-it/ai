import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const root = process.cwd();

test('github pages entry files exist', () => {
  assert.equal(fs.existsSync(path.join(root, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(root, 'app.js')), true);
  assert.equal(fs.existsSync(path.join(root, 'styles.css')), true);
});

test('static app references GitHub Pages and local browser storage flow', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(html, /GitHub Pages/);
  assert.match(js, /localStorage/);
  assert.match(js, /https:\/\/api\.openai\.com/);
});
