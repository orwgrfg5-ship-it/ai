import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd());

test('public entrypoint exists', () => {
  assert.equal(fs.existsSync(path.join(root, 'public', 'index.html')), true);
});

test('server source references ORPHEUS routes and lore seed messages', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'server.js'), 'utf8');
  assert.match(source, /\/api\/chat/);
  assert.match(source, /\/api\/image/);
  assert.match(source, /Welcome to ORPHEUS/);
  assert.match(source, /Known commands: help, ls/);
});
