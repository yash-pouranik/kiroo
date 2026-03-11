import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';
import { saveInteraction, loadEnv, saveEnv } from './storage.js';
import { formatResponse } from './formatter.js';

function applyEnvReplacements(data, envVars, usedKeys = null) {
  if (typeof data === 'string') {
    return data.replace(/\{\{(.+?)\}\}/g, (match, key) => {
      if (envVars[key] !== undefined) {
        if (usedKeys) usedKeys.add(key);
        return envVars[key];
      }
      return match;
    });
  }
  if (typeof data === 'object' && data !== null) {
    const newData = Array.isArray(data) ? [] : {};
    for (const key in data) {
      newData[key] = applyEnvReplacements(data[key], envVars, usedKeys);
    }
    return newData;
  }
  return data;
}

function setDeep(obj, path, value) {
  const keys = path.split(/[.[\]]+/).filter(Boolean);
  let current = obj;
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const isLast = i === keys.length - 1;
    
    if (isLast) {
      current[key] = value;
    } else {
      // Check if next key looks like a number (array index)
      const nextKey = keys[i + 1];
      const isNextNumber = !isNaN(nextKey);
      
      if (!current[key]) {
        current[key] = isNextNumber ? [] : {};
      }
      current = current[key];
    }
  }
}

function getDeep(obj, path) {
  const keys = path.split(/[.[\]]+/).filter(Boolean);
  return keys.reduce((acc, key) => acc && acc[key], obj);
}

export async function executeRequest(method, url, options = {}) {
  const env = loadEnv();
  const currentEnvVars = env.environments[env.current] || {};

  const usedKeys = new Set();
  const savedKeys = [];

  // Apply replacements to URL
  url = applyEnvReplacements(url, currentEnvVars, usedKeys);

  // Auto-BaseURL logic
  if (currentEnvVars.baseUrl) {
    let isRelative = false;
    let pathPart = url;

    // 1. Direct relative path
    if (url.startsWith('/')) {
      isRelative = true;
    } 
    // 2. Windows Git Bash conversion: Detect "C:/..." style paths with no protocol
    else if (process.platform === 'win32' && /^[a-zA-Z]:[/\\]/.test(url) && !url.includes('://')) {
      isRelative = true;
      // Extract the part after the drive letter and potential Git Bash root
      // We look for common markers or just the first segment that looks like a path
      // Most reliable for Git Bash: The user's path is at the end.
      // We'll try to find the /api, /v1, etc., or just fallback to the full path after the first few segments
      const segments = url.split(/[/\\]/);
      const apiIdx = segments.findIndex(s => s === 'api' || s === 'v1' || s === 'v2');
      if (apiIdx !== -1) {
        pathPart = '/' + segments.slice(apiIdx).join('/');
      } else {
        // Fallback: If we can't find a marker, it's hard to guess safely,
        // but we can try to strip the drive letter and first few segments
        // In Git Bash, it's usually C:/Program Files/Git/api...
        // Let's at least strip the drive letter root
        pathPart = url.replace(/^[a-zA-Z]:/, '').replace(/\\/g, '/');
        if (!pathPart.startsWith('/')) pathPart = '/' + pathPart;
      }
    }
    // 3. No leading slash but doesn't look like a host (no dots, no protocol)
    else if (!url.includes('://') && !url.includes('.') && !url.includes(':') && !url.startsWith('localhost')) {
      isRelative = true;
      pathPart = '/' + url;
    }

    if (isRelative) {
      const baseUrl = currentEnvVars.baseUrl;
      const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      url = normalizedBaseUrl + (pathPart.startsWith('/') ? pathPart : '/' + pathPart);
    }
  }

  // Parse headers
  const headers = {};
  if (options.header) {
    options.header.forEach(h => {
      const [key, ...valueParts] = h.split(':');
      const headerValue = valueParts.join(':').trim();
      headers[key.trim()] = applyEnvReplacements(headerValue, currentEnvVars, usedKeys);
    });
  }

  // Parse body
  let body;
  if (options.data) {
    let rawData = options.data;
    // Apply replacements to raw data string before parsing
    rawData = applyEnvReplacements(rawData, currentEnvVars, usedKeys);

    try {
      body = JSON.parse(rawData);
    } catch {
      body = {};
      // Improved shorthand parser to handle quoted strings and nested objects
      const pairs = rawData.match(/(\\.|[^ ])+/g) || [];
      
      pairs.forEach(pair => {
        const [key, ...valueParts] = pair.split('=');
        let value = valueParts.join('=');
        
        if (key && value !== undefined) {
          let parsedValue;
          // Check for quoted strings
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            parsedValue = value.slice(1, -1);
          } else {
            parsedValue = value;
            if (value === 'true') parsedValue = true;
            else if (value === 'false') parsedValue = false;
            else if (!isNaN(value) && value.trim() !== '') parsedValue = Number(value);
          }
          
          setDeep(body, key, parsedValue);
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
          const val = getDeep(response, responsePath);
          if (val !== undefined) {
            env.environments[env.current][envKey] = val;
            savedKeys.push(envKey);
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
      saves: savedKeys,
      uses: Array.from(usedKeys)
    });

    console.log(chalk.gray('\n  💾 Interaction saved:'), chalk.white(interactionId));

    return response;
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
