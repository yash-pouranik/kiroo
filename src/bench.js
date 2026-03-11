import chalk from 'chalk';
import Table from 'cli-table3';
import axios from 'axios';
import ora from 'ora';
import { loadEnv } from './storage.js';

export async function runBenchmark(url, options) {
  const method = (options.method || 'GET').toUpperCase();
  const totalRequests = parseInt(options.number) || 10;
  const concurrency = parseInt(options.concurrent) || 1;
  const headersObj = {};

  if (options.header) {
    options.header.forEach(h => {
      const parts = h.split(':');
      if (parts.length >= 2) {
        headersObj[parts[0].trim()] = parts.slice(1).join(':').trim();
      }
    });
  }

  // Auto-BaseURL processing
  let targetUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const envData = loadEnv();
    const currentEnv = envData.environments[envData.current] || {};
    if (currentEnv.baseUrl) {
      if (!currentEnv.baseUrl.endsWith('/') && !url.startsWith('/')) {
        targetUrl = `${currentEnv.baseUrl}/${url}`;
      } else {
        targetUrl = `${currentEnv.baseUrl}${url}`;
      }
    } else {
      console.log(chalk.red(`\n  ✗ Invalid URL and no baseUrl defined in environment '${envData.current}'\n`));
      process.exit(1);
    }
  }

  // Parse Body
  let requestData = options.data;
  if (options.data && !options.data.trim().startsWith('{')) {
    const pairs = options.data.split(' ');
    requestData = {};
    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value !== undefined) {
        requestData[key] = value;
      }
    });
  } else if (options.data) {
    try {
      requestData = JSON.parse(options.data);
    } catch(e) {}
  }

  const spinner = ora(`Benchmarking ${method} ${targetUrl} (Reqs: ${totalRequests}, Workers: ${concurrency})`).start();

  const results = {
    total: totalRequests,
    success: 0,
    failures: 0,
    times: []
  };

  const startTime = Date.now();
  let completedCount = 0;
  let activeWorkers = 0;
  
  // Custom concurrency implementation
  return new Promise((resolve) => {
    const executeNext = async () => {
      if (completedCount >= totalRequests) {
        if (activeWorkers === 0) finalizeBenchmark();
        return;
      }

      activeWorkers++;
      const reqIndex = completedCount++;
      const reqStartTime = Date.now();

      try {
        const response = await axios({
          method: method.toLowerCase(),
          url: targetUrl,
          headers: headersObj,
          data: requestData,
          validateStatus: () => true, // Don't throw on 4xx/5xx
        });
        
        const duration = Date.now() - reqStartTime;
        results.times.push(duration);
        
        if (response.status >= 200 && response.status < 400) {
          results.success++;
        } else {
          results.failures++;
        }
      } catch (error) {
        const duration = Date.now() - reqStartTime;
        results.times.push(duration);
        results.failures++;
      } finally {
        activeWorkers--;
        // Update spinner
        const percent = Math.floor((completedCount / totalRequests) * 100);
        spinner.text = `Benchmarking... ${percent}% [${completedCount}/${totalRequests}]`;
        
        executeNext();
      }
    };

    const finalizeBenchmark = () => {
      const totalTime = Date.now() - startTime;
      spinner.stop();
      
      const rps = ((results.total / totalTime) * 1000).toFixed(2);
      
      // Calculate min, max, avg
      let min = 0, max = 0, avg = 0;
      if (results.times.length > 0) {
        min = Math.min(...results.times);
        max = Math.max(...results.times);
        avg = Math.round(results.times.reduce((a, b) => a + b, 0) / results.times.length);
      }

      console.log('\n  ' + chalk.blue.bold('🚀 Benchmark Results'));
      console.log('  ' + chalk.gray(`${method} ${targetUrl}\n`));

      const statsTable = new Table({
        colWidths: [20, 15]
      });

      statsTable.push(
        [chalk.white('Total Requests'), chalk.cyan(results.total)],
        [chalk.white('Concurrency'), chalk.cyan(concurrency)],
        [chalk.white('Success Rate'), results.failures === 0 ? chalk.green('100%') : chalk.yellow(`${((results.success/results.total)*100).toFixed(1)}%`)],
        [chalk.white('Requests/sec'), chalk.magenta(rps)],
        [chalk.gray('---'), chalk.gray('---')],
        [chalk.white('Fastest (Min)'), chalk.green(`${min}ms`)],
        [chalk.white('Slowest (Max)'), chalk.red(`${max}ms`)],
        [chalk.white('Average'), chalk.blue(`${avg}ms`)]
      );

      console.log(statsTable.toString());
      
      if (results.failures > 0) {
        console.log(chalk.red(`\n  ⚠️  ${results.failures} requests failed (HTTP 4xx/5xx or Network Error).\n`));
      } else {
        console.log(chalk.green(`\n  ✅ All requests completed successfully.\n`));
      }
      
      resolve();
    };

    // Bootstrap workers
    const initialWorkers = Math.min(concurrency, totalRequests);
    for (let i = 0; i < initialWorkers; i++) {
      executeNext();
    }
  });
}
