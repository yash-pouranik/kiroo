import chalk from 'chalk';

import { translateText, translateResponseData } from './lingo.js';

export async function formatResponse(response, lang) {
  const lines = [];
  
  // Status
  const statusColor = response.status >= 200 && response.status < 300 
    ? 'green' 
    : response.status >= 400 
    ? 'red' 
    : 'yellow';
  
  lines.push('');
  lines.push(chalk[statusColor].bold(`  ${response.status} ${response.statusText}`));
  lines.push('');
  
  // Headers
  const importantHeaders = ['content-type', 'content-length', 'set-cookie'];
  const headers = Object.entries(response.headers)
    .filter(([key]) => importantHeaders.includes(key.toLowerCase()))
    .slice(0, 3);
  
  if (headers.length > 0) {
    let headersLabel = '  Headers:';
    if (lang) headersLabel = await translateText(headersLabel, lang);
    lines.push(chalk.gray(headersLabel));
    
    headers.forEach(([key, value]) => {
      const displayValue = typeof value === 'string' && value.length > 50 
        ? value.substring(0, 50) + '...' 
        : value;
      lines.push(chalk.gray(`    ${key}:`), chalk.white(displayValue));
    });
    lines.push('');
  }
  
  // Body
  if (response.data) {
    let responseLabel = '  Response:';
    if (lang) responseLabel = await translateText(responseLabel, lang);
    lines.push(chalk.gray(responseLabel));
    
    let displayData = response.data;
    if (lang) {
      displayData = await translateResponseData(response.data, lang);
    }
    
    if (typeof displayData === 'object') {
      // Pretty print JSON
      const json = JSON.stringify(displayData, null, 2);
      json.split('\n').forEach(line => {
        lines.push(chalk.cyan(`    ${line}`));
      });
    } else {
      // Plain text
      const text = String(displayData);
      const preview = text.length > 500 ? text.substring(0, 500) + '...' : text;
      lines.push(chalk.white(`    ${preview}`));
    }
  }
  
  lines.push('');
  return lines.join('\n');
}
