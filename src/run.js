import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';
import { loadSnapshotData, loadEnv } from './storage.js';

const REDACTED_RE = /<REDACTED[^>]*>/i;

function isRedacted(val) {
  return typeof val === 'string' && REDACTED_RE.test(val.trim());
}

/**
 * Sort interactions chronologically (oldest first) so login
 * runs before authenticated requests.
 */
function sortChronologically(interactions) {
  return [...interactions].sort((a, b) => {
    // IDs are timestamps like "2026-03-15T08-10-57-031Z"
    const idA = a.id || '';
    const idB = b.id || '';
    return idA.localeCompare(idB);
  });
}

/**
 * Deduplicate redundant interactions (e.g. 10 identical GET /api/projects 304s).
 * Keeps unique method+path combinations, but allows duplicates for different
 * status codes or non-cacheable methods (POST/PUT/DELETE).
 */
function deduplicateInteractions(interactions) {
  const seen = new Map();
  return interactions.filter((int) => {
    const method = String(int.method || int.request?.method || 'GET').toUpperCase();
    // Always keep non-GET (side-effectful) methods
    if (method !== 'GET') return true;

    const url = int.url || int.request?.url || '/';
    const status = int.response?.status || 0;
    const key = `${method}|${url}|${status}`;
    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });
}

/**
 * Run all interactions from a snapshot sequentially.
 * - Sorted oldest-first so login precedes authenticated requests
 * - Deduplicates redundant 304 GET requests
 * - Auto-chains tokens from auth responses
 * - Resolves <REDACTED> headers/body from env vars
 */
