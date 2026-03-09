#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { executeRequest } from '../src/executor.js';
import { listInteractions, replayInteraction } from '../src/replay.js';
// import { saveSnapshot, compareSnapshots, listSnapshots } from '../src/snapshot.js';
// import { showGraph } from '../src/graph.js';
import { initProject } from '../src/init.js';
// import { showStats } from '../src/stats.js';

const program = new Command();

program
  .name('kiroo')
  .description('Git for API interactions. Record, replay, snapshot, and diff your APIs.')
  .version('0.1.0');

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
    .action(async (url, options) => {
      await executeRequest(method, url, options);
    });
});

// List interactions
program
  .command('list')
  .description('List all stored interactions')
  .option('-n, --limit <number>', 'Number of interactions to show', '10')
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

// Snapshot commands
/*
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
*/

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
/*
program
  .command('stats')
  .description('Show usage statistics')
  .action(async () => {
    await showStats();
  });
*/

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
