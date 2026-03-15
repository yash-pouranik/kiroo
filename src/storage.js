import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { sanitizeInteractionRecord } from './sanitizer.js';
import { loadKirooConfig } from './config.js';
import { stableJSONStringify } from './deterministic.js';

const KIROO_DIR = '.kiroo';
const INTERACTIONS_DIR = join(KIROO_DIR, 'interactions');
const SNAPSHOTS_DIR = join(KIROO_DIR, 'snapshots');
const ENV_FILE = join(KIROO_DIR, 'env.json');

function buildEndpointSlug(rawUrl) {
  let candidate = String(rawUrl || '');

  try {
    const parsed = new URL(candidate);
    candidate = parsed.pathname || 'root';
  } catch {
    candidate = candidate.replace(/^https?:\/\/[^/]+/i, '');
    candidate = candidate.split('?')[0];
  }

  if (!candidate || candidate === '/') {
    candidate = 'root';
  }

  const slug = candidate
    .replace(/^\/+/, '')
    .replace(/\/+/g, '-')
    .replace(/\{|\}/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  return slug || 'root';
}

function buildInteractionId(method, url, timestamp) {
  const timestampId = timestamp.replace(/[:.]/g, '-');
  const methodSlug = String(method || 'REQ').toUpperCase().replace(/[^A-Z]/g, '') || 'REQ';
  const endpointSlug = buildEndpointSlug(url);
  return `${methodSlug}__${endpointSlug}__${timestampId}`;
}

function buildInteractionFilename(method, url, timestamp) {
  const timestampId = timestamp.replace(/[:.]/g, '-');
  const methodSlug = String(method || 'REQ').toUpperCase().replace(/[^A-Z]/g, '') || 'REQ';
  const endpointSlug = buildEndpointSlug(url);
  return `~${timestampId}__${methodSlug}__${endpointSlug}.json`;
}

function getPersistenceSettings() {
  const config = loadKirooConfig();
  const redaction = config.settings?.redaction || {};
  const determinism = config.settings?.determinism || {};

  return {
    redactEnabled: redaction.enabled !== false,
    redactedValue: redaction.redactedValue || '<REDACTED>',
    sortKeys: determinism.sortKeys !== false
  };
}

function stringifyForPersistence(value, sortKeysEnabled) {
  if (sortKeysEnabled) {
    return stableJSONStringify(value, 2);
  }
  return JSON.stringify(value, null, 2);
}

export function ensureKirooDir() {
  if (!existsSync(KIROO_DIR)) {
    mkdirSync(KIROO_DIR);
  }
  if (!existsSync(INTERACTIONS_DIR)) {
    mkdirSync(INTERACTIONS_DIR);
  }
  if (!existsSync(SNAPSHOTS_DIR)) {
    mkdirSync(SNAPSHOTS_DIR);
  }
  if (!existsSync(ENV_FILE)) {
    writeFileSync(ENV_FILE, JSON.stringify({ current: 'default', environments: { default: {} } }, null, 2));
  }
  
  const GITIGNORE_FILE = join(KIROO_DIR, '.gitignore');
  if (!existsSync(GITIGNORE_FILE)) {
    writeFileSync(GITIGNORE_FILE, 'env.json\n');
  }
}

export async function saveInteraction(interaction) {
  ensureKirooDir();
  const settings = getPersistenceSettings();
  
  const timestamp = new Date().toISOString();
  const id = buildInteractionId(interaction.method, interaction.url, timestamp);
  
  const interactionData = {
    id,
    timestamp,
    request: {
      method: interaction.method,
      url: interaction.url,
      headers: interaction.headers,
      body: interaction.body,
    },
    response: interaction.response,
    metadata: {
      duration_ms: interaction.duration,
      saves: interaction.saves || [], // Variables saved from this response
      uses: interaction.uses || [],   // Variables used in this request
    },
  };

  const sanitizedInteractionData = sanitizeInteractionRecord(interactionData, {
    enabled: settings.redactEnabled,
    redactedValue: settings.redactedValue
  });

  const filename = buildInteractionFilename(interaction.method, interaction.url, timestamp);
  const filepath = join(INTERACTIONS_DIR, filename);
  
  writeFileSync(filepath, stringifyForPersistence(sanitizedInteractionData, settings.sortKeys));
  
  return id;
}

export function loadInteraction(id) {
  const directPath = join(INTERACTIONS_DIR, `${id}.json`);
  
  if (existsSync(directPath)) {
    const data = readFileSync(directPath, 'utf8');
    return JSON.parse(data);
  }

  const files = readdirSync(INTERACTIONS_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const filepath = join(INTERACTIONS_DIR, file);
    const parsed = JSON.parse(readFileSync(filepath, 'utf8'));
    if (parsed.id === id) {
      return parsed;
    }
  }

  throw new Error(`Interaction not found: ${id}`);
}

export function getAllInteractions() {
  ensureKirooDir();
  
  if (!existsSync(INTERACTIONS_DIR)) {
    return [];
  }
  
  const files = readdirSync(INTERACTIONS_DIR).filter(f => f.endsWith('.json'));
  const interactions = files.map(f => {
    const filepath = join(INTERACTIONS_DIR, f);
    const data = readFileSync(filepath, 'utf8');
    return JSON.parse(data);
  });

  return interactions.sort((a, b) => {
    const timeA = Date.parse(a.timestamp || '');
    const timeB = Date.parse(b.timestamp || '');

    if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
      return timeB - timeA; // Most recent first
    }

    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

export function saveSnapshotData(tag, data) {
  ensureKirooDir();
  const settings = getPersistenceSettings();
  
  const filename = `${tag}.json`;
  const filepath = join(SNAPSHOTS_DIR, filename);
  const sanitizedSnapshot = sanitizeInteractionRecord(data, {
    enabled: settings.redactEnabled,
    redactedValue: settings.redactedValue
  });
  
  writeFileSync(filepath, stringifyForPersistence(sanitizedSnapshot, settings.sortKeys));
}

export function loadSnapshotData(tag) {
  const filepath = join(SNAPSHOTS_DIR, `${tag}.json`);
  
  if (!existsSync(filepath)) {
    throw new Error(`Snapshot not found: ${tag}`);
  }
  
  const data = readFileSync(filepath, 'utf8');
  return JSON.parse(data);
}

export function getAllSnapshots() {
  ensureKirooDir();
  
  if (!existsSync(SNAPSHOTS_DIR)) {
    return [];
  }
  
  return readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
    .map(f => f.replace('.json', ''));
}

export function clearAllInteractions() {
  ensureKirooDir();
  if (existsSync(INTERACTIONS_DIR)) {
    const files = readdirSync(INTERACTIONS_DIR);
    files.forEach(f => {
      const filepath = join(INTERACTIONS_DIR, f);
      rmSync(filepath, { force: true });
    });
  }
}

function scrubDirectory(directoryPath, { dryRun = false } = {}) {
  const settings = getPersistenceSettings();

  if (!existsSync(directoryPath)) {
    return { scanned: 0, updated: 0 };
  }

  const files = readdirSync(directoryPath).filter((f) => f.endsWith('.json'));
  let updated = 0;

  for (const fileName of files) {
    const filePath = join(directoryPath, fileName);
    const originalRaw = readFileSync(filePath, 'utf8');
    const originalData = JSON.parse(originalRaw);
    const sanitizedData = sanitizeInteractionRecord(originalData, {
      enabled: settings.redactEnabled,
      redactedValue: settings.redactedValue
    });
    const sanitizedRaw = stringifyForPersistence(sanitizedData, settings.sortKeys);

    if (originalRaw !== sanitizedRaw) {
      updated += 1;
      if (!dryRun) {
        writeFileSync(filePath, sanitizedRaw);
      }
    }
  }

  return { scanned: files.length, updated };
}

export function scrubStoredData(options = {}) {
  ensureKirooDir();
  const { dryRun = false } = options;

  const interactions = scrubDirectory(INTERACTIONS_DIR, { dryRun });
  const snapshots = scrubDirectory(SNAPSHOTS_DIR, { dryRun });

  return {
    interactions,
    snapshots,
    totalUpdated: interactions.updated + snapshots.updated,
    dryRun,
  };
}

export function loadEnv() {
  ensureKirooDir();
  const data = readFileSync(ENV_FILE, 'utf8');
  return JSON.parse(data);
}

export function saveEnv(data) {
  ensureKirooDir();
  const settings = getPersistenceSettings();
  writeFileSync(ENV_FILE, stringifyForPersistence(data, settings.sortKeys));
}
