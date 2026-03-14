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
  ]);
  
  ensureKirooDir();
  
  const config = {
    projectName: answers.projectName,
    baseUrl: answers.baseUrl,
    createdAt: new Date().toISOString(),
  };
  
  saveKirooConfig(config);

  const envData = loadEnv();
  const current = envData.current || 'default';
  if (!envData.environments[current]) {
    envData.environments[current] = {};
  }

  if (answers.baseUrl) {
    envData.environments[current].baseUrl = answers.baseUrl;
  }
  if (answers.groqApiKey) {
    envData.environments[current].GROQ_API_KEY = answers.groqApiKey;
  }
  if (answers.lingoApiKey) {
    envData.environments[current].LINGODOTDEV_API_KEY = answers.lingoApiKey;
  }
  saveEnv(envData);
  
  console.log('');
  console.log(chalk.green('  ✅ Kiroo initialized successfully!'));
  console.log('');
  console.log(chalk.gray('  Next steps:'));
  console.log(chalk.white('    kiroo POST https://api.example.com/login email=test@test.com'));
  console.log(chalk.white('    kiroo list'));
  console.log(chalk.white('    kiroo snapshot save initial\n'));
}
