#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { executeRequest } from '../src/executor.js';
import { listInteractions, replayInteraction } from '../src/replay.js';
import { saveSnapshot, compareSnapshots, listSnapshots } from '../src/snapshot.js';
import { setEnv, setVar, deleteVar, listEnv } from '../src/env.js';
import { showGraph } from '../src/graph.js';
import { initProject } from '../src/init.js';
import { showStats } from '../src/stats.js';
import { handleImport } from '../src/import.js';
import { clearAllInteractions } from '../src/storage.js';

const program = new Command();

program
  .name('kiroo')
  .description('Git for API interactions. Record, replay, snapshot, and diff your APIs.')
  .version('0.4.0');

// Init command
program
  .command('init')
  .description('Initialize Kiroo in current directory')
  .action(async () => {
    await initProject();
  });
  // sk_live_p7BWJjsYlKmauBOjiEeiLRuu4DokkBWsgYne_E6osTo

// HTTP methods as commands
['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].forEach(method => {
  program
    .command(`${method.toLowerCase()} <url>`)
    .alias(method)
    .description(`Execute ${method} request and store interaction`)
    .option('-H, --header <headers...>', 'Headers (key:value)')
    .option('-d, --data <data>', 'Request body (JSON string or key=value pairs)')
    .option('-s, --save <pairs...>', 'Extract values from response to env (key=path.to.data)')
    .action(async (url, options) => {
      await executeRequest(method, url, options);
    });
});

// List interactions
program
  .command('list')
  .description('List all stored interactions')
  .option('-n, --limit <number>', 'Number of interactions to show', '10')
  .option('-o, --offset <number>', 'Number of interactions to skip', '0')
  .action(async (options) => {
    await listInteractions(options);
  });

// Replay interaction
program
  .command('replay <id>')
  .description('Replay a stored interaction')
  .action(async (id) => {
    await replayInteraction(id);
  });

// Clear command
program
  .command('clear')
  .description('Clear all stored interaction history')
  .option('-f, --force', 'Force clear without confirmation')
  .action(async (options) => {
    if (!options.force) {
      const inquirer = (await import('inquirer')).default;
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: chalk.red('Are you sure you want to clear all history?'),
          default: false
        }
      ]);
      if (!confirm) return;
    }
    clearAllInteractions();
    console.log(chalk.green('\n  ✨ History cleared successfully.\n'));
  });

// Environment commands
const env = program.command('env').description('Environment management');

env
  .command('use <name>')
  .description('Switch to a specific environment')
  .action((name) => setEnv(name));

env
  .command('list')
  .description('List environments and variables')
  .action(() => listEnv());

env
  .command('set <key> <value>')
  .description('Set a variable in current environment')
  .action((key, value) => setVar(key, value));

env
  .command('rm <key>')
  .description('Remove a variable from current environment')
  .action((key) => deleteVar(key));

// Snapshot commands
const snapshot = program.command('snapshot').description('Snapshot management');

snapshot
  .command('save <tag>')
  .description('Save current state as snapshot')
  .action(async (tag) => {
    await saveSnapshot(tag);
  });

snapshot
  .command('list')
  .description('List all snapshots')
  .action(async () => {
    await listSnapshots();
  });

snapshot
  .command('compare <tag1> <tag2>')
  .description('Compare two snapshots')
  .action(async (tag1, tag2) => {
    await compareSnapshots(tag1, tag2);
  });

// Graph command
program
  .command('graph')
  .description('Show visual dependency graph of API interactions')
  .action(async () => {
    await showGraph();
  });

// Import command
program
  .command('import')
  .description('Import a request from a cURL command (opens editor if no command is provided)')
  .allowUnknownOption()
  .action(async (_, command) => {
    if (command.args.length > 0) {
      // Pass tokens directly to handleImport
      await handleImport(command.args);
    } else {
      const inquirer = (await import('inquirer')).default;
      const response = await inquirer.prompt([
        {
          type: 'editor',
          name: 'curl',
          message: 'Paste your cURL command here (opens your default editor):',
          validate: (input) => input.trim().length > 0 || 'Please enter a cURL command'
        }
      ]);
      await handleImport(response.curl);
    }
  });

// Graph command
/*
program
  .command('graph')
  .description('Show API dependency graph')
  .action(async () => {
    await showGraph();
  });
*/

// Stats command
program
  .command('stats')
  .description('Show usage statistics')
  .action(async () => {
    await showStats();
  });

// Error handling
program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (err) {
  if (err.code === 'commander.help' || err.message === '(outputHelp)') {
    // Help was requested, exit normally
    process.exit(0);
  } else if (err.code === 'commander.unknownCommand') {
    console.error(chalk.red(`\n  ✗ Unknown command: ${err.message}\n`));
    console.log(chalk.gray('  Run'), chalk.white('kiroo --help'), chalk.gray('for usage information.\n'));
    process.exit(1);
  } else {
    console.error(chalk.red('\n  ✗ Error:'), err.message, `(${err.code})`, '\n');
    process.exit(1);
  }
}
