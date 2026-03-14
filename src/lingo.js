import { LingoDotDevEngine } from "lingo.dev/sdk";
import chalk from "chalk";
import { getEnvVar } from "./env.js";

function getLingoEngine() {
  const apiKey = getEnvVar('LINGODOTDEV_API_KEY') || getEnvVar('LINGO_API_KEY');

  if (!apiKey) {
    console.log(chalk.yellow(`\n  ⚠️  Lingo API key not found in .kiroo/env.json.`));
    console.log(chalk.gray(`  Run 'kiroo env set LINGODOTDEV_API_KEY <your_key>' or re-run 'kiroo init'.\n`));
    return null;
  }

  return new LingoDotDevEngine({ apiKey });
}

export async function translateText(text, targetLang) {
  const engine = getLingoEngine();
  if (!engine) return text;

  try {
    const result = await engine.localizeText(text, {
      sourceLocale: 'en',
      targetLocale: targetLang,
      fast: true 
    });
    return result;
  } catch (error) {
    console.log(chalk.red(`\n  ⚠️  Translation failed: ${error.message}`));
    return text; 
  }
}