export async function runSnapshot(tag, options = {}) {
  let snapshot;
  try {
    snapshot = loadSnapshotData(tag);
  } catch (err) {
    console.error(chalk.red(`\n  ✗ Snapshot not found: ${tag}`));
    console.log(chalk.gray(`  Run 'kiroo snapshot list' to see available snapshots.\n`));
    process.exit(1);
  }

  const raw = snapshot.interactions || [];
  if (raw.length === 0) {
    console.log(chalk.yellow(`\n  ⚠️ Snapshot "${tag}" has no interactions.\n`));
    return;
  }

  const env = loadEnv();
  const envVars = env.environments[env.current] || {};
  const baseUrl = envVars.baseUrl || '';

  // Sort chronologically, then deduplicate
  const sorted = sortChronologically(raw);
  const interactions = deduplicateInteractions(sorted);

  // Captured variables during run (auto-chained)
  const captured = {};

  console.log(chalk.cyan(`\n  ▶ Running snapshot: ${chalk.white(tag)}`));
  console.log(chalk.gray(`  ${interactions.length} interactions (${raw.length - interactions.length} duplicates skipped)\n`));

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < interactions.length; i++) {
    const int = interactions[i];
    const method = String(int.method || int.request?.method || 'GET').toUpperCase();
    let url = int.url || int.request?.url || '/';
    const headers = { ...(int.request?.headers || {}) };
    let body = int.request?.body ? JSON.parse(JSON.stringify(int.request.body)) : undefined;

    // Remove internal/hop-by-hop headers
    for (const h of ['host', 'content-length', 'connection', 'accept-encoding', 'if-none-match',
      'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'sec-fetch-dest', 'sec-fetch-mode',
      'sec-fetch-site', 'dnt', 'origin', 'referer', 'user-agent']) {
      delete headers[h];
    }

    // Resolve URL — if relative, prepend baseUrl
    if (url.startsWith('/') && baseUrl) {
      const normalized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      url = normalized + url;
    }

    // Fix redacted auth headers
    for (const [key, val] of Object.entries(headers)) {
      if (isRedacted(String(val))) {
        const k = key.toLowerCase();
        if (k === 'authorization') {
          const token = captured.token || envVars.token;
          if (token) headers[key] = token.startsWith('Bearer') ? token : `Bearer ${token}`;
          else delete headers[key];
        } else if (k === 'x-api-key' || k === 'api-key') {
          const apiKey = captured.apiKey || envVars.sk || envVars.apiKey || envVars['x-api-key'];
          if (apiKey) headers[key] = apiKey;
          else delete headers[key];
        } else {
          delete headers[key];
        }
      }
    }

    // Fix redacted body fields (e.g. password)
    if (body && typeof body === 'object') {
      for (const [key, val] of Object.entries(body)) {
        if (isRedacted(String(val))) {
          // Try to find from env vars (password, secret, etc.)
          const envVal = envVars[key] || envVars[key.toLowerCase()];
          if (envVal) {
            body[key] = envVal;
          }
          // If no env val found, leave <REDACTED> — will fail but at least user knows
        }
      }
    }

    // Replace {{var}} placeholders
    const allVars = { ...envVars, ...captured };
    url = replaceVars(url, allVars);
    if (typeof body === 'string') body = replaceVars(body, allVars);
    if (body && typeof body === 'object') body = replaceVarsDeep(body, allVars);
    for (const [key, val] of Object.entries(headers)) {
      if (typeof val === 'string') headers[key] = replaceVars(val, allVars);
    }

    // Execute
    const shortUrl = url.replace(/^https?:\/\/[^/]+/, '');
    const label = `[${i + 1}/${interactions.length}] ${method} ${shortUrl}`;
    const spinner = ora({ text: chalk.gray(label), spinner: 'dots' }).start();
    const start = Date.now();

    try {
      const res = await axios({
        method: method.toLowerCase(),
        url,
        headers,
        data: body,
        timeout: options.timeout || 30000,
        validateStatus: () => true,
      });

      const duration = Date.now() - start;
      const status = res.status;
      const statusColor = status >= 400 ? chalk.red : chalk.green;

      spinner.stopAndPersist({
        symbol: status >= 400 ? chalk.red('✗') : chalk.green('✓'),
        text: `${statusColor(`${status}`)} ${chalk.gray(`${method} ${shortUrl}`)} ${chalk.dim(`${duration}ms`)}`,
      });

      // Auto-capture tokens from auth-like responses
      if (res.data && typeof res.data === 'object') {
        const data = res.data;
        for (const field of ['token', 'accessToken', 'access_token', 'jwt', 'authToken', 'auth_token']) {
          if (data[field] && typeof data[field] === 'string') {
            captured.token = data[field];
            if (options.verbose) console.log(chalk.dim(`    🔑 Captured ${field}`));
          }
          if (data.data && typeof data.data === 'object' && data.data[field]) {
            captured.token = data.data[field];
            if (options.verbose) console.log(chalk.dim(`    🔑 Captured data.${field}`));
          }
        }
        for (const field of ['apiKey', 'api_key', 'key', 'publishableKey']) {
          if (data[field] && typeof data[field] === 'string') {
            captured.apiKey = data[field];
          }
        }
      }

      if (options.verbose && res.data) {
        const bodyStr = typeof res.data === 'object' ? JSON.stringify(res.data, null, 2) : String(res.data);
        const lines = bodyStr.split('\n');
        const preview = lines.length > 6 ? lines.slice(0, 6).join('\n') + '\n    ...' : lines.join('\n');
        console.log(chalk.gray(`    ↳ ${preview.split('\n').join('\n    ')}`));
      }

      if (status < 400) passed++;
      else failed++;

    } catch (err) {
      const duration = Date.now() - start;
      spinner.stopAndPersist({
        symbol: chalk.red('✗'),
        text: `${chalk.red('ERR')} ${chalk.gray(`${method} ${shortUrl}`)} ${chalk.dim(`${duration}ms`)} ${chalk.red(err.code || err.message)}`,
      });
      failed++;
    }
  }

  // Summary
  console.log(chalk.cyan(`\n  ── Run Complete ──`));
  console.log(chalk.white(`  Snapshot: ${tag}`));
  console.log(chalk.green(`  Passed:  ${passed}`));
  if (failed > 0) console.log(chalk.red(`  Failed:  ${failed}`));
  console.log(chalk.gray(`  Total:   ${interactions.length}\n`));

  if (captured.token) {
    console.log(chalk.dim(`  🔑 Auto-captured token from auth response`));
    console.log('');
  }

  if (failed > 0 && options.failFast) {
    process.exit(1);
  }
}

function replaceVars(str, vars) {
  return str.replace(/\{\{(.+?)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

function replaceVarsDeep(obj, vars) {
  if (typeof obj === 'string') return replaceVars(obj, vars);
  if (Array.isArray(obj)) return obj.map(item => replaceVarsDeep(item, vars));
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = replaceVarsDeep(v, vars);
    }
    return result;
  }
  return obj;
}
