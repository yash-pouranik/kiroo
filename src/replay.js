import chalk from 'chalk';
import Table from 'cli-table3';
import axios from 'axios';
import { getAllInteractions, loadInteraction } from './storage.js';
import { formatResponse } from './formatter.js';

export async function listInteractions(options) {
  const interactions = getAllInteractions();
  const limit = parseInt(options.limit) || 10;
  const offset = parseInt(options.offset) || 0;
  
  if (interactions.length === 0) {
    console.log(chalk.yellow('\n  No interactions found.'));
    console.log(chalk.gray('  Run a request first: '), chalk.white('kiroo POST https://api.example.com/endpoint\n'));
    return;
  }
  
  const table = new Table({
    head: ['ID', 'Method', 'URL', 'Status', 'Duration'].map(h => chalk.cyan(h)),
    colWidths: [26, 8, 45, 8, 12],
  });
  
  const page = interactions.slice(offset, offset + limit);
  
  page.forEach(int => {
    const statusColor = int.response.status >= 200 && int.response.status < 300 
      ? chalk.green 
      : int.response.status >= 400 
      ? chalk.red 
      : chalk.yellow;
    
    table.push([
      chalk.white(int.id),
      chalk.white(int.request.method),
      chalk.gray(int.request.url.substring(0, 42) + (int.request.url.length > 42 ? '...' : '')),
      statusColor(int.response.status),
      chalk.gray(int.metadata.duration_ms + 'ms'),
    ]);
  });
  
  console.log('');
  console.log(table.toString());
  console.log('');
  
  const start = offset + 1;
  const end = Math.min(offset + limit, interactions.length);
  
  console.log(chalk.gray(`  Showing ${start}-${end} of ${interactions.length} interactions`));
  if (interactions.length > offset + limit) {
    console.log(chalk.gray(`  Next page: `), chalk.white(`kiroo list --offset ${offset + limit}\n`));
  } else {
    console.log('');
  }
  console.log(chalk.gray('  Replay: '), chalk.white('kiroo replay <id>\n'));
}

export async function replayInteraction(id) {
  try {
    const interaction = loadInteraction(id);
    
    console.log(chalk.cyan(`\n  🔄 Replaying interaction:`), chalk.white(id));
    console.log(chalk.gray(`  ${interaction.request.method} ${interaction.request.url}\n`));
    
    const startTime = Date.now();
    const response = await axios({
      method: interaction.request.method.toLowerCase(),
      url: interaction.request.url,
      headers: interaction.request.headers,
      data: interaction.request.body,
      validateStatus: () => true,
    });
    const duration = Date.now() - startTime;
    
    console.log(formatResponse(response));
    
    // Simple comparison
    console.log(chalk.cyan('  📊 Comparison with stored response:'));
    
    if (response.status === interaction.response.status) {
      console.log(chalk.green('  ✓ Status matches:'), chalk.white(response.status));
    } else {
      console.log(chalk.red('  ✗ Status changed:'), chalk.gray(interaction.response.status), chalk.white('→'), chalk.red(response.status));
    }
    
    const timeDiff = duration - interaction.metadata.duration_ms;
    const timeColor = timeDiff > 0 ? chalk.yellow : chalk.green;
    console.log(chalk.gray('  ⏱  Duration:'), chalk.white(`${duration}ms`), timeColor(`(${timeDiff > 0 ? '+' : ''}${timeDiff}ms)`));
    console.log('');
    
  } catch (error) {
    console.error(chalk.red('\n  ✗ Replay failed:'), error.message, '\n');
    process.exit(1);
  }
}
