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
  if (!text || typeof text !== 'string' || text.trim() === '') return text;
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
    // console.log(chalk.red(`\n  ⚠️  Translation failed: ${error.message}`));
    return text; 
  }
}

// Recursive localization for objects/arrays
export async function translateResponseData(data, targetLang) {
  if (!data) return data;
  if (typeof data === 'string') {
    return await translateText(data, targetLang);
  }
  if (Array.isArray(data)) {
    return await Promise.all(data.map(item => translateResponseData(item, targetLang)));
  }
  if (typeof data === 'object') {
    const translated = {};
    for (const [key, value] of Object.entries(data)) {
      // Don't translate keys, just values
      translated[key] = await translateResponseData(value, targetLang);
    }
    return translated;
  }
  return data;
}
