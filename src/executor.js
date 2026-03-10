import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';
import { saveInteraction, loadEnv, saveEnv } from './storage.js';
import { formatResponse } from './formatter.js';

function applyEnvReplacements(data, envVars) {
  if (typeof data === 'string') {
    return data.replace(/\{\{(.+?)\}\}/g, (match, key) => {
      return envVars[key] !== undefined ? envVars[key] : match;
    });
  }
  if (typeof data === 'object' && data !== null) {
    const newData = Array.isArray(data) ? [] : {};
    for (const key in data) {
      newData[key] = applyEnvReplacements(data[key], envVars);
    }
    return newData;
  }
  return data;
}

function getValueByPath(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

export async function executeRequest(method, url, options = {}) {
  const env = loadEnv();
  const currentEnvVars = env.environments[env.current] || {};

  // Apply replacements to URL
  url = applyEnvReplacements(url, currentEnvVars);

  // Parse headers
  const headers = {};
  if (options.header) {
    options.header.forEach(h => {
      const [key, ...valueParts] = h.split(':');
      const headerValue = valueParts.join(':').trim();
      headers[key.trim()] = applyEnvReplacements(headerValue, currentEnvVars);
    });
  }

  // Parse body
  let body;
  if (options.data) {
    let rawData = options.data;
    // Apply replacements to raw data string before parsing
    rawData = applyEnvReplacements(rawData, currentEnvVars);

    try {
      body = JSON.parse(rawData);
    } catch {
      body = {};
      rawData.split(' ').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value !== undefined) {
          let parsedValue = value;
          if (value === 'true') parsedValue = true;
          else if (value === 'false') parsedValue = false;
          else if (!isNaN(value) && value.trim() !== '') parsedValue = Number(value);
          
          body[key] = parsedValue;
        }
      });
    }
  }

  // Ensure URL has protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  const spinner = ora('Sending request...').start();
  const startTime = Date.now();

  try {
    const response = await axios({
      method: method.toLowerCase(),
      url,
      headers,
      data: body,
      validateStatus: () => true,
    });

    const duration = Date.now() - startTime;
    spinner.succeed(chalk.green(`${response.status} ${response.statusText}`) + chalk.gray(` (${duration}ms)`));

    // Format and display response
    console.log(formatResponse(response));

    // Handle --save option
    if (options.save) {
      const saves = Array.isArray(options.save) ? options.save : [options.save];
      saves.forEach(s => {
        const [envKey, responsePath] = s.split('=');
        if (envKey && responsePath) {
          const val = getValueByPath(response, responsePath);
          if (val !== undefined) {
            env.environments[env.current][envKey] = val;
            console.log(chalk.cyan(`  ✨ Saved to env:`), chalk.white(`${envKey}=${val}`));
          } else {
            console.log(chalk.yellow(`  ⚠️  Could not find path '${responsePath}' in response`));
          }
        }
      });
      saveEnv(env);
    }

    // Save interaction
    const interactionId = await saveInteraction({
      method,
      url,
      headers,
      body,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
      },
      duration,
    });

    console.log(chalk.gray('\n  💾 Interaction saved:'), chalk.white(interactionId));

  } catch (error) {
    const duration = Date.now() - startTime;
    spinner.fail(chalk.red('Request failed'));
    
    if (error.code === 'ENOTFOUND') {
      console.error(chalk.red('\n  ✗ Host not found:'), url);
    } else if (error.code === 'ECONNREFUSED') {
      console.error(chalk.red('\n  ✗ Connection refused:'), url);
    } else {
      console.error(chalk.red('\n  ✗ Error:'), error.message, '\n');
    }
    
    process.exit(1);
  }
}
