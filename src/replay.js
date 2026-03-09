import chalk from 'chalk';
import Table from 'cli-table3';
import { getAllInteractions, loadInteraction } from './storage.js';

export async function listInteractions(options) {
  const interactions = getAllInteractions();
  const limit = parseInt(options.limit) || 10;
  
  if (interactions.length === 0) {
    console.log(chalk.yellow('\n  No interactions found.'));
    console.log(chalk.gray('  Run a request first: '), chalk.white('kiroo POST https://api.example.com/endpoint\n'));
    return;
  }
  
  const table = new Table({
    head: ['ID', 'Method', 'URL', 'Status', 'Duration'].map(h => chalk.cyan(h)),
    colWidths: [22, 8, 50, 8, 10],
  });
  
  interactions.slice(0, limit).forEach(int => {
    const statusColor = int.response.status >= 200 && int.response.status < 300 
      ? chalk.green 
      : int.response.status >= 400 
      ? chalk.red 
      : chalk.yellow;
    
    table.push([
      chalk.white(int.id),
      chalk.white(int.request.method),
      chalk.gray(int.request.url.substring(0, 47) + '...'),
      statusColor(int.response.status),
      chalk.gray(int.metadata.duration_ms + 'ms'),
    ]);
  });
  
  console.log('');
  console.log(table.toString());
  console.log('');
  console.log(chalk.gray(`  Showing ${Math.min(limit, interactions.length)} of ${interactions.length} interactions`));
  console.log(chalk.gray('  Replay: '), chalk.white('kiroo replay <id>\n'));
}

export async function replayInteraction(id) {
  console.log(chalk.yellow('\n  🔄 Replay feature coming in Day 2!\n'));
  console.log(chalk.gray('  This will reproduce the exact request from:'), chalk.white(id), '\n');
}
