import test from 'node:test';
import assert from 'node:assert';
import { existsSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as storage from './src/storage.js';
import { loadKirooConfig, saveKirooConfig } from './src/config.js';
import { stableJSONStringify } from './src/deterministic.js';
import { analyzeSnapshotData, resolveGroqApiKey } from './src/analyze.js';

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
  const saved = interactions.find((int) => int.id === id);
  assert.ok(saved, 'Saved interaction should be present');
  assert.strictEqual(saved.request.url, 'https://example.com');
});

test('Storage: saveInteraction redacts sensitive fields', async () => {
  const id = await storage.saveInteraction({
    method: 'POST',
    url: 'https://api.example.com/login?apiKey=super-secret&ok=1',
    headers: {
      Authorization: 'Bearer abc123',
      Cookie: 'sessionId=very-secret-cookie',
      'Content-Type': 'application/json'
    },
    body: {
      email: 'user@example.com',
      password: 'plain-password',
      nested: {
        refresh_token: 'refresh-secret'
      }
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: {
        'set-cookie': 'session=abc'
      },
      data: {
        token: 'jwt-token-value',
        profile: { id: 1, name: 'user' }
      }
    },
    duration: 42
  });

  const saved = storage.loadInteraction(id);
  assert.match(saved.request.url, /apiKey=%3CREDACTED%3E/);
  assert.match(saved.request.headers.Authorization, /REDACTED/);
  assert.match(saved.request.headers.Cookie, /REDACTED/);
  assert.strictEqual(saved.request.body.email, 'user@example.com');
  assert.match(saved.request.body.password, /REDACTED/);
  assert.match(saved.request.body.nested.refresh_token, /REDACTED/);
  assert.match(saved.response.headers['set-cookie'], /REDACTED/);
  assert.match(saved.response.data.token, /REDACTED/);
});

test('Storage: scrubStoredData redacts existing legacy files', () => {
  storage.ensureKirooDir();

  const legacyInteractionPath = join('.kiroo', 'interactions', '000_legacy_scrub.json');
  const legacySnapshotPath = join('.kiroo', 'snapshots', '000_legacy_scrub.json');
  const oldLegacyInteractionPath = join('.kiroo', 'interactions', 'zz_legacy_scrub.json');
  const oldLegacySnapshotPath = join('.kiroo', 'snapshots', 'zz_legacy_scrub.json');

  rmSync(oldLegacyInteractionPath, { force: true });
  rmSync(oldLegacySnapshotPath, { force: true });

  writeFileSync(legacyInteractionPath, JSON.stringify({
    id: '000_legacy_scrub',
    request: {
      method: 'GET',
      url: 'https://api.example.com/profile?token=abc',
      headers: { Authorization: 'Bearer unsafe-token' },
      body: null
    },
    response: {
      status: 200,
      data: { access_token: 'unsafe-value' }
    },
    metadata: { duration_ms: 1 }
  }, null, 2));

  writeFileSync(legacySnapshotPath, JSON.stringify({
    tag: '000_legacy_scrub',
    interactions: [
      {
        method: 'GET',
        url: 'https://api.example.com/profile?api_key=abc123',
        response: { body: { password: 'unsafe-password' } }
      }
    ]
  }, null, 2));

  const preview = storage.scrubStoredData({ dryRun: true });
  assert.ok(preview.totalUpdated >= 2, 'Dry run should detect legacy secrets');

  const untouched = JSON.parse(readFileSync(legacyInteractionPath, 'utf8'));
  assert.strictEqual(untouched.request.headers.Authorization, 'Bearer unsafe-token');

  const applied = storage.scrubStoredData();
  assert.ok(applied.totalUpdated >= 2, 'Scrub should update legacy files');

  const scrubbedInteraction = JSON.parse(readFileSync(legacyInteractionPath, 'utf8'));
  const scrubbedSnapshot = JSON.parse(readFileSync(legacySnapshotPath, 'utf8'));
  assert.match(scrubbedInteraction.request.headers.Authorization, /REDACTED/);
  assert.match(scrubbedInteraction.request.url, /token=%3CREDACTED%3E/);
  assert.match(scrubbedInteraction.response.data.access_token, /REDACTED/);
  assert.match(scrubbedSnapshot.interactions[0].url, /api_key=%3CREDACTED%3E/);
  assert.match(scrubbedSnapshot.interactions[0].response.body.password, /REDACTED/);

  rmSync(legacyInteractionPath, { force: true });
  rmSync(legacySnapshotPath, { force: true });
});

