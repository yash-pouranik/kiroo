import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const KIROO_DIR = '.kiroo';
const INTERACTIONS_DIR = join(KIROO_DIR, 'interactions');
const SNAPSHOTS_DIR = join(KIROO_DIR, 'snapshots');
const ENV_FILE = join(KIROO_DIR, 'env.json');

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
}

export async function saveInteraction(interaction) {
  ensureKirooDir();
  
  const timestamp = new Date().toISOString();
  const id = timestamp.replace(/[:.]/g, '-');
  
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
    },
  };

  const filename = `${id}.json`;
  const filepath = join(INTERACTIONS_DIR, filename);
  
  writeFileSync(filepath, JSON.stringify(interactionData, null, 2));
  
  return id;
}

export function loadInteraction(id) {
  const filepath = join(INTERACTIONS_DIR, `${id}.json`);
  
  if (!existsSync(filepath)) {
    throw new Error(`Interaction not found: ${id}`);
  }
  
  const data = readFileSync(filepath, 'utf8');
  return JSON.parse(data);
}

export function getAllInteractions() {
  ensureKirooDir();
  
  if (!existsSync(INTERACTIONS_DIR)) {
    return [];
  }
  
  const files = readdirSync(INTERACTIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse(); // Most recent first
  
  return files.map(f => {
    const filepath = join(INTERACTIONS_DIR, f);
    const data = readFileSync(filepath, 'utf8');
    return JSON.parse(data);
  });
}

export function saveSnapshotData(tag, data) {
  ensureKirooDir();
  
  const filename = `${tag}.json`;
  const filepath = join(SNAPSHOTS_DIR, filename);
  
  writeFileSync(filepath, JSON.stringify(data, null, 2));
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
    .map(f => f.replace('.json', ''));
}

export function loadEnv() {
  ensureKirooDir();
  const data = readFileSync(ENV_FILE, 'utf8');
  return JSON.parse(data);
}

export function saveEnv(data) {
  ensureKirooDir();
  writeFileSync(ENV_FILE, JSON.stringify(data, null, 2));
}
