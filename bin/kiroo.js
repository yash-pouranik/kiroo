#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { executeRequest } from '../src/executor.js';
import { listInteractions, replayInteraction } from '../src/replay.js';
import { saveSnapshot, compareSnapshots, listSnapshots } from '../src/snapshot.js';
import { setEnv, setVar, deleteVar, listEnv } from '../src/env.js';
import { showGraph } from '../src/graph.js';
import { validateResponse, showCheckResult } from '../src/checker.js';
import { initProject } from '../src/init.js';
import { showStats } from '../src/stats.js';
import { handleImport } from '../src/import.js';
import { clearAllInteractions, scrubStoredData } from '../src/storage.js';
import { runBenchmark } from '../src/bench.js';
import { editInteraction } from '../src/edit.js';
import { exportInteractions } from '../src/export.js';
import { runProxy } from '../src/proxy.js';
import { analyzeSnapshots } from '../src/analyze.js';

const program = new Command();

program
  .name('kiroo')
  .description('Git for API interactions. Record, replay, snapshot, and diff your APIs.')
  .version('0.8.0')
  .option('--lang <language>', 'Translate output to specified language (e.g., hi, es, fr)');

// Init command
program
  .command('init')
  .description('Initialize Kiroo in current directory')
  .action(async () => {
    await initProject();
  });


// Check command (Zero-Code Testing)
program
  .command('check <url>')
  .description('Execute a request and validate the response against rules')
  .option('-m, --method <method>', 'HTTP method (GET, POST, etc.)', 'GET')
  .option('-H, --header <header...>', 'Add custom headers')
  .option('-d, --data <data>', 'Request body (JSON or shorthand)')
  .option('--status <code...>', 'Expected HTTP status code')
  .option('--has <fields...>', 'Comma-separated list of expected fields in JSON response')
  .option('--match <matches...>', 'Expected field values (e.g., status=active)')
  .action(async (url, options) => {
    // Execute request
    const response = await executeRequest(options.method || 'GET', url, {
      header: options.header,
      data: options.data,
    });

    if (!response) {
      console.error(chalk.red('\n  ✗ No response received to validate.'));
      process.exit(1);
    }

    // Parse matches: ["key1=val1", "key2=val2"] -> { key1: val1, key2: val2 }
    const matchObj = {};
    if (options.match) {
      options.match.forEach(m => {
        const [k, ...v] = m.split('=');
        if (k) matchObj[k] = v.join('=');
      });
    }

    // Parse has: ["id,name"] or ["id", "name"] -> ["id", "name"]
    const hasFields = options.has ? options.has.flatMap(h => h.split(',')).map(f => f.trim()) : [];

    // Construct rules
    const rules = {
      status: Array.isArray(options.status) ? options.status[0] : options.status,
      has: hasFields,
      match: matchObj
    };

    // Validate
    const validation = validateResponse(response, rules);
    showCheckResult(validation);

    if (!validation.passed) {
      process.exit(1);
    }
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
  .option('-o, --offset <number>', 'Offset for pagination', '0')
  .option('--date <date>', 'Filter by date (YYYY-MM-DD)')
  .option('--url <url>', 'Filter by URL path')
  .option('--status <status>', 'Filter by HTTP status')
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

// Edit interaction
program
  .command('edit <id>')
  .description('Edit an interaction in your text editor and quickly replay it')
  .action(async (id) => {
    await editInteraction(id);
  });

// Export interactions
program
  .command('export')
  .description('Export stored interactions to Postman or OpenAPI')
  .option('-f, --format <format>', 'Export format: postman|openapi', 'postman')
  .option('-o, --out <filename>', 'Output JSON filename')
  .option('--title <title>', 'OpenAPI title (openapi format only)')
  .option('--api-version <version>', 'OpenAPI version (openapi format only)')
  .option('--server <url>', 'OpenAPI server URL override')
  .option('--path-prefix <prefix>', 'Only include endpoints that start with this path')
  .option('--min-samples <number>', 'Only include operations seen at least N times')
  .action((options) => {
    exportInteractions(options);
  });

// Bench command (Load Testing)
program
  .command('bench <url>')
  .description('Run a basic load test against an endpoint')
  .option('-m, --method <method>', 'HTTP method (GET, POST, etc.)', 'GET')
  .option('-n, --number <number>', 'Number of total requests to send', '10')
  .option('-c, --concurrent <number>', 'Number of concurrent requests', '1')
  .option('-H, --header <header...>', 'Add custom headers')
  .option('-v, --verbose', 'Show detailed output for every request')
  .option('-d, --data <data>', 'Request body')
  .action(async (url, options) => {
    await runBenchmark(url, options);
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

program
  .command('scrub')
  .description('Redact sensitive data in stored interactions and snapshots')
  .option('--dry-run', 'Show what would be changed without modifying files')
  .action((options) => {
    const summary = scrubStoredData({ dryRun: !!options.dryRun });

    console.log(chalk.cyan('\n  🧼 Scrub summary'));
    console.log(chalk.gray(`  Interactions: ${summary.interactions.updated}/${summary.interactions.scanned} updated`));
    console.log(chalk.gray(`  Snapshots:    ${summary.snapshots.updated}/${summary.snapshots.scanned} updated`));

    if (summary.totalUpdated === 0) {
      console.log(chalk.green('\n  ✅ No sensitive changes needed.\n'));
      return;
    }

    if (summary.dryRun) {
      console.log(chalk.yellow('\n  ⚠️ Dry run only. Re-run without --dry-run to apply changes.\n'));
      return;
    }

    console.log(chalk.green('\n  ✅ Sensitive fields were redacted successfully.\n'));
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
  .option('--analyze', 'Run semantic analysis right after structural compare')
  .option('--ai', 'When used with --analyze, include AI summary')
  .option('--model <model>', 'Model override for analyze --ai mode')
  .option('--max-tokens <number>', 'Max completion tokens for analyze --ai mode')
  .option('--fail-on <severity>', 'Severity threshold for analyze mode (low|medium|high|critical)')
  .action(async (tag1, tag2, options) => {
    const opts = program.opts();
    await compareSnapshots(tag1, tag2, opts.lang);
    if (options.analyze) {
      await analyzeSnapshots(tag1, tag2, {
        ai: !!options.ai,
        model: options.model,
        maxTokens: options.maxTokens,
        failOn: options.failOn,
        lang: opts.lang,
      });
    }
  });

program
  .command('analyze <tag1> <tag2>')
  .description('Semantic blast-radius analysis between two snapshots')
  .option('--json', 'Output structured JSON report')
  .option('--ai', 'Generate Groq-powered impact summary (uses GROQ_API_KEY)')
  .option('--model <model>', 'Groq model override')
  .option('--max-tokens <number>', 'Max completion tokens for AI summary')
  .option('--fail-on <severity>', 'Exit non-zero when severity >= threshold (low|medium|high|critical)')
  .action(async (tag1, tag2, options) => {
    const opts = program.opts();
    await analyzeSnapshots(tag1, tag2, {
      ...options,
      lang: opts.lang
    });
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

// Proxy command
program
  .command('proxy')
  .description('Start a time-travel proxy to automatically record interactions')
  .requiredOption('-t, --target <url>', 'Target URL to proxy requests to')
  .option('-p, --port <port>', 'Port to listen on', '8080')
  .action(async (options) => {
    await runProxy(options.target, options);
  });

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
