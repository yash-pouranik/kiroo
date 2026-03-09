import chalk from 'chalk';
import inquirer from 'inquirer';
import { writeFileSync, existsSync } from 'fs';
import { ensureKirooDir } from './storage.js';

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
  ]);
  
  ensureKirooDir();
  
  const config = {
    projectName: answers.projectName,
    baseUrl: answers.baseUrl,
    createdAt: new Date().toISOString(),
  };
  
  writeFileSync('.kiroo/config.json', JSON.stringify(config, null, 2));
  
  console.log('');
  console.log(chalk.green('  ✅ Kiroo initialized successfully!'));
  console.log('');
  console.log(chalk.gray('  Next steps:'));
  console.log(chalk.white('    kiroo POST https://api.example.com/login email=test@test.com'));
  console.log(chalk.white('    kiroo list'));
  console.log(chalk.white('    kiroo snapshot save initial\n'));
}
