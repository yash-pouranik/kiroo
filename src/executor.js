import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';
import { saveInteraction } from './storage.js';
import { formatResponse } from './formatter.js';

export async function executeRequest(method, url, options = {}) {
  // Parse headers
  const headers = {};
  if (options.header) {
    options.header.forEach(h => {
      const [key, ...valueParts] = h.split(':');
      headers[key.trim()] = valueParts.join(':').trim();
    });
  }

  // Parse body
  let body;
  if (options.data) {
    try {
      // Try parsing as JSON first
      body = JSON.parse(options.data);
    } catch {
      // Otherwise parse as key=value pairs
      body = {};
      options.data.split(' ').forEach(pair => {
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
      validateStatus: () => true, // Don't throw on any status
    });

    const duration = Date.now() - startTime;
    spinner.succeed(chalk.green(`${response.status} ${response.statusText}`) + chalk.gray(` (${duration}ms)`));

    // Format and display response
    console.log(formatResponse(response));

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
      console.log(chalk.gray('  Check the URL and try again.\n'));
    } else if (error.code === 'ECONNREFUSED') {
      console.error(chalk.red('\n  ✗ Connection refused:'), url);
      console.log(chalk.gray('  Is the server running?\n'));
    } else {
      console.error(chalk.red('\n  ✗ Error:'), error.message, '\n');
    }
    
    process.exit(1);
  }
}
