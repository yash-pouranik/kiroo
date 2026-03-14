import http from 'http';
import httpProxy from 'http-proxy';
import chalk from 'chalk';
import { URL } from 'url';
import stream from 'stream';
import { saveInteraction } from './storage.js';

export async function runProxy(targetHost, options = {}) {
  const port = parseInt(options.port, 10) || 8080;

  if (isNaN(port) || port <= 0 || port > 65535) {
    console.error(chalk.red('\n  ✗ Invalid port provided.'), options.port);
    console.log(chalk.gray('  Port must be a number between 1 and 65535.\n'));
    process.exit(1);
  }

  // Validate target URL
  try {
    new URL(targetHost);
  } catch (err) {
    console.error(chalk.red('\n  ✗ Invalid target URL provided.'), targetHost);
    console.log(chalk.gray('  Example: kiroo proxy --target http://localhost:3000\n'));
    process.exit(1);
  }

  const proxy = httpProxy.createProxyServer({
    target: targetHost,
    changeOrigin: true,
    secure: false,
  });

  // Handle Proxy Errors
  proxy.on('error', (err, req, res) => {
    let errorMsg = err.message;
    if (err.code === 'ECONNREFUSED') {
      errorMsg = `Connection Refused. Is your backend server running on ${targetHost}?`;
    } else if (err.code === 'ENOTFOUND') {
      errorMsg = `Target host not found: ${targetHost}`;
    }

    console.error(chalk.red(`\n  ✗ Proxy error for ${req.method} ${req.url}`));
    console.error(chalk.yellow(`    Error: ${errorMsg} (${err.code || 'UNKNOWN'})\n`));

    if (!res.headersSent && res.writeHead) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    if (res.end) {
      res.end(JSON.stringify({ error: 'Proxy Error', message: errorMsg, code: err.code }));
    }
  });

  // Intercept Response to save interaction
  proxy.on('proxyRes', (proxyRes, req, res) => {
    let responseBody = '';
    proxyRes.on('data', (chunk) => {
      responseBody += chunk.toString('utf8');
    });

    proxyRes.on('end', () => {
      const duration = Date.now() - req.kirooStartTime;
      const fullUrl = new URL(req.url, targetHost).toString();
      
      let parsedReqBody = req.kirooBodyData;
      if (req.kirooBodyData) {
         try { parsedReqBody = JSON.parse(req.kirooBodyData); } catch (e) { }
      }

      let parsedResBody = responseBody;
      if (responseBody) {
         try { parsedResBody = JSON.parse(responseBody); } catch (e) { }
      }

      // Only save if it's not a CORS preflight with no content
      if (req.method !== 'OPTIONS' || proxyRes.statusCode !== 204) {
          saveInteraction({
            method: req.method,
            url: fullUrl,
            headers: req.headers,
            body: parsedReqBody || undefined,
            response: {
              status: proxyRes.statusCode,
              headers: proxyRes.headers,
              body: parsedResBody || undefined
            },
            duration: duration
          });
          
          const statusColor = proxyRes.statusCode >= 400 ? chalk.red : chalk.green;
          console.log(`  ${statusColor(req.method)} ${chalk.dim(fullUrl)} ${statusColor(proxyRes.statusCode)} - ${duration}ms`);
      }
    });
  });

  const server = http.createServer((req, res) => {
    req.kirooStartTime = Date.now();
    let bodyChunks = [];

    req.on('data', (chunk) => {
      bodyChunks.push(chunk);
    });

    req.on('end', () => {
      const bodyBuffer = Buffer.concat(bodyChunks);
      req.kirooBodyData = bodyBuffer.toString('utf8');
      
      // We must re-stream the body because the original req stream is exhausted
      const bufferStream = new stream.PassThrough();
      bufferStream.end(bodyBuffer);
      
      proxy.web(req, res, { buffer: bufferStream });
    });
  });

  server.listen(port, () => {
    console.log(chalk.cyan(`\n  📡 Kiroo Proxy Started`));
    console.log(chalk.white(`  Listening on : http://localhost:${port}`));
    console.log(chalk.white(`  Forwarding to: ${targetHost}`));
    console.log(chalk.gray(`\n  (Press Ctrl+C to stop recording)\n`));
  });
}
