import chalk from 'chalk';
import Table from 'cli-table3';
import { getAllInteractions } from './storage.js';
import { translateText } from './lingo.js';

export async function showStats(options = {}) {
  const lang = options.lang;
  const interactions = getAllInteractions();

  if (interactions.length === 0) {
    console.log(chalk.yellow('\n  No interactions found to analyze.'));
    console.log(chalk.gray('  Run some requests first to see the magic! ✨\n'));
    return;
  }

  let title = '📊 Kiroo Analytics Dashboard';
  if (lang) title = await translateText(title, lang);
  console.log(chalk.cyan.bold(`\n  ${title}\n`));

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

  let generalHeader = '● General Performance';
  if (lang) generalHeader = await translateText(generalHeader, lang);
  console.log(chalk.white.bold(`  ${generalHeader}`));
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

  let distHeader = '● Request Distribution';
  if (lang) distHeader = await translateText(distHeader, lang);
  console.log(chalk.white.bold(`\n  ${distHeader}`));
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

  let slowHeader = '● Top 5 Slowest Endpoints (Bottlenecks)';
  if (lang) slowHeader = await translateText(slowHeader, lang);
  console.log(chalk.white.bold(`\n  ${slowHeader}`));
  console.log(slowTable.toString());
  console.log('');
}
