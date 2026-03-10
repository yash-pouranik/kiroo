import chalk from 'chalk';
import { executeRequest } from './executor.js';

export async function handleImport(curlCommand) {
  try {
    const parsed = parseCurl(curlCommand);
    
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

/**
 * A basic cURL parser that handles:
 * - -X, --request
 * - -H, --header
 * - -d, --data, --data-raw, --data-binary
 * - URL (positional)
 */
function parseCurl(curlString) {
  // Clean up the string (handle multi-line backslashes)
  const cleanStr = curlString.replace(/\\\n/g, ' ').trim();
  
  // Basic tokenization (naive but works for most browser exports)
  // We need to respect quotes when splitting
  const tokens = [];
  let currentToken = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < cleanStr.length; i++) {
    const char = cleanStr[i];
    if ((char === "'" || char === '"') && cleanStr[i-1] !== '\\') {
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

  const result = {
    method: 'GET',
    url: '',
    headers: {},
    body: ''
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    if (token === '-X' || token === '--request') {
      result.method = tokens[++i].toUpperCase();
    } else if (token === '-H' || token === '--header') {
      const headerStr = tokens[++i];
      const colonIdx = headerStr.indexOf(':');
      if (colonIdx !== -1) {
        const key = headerStr.substring(0, colonIdx).trim();
        const value = headerStr.substring(colonIdx + 1).trim();
        result.headers[key] = value;
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      result.body = tokens[++i];
      if (result.method === 'GET') result.method = 'POST'; // Default to POST if data is present
    } else if (token.startsWith('http')) {
      result.url = token;
    } else if (token !== 'curl' && !token.startsWith('-')) {
      // Might be a naked URL without http prefix or an argument
      if (!result.url) result.url = token;
    }
  }

  return result;
}
