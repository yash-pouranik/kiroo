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

test('CLI: list pagination works', async () => {
  const { spawnSync } = await import('node:child_process');
  
  // Ensure we have some interactions
  spawnSync('node', ['bin/kiroo.js', 'get', 'https://example.com/1'], { encoding: 'utf8' });
  spawnSync('node', ['bin/kiroo.js', 'get', 'https://example.com/2'], { encoding: 'utf8' });
  
  const result = spawnSync('node', ['bin/kiroo.js', 'list', '--limit', '1', '--offset', '1'], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /Showing 2-2/);
});

test('CLI: replay command works', async () => {
  const { spawnSync } = await import('node:child_process');
  
  // Create an interaction to replay
  spawnSync('node', ['bin/kiroo.js', 'get', 'https://jsonplaceholder.typicode.com/todos/1'], { encoding: 'utf8' });
  const interactions = storage.getAllInteractions();
  const id = interactions[0].id;
  
  const result = spawnSync('node', ['bin/kiroo.js', 'replay', id], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /Replaying interaction/);
  assert.match(result.stdout, /Comparison with stored response/);
});

test('CLI: snapshot commands work', async () => {
  const { spawnSync } = await import('node:child_process');
  
  // Ensure we have interactions
  spawnSync('node', ['bin/kiroo.js', 'get', 'https://jsonplaceholder.typicode.com/todos/1'], { encoding: 'utf8' });

  // 1. Save snapshot
  const saveResult = spawnSync('node', ['bin/kiroo.js', 'snapshot', 'save', 'test-snap'], { encoding: 'utf8' });
  assert.strictEqual(saveResult.status, 0);
  assert.ok(saveResult.stdout.includes('Snapshot saved') && saveResult.stdout.includes('test-snap'), 'Snapshot save message missing');
  
  // 2. List snapshots
  const listResult = spawnSync('node', ['bin/kiroo.js', 'snapshot', 'list'], { encoding: 'utf8' });
  assert.strictEqual(listResult.status, 0);
  assert.ok(listResult.stdout.includes('test-snap'), 'test-snap missing from list');
  
  // 3. Compare snapshots (same snapshot)
  const compareResult = spawnSync('node', ['bin/kiroo.js', 'snapshot', 'compare', 'test-snap', 'test-snap'], { encoding: 'utf8' });
  assert.strictEqual(compareResult.status, 0);
  assert.ok(compareResult.stdout.includes('No differences detected'), 'Diff check failed for identical snapshots');
});
