import chalk from 'chalk';
import Table from 'cli-table3';
import { loadEnv, saveEnv } from './storage.js';
import { isSensitiveKey } from './sanitizer.js';

function maskEnvValue(key, value) {
  if (!isSensitiveKey(key)) {
    return String(value);
  }

  const raw = String(value || '');
  if (raw.length <= 4) {
    return '<REDACTED>';
  }
  return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
}

export function getCurrentEnvVars() {
  const env = loadEnv();
  if (!env.environments[env.current]) {
    env.environments[env.current] = {};
    saveEnv(env);
  }
  return env.environments[env.current];
}

export function getEnvVar(key) {
  const vars = getCurrentEnvVars();
  return vars[key];
}

export function listEnv() {
  const env = loadEnv();
  
  console.log(chalk.cyan(`\n  🌍 Environments:`));
  Object.keys(env.environments).forEach(name => {
    const activeMarker = name === env.current ? chalk.green(' (active)') : '';
    console.log(`  - ${chalk.white(name)}${activeMarker}`);
  });

  const currentVars = env.environments[env.current];
  if (Object.keys(currentVars).length > 0) {
    console.log(chalk.cyan(`\n  📦 Variables in '${env.current}':`));
    const table = new Table({
      head: [chalk.cyan('Key'), chalk.cyan('Value')],
      colWidths: [20, 40]
    });
    
    Object.entries(currentVars).sort(([a], [b]) => a.localeCompare(b)).forEach(([k, v]) => {
      table.push([chalk.white(k), chalk.gray(maskEnvValue(k, v))]);
    });
    console.log(table.toString());
  } else {
    console.log(chalk.gray(`\n  No variables set in '${env.current}' environment.`));
  }
  console.log('');
}

export function setEnv(name) {
  const env = loadEnv();
  if (name === 'list') {
    return listEnv();
  }

  if (!env.environments[name]) {
    env.environments[name] = {};
    console.log(chalk.green(`  ✨ Created new environment:`), chalk.white(name));
  }

  env.current = name;
  saveEnv(env);
  console.log(chalk.green(`  🔄 Switched to environment:`), chalk.white(name));
}

export function setVar(key, value) {
  const env = loadEnv();
  env.environments[env.current][key] = value;
  saveEnv(env);
  const printValue = isSensitiveKey(key) ? '<REDACTED>' : value;
  console.log(chalk.green(`  ✅ Set ${key}=${printValue} in`), chalk.white(env.current));
}

export function deleteVar(key) {
  const env = loadEnv();
  if (env.environments[env.current][key] !== undefined) {
    delete env.environments[env.current][key];
    saveEnv(env);
    console.log(chalk.green(`  🗑️  Deleted variable:`), chalk.white(key));
  } else {
    console.log(chalk.yellow(`  ⚠️  Variable '${key}' not found in environment '${env.current}'`));
  }
}
