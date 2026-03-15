import chalk from 'chalk';
import Table from 'cli-table3';
import axios from 'axios';
import { getAllInteractions, loadInteraction } from './storage.js';
import { formatResponse } from './formatter.js';

export async function listInteractions(options) {
  let interactions = getAllInteractions();
  const limit = parseInt(options.limit) || 10;
  const offset = parseInt(options.offset) || 0;
  
  // Apply Filters
  if (options.date) {
    interactions = interactions.filter(int => (int.timestamp || '').startsWith(options.date));
  }
  if (options.url) {
    interactions = interactions.filter(int => int.request.url.toLowerCase().includes(options.url.toLowerCase()));
  }
  if (options.status) {
    interactions = interactions.filter(int => String(int.response.status) === String(options.status));
  }

  if (interactions.length === 0) {
    console.log(chalk.yellow('\n  No matching interactions found.'));
    if (!options.date && !options.url && !options.status) {
      console.log(chalk.gray('  Run a request first: '), chalk.white('kiroo POST https://api.example.com/endpoint\n'));
    }
    return;
  }
  
  const table = new Table({
    head: ['ID', 'Method', 'URL', 'Status', 'Duration'].map(h => chalk.cyan(h)),
    colWidths: [44, 8, 27, 8, 12],
  });
  
  const page = interactions.slice(offset, offset + limit);
  
  page.forEach(int => {
    const statusColor = int.response.status >= 200 && int.response.status < 300 
      ? chalk.green 
      : int.response.status >= 400 
      ? chalk.red 
      : chalk.yellow;
    
    const url = int.request.url || 'N/A';
    table.push([
      chalk.white(int.id),
      chalk.white(int.request.method || '???'),
      chalk.gray(url.substring(0, 24) + (url.length > 24 ? '...' : '')),
      statusColor(int.response.status),
      chalk.gray((int.metadata.duration_ms || 0) + 'ms'),
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

export async function replayInteraction(id, options = {}) {
  try {
    const interaction = loadInteraction(id);
    
    let url = interaction.request.url;
    if (options.target) {
      try {
        const targetBase = options.target.startsWith('http') ? options.target : `http://${options.target}`;
        const targetUrl = new URL(targetBase);
        
        // Handle captured URL which might be full URL OR just a path
        let pathAndQuery = interaction.request.url;
        if (pathAndQuery.startsWith('http')) {
          const parsedOriginal = new URL(pathAndQuery);
          pathAndQuery = `${parsedOriginal.pathname}${parsedOriginal.search}`;
        }
        
        // Ensure path starts with /
        if (!pathAndQuery.startsWith('/')) {
          pathAndQuery = '/' + pathAndQuery;
        }
        
        url = `${targetUrl.origin}${pathAndQuery}`;
        
        // Optimization: Remove original host header to avoid conflicts with target
        if (interaction.request.headers) {
          delete interaction.request.headers.host;
          delete interaction.request.headers.Host;
        }
      } catch (e) {
        console.error(chalk.red('\n  ✗ Error processing target URL:'), e.message);
        process.exit(1);
      }
    }

    console.log(chalk.cyan(`\n  🔄 Replaying interaction:`), chalk.white(id));
    if (options.target) {
      console.log(chalk.gray(`  Redirected to: ${chalk.yellow(url)}`));
    } else {
      console.log(chalk.gray(`  ${interaction.request.method} ${interaction.request.url}\n`));
    }
    
    const startTime = Date.now();
    const response = await axios({
      method: interaction.request.method.toLowerCase(),
      url: url,
      headers: interaction.request.headers,
      data: interaction.request.body,
      validateStatus: () => true,
    });
    const duration = Date.now() - startTime;
    
    console.log(await formatResponse(response));
    
    // Simple comparison
    console.log(chalk.cyan('  📊 Comparison with stored response:'));
    
    if (response.status === interaction.response.status) {
      console.log(chalk.green('  ✓ Status matches:'), chalk.white(response.status));
    } else {
      console.log(chalk.red('  ✗ Status changed:'), chalk.gray(interaction.response.status), chalk.white('→'), chalk.red(response.status));
    }
    
    const originalDuration = interaction.metadata?.duration_ms;
    const timeDiff = originalDuration !== undefined ? duration - originalDuration : null;
    const timeColor = timeDiff > 0 ? chalk.yellow : chalk.green;
    const timeStr = timeDiff !== null ? timeColor(`(${timeDiff > 0 ? '+' : ''}${timeDiff}ms)`) : '';
    
    console.log(chalk.gray('  ⏱  Duration:'), chalk.white(`${duration}ms`), timeStr);
    console.log('');
    
  } catch (error) {
    console.error(chalk.red('\n  ✗ Replay failed:'), error.message, '\n');
    process.exit(1);
  }
}