test('Config: loadKirooConfig exposes deterministic and redaction defaults', () => {
  const config = loadKirooConfig();
  assert.strictEqual(config.settings.determinism.sortKeys, true);
  assert.strictEqual(config.settings.redaction.enabled, true);
  assert.ok(config.settings.redaction.redactedValue);
});

test('Config: saveKirooConfig can disable redaction deterministically', async () => {
  saveKirooConfig({
    settings: {
      redaction: {
        enabled: false
      }
    }
  });

  const id = await storage.saveInteraction({
    method: 'POST',
    url: 'https://api.example.com/login?token=plain-token',
    headers: {
      Authorization: 'Bearer plain-token'
    },
    body: {
      password: 'plain-password'
    },
    response: {
      status: 200,
      headers: {},
      data: {
        access_token: 'plain-token'
      }
    },
    duration: 10
  });

  const saved = storage.loadInteraction(id);
  assert.strictEqual(saved.request.headers.Authorization, 'Bearer plain-token');
  assert.strictEqual(saved.request.body.password, 'plain-password');
  assert.strictEqual(saved.response.data.access_token, 'plain-token');

  saveKirooConfig({
    settings: {
      redaction: {
        enabled: true
      }
    }
  });
});

test('Deterministic: stableJSONStringify keeps sorted key order', () => {
  const unordered = {
    b: 1,
    a: { z: true, m: false },
    c: [{ d: 1, b: 2 }]
  };
  const json = stableJSONStringify(unordered);

  assert.ok(json.indexOf('"a"') < json.indexOf('"b"'));
  assert.ok(json.indexOf('"m"') < json.indexOf('"z"'));
});

test('Analyze: resolves GROQ key from env.json instead of process env', () => {
  const envData = storage.loadEnv();
  const current = envData.current;
  const previousGroq = envData.environments[current].GROQ_API_KEY;
  const previousProcess = process.env.GROQ_API_KEY;

  envData.environments[current].GROQ_API_KEY = 'from-env-json-key';
  storage.saveEnv(envData);
  process.env.GROQ_API_KEY = 'from-process-env-key';

  assert.strictEqual(resolveGroqApiKey(), 'from-env-json-key');

  if (previousGroq === undefined) {
    delete envData.environments[current].GROQ_API_KEY;
  } else {
    envData.environments[current].GROQ_API_KEY = previousGroq;
  }
  storage.saveEnv(envData);

  if (previousProcess === undefined) {
    delete process.env.GROQ_API_KEY;
  } else {
    process.env.GROQ_API_KEY = previousProcess;
  }
});

test('Analyze: detects rename candidate and severity', () => {
  const source = {
    tag: 'before',
    interactions: [
      {
        id: 'a1',
        method: 'GET',
        url: 'https://api.example.com/users',
        response: {
          status: 200,
          body: {
            user_id: '1',
            email: 'a@example.com'
          }
        }
      }
    ]
  };

  const target = {
    tag: 'after',
    interactions: [
      {
        id: 'a1',
        method: 'GET',
        url: 'https://api.example.com/users',
        response: {
          status: 200,
          body: {
            userId: '1',
            email: 'a@example.com'
          }
        }
      }
    ]
  };

  const report = analyzeSnapshotData(source, target);
  assert.strictEqual(report.highestSeverity, 'medium');
  assert.strictEqual(report.summary.byType.field_rename_candidate, 1);
});

