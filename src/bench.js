import chalk from 'chalk';
import Table from 'cli-table3';
import axios from 'axios';
import ora from 'ora';
import { loadEnv } from './storage.js';
import { applyEnvReplacements } from './executor.js';

export async function runBenchmark(url, options) {
  const envData = loadEnv();
  const currentEnvVars = envData.environments[envData.current] || {};

  url = applyEnvReplacements(url, currentEnvVars);

  const method = (options.method || 'GET').toUpperCase();
  const totalRequests = parseInt(options.number) || 10;
  const concurrency = parseInt(options.concurrent) || 1;
  const headersObj = {};

  if (options.header) {
    options.header.forEach(h => {
      const parts = h.split(':');
      if (parts.length >= 2) {
        let val = parts.slice(1).join(':').trim();
        val = applyEnvReplacements(val, currentEnvVars);
        headersObj[parts[0].trim()] = val;
      }
    });
  }

  // Auto-BaseURL logic (Synced from executor.js)
  let targetUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
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
        const segments = url.split(/[/\\]/);
        const apiIdx = segments.findIndex(s => s === 'api' || s === 'v1' || s === 'v2');
        if (apiIdx !== -1) {
          pathPart = '/' + segments.slice(apiIdx).join('/');
        } else {
          pathPart = url.replace(/^[a-zA-Z]:/, '').replace(/\\/g, '/');
          if (!pathPart.startsWith('/')) pathPart = '/' + pathPart;
          
          // Hard fix for Git Bash root expansion "C:/Program Files/Git/" -> "/"
          const lowerPath = pathPart.toLowerCase();
          if (lowerPath === '/program files/git/' || lowerPath === '/program files/git') {
             pathPart = '/';
          }
        }
      }
      // 3. No leading slash but doesn't look like a host
      else if (!url.includes('://') && !url.includes('.') && !url.includes(':') && !url.startsWith('localhost')) {
        isRelative = true;
        pathPart = '/' + url;
      }

      if (isRelative) {
        const baseUrl = currentEnvVars.baseUrl;
        const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        targetUrl = normalizedBaseUrl + (pathPart.startsWith('/') ? pathPart : '/' + pathPart);
      }
    } else {
      console.log(chalk.red(`\n  ✗ Invalid URL and no baseUrl defined in environment '${envData.current}'\n`));
      process.exit(1);
    }
  }

  // Parse Body
  let requestData = options.data;
  if (options.data) {
    requestData = applyEnvReplacements(options.data, currentEnvVars);
  }

  if (requestData && typeof requestData === 'string' && !requestData.trim().startsWith('{')) {
    const pairs = requestData.split(' ');
    requestData = {};
    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value !== undefined) {
        requestData[key] = value;
      }
    });
  } else if (requestData && typeof requestData === 'string') {
    try {
      requestData = JSON.parse(requestData);
    } catch(e) {}
  }

  const isVerbose = options.verbose;
  let spinner;
  
  if (!isVerbose) {
    spinner = ora(`Benchmarking ${method} ${targetUrl} (Reqs: ${totalRequests}, Workers: ${concurrency})`).start();
  } else {
    console.log(chalk.cyan(`\n  Starting Benchmark: ${method} ${targetUrl} (Reqs: ${totalRequests}, Workers: ${concurrency})\n`));
  }

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
      const reqId = reqIndex + 1;
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
        
        let statusColor = response.status >= 400 ? chalk.red : chalk.green;
        
        if (response.status >= 200 && response.status < 400) {
          results.success++;
        } else {
          results.failures++;
        }

        if (isVerbose) {
           console.log(chalk.gray(`  [Req ${reqId}/${totalRequests}] `) + statusColor(`${response.status} ${response.statusText}`) + chalk.gray(` - ${duration}ms`));
           
           // Print snippet of data if available
           if (response.data) {
             let dataStr = typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data);
             if (dataStr.length > 200) dataStr = dataStr.substring(0, 197) + '...';
             console.log(chalk.gray(`  ↳ Data: `) + chalk.white(dataStr));
           }
        }
      } catch (error) {
        const duration = Date.now() - reqStartTime;
        results.times.push(duration);
        results.failures++;

        if (isVerbose) {
           console.log(chalk.gray(`  [Req ${reqId}/${totalRequests}] `) + chalk.red(`ERR: ${error.message}`) + chalk.gray(` - ${duration}ms`));
        }
      } finally {
        activeWorkers--;
        // Update spinner if not verbose
        if (!isVerbose) {
          const percent = Math.floor((completedCount / totalRequests) * 100);
          spinner.text = `Benchmarking... ${percent}% [${completedCount}/${totalRequests}]`;
        }
        
        executeNext();
      }
    };

    const finalizeBenchmark = () => {
      const totalTime = Date.now() - startTime;
      if (!isVerbose) spinner.stop();
      
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
