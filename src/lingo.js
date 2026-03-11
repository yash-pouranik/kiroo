import { LingoDotDevEngine } from "lingo.dev/sdk";
import chalk from "chalk";
import { loadEnv } from "./storage.js";

function getLingoEngine() {
  const envData = loadEnv();
  const currentEnvVars = envData.environments[envData.current] || {};
  
  // Prioritize process.env, fallback to kiroo environments
  const apiKey = currentEnvVars.LINGODOTDEV_API_KEY;

  if (!apiKey) {
    console.log(chalk.yellow(`\n  ⚠️  LINGODOTDEV_API_KEY not found.`));
    console.log(chalk.gray(`run 'kiroo env set LINGODOTDEV_API_KEY <your_key>'\n`));
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
