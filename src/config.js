import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { stableJSONStringify } from './deterministic.js';

const KIROO_DIR = '.kiroo';
const CONFIG_FILE = join(KIROO_DIR, 'config.json');

const DEFAULT_CONFIG_TEMPLATE = {
  projectName: 'my-api-project',
  baseUrl: '',
  settings: {
    determinism: {
      sortKeys: true
    },
    redaction: {
      enabled: true,
      redactedValue: '<REDACTED>'
    },
    analysis: {
      failOnSeverity: 'none',
      provider: 'groq',
      modelPriority: [
        'qwen/qwen3-32b',
        'moonshotai/kimi-k2-instruct-0905',
        'openai/gpt-oss-20b'
      ],
      maxCompletionTokens: 900
    },
    export: {
      defaultFormat: 'postman'
    },
    ci: {
      failOnSeverity: 'high'
    }
  }
};

function cloneDefaultConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG_TEMPLATE));
}

function mergeWithDefaults(defaultObj, currentObj) {
  if (Array.isArray(defaultObj)) {
    if (Array.isArray(currentObj)) return currentObj;
    return [...defaultObj];
  }

  if (defaultObj && typeof defaultObj === 'object') {
    const merged = {};
    const source = currentObj && typeof currentObj === 'object' ? currentObj : {};
    const keys = new Set([...Object.keys(defaultObj), ...Object.keys(source)]);

    for (const key of keys) {
      if (key in defaultObj) {
        merged[key] = mergeWithDefaults(defaultObj[key], source[key]);
      } else {
        merged[key] = source[key];
      }
    }
    return merged;
  }

  return currentObj !== undefined ? currentObj : defaultObj;
}

function ensureConfigFile() {
  if (!existsSync(KIROO_DIR)) {
    mkdirSync(KIROO_DIR);
  }

  if (!existsSync(CONFIG_FILE)) {
    const initialConfig = {
      ...cloneDefaultConfig(),
      createdAt: new Date().toISOString()
    };
    writeFileSync(CONFIG_FILE, stableJSONStringify(initialConfig));
  }
}

export function loadKirooConfig() {
  ensureConfigFile();

  const raw = readFileSync(CONFIG_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  const defaults = cloneDefaultConfig();
  const normalized = mergeWithDefaults(defaults, parsed);

  if (!normalized.createdAt) {
    normalized.createdAt = new Date().toISOString();
  }

  const normalizedRaw = stableJSONStringify(normalized);
  if (normalizedRaw !== raw) {
    writeFileSync(CONFIG_FILE, normalizedRaw);
  }

  return normalized;
}

export function saveKirooConfig(partialConfig = {}) {
  const current = loadKirooConfig();
  const merged = mergeWithDefaults(current, partialConfig);
  writeFileSync(CONFIG_FILE, stableJSONStringify(merged));
  return merged;
}

export function getDefaultKirooConfig() {
  return cloneDefaultConfig();
}
