import chalk from 'chalk';
import Table from 'cli-table3';
import { getAllInteractions, saveSnapshotData, getAllSnapshots, loadSnapshotData } from './storage.js';

export async function saveSnapshot(tag) {
  const interactions = getAllInteractions();
  
  if (interactions.length === 0) {
    console.log(chalk.yellow('\n  No interactions to snapshot.'));
    console.log(chalk.gray('  Run some requests first.\n'));
    return;
  }
  
  const snapshotData = {
    tag,
    timestamp: new Date().toISOString(),
    interactions: interactions.map(int => ({
      id: int.id,
      method: int.request.method,
      url: int.request.url,
      request: int.request,
      response: {
        status: int.response.status,
        body: int.response.data
      },
      metadata: int.metadata
    }))
  };
  
  saveSnapshotData(tag, snapshotData);
  
  console.log(chalk.green(`\n  📸 Snapshot saved:`), chalk.white(tag));
  console.log(chalk.gray(`  Contains ${interactions.length} interactions\n`));
}

export async function listSnapshots() {
  const snapshots = getAllSnapshots();
  
  if (snapshots.length === 0) {
    console.log(chalk.yellow('\n  No snapshots found.'));
    console.log(chalk.gray('  Save one with: '), chalk.white('kiroo snapshot save <tag>\n'));
    return;
  }
  
  console.log(chalk.cyan('\n  📸 Available Snapshots:'));
  snapshots.forEach(tag => {
    console.log(`  - ${chalk.white(tag)}`);
  });
  console.log('');
}

export async function compareSnapshots(tag1, tag2) {
  try {
    const s1 = loadSnapshotData(tag1);
    const s2 = loadSnapshotData(tag2);
    
    console.log(chalk.cyan(`\n  🔍 Comparing Snapshots:`), chalk.white(tag1), chalk.gray('vs'), chalk.white(tag2));
    
    const results = [];
    let breakingChanges = 0;
    
    // Simplistic comparison: match by URL and Method
    s2.interactions.forEach(int2 => {
      const int1 = s1.interactions.find(i => i.url === int2.url && i.method === int2.method);
      
      if (!int1) {
        results.push({
          type: 'NEW',
          method: int2.method,
          url: int2.url,
          msg: chalk.blue('New interaction added')
        });
        return;
      }
      
      const diffs = [];
      
      // Compare status
      if (int1.response.status !== int2.response.status) {
        diffs.push(`Status: ${chalk.gray(int1.response.status)} → ${chalk.red(int2.response.status)}`);
        breakingChanges++;
      }
      
      // Deep field comparison (very basic for MVP)
      if (typeof int1.response.body === 'object' && typeof int2.response.body === 'object' && int1.response.body !== null && int2.response.body !== null) {
        const keys1 = Object.keys(int1.response.body);
        const keys2 = Object.keys(int2.response.body);
        
        const removed = keys1.filter(k => !keys2.includes(k));
        if (removed.length > 0) {
          diffs.push(`Fields removed: ${chalk.red(removed.join(', '))}`);
          breakingChanges++;
        }
      }
      
      if (diffs.length > 0) {
        results.push({
          type: 'CHANGE',
          method: int2.method,
          url: int2.url,
          msg: diffs.join('\n    ')
        });
      }
    });

    if (results.length === 0) {
      console.log(chalk.green('\n  ✅ No differences detected. Your API is stable!\n'));
    } else {
      console.log('');
      results.forEach(res => {
        const symbol = res.type === 'NEW' ? chalk.blue('+') : chalk.yellow('⚠️');
        console.log(`  ${symbol} ${chalk.white(res.method)} ${chalk.gray(res.url)}`);
        console.log(`    ${res.msg}`);
      });
      
      if (breakingChanges > 0) {
        console.log(chalk.red(`\n  🚨 Detected ${breakingChanges} potential breaking changes!\n`));
      } else {
        console.log(chalk.blue('\n  ℹ️ Non-breaking changes detected.\n'));
      }
    }

  } catch (error) {
    console.error(chalk.red('\n  ✗ Comparison failed:'), error.message, '\n');
    process.exit(1);
  }
}