test('Analyze: detects removed endpoint as high severity', () => {
  const source = {
    tag: 'before',
    interactions: [
      {
        id: 'a1',
        method: 'POST',
        url: 'https://api.example.com/checkout',
        response: {
          status: 200,
          body: { ok: true }
        }
      }
    ]
  };

  const target = {
    tag: 'after',
    interactions: []
  };

  const report = analyzeSnapshotData(source, target);
  assert.strictEqual(report.highestSeverity, 'high');
  assert.strictEqual(report.summary.byType.endpoint_removed, 1);
});

test('CLI: env list masks sensitive values', async () => {
  const { spawnSync } = await import('node:child_process');
  const envData = storage.loadEnv();
  const current = envData.current;
  const previousValue = envData.environments[current].GROQ_API_KEY;

  const setResult = spawnSync('node', ['bin/kiroo.js', 'env', 'set', 'GROQ_API_KEY', 'super-secret-token'], { encoding: 'utf8' });
  assert.strictEqual(setResult.status, 0);

  const listResult = spawnSync('node', ['bin/kiroo.js', 'env', 'list'], { encoding: 'utf8' });
  assert.strictEqual(listResult.status, 0);
  assert.ok(!listResult.stdout.includes('super-secret-token'));
  assert.ok(listResult.stdout.includes('***'));

  const restoreEnv = storage.loadEnv();
  if (previousValue === undefined) {
    delete restoreEnv.environments[current].GROQ_API_KEY;
  } else {
    restoreEnv.environments[current].GROQ_API_KEY = previousValue;
  }
  storage.saveEnv(restoreEnv);
});

test('CLI: export supports postman and openapi formats', async () => {
  const { spawnSync } = await import('node:child_process');
  const postmanOut = 'kiroo-test-postman.json';
  const openapiOut = 'kiroo-test-openapi.json';

  rmSync(postmanOut, { force: true });
  rmSync(openapiOut, { force: true });

  const prep = spawnSync('node', ['bin/kiroo.js', 'get', 'https://jsonplaceholder.typicode.com/todos/1'], { encoding: 'utf8' });
  assert.strictEqual(prep.status, 0);
  await storage.saveInteraction({
    method: 'GET',
    url: 'https://demo.example.com/api/projects/69abf7e5296d54a72b85171f?limit=10',
    headers: { Authorization: 'Bearer test-token' },
    response: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: { id: '69abf7e5296d54a72b85171f', name: 'Demo Project' }
    },
    duration: 5
  });

  const postmanResult = spawnSync(
    'node',
    ['bin/kiroo.js', 'export', '--format', 'postman', '--out', postmanOut],
    { encoding: 'utf8' }
  );
  assert.strictEqual(postmanResult.status, 0);
  assert.strictEqual(existsSync(postmanOut), true);
  const postmanData = JSON.parse(readFileSync(postmanOut, 'utf8'));
  assert.ok(postmanData.info?.schema?.includes('postman'));

  const openapiResult = spawnSync(
    'node',
    ['bin/kiroo.js', 'export', '--format', 'openapi', '--out', openapiOut, '--title', 'Kiroo Test API', '--api-version', '1.0.0', '--path-prefix', '/api'],
    { encoding: 'utf8' }
  );
  assert.strictEqual(openapiResult.status, 0);
  assert.strictEqual(existsSync(openapiOut), true);
  const openapiData = JSON.parse(readFileSync(openapiOut, 'utf8'));
  assert.strictEqual(openapiData.openapi, '3.0.3');
  assert.ok(openapiData.paths && Object.keys(openapiData.paths).length > 0);
  assert.ok(openapiData.paths['/api/projects/{projectId}']);
  assert.ok(openapiData.paths['/api/projects/{projectId}'].get);
  assert.ok((openapiData.paths['/api/projects/{projectId}'].get.parameters || []).some((p) => p.in === 'path' && p.name === 'projectId'));
  assert.ok(openapiData.components?.securitySchemes?.bearerAuth);

  rmSync(postmanOut, { force: true });
  rmSync(openapiOut, { force: true });
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
  const beforeIds = new Set(storage.getAllInteractions().map((int) => int.id));
  const createResult = spawnSync('node', ['bin/kiroo.js', 'get', 'https://jsonplaceholder.typicode.com/todos/1'], { encoding: 'utf8' });
  assert.strictEqual(createResult.status, 0);

  const created = storage.getAllInteractions().find((int) => !beforeIds.has(int.id));
  assert.ok(created, 'Should capture newly created interaction for replay');
  
  const result = spawnSync('node', ['bin/kiroo.js', 'replay', created.id], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /Replaying interaction/);
  assert.match(result.stdout, /Comparison with stored response/);
});

