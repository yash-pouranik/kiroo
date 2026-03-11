import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { loadInteraction } from './storage.js';
import { replayInteraction } from './replay.js';

export async function editInteraction(id) {
  try {
    const interaction = loadInteraction(id);
    if (!interaction) {
      console.log(chalk.red(`\n  ✗ Interaction not found: ${id}\n`));
      return;
    }

    // Step 2: Generate temporary editable JSON
    const tmpFileName = `.kiroo/tmp_edit_${id}.json`;
    const editableData = {
      method: interaction.request.method,
      url: interaction.request.url,
      headers: interaction.request.headers || {},
      data: interaction.request.body || null
    };

    writeFileSync(tmpFileName, JSON.stringify(editableData, null, 2));

    // Step 3: Launch Editor
    const editor = process.env.EDITOR || 'code'; // Fallbacks: code, nano, vim, notepad...
    
    console.log(chalk.cyan(`\n  📝 Opening interaction in your editor (${editor})...`));
    console.log(chalk.gray(`  Save and close the file to automatically replay the request.`));
    
    try {
      // In windows, 'code -w' waits for VS Code to close. 
      // If notepad, just 'notepad' blocks until closed.
      // If using fallback, we try standard blocking call.
      const launchCmd = editor === 'code' ? 'code -w' : editor;
      execSync(`${launchCmd} ${tmpFileName}`, { stdio: 'inherit' });
    } catch (e) {
      console.log(chalk.red(`\n  ✗ Failed to open editor '${editor}'.`));
      console.log(chalk.gray(`  Please specify a valid editor via EDITOR environment variable (e.g. EDITOR=nano kiroo edit).`));
      try { unlinkSync(tmpFileName); } catch(err){}
      return;
    }

    // Step 4: Editor closed, read updated data
    let updatedDataStr;
    try {
      updatedDataStr = readFileSync(tmpFileName, 'utf-8');
    } catch (e) {
      console.log(chalk.red('\n  ✗ Could not read the edited file. Editing cancelled.\n'));
      return;
    }

    let updatedData;
    try {
      updatedData = JSON.parse(updatedDataStr);
    } catch (e) {
      console.log(chalk.red('\n  ✗ Invalid JSON syntax in edited file. Editing cancelled.\n'));
      try { unlinkSync(tmpFileName); } catch(err){}
      return;
    }

    // Step 5: Merge and Rewrite
    interaction.request.method = updatedData.method;
    interaction.request.url = updatedData.url;
    interaction.request.headers = updatedData.headers;
    interaction.request.body = updatedData.data;
    
    // Save it over the original file
    const originalPath = join('.kiroo', 'interactions', `${id}.json`);
    writeFileSync(originalPath, JSON.stringify(interaction, null, 2));
    
    // Cleanup tmp file
    try { unlinkSync(tmpFileName); } catch(err){}

    console.log(chalk.green(`\n  ✅ Interaction updated. Replaying now...\n`));

    // Step 6: Trigger replay
    await replayInteraction(id);

  } catch (error) {
    console.error(chalk.red(`\n  ✗ Edit Failed: ${error.message}\n`));
  }
}
