import chalk from 'chalk';
import inquirer from 'inquirer';
import { existsSync } from 'fs';
import { ensureKirooDir, loadEnv, saveEnv } from './storage.js';
import { saveKirooConfig } from './config.js';

export async function initProject() {
  console.log('');
  console.log(chalk.cyan.bold('  🚀 Welcome to Kiroo'));
  console.log(chalk.gray('  Git for API interactions\n'));
  
  if (existsSync('.kiroo')) {
    console.log(chalk.yellow('  ⚠️  Kiroo is already initialized in this directory.\n'));
    return;
  }
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: 'my-api-project',
    },
    {
      type: 'input',
      name: 'environmentName',
      message: 'Environment name:',
      default: 'default',
      validate: (input) => input.trim().length > 0 || 'Environment name is required',
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Base URL (optional):',
      default: '',
    },
    {
      type: 'password',
      name: 'groqApiKey',
      message: 'Groq API Key (optional, hidden):',
      default: '',
      mask: '*',
    },
    {
      type: 'password',
      name: 'lingoApiKey',
      message: 'Lingo.dev API Key (optional, hidden):',
      default: '',
      mask: '*',
    },
    {
      type: 'input',
      name: 'supabaseUrl',
      message: 'Supabase URL (optional):',
      default: '',
    },
    {
      type: 'password',
      name: 'supabaseKey',
      message: 'Supabase Key (optional, hidden):',
      default: '',
      mask: '*',
    },
    {
      type: 'input',
      name: 'supabaseBucket',
      message: 'Supabase Bucket (optional):',
      default: 'kiroo-captures',
    },
    {
      type: 'input',
      name: 'defaultLang',
      message: 'Default output language code (optional, e.g., en, hi, de):',
      default: '',
    },
    {
      type: 'confirm',
      name: 'redactionEnabled',
      message: 'Enable secret redaction by default?',
      default: true,
    },
    {
      type: 'input',
      name: 'redactedValue',
      message: 'Redacted placeholder value:',
      default: '<REDACTED>',
      when: (answers) => answers.redactionEnabled === true,
      validate: (input) => input.trim().length > 0 || 'Redacted placeholder is required',
    },
  ]);
  
  ensureKirooDir();
  
  const config = {
    projectName: answers.projectName,
    baseUrl: answers.baseUrl,
    settings: {
      redaction: {
        enabled: answers.redactionEnabled !== false,
        redactedValue: answers.redactionEnabled === false
          ? '<REDACTED>'
          : (answers.redactedValue || '<REDACTED>')
      }
    },
    createdAt: new Date().toISOString(),
  };
  
  saveKirooConfig(config);

  const envData = loadEnv();
  const selectedEnv = String(answers.environmentName || 'default').trim();
  if (!envData.environments[selectedEnv]) {
    envData.environments[selectedEnv] = {};
  }
  envData.current = selectedEnv;

  if (answers.baseUrl) {
    envData.environments[selectedEnv].baseUrl = answers.baseUrl;
  }
  if (answers.groqApiKey) {
    envData.environments[selectedEnv].GROQ_API_KEY = answers.groqApiKey;
  }
  if (answers.lingoApiKey) {
    envData.environments[selectedEnv].LINGODOTDEV_API_KEY = answers.lingoApiKey;
  }
  if (answers.supabaseUrl) {
    envData.environments[selectedEnv].SUPABASE_URL = answers.supabaseUrl;
  }
  if (answers.supabaseKey) {
    envData.environments[selectedEnv].SUPABASE_KEY = answers.supabaseKey;
  }
  if (answers.supabaseBucket) {
    envData.environments[selectedEnv].SUPABASE_BUCKET = answers.supabaseBucket;
  }
  if (answers.defaultLang) {
    envData.environments[selectedEnv].DEFAULT_LANG = answers.defaultLang.trim();
  }
  saveEnv(envData);
  
  console.log('');
  console.log(chalk.green('  ✅ Kiroo initialized successfully!'));
  console.log(chalk.gray(`  Environment: ${chalk.white(selectedEnv)}`));
  console.log(chalk.gray(`  Env file: ${chalk.white('.kiroo/env.json')}`));
  console.log(chalk.gray(`  Config file: ${chalk.white('.kiroo/config.json')}`));
  console.log(chalk.gray('  Saved keys:'), chalk.white([
    answers.baseUrl ? 'baseUrl' : null,
    answers.groqApiKey ? 'GROQ_API_KEY' : null,
    answers.lingoApiKey ? 'LINGODOTDEV_API_KEY' : null,
    answers.supabaseUrl ? 'SUPABASE_URL' : null,
    answers.supabaseKey ? 'SUPABASE_KEY' : null,
    answers.supabaseBucket ? 'SUPABASE_BUCKET' : null,
    answers.defaultLang ? 'DEFAULT_LANG' : null
  ].filter(Boolean).join(', ') || 'none'));
  console.log('');
  console.log(chalk.gray('  Next steps:'));
  console.log(chalk.white('    kiroo POST https://api.example.com/login email=test@test.com'));
  console.log(chalk.white('    kiroo list'));
  console.log(chalk.white('    kiroo snapshot save initial\n'));
}