test('CLI: environment and variables work', async () => {
  const { spawnSync } = await import('node:child_process');
  
  // 1. Set a variable
  const setResult = spawnSync('node', ['bin/kiroo.js', 'env', 'set', 'testVar', 'testValue'], { encoding: 'utf8' });
  assert.strictEqual(setResult.status, 0);
  assert.ok(setResult.stdout.includes('Set testVar=testValue'), 'Var set message missing');
  
  // 2. Use variable in a request (mocking with a simple GET to jsonplaceholder)
  const getResult = spawnSync('node', ['bin/kiroo.js', 'get', 'https://jsonplaceholder.typicode.com/todos/{{id}}'], { encoding: 'utf8' });
  // This will fail to substitute since id is not set, it should try to call .../{{id}} literally and fail or work if server handles it
  // Let's set id first
  spawnSync('node', ['bin/kiroo.js', 'env', 'set', 'id', '1'], { encoding: 'utf8' });
  const getResultSucc = spawnSync('node', ['bin/kiroo.js', 'get', 'https://jsonplaceholder.typicode.com/todos/{{id}}'], { encoding: 'utf8' });
  assert.strictEqual(getResultSucc.status, 0);
  assert.ok(getResultSucc.stdout.includes('200 OK'), 'Variable substitution in URL failed');
  
  // 3. Response chaining (--save)
  const loginResult = spawnSync('node', ['bin/kiroo.js', 'get', 'https://jsonplaceholder.typicode.com/posts/1', '--save', 'postId=data.id'], { encoding: 'utf8' });
  assert.strictEqual(loginResult.status, 0);
  assert.ok(loginResult.stdout.includes('Saved to env') && loginResult.stdout.includes('postId=1'), 'Response chaining failed');
  
  // 4. Verify variable was saved
  const listResult = spawnSync('node', ['bin/kiroo.js', 'env', 'list'], { encoding: 'utf8' });
  assert.ok(listResult.stdout.includes('postId') && listResult.stdout.includes('1'), 'Saved variable missing from env list');
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

test('CLI: Auto-BaseURL prepends baseUrl for paths starting with /', async () => {
  const { spawnSync } = await import('node:child_process');
  const fs = await import('node:fs');
  const path = await import('node:path');
  
  // 1. Set baseUrl
  spawnSync('node', ['bin/kiroo.js', 'env', 'set', 'baseUrl', 'http://localhost:1234'], { encoding: 'utf8' });
  
  // 2. Fetch using relative path
  try {
    spawnSync('node', ['bin/kiroo.js', 'get', '/auto-test-path'], { encoding: 'utf8' });
  } catch (e) {
    // Failure is okay, we just want to see what URL was saved
  }
  
  // 3. Verify saved interaction
  const interactionsDir = join('.kiroo', 'interactions');
  const files = fs.readdirSync(interactionsDir);
  const latest = files.sort().pop();
  
  assert.ok(latest, 'Auto-BaseURL test should create a new interaction');
  
  const data = JSON.parse(fs.readFileSync(join(interactionsDir, latest), 'utf8'));
  assert.strictEqual(data.request.url, 'http://localhost:1234/auto-test-path', 'URL should have baseUrl prepended');
});
