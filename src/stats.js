import chalk from 'chalk';
import Table from 'cli-table3';
import { getAllInteractions } from './storage.js';

export function showStats() {
  const interactions = getAllInteractions();

  if (interactions.length === 0) {
    console.log(chalk.yellow('\n  No interactions found to analyze.'));
    console.log(chalk.gray('  Run some requests first to see the magic! ✨\n'));
    return;
  }

  console.log(chalk.cyan.bold('\n  📊 Kiroo Analytics Dashboard\n'));

  // 1. General Metrics
  const total = interactions.length;
  const successes = interactions.filter(i => i.response.status >= 200 && i.response.status < 300).length;
  const successRate = ((successes / total) * 100).toFixed(1);
  const avgDuration = (interactions.reduce((acc, i) => acc + i.metadata.duration_ms, 0) / total).toFixed(0);

  const generalTable = new Table();
  generalTable.push(
    { [chalk.white('Total Requests')]: chalk.cyan(total) },
    { [chalk.white('Success Rate')]: successRate >= 80 ? chalk.green(successRate + '%') : chalk.yellow(successRate + '%') },
    { [chalk.white('Avg. Duration')]: chalk.white(avgDuration + 'ms') }
  );

  console.log(chalk.white.bold('  ● General Performance'));
  console.log(generalTable.toString());

  // 2. Method Distribution
  const methods = {};
  interactions.forEach(i => {
    methods[i.request.method] = (methods[i.request.method] || 0) + 1;
  });

  const methodTable = new Table({
    head: ['Method', 'Count', 'Percentage'].map(h => chalk.cyan(h)),
    colWidths: [15, 10, 15]
  });

  Object.entries(methods).forEach(([method, count]) => {
    const percentage = ((count / total) * 100).toFixed(1) + '%';
    methodTable.push([chalk.white(method), chalk.white(count), chalk.gray(percentage)]);
  });

  console.log(chalk.white.bold('\n  ● Request Distribution'));
  console.log(methodTable.toString());

  // 3. Slowest Endpoints
  const slowTable = new Table({
    head: ['URL', 'Status', 'Duration'].map(h => chalk.cyan(h)),
    colWidths: [45, 10, 15]
  });

  const sortedBySlowest = [...interactions].sort((a, b) => b.metadata.duration_ms - a.metadata.duration_ms);
  const topSlow = sortedBySlowest.slice(0, 5);

  topSlow.forEach(i => {
    const url = i.request.url.length > 42 ? i.request.url.substring(0, 39) + '...' : i.request.url;
    const statusColor = i.response.status < 400 ? chalk.green : chalk.red;
    slowTable.push([
      chalk.gray(url),
      statusColor(i.response.status),
      chalk.red(i.metadata.duration_ms + 'ms')
    ]);
  });

  console.log(chalk.white.bold('\n  ● Top 5 Slowest Endpoints (Bottlenecks)'));
  console.log(slowTable.toString());
  console.log('');
}
