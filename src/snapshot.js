import chalk from 'chalk';
import Table from 'cli-table3';
import { getAllInteractions, saveSnapshotData, getAllSnapshots, loadSnapshotData } from './storage.js';
import { translateText } from './lingo.js';

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

export async function compareSnapshots(tag1, tag2, lang) {
  try {
    const s1 = loadSnapshotData(tag1);
    const s2 = loadSnapshotData(tag2);
    
    console.log(chalk.cyan(`\n  🔍 Comparing Snapshots:`), chalk.white(tag1), chalk.gray('vs'), chalk.white(tag2));
    if (lang) {
      console.log(chalk.magenta(`  🌍 Translating output to: ${chalk.white(lang.toUpperCase())} using Lingo.dev...`));
    }
    
    const results = [];
    let breakingChanges = 0;
    
    // Helper to get path from URL string
    const getPath = (urlStr) => {
      try {
        const urlObj = new URL(urlStr);
        return urlObj.pathname;
      } catch (e) {
        // If it's already a path or invalid full URL, return as is
        return urlStr.startsWith('http') ? urlStr : (urlStr.startsWith('/') ? urlStr : '/' + urlStr);
      }
    };

    // Domain-agnostic comparison: match by Path and Method
    s2.interactions.forEach(int2 => {
      const path2 = getPath(int2.url);
      const int1 = s1.interactions.find(i => getPath(i.url) === path2 && i.method === int2.method);
      
      if (!int1) {
        results.push({
          type: 'NEW',
          method: int2.method,
          url: path2,
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
      
      // Helper for deep structural comparison
      const deepCompare = (val1, val2, path = '') => {
        const changes = [];
        
        // Handle nulls
        if (val1 === null && val2 !== null) return [{ path, msg: `type changed from null to ${typeof val2}`, breaking: false }];
        if (val1 !== null && val2 === null) return [{ path, msg: `type changed from ${typeof val1} to null`, breaking: false }];
        if (val1 === null && val2 === null) return changes;

        const type1 = Array.isArray(val1) ? 'array' : typeof val1;
        const type2 = Array.isArray(val2) ? 'array' : typeof val2;

        if (type1 !== type2) {
          changes.push({ path, msg: `type changed from ${chalk.yellow(type1)} to ${chalk.yellow(type2)}`, breaking: true });
          return changes;
        }

        if (type1 === 'object') {
          const keys1 = Object.keys(val1);
          const keys2 = Object.keys(val2);

          // Check for removed keys (Breaking)
          for (const k of keys1) {
            const currentPath = path ? `${path}.${k}` : k;
            if (!keys2.includes(k)) {
              changes.push({ path: currentPath, msg: `was ${chalk.red('removed')}`, breaking: true });
            } else {
              changes.push(...deepCompare(val1[k], val2[k], currentPath));
            }
          }

          // Check for added keys (Non-breaking)
          for (const k of keys2) {
            const currentPath = path ? `${path}.${k}` : k;
            if (!keys1.includes(k)) {
              changes.push({ path: currentPath, msg: `was ${chalk.green('added')}`, breaking: false });
            }
          }
        } else if (type1 === 'array') {
          // Array structure validation (check first item schema only if exists)
          if (val1.length > 0 && val2.length > 0) {
            const itemPath = path ? `${path}[0]` : '[0]';
            changes.push(...deepCompare(val1[0], val2[0], itemPath));
          }
        }
        
        return changes;
      };

      if (int1.response.body !== undefined && int2.response.body !== undefined) {
        const structuralChanges = deepCompare(int1.response.body, int2.response.body);
        for (const change of structuralChanges) {
           diffs.push(`${chalk.cyan(change.path || 'root')} ${change.msg}`);
           if (change.breaking) breakingChanges++;
        }
      }      
      if (diffs.length > 0) {
        results.push({
          type: 'CHANGE',
          method: int2.method,
          url: path2,
          msg: diffs.join('\n    ')
        });
      }
    });

    if (results.length === 0) {
      let finalMsg = 'No differences detected. Your API is stable!';
      if (lang) finalMsg = await translateText(finalMsg, lang);
      console.log(chalk.green(`\n  ✅ ${finalMsg}\n`));
    } else {
      console.log('');
      
      for (const res of results) {
        let printMsg = res.msg;
        if (lang) {
           // Basic translation hook for individual diff items (stripping ansi)
           const cleanMsg = printMsg.replace(/\x1B\[[0-9;]*m/g, '');
           const translatedMsg = await translateText(cleanMsg, lang);
           printMsg = chalk.yellow('[Translated] ') + translatedMsg;
        }

        const symbol = res.type === 'NEW' ? chalk.blue('+') : chalk.yellow('⚠️');
        console.log(`  ${symbol} ${chalk.white(res.method)} ${chalk.gray(res.url)}`);
        console.log(`    ${printMsg}`);
      }
      
      let alertMsg = breakingChanges > 0 
          ? `Detected ${breakingChanges} potential breaking changes!`
          : `Non-breaking changes detected.`;
          
      if (lang) alertMsg = await translateText(alertMsg, lang);

      if (breakingChanges > 0) {
        console.log(chalk.red(`\n  🚨 ${alertMsg}\n`));
      } else {
        console.log(chalk.blue(`\n  ℹ️ ${alertMsg}\n`));
      }
    }

  } catch (error) {
    console.error(chalk.red('\n  ✗ Comparison failed:'), error.message, '\n');
    process.exit(1);
  }
}
