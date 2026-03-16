import chalk from 'chalk';
import Table from 'cli-table3';
import { getAllInteractions } from './storage.js';
import { translateText } from './lingo.js';

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function statusBucket(status) {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  return 'other';
}

function shortUrl(url = '') {
  return url.length > 52 ? `${url.slice(0, 49)}...` : url;
}

export async function showStats(options = {}) {
  const lang = options.lang;
  const asJson = !!options.json;
  const interactions = getAllInteractions();

  if (interactions.length === 0) {
    if (asJson) {
      console.log(JSON.stringify({
        generatedAt: new Date().toISOString(),
        totalRequests: 0,
        message: 'No interactions found to analyze.'
      }, null, 2));
      return;
    }
    console.log(chalk.yellow('\n  No interactions found to analyze.'));
    console.log(chalk.gray('  Run some requests first to see the magic! ✨\n'));
    return;
  }

  if (!asJson) {
    let title = '📊 Kiroo Analytics Dashboard';
    if (lang) title = await translateText(title, lang);
    console.log(chalk.cyan.bold(`\n  ${title}\n`));
  }

  // 1) Core Metrics
  const total = interactions.length;
  const latencies = interactions.map((i) => toNumber(i?.metadata?.duration_ms, 0));
  const statuses = interactions.map((i) => toNumber(i?.response?.status, 0));
  const successes = statuses.filter((s) => s >= 200 && s < 300).length;
  const clientErrors = statuses.filter((s) => s >= 400 && s < 500).length;
  const serverErrors = statuses.filter((s) => s >= 500 && s < 600).length;
  const successRate = ((successes / total) * 100).toFixed(1);
  const avgDuration = (latencies.reduce((acc, n) => acc + n, 0) / total).toFixed(0);
  const p50 = Math.round(percentile(latencies, 0.5));
  const p95 = Math.round(percentile(latencies, 0.95));
  const p99 = Math.round(percentile(latencies, 0.99));
  const uniqueEndpoints = new Set(interactions.map((i) => `${i?.request?.method || 'GET'} ${i?.request?.url || ''}`)).size;

  const timestamps = interactions
    .map((i) => Date.parse(i.timestamp || ''))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);
  let rpm = 'N/A';
  if (timestamps.length >= 2) {
    const windowMs = timestamps[timestamps.length - 1] - timestamps[0];
    if (windowMs > 0) {
      rpm = ((total / windowMs) * 60000).toFixed(1);
    }
  }

  if (!asJson) {
    const generalTable = new Table();
    generalTable.push(
      { [chalk.white('Total Requests')]: chalk.cyan(total) },
      { [chalk.white('Unique Endpoints')]: chalk.cyan(uniqueEndpoints) },
      { [chalk.white('Success Rate')]: successRate >= 80 ? chalk.green(successRate + '%') : chalk.yellow(successRate + '%') },
      { [chalk.white('4xx / 5xx')]: chalk.yellow(`${clientErrors} / ${serverErrors}`) },
      { [chalk.white('Avg / P50 / P95 / P99')]: chalk.white(`${avgDuration} / ${p50} / ${p95} / ${p99} ms`) },
      { [chalk.white('Observed Throughput')]: chalk.white(rpm === 'N/A' ? rpm : `${rpm} req/min`) }
    );

    let generalHeader = '● Core API Performance';
    if (lang) generalHeader = await translateText(generalHeader, lang);
    console.log(chalk.white.bold(`  ${generalHeader}`));
    console.log(generalTable.toString());
  }

  // 2) Method + Status Class Distribution
  const methods = {};
  const statusClasses = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 };
  interactions.forEach((i) => {
    const m = String(i?.request?.method || 'UNKNOWN').toUpperCase();
    methods[m] = (methods[m] || 0) + 1;
    statusClasses[statusBucket(toNumber(i?.response?.status, 0))] += 1;
  });

  if (!asJson) {
    const distTable = new Table({
      head: ['Metric', 'Count', 'Percent'].map((h) => chalk.cyan(h)),
      colWidths: [20, 10, 12]
    });

    Object.entries(methods)
      .sort((a, b) => b[1] - a[1])
      .forEach(([method, count]) => {
        const percentage = ((count / total) * 100).toFixed(1) + '%';
        distTable.push([chalk.white(`Method ${method}`), chalk.white(count), chalk.gray(percentage)]);
      });

    Object.entries(statusClasses).forEach(([bucket, count]) => {
      const percentage = ((count / total) * 100).toFixed(1) + '%';
      const color = bucket === '2xx' ? chalk.green : (bucket === '4xx' || bucket === '5xx') ? chalk.red : chalk.yellow;
      distTable.push([color(`Status ${bucket}`), chalk.white(count), chalk.gray(percentage)]);
    });

    let distHeader = '● Request and Status Distribution';
    if (lang) distHeader = await translateText(distHeader, lang);
    console.log(chalk.white.bold(`\n  ${distHeader}`));
    console.log(distTable.toString());
  }

  // 3) Endpoint Health Ranking
  const byEndpoint = new Map();
  for (const i of interactions) {
    const method = String(i?.request?.method || 'GET').toUpperCase();
    const url = String(i?.request?.url || '');
    const key = `${method} ${url}`;
    if (!byEndpoint.has(key)) {
      byEndpoint.set(key, {
        method,
        url,
        count: 0,
        errors: 0,
        durations: [],
        statusCounts: {}
      });
    }
    const row = byEndpoint.get(key);
    const status = toNumber(i?.response?.status, 0);
    const dur = toNumber(i?.metadata?.duration_ms, 0);
    row.count += 1;
    if (status >= 400) row.errors += 1;
    row.durations.push(dur);
    row.statusCounts[status] = (row.statusCounts[status] || 0) + 1;
  }

  const endpointStats = Array.from(byEndpoint.values()).map((row) => {
    const errRate = row.count ? (row.errors / row.count) : 0;
    const p95Latency = percentile(row.durations, 0.95);
    const avgLatency = row.durations.reduce((a, n) => a + n, 0) / Math.max(row.durations.length, 1);
    const topStatusEntry = Object.entries(row.statusCounts).sort((a, b) => b[1] - a[1])[0];
    const topStatus = topStatusEntry ? topStatusEntry[0] : '-';

    // Weighted risk score: errors dominate, latency secondary
    const latencyScore = Math.min(100, (p95Latency / Math.max(1, p95)) * 100);
    const riskScore = Math.round((errRate * 100) * 0.7 + latencyScore * 0.3);

    return {
      ...row,
      errRate,
      avgLatency,
      p95Latency,
      topStatus,
      riskScore
    };
  });

  const endpointRiskTop = endpointStats
    .slice()
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8)
    .map((row) => ({
      method: row.method,
      url: row.url,
      requestCount: row.count,
      errorRate: Number((row.errRate * 100).toFixed(2)),
      avgLatencyMs: Number(row.avgLatency.toFixed(2)),
      p95LatencyMs: Number(row.p95Latency.toFixed(2)),
      topStatus: row.topStatus,
      riskScore: row.riskScore
    }));

  const authIncidents = statuses.filter((s) => s === 401 || s === 403).length;
  const rateLimitIncidents = statuses.filter((s) => s === 429).length;
  const last20 = interactions.slice(0, 20);
  const last20Errors = last20.filter((i) => toNumber(i?.response?.status, 0) >= 400).length;
  const slowThreshold = Math.max(p95, p50 * 1.8);
  const recentSlow = last20.filter((i) => toNumber(i?.metadata?.duration_ms, 0) >= slowThreshold).length;

  const slowestSamples = [...interactions]
    .sort((a, b) => toNumber(b?.metadata?.duration_ms, 0) - toNumber(a?.metadata?.duration_ms, 0))
    .slice(0, 5)
    .map((i) => ({
      method: String(i?.request?.method || 'GET').toUpperCase(),
      url: String(i?.request?.url || ''),
      status: toNumber(i?.response?.status, 0),
      durationMs: toNumber(i?.metadata?.duration_ms, 0),
      timestamp: i?.timestamp || null
    }));

  const topRisk = endpointRiskTop[0] || null;
  const summary = {
    quality: successRate >= 95 ? 'excellent' : successRate >= 85 ? 'good' : successRate >= 70 ? 'watch' : 'critical',
    headline: `Success ${successRate}% | P95 ${p95}ms | 4xx/5xx ${clientErrors}/${serverErrors}`,
    topRiskEndpoint: topRisk ? `${topRisk.method} ${topRisk.url}` : null,
    topRiskScore: topRisk ? topRisk.riskScore : null,
    recommendation: topRisk && topRisk.riskScore >= 70
      ? 'Prioritize top-risk endpoint hardening before release.'
      : 'No severe hotspot detected; keep monitoring p95 and 4xx trends.'
  };

  if (asJson) {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      core: {
        totalRequests: total,
        uniqueEndpoints,
        successRate: Number(successRate),
        clientErrors,
        serverErrors,
        latency: {
          avgMs: Number(avgDuration),
          p50Ms: p50,
          p95Ms: p95,
          p99Ms: p99
        },
        throughputReqPerMin: rpm === 'N/A' ? null : Number(rpm)
      },
      distributions: {
        methods,
        statusClasses
      },
      incidents: {
        authIncidents,
        rateLimitIncidents,
        recent: {
          windowSize: 20,
          errors: last20Errors,
          slowSpikes: recentSlow,
          slowThresholdMs: Math.round(slowThreshold)
        }
      },
      summary,
      endpointRiskTop,
      slowestSamples
    }, null, 2));
    return;
  }

  const healthTable = new Table({
    head: ['Endpoint', 'Req', 'Err%', 'P95', 'Top Status', 'Risk'].map((h) => chalk.cyan(h)),
    colWidths: [48, 7, 8, 8, 12, 7]
  });

  endpointRiskTop.forEach((entry) => {
      const row = {
        method: entry.method,
        url: entry.url,
        count: entry.requestCount,
        errRate: entry.errorRate / 100,
        p95Latency: entry.p95LatencyMs,
        topStatus: entry.topStatus,
        riskScore: entry.riskScore
      };
      const riskColor = row.riskScore >= 70 ? chalk.red : row.riskScore >= 40 ? chalk.yellow : chalk.green;
      healthTable.push([
        chalk.gray(shortUrl(`${row.method} ${row.url}`)),
        chalk.white(row.count),
        row.errRate > 0.2 ? chalk.red(`${(row.errRate * 100).toFixed(1)}%`) : chalk.white(`${(row.errRate * 100).toFixed(1)}%`),
        chalk.white(`${Math.round(row.p95Latency)}ms`),
        chalk.white(row.topStatus),
        riskColor(row.riskScore)
      ]);
    });

  let healthHeader = '● Endpoint Risk Ranking';
  if (lang) healthHeader = await translateText(healthHeader, lang);
  console.log(chalk.white.bold(`\n  ${healthHeader}`));
  console.log(healthTable.toString());

  // 4) Incidents and Spikes

  const incidentTable = new Table();
  incidentTable.push(
    { [chalk.white('Auth Incidents (401/403)')]: authIncidents > 0 ? chalk.red(authIncidents) : chalk.green(authIncidents) },
    { [chalk.white('Rate-Limit Incidents (429)')]: rateLimitIncidents > 0 ? chalk.red(rateLimitIncidents) : chalk.green(rateLimitIncidents) },
    { [chalk.white('Errors in Last 20 Requests')]: last20Errors > 0 ? chalk.yellow(last20Errors) : chalk.green(last20Errors) },
    { [chalk.white(`Slow Spikes in Last 20 (>=${Math.round(slowThreshold)}ms)`)]: recentSlow > 0 ? chalk.yellow(recentSlow) : chalk.green(recentSlow) }
  );

  let incidentHeader = '● Incident Signals';
  if (lang) incidentHeader = await translateText(incidentHeader, lang);
  console.log(chalk.white.bold(`\n  ${incidentHeader}`));
  console.log(incidentTable.toString());

  // 5) Slowest Samples (raw)
  const slowTable = new Table({
    head: ['URL', 'Status', 'Duration'].map((h) => chalk.cyan(h)),
    colWidths: [45, 10, 15]
  });
  slowestSamples.forEach((i) => {
    const url = shortUrl(String(i.url || ''));
    const status = toNumber(i.status, 0);
    const statusColor = status < 400 ? chalk.green : chalk.red;
    slowTable.push([
      chalk.gray(url),
      statusColor(status),
      chalk.red(`${toNumber(i.durationMs, 0)}ms`)
    ]);
  });

  let slowHeader = '● Top 5 Slowest Samples';
  if (lang) slowHeader = await translateText(slowHeader, lang);
  console.log(chalk.white.bold(`\n  ${slowHeader}`));
  console.log(slowTable.toString());

  let summaryHeader = '● Executive Summary';
  if (lang) summaryHeader = await translateText(summaryHeader, lang);
  console.log(chalk.white.bold(`\n  ${summaryHeader}`));

  let line1 = `Health: ${summary.quality.toUpperCase()} | ${summary.headline}`;
  let line2 = summary.topRiskEndpoint
    ? `Top risk endpoint: ${summary.topRiskEndpoint} (risk ${summary.topRiskScore})`
    : 'Top risk endpoint: N/A';
  let line3 = `Recommendation: ${summary.recommendation}`;

  if (lang) {
    line1 = await translateText(line1, lang);
    line2 = await translateText(line2, lang);
    line3 = await translateText(line3, lang);
  }

  console.log(chalk.gray(`  ${line1}`));
  console.log(chalk.gray(`  ${line2}`));
  console.log(chalk.gray(`  ${line3}`));
  console.log('');
}
