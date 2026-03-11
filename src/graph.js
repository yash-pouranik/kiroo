import chalk from 'chalk';
import { getAllInteractions } from './storage.js';

export async function showGraph() {
  const interactions = getAllInteractions().reverse(); // Chronological order

  if (interactions.length === 0) {
    console.log(chalk.yellow('\n  No interactions recorded yet.'));
    console.log(chalk.gray('  Run some requests to see the dependency graph!\n'));
    return;
  }

  // 1. Map: Variable -> Provider Interaction (Method + Path)
  const variableProviders = {};
  
  // 2. Interaction nodes with their connections
  const nodes = [];

  const getPath = (urlStr) => {
    try {
      const urlObj = new URL(urlStr);
      return urlObj.pathname;
    } catch (e) {
      return urlStr.startsWith('http') ? urlStr : (urlStr.startsWith('/') ? urlStr : '/' + urlStr);
    }
  };

  interactions.forEach(int => {
    const path = getPath(int.request.url);
    const method = int.request.method;
    const saves = int.metadata.saves || [];
    const uses = int.metadata.uses || [];

    // Track which variables this interaction provides
    saves.forEach(v => {
      variableProviders[v] = { method, path };
    });

    nodes.push({ method, path, saves, uses });
  });

  console.log(chalk.cyan('\n  🕸️  API Dependency Graph:'));
  console.log(chalk.gray('  (Shows how data flows between endpoints)\n'));

  // Simple visualization
  const seenPaths = new Set();
  
  nodes.forEach((node, idx) => {
    const nodeLabel = `${chalk.white(node.method)} ${chalk.gray(node.path)}`;
    
    // Find dependencies based on 'uses'
    const dependencies = node.uses.map(v => {
      const provider = variableProviders[v];
      return provider ? `[${v}] from ${provider.method} ${provider.path}` : null;
    }).filter(Boolean);

    // Render the node
    if (dependencies.length > 0) {
      console.log(`  ${chalk.blue('⬇')} ${nodeLabel}`);
      dependencies.forEach((dep, depIdx) => {
        const branchToken = depIdx === dependencies.length - 1 ? '└─' : '├─';
        console.log(`     ${chalk.gray(branchToken)} ${chalk.yellow('uses')} ${dep}`);
      });
    } else {
      console.log(`  ${chalk.green('○')} ${nodeLabel}`);
    }

    if (node.saves.length > 0) {
      const saveToken = node.uses.length > 0 ? '     │' : '     ';
      console.log(`${saveToken}  ${chalk.magenta('↳')} ${chalk.gray('saves')} ${chalk.white(node.saves.join(', '))}`);
    }
    
    console.log('');
  });
}
