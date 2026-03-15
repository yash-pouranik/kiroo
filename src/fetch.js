import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import fs from 'fs';
import { join } from 'path';
import { ensureKirooDir } from './storage.js';
import { getEnvVar } from './env.js';

export async function fetchCapture(replayId) {
  const supabaseUrl = getEnvVar('SUPABASE_URL');
  const supabaseKey = getEnvVar('SUPABASE_KEY');
  const bucket = getEnvVar('SUPABASE_BUCKET') || 'kiroo-captures';
  
  if (!supabaseUrl || !supabaseKey) {
    console.error(chalk.red('\n  ✗ Error: SUPABASE_URL and SUPABASE_KEY are required.'));
    console.log(chalk.gray('  Set them in your environment or use:'), chalk.white('kiroo env set SUPABASE_URL <url>'));
    process.exit(1);
  }
  
  console.log(chalk.magenta(`\n  🔍 Searching production captures for: ${chalk.white(replayId)}`));
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Extract date from replay ID (format: kiroo-TIMESTAMP-hash)
  const parts = replayId.split('-');
  if (parts.length < 2) {
    console.error(chalk.red(`  ✗ Invalid Replay ID format: ${replayId}`));
    process.exit(1);
  }

  const timestamp = parseInt(parts[1], 10);
  if (isNaN(timestamp)) {
    console.error(chalk.red(`  ✗ Could not parse timestamp from Replay ID: ${replayId}`));
    process.exit(1);
  }

  const date = new Date(timestamp).toISOString().split('T')[0];
  const fileName = `${date}.json`;
  
  console.log(chalk.gray(`  Looking in partition: ${fileName}...`));
  
  try {
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(fileName);
    
    if (downloadError) {
      console.error(chalk.red(`  ✗ Capture partition not found: ${fileName}`));
      console.log(chalk.gray('    Are you sure the ID is correct and captured today/recently?'));
      process.exit(1);
    }
    
    const text = await fileBlob.text();
    const captures = JSON.parse(text);
    const capture = captures.find(c => c.id === replayId);
    
    if (!capture) {
      console.error(chalk.red(`  ✗ Replay ID not found in ${fileName}`));
      process.exit(1);
    }
    
    // Save to local .kiroo/interactions/
    ensureKirooDir();
    const localDir = join('.kiroo', 'interactions');
    const localPath = join(localDir, `${replayId}.json`);
    
    fs.writeFileSync(localPath, JSON.stringify(capture, null, 2));
    
    console.log(chalk.green(`\n  ✓ Successfully downloaded: ${chalk.white(replayId)}`));
    console.log(chalk.gray(`    Method:    ${chalk.white(capture.request.method)}`));
    console.log(chalk.gray(`    URL:       ${chalk.white(capture.request.url)}`));
    console.log(chalk.gray(`    Status:    ${chalk.white(capture.response.status)}`));
    console.log(chalk.gray(`    Timestamp: ${chalk.white(capture.timestamp)}`));
    console.log(chalk.cyan(`\n  🚀 Ready to debug! Run:`));
    console.log(`  $ kiroo replay ${replayId} --target http://localhost:3000\n`);

  } catch (err) {
    console.error(chalk.red(`\n  ✗ Fetch failed: ${err.message}`));
    process.exit(1);
  }
}
