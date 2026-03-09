import chalk from 'chalk';

export function formatResponse(response) {
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
  
  // Headers (selected)
  const importantHeaders = ['content-type', 'content-length', 'set-cookie'];
  const headers = Object.entries(response.headers)
    .filter(([key]) => importantHeaders.includes(key.toLowerCase()))
    .slice(0, 3);
  
  if (headers.length > 0) {
    lines.push(chalk.gray('  Headers:'));
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
    lines.push(chalk.gray('  Response:'));
    
    if (typeof response.data === 'object') {
      // Pretty print JSON
      const json = JSON.stringify(response.data, null, 2);
      json.split('\n').forEach(line => {
        lines.push(chalk.cyan(`    ${line}`));
      });
    } else {
      // Plain text
      const text = String(response.data);
      const preview = text.length > 500 ? text.substring(0, 500) + '...' : text;
      lines.push(chalk.white(`    ${preview}`));
    }
  }
  
  lines.push('');
  return lines.join('\n');
}
