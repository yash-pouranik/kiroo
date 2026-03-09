import test from 'node:test';
import assert from 'node:assert';
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as storage from './src/storage.js';

const TEST_DIR = '.kiroo_test';

// Mock storage to use a test directory
test.before(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

test.after(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

test('Storage: ensureKirooDir creates directories', () => {
  // We need to override the constant or just test the logic since it's hard to mock constants in ES modules
  // For now, let's test if the actual storage.js works (it will create .kiroo)
  storage.ensureKirooDir();
  assert.strictEqual(existsSync('.kiroo'), true);
  assert.strictEqual(existsSync('.kiroo/interactions'), true);
  assert.strictEqual(existsSync('.kiroo/snapshots'), true);
});

test('Storage: saveInteraction and getAllInteractions', async () => {
  const interaction = {
    method: 'GET',
    url: 'https://example.com',
    headers: { 'Content-Type': 'application/json' },
    body: { foo: 'bar' },
    response: {
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { success: true }
    },
    duration: 100
  };

  const id = await storage.saveInteraction(interaction);
  assert.ok(id, 'Should return an interaction ID');

  const interactions = storage.getAllInteractions();
  assert.strictEqual(interactions.length > 0, true, 'Should have at least one interaction');
  assert.strictEqual(interactions[0].id, id);
  assert.strictEqual(interactions[0].request.url, 'https://example.com');
});

test('CLI: node bin/kiroo.js --help runs without error', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync('node', ['bin/kiroo.js', '--help'], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /Usage: kiroo/);
});

test('CLI: both GET and get commands work', async () => {
  const { spawnSync } = await import('node:child_process');
  
  // Test GET (uppercase alias)
  const resultUpper = spawnSync('node', ['bin/kiroo.js', 'GET', 'https://jsonplaceholder.typicode.com/posts/1'], { encoding: 'utf8' });
  assert.strictEqual(resultUpper.status, 0, 'GET should work');
  
  // Test get (lowercase command)
  const resultLower = spawnSync('node', ['bin/kiroo.js', 'get', 'https://jsonplaceholder.typicode.com/posts/1'], { encoding: 'utf8' });
  assert.strictEqual(resultLower.status, 0, 'get should work');
});
