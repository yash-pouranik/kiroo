import chalk from 'chalk';
import { executeRequest } from './executor.js';

export async function handleImport(input) {
  try {
    let tokens = [];
    if (Array.isArray(input)) {
      tokens = input;
    } else {
      tokens = stringToTokens(input);
    }
    
    const parsed = parseCurlTokens(tokens);
    
    console.log(chalk.cyan('\n  📥 Parsed cURL Command:'));
    console.log(chalk.gray(`  Method: `), chalk.white(parsed.method));
    console.log(chalk.gray(`  URL:    `), chalk.white(parsed.url));
    console.log(chalk.gray(`  Headers:`), chalk.white(Object.keys(parsed.headers).length));
    if (parsed.body) {
      console.log(chalk.gray(`  Body:   `), chalk.white('Present'));
    }
    console.log('');

    // Convert parsed object to options format for executeRequest
    const options = {
      header: Object.entries(parsed.headers).map(([k, v]) => `${k}: ${v}`),
      data: parsed.body
    };

    await executeRequest(parsed.method, parsed.url, options);
    
  } catch (error) {
    console.error(chalk.red('\n  ✗ Import failed:'), error.message, '\n');
  }
}

function stringToTokens(curlString) {
  // Clean up shell artifacts (Windows ^, backslashes for line continuation)
  let cleanStr = curlString.replace(/\^/g, '').replace(/\\\n/g, ' ').trim();
  
  const tokens = [];
  let currentToken = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < cleanStr.length; i++) {
    const char = cleanStr[i];
    if ((char === "'" || char === '"') && (i === 0 || cleanStr[i - 1] !== '\\')) {
      if (inQuotes && char === quoteChar) {
        inQuotes = false;
        tokens.push(currentToken);
        currentToken = '';
        quoteChar = '';
      } else if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else {
        currentToken += char;
      }
    } else if (char === ' ' && !inQuotes) {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } else {
      currentToken += char;
    }
  }
  if (currentToken) tokens.push(currentToken);
  return tokens;
}

function parseCurlTokens(tokens) {
  const result = {
    method: 'GET',
    url: '',
    headers: {},
    body: ''
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim();
    if (!token) continue;

    if (token === '-X' || token === '--request') {
      result.method = tokens[++i].toUpperCase();
    } else if (token === '-H' || token === '--header') {
      const headerStr = tokens[++i];
      if (!headerStr) continue;
      const colonIdx = headerStr.indexOf(':');
      if (colonIdx !== -1) {
        const key = headerStr.substring(0, colonIdx).trim();
        const value = headerStr.substring(colonIdx + 1).trim();
        result.headers[key] = value;
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      result.body = tokens[++i];
      if (result.method === 'GET') result.method = 'POST';
    } else if (token.includes('://') || (token.startsWith('localhost') || token.startsWith('127.0.0.1'))) {
      if (!result.url) result.url = token;
    } else if (token === 'curl' || token.startsWith('-')) {
      continue;
    } else {
      if (!result.url) result.url = token;
    }
  }

  if (result.url) {
    result.url = result.url.replace(/^["']|["']$/g, '');
  }

  return result;
}
