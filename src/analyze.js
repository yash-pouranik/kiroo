import axios from 'axios';
import chalk from 'chalk';
import { loadKirooConfig } from './config.js';
import { stableJSONStringify } from './deterministic.js';
import { loadSnapshotData } from './storage.js';
import { translateText } from './lingo.js';
import { getEnvVar } from './env.js';

const SEVERITY_RANK = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const DEFAULT_MODEL_PRIORITY = [
  'qwen/qwen3-32b',
  'moonshotai/kimi-k2-instruct-0905',
  'openai/gpt-oss-20b'
];

const USER_FACING_FIELD_HINTS = [
  'name', 'title', 'label', 'message', 'description', 'summary', 'content', 'text',
  'price', 'amount', 'currency', 'country', 'locale', 'language',
  'product', 'checkout', 'cart', 'profile', 'notification', 'error', 'user'
];

const LOCALIZATION_CRITICAL_HINTS = [
  'title', 'label', 'message', 'description', 'summary', 'content', 'text',
  'price', 'amount', 'currency', 'country', 'locale', 'language'
];

function inferIntentLabels(issue, endpointPath = '') {
  const haystack = `${String(issue.path || '')} ${String(issue.message || '')} ${String(endpointPath || '')}`.toLowerCase();
  const labels = new Set();

  if (USER_FACING_FIELD_HINTS.some((hint) => haystack.includes(hint))) {
    labels.add('user-facing');
  }

  if (LOCALIZATION_CRITICAL_HINTS.some((hint) => haystack.includes(hint))) {
    labels.add('localization-critical');
  }

  if (['field_removed', 'field_type_changed', 'endpoint_removed', 'status_changed'].includes(issue.type)) {
    labels.add('contract-critical');
  }

  return Array.from(labels).sort((a, b) => a.localeCompare(b));
}

function migrationHintsForIssue(issue, intentLabels = []) {
  const hints = [];

  if (issue.type === 'field_rename_candidate') {
    hints.push('Update client field mapping and keep temporary backward-compatible aliases.');
  } else if (issue.type === 'field_removed') {
    hints.push('Add fallback handling for missing field and avoid hard-required parsing.');
  } else if (issue.type === 'field_type_changed') {
    hints.push('Update serializers/validators for the new field type and add compatibility parsing.');
  } else if (issue.type === 'status_changed') {
    hints.push('Adjust status handling logic and retries for the new response code.');
  } else if (issue.type === 'endpoint_removed') {
    hints.push('Restore endpoint alias or publish deprecation plan before removing old route.');
  } else if (issue.type === 'endpoint_added') {
    hints.push('Add contract tests and client adoption docs for the new endpoint.');
  } else if (issue.type === 'field_added') {
    hints.push('Ensure clients ignore unknown fields safely to prevent parser breaks.');
  }

  if (intentLabels.includes('localization-critical')) {
    hints.push('Validate locale/currency/text handling across target languages before release.');
  }

  if (intentLabels.includes('user-facing')) {
    hints.push('Run UI regression checks for all affected user-visible fields.');
  }

  return Array.from(new Set(hints)).slice(0, 3);
}

function annotateIssue(issue, endpointPath = '') {
  const intentLabels = inferIntentLabels(issue, endpointPath);
  const migrationHints = migrationHintsForIssue(issue, intentLabels);
  return {
    ...issue,
    intentLabels,
    migrationHints
  };
}

function buildIntentSummary(endpoints) {
  const counts = {
    'user-facing': 0,
    'localization-critical': 0,
    'contract-critical': 0
  };

  for (const endpoint of endpoints) {
    for (const issue of endpoint.issues || []) {
      for (const label of issue.intentLabels || []) {
        if (counts[label] !== undefined) counts[label] += 1;
      }
    }
  }

  return counts;
}

function buildImpactSummary(report) {
  const intent = report.summary.intent || {};
  const severityView = report.summary.bySeverityEffective || report.summary.bySeverity || {};
  const criticalOrHigh = (severityView.critical || 0) + (severityView.high || 0);
  const affectedEndpoints = report.endpoints.filter((endpoint) => (
    SEVERITY_RANK[endpoint.highestSeverity] >= SEVERITY_RANK.high
  )).length;

  const developerImpact = criticalOrHigh > 0
    ? `High merge risk: ${criticalOrHigh} high/critical issues across ${affectedEndpoints} endpoint(s).`
    : `Low merge risk: no high/critical issues detected in current diff.`;

  const localizationCount = intent['localization-critical'] || 0;
  const userFacingCount = intent['user-facing'] || 0;
  const productImpact = localizationCount > 0
    ? `Localization-sensitive drift in ${localizationCount} issue(s); verify multilingual UI/API contracts before release.`
    : `No localization-sensitive drift detected; focus on technical contract compatibility.`;

  const consumerImpact = userFacingCount > 0
    ? `${userFacingCount} user-facing field change(s) may alter frontend rendering and copy behavior.`
    : 'No user-facing field change detected in sampled diff output.';

  return {
    developerImpact,
    productImpact,
    consumerImpact
  };
}

function bumpSeverity(severity, steps = 1) {
  const order = ['none', 'low', 'medium', 'high', 'critical'];
  const idx = order.indexOf(String(severity || 'none'));
  if (idx === -1) return severity;
  return order[Math.min(order.length - 1, idx + steps)];
}

function applyLocaleRiskBoost(report, lang) {
  if (!lang) return report;

  const boostedEndpoints = report.endpoints.map((endpoint) => {
    const boostedIssues = endpoint.issues.map((issue) => {
      let extraRiskSteps = 0;
      const labels = issue.intentLabels || [];
      const baseSeverity = issue.severity;

      if (labels.includes('localization-critical')) extraRiskSteps += 1;
      if (labels.includes('user-facing') && ['field_removed', 'field_type_changed', 'status_changed', 'endpoint_removed'].includes(issue.type)) {
        extraRiskSteps += 1;
      }

      const effectiveSeverity = extraRiskSteps > 0 ? bumpSeverity(baseSeverity, extraRiskSteps) : baseSeverity;
      return {
        ...issue,
        effectiveSeverity,
        localeRiskBoosted: effectiveSeverity !== baseSeverity
      };
    });

    const effectiveHighestSeverity = boostedIssues.reduce((highest, issue) => (
      SEVERITY_RANK[issue.effectiveSeverity] > SEVERITY_RANK[highest] ? issue.effectiveSeverity : highest
    ), 'none');

    return {
      ...endpoint,
      issues: boostedIssues,
      effectiveHighestSeverity
    };
  });

  const bySeverityEffective = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const endpoint of boostedEndpoints) {
    for (const issue of endpoint.issues) {
      if (bySeverityEffective[issue.effectiveSeverity] !== undefined) {
        bySeverityEffective[issue.effectiveSeverity] += 1;
      }
    }
  }

  const effectiveHighestSeverity = boostedEndpoints.reduce((highest, endpoint) => (
    SEVERITY_RANK[endpoint.effectiveHighestSeverity] > SEVERITY_RANK[highest] ? endpoint.effectiveHighestSeverity : highest
  ), 'none');

  return {
    ...report,
    baseHighestSeverity: report.highestSeverity,
    highestSeverity: effectiveHighestSeverity,
    endpoints: boostedEndpoints,
    summary: {
      ...report.summary,
      bySeverityEffective
    }
  };
}

function getPath(urlStr) {
  try {
    const urlObj = new URL(urlStr);
    return urlObj.pathname;
  } catch {
    return urlStr.startsWith('/') ? urlStr : `/${urlStr}`;
  }
}

function endpointKey(method, path) {
  return `${String(method || '').toUpperCase()} ${path}`;
}

function normalizeFieldName(name) {
  return String(name || '').replace(/[_-]/g, '').toLowerCase();
}

function isObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function compareStatus(beforeStatus, afterStatus) {
  if (beforeStatus === afterStatus) return null;

  const before2xx = beforeStatus >= 200 && beforeStatus < 300;
  const before4xx5xx = beforeStatus >= 400;
  const after3xx = afterStatus >= 300 && afterStatus < 400;
  const after4xx5xx = afterStatus >= 400;

  let severity = 'medium';
  let breaking = true;

  if (before2xx && afterStatus === 304) {
    severity = 'low';
    breaking = false;
  } else if (before2xx && after3xx) {
    severity = 'low';
    breaking = false;
  } else if (before2xx && after4xx5xx) {
    severity = 'high';
    breaking = true;
  } else if (before4xx5xx && afterStatus >= 200 && afterStatus < 300) {
    severity = 'low';
    breaking = false;
  }

  return {
    type: 'status_changed',
    path: 'response.status',
    severity,
    breaking,
    message: `Status changed from ${beforeStatus} to ${afterStatus}`
  };
}

function compareBodies(beforeValue, afterValue, path = '') {
  const issues = [];

  if (beforeValue === null && afterValue === null) return issues;
  if (beforeValue === null && afterValue !== null) {
    issues.push({
      type: 'field_type_changed',
      path: path || 'root',
      severity: 'medium',
      breaking: false,
      message: `Type changed from null to ${Array.isArray(afterValue) ? 'array' : typeof afterValue}`
    });
    return issues;
  }
  if (beforeValue !== null && afterValue === null) {
    issues.push({
      type: 'field_type_changed',
      path: path || 'root',
      severity: 'medium',
      breaking: false,
      message: `Type changed from ${Array.isArray(beforeValue) ? 'array' : typeof beforeValue} to null`
    });
    return issues;
  }

  const beforeType = Array.isArray(beforeValue) ? 'array' : typeof beforeValue;
  const afterType = Array.isArray(afterValue) ? 'array' : typeof afterValue;

  if (beforeType !== afterType) {
    issues.push({
      type: 'field_type_changed',
      path: path || 'root',
      severity: 'high',
      breaking: true,
      message: `Type changed from ${beforeType} to ${afterType}`
    });
    return issues;
  }

  if (isObject(beforeValue) && isObject(afterValue)) {
    const beforeKeys = Object.keys(beforeValue).sort((a, b) => a.localeCompare(b));
    const afterKeys = Object.keys(afterValue).sort((a, b) => a.localeCompare(b));

    const removed = beforeKeys.filter((key) => !afterKeys.includes(key));
    const added = afterKeys.filter((key) => !beforeKeys.includes(key));
    const matchedRemoved = new Set();
    const matchedAdded = new Set();

    for (const removedKey of removed) {
      const removedNorm = normalizeFieldName(removedKey);
      const addCandidate = added.find((addedKey) => !matchedAdded.has(addedKey) && normalizeFieldName(addedKey) === removedNorm);

      if (addCandidate) {
        matchedRemoved.add(removedKey);
        matchedAdded.add(addCandidate);
        issues.push({
          type: 'field_rename_candidate',
          path: path || 'root',
          severity: 'medium',
          breaking: true,
          message: `Possible rename: "${removedKey}" -> "${addCandidate}"`
        });
      }
    }

    for (const removedKey of removed) {
      if (matchedRemoved.has(removedKey)) continue;
      const removedPath = path ? `${path}.${removedKey}` : removedKey;
      issues.push({
        type: 'field_removed',
        path: removedPath,
        severity: 'high',
        breaking: true,
        message: `Field removed: ${removedPath}`
      });
    }

    for (const addedKey of added) {
      if (matchedAdded.has(addedKey)) continue;
      const addedPath = path ? `${path}.${addedKey}` : addedKey;
      issues.push({
        type: 'field_added',
        path: addedPath,
        severity: 'low',
        breaking: false,
        message: `Field added: ${addedPath}`
      });
    }

    for (const sharedKey of beforeKeys.filter((key) => afterKeys.includes(key))) {
      const childPath = path ? `${path}.${sharedKey}` : sharedKey;
      issues.push(...compareBodies(beforeValue[sharedKey], afterValue[sharedKey], childPath));
    }

    return issues;
  }

  if (Array.isArray(beforeValue) && Array.isArray(afterValue)) {
    if (beforeValue.length > 0 && afterValue.length > 0) {
      const itemPath = `${path || 'root'}[0]`;
      issues.push(...compareBodies(beforeValue[0], afterValue[0], itemPath));
    }
  }

  return issues;
}

function updateSummaryFromIssue(summary, issue) {
  summary.totalIssues += 1;
  summary.bySeverity[issue.severity] += 1;
  summary.byType[issue.type] = (summary.byType[issue.type] || 0) + 1;
}

function ensureEndpoint(reportMap, method, path) {
  const key = endpointKey(method, path);
  if (!reportMap.has(key)) {
    reportMap.set(key, {
      method: String(method || '').toUpperCase(),
      path,
      issues: [],
      highestSeverity: 'none'
    });
  }
  return reportMap.get(key);
}

function addIssue(reportMap, summary, method, path, issue) {
  const endpoint = ensureEndpoint(reportMap, method, path);
  const annotatedIssue = annotateIssue(issue, path);
  const isDuplicate = endpoint.issues.some((existing) =>
    existing.type === annotatedIssue.type &&
    existing.path === annotatedIssue.path &&
    existing.message === annotatedIssue.message &&
    existing.severity === annotatedIssue.severity
  );
  if (isDuplicate) {
    return;
  }

  endpoint.issues.push(annotatedIssue);
  if (SEVERITY_RANK[annotatedIssue.severity] > SEVERITY_RANK[endpoint.highestSeverity]) {
    endpoint.highestSeverity = annotatedIssue.severity;
  }
  updateSummaryFromIssue(summary, annotatedIssue);
}

function compareInteractionsForAnalysis(beforeInteractions, afterInteractions) {
  const reportMap = new Map();
  const summary = {
    totalEndpoints: 0,
    totalIssues: 0,
    bySeverity: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    },
    byType: {}
  };

  const sortedBefore = [...beforeInteractions].sort((a, b) => endpointKey(a.method, getPath(a.url)).localeCompare(endpointKey(b.method, getPath(b.url))));
  const sortedAfter = [...afterInteractions].sort((a, b) => endpointKey(a.method, getPath(a.url)).localeCompare(endpointKey(b.method, getPath(b.url))));
  const consumedBeforeIndexes = new Set();

  for (const after of sortedAfter) {
    const method = String(after.method || '').toUpperCase();
    const path = getPath(after.url || '');
    const candidates = sortedBefore
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => !consumedBeforeIndexes.has(index) && String(item.method || '').toUpperCase() === method && getPath(item.url || '') === path);

    const match = candidates.find(({ item }) => item.id && after.id && item.id === after.id) || candidates[0];

    if (!match) {
      addIssue(reportMap, summary, method, path, {
        type: 'endpoint_added',
        path,
        severity: 'low',
        breaking: false,
        message: 'Endpoint added in target snapshot'
      });
      continue;
    }

    consumedBeforeIndexes.add(match.index);
    const before = match.item;
    const statusIssue = compareStatus(before.response?.status, after.response?.status);
    if (statusIssue) {
      addIssue(reportMap, summary, method, path, statusIssue);
    }

    if (before.response?.body !== undefined && after.response?.body !== undefined) {
      const bodyIssues = compareBodies(before.response.body, after.response.body);
      for (const issue of bodyIssues) {
        addIssue(reportMap, summary, method, path, issue);
      }
    }
  }

  sortedBefore.forEach((before, index) => {
    if (consumedBeforeIndexes.has(index)) return;
    const method = String(before.method || '').toUpperCase();
    const path = getPath(before.url || '');
    addIssue(reportMap, summary, method, path, {
      type: 'endpoint_removed',
      path,
      severity: 'high',
      breaking: true,
      message: 'Endpoint removed from target snapshot'
    });
  });

  const endpoints = Array.from(reportMap.values())
    .sort((a, b) => {
      const severityDiff = SEVERITY_RANK[b.highestSeverity] - SEVERITY_RANK[a.highestSeverity];
      if (severityDiff !== 0) return severityDiff;
      if (a.method !== b.method) return a.method.localeCompare(b.method);
      return a.path.localeCompare(b.path);
    })
    .map((endpoint) => ({
      ...endpoint,
      issues: endpoint.issues.sort((a, b) => {
        const severityDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
        if (severityDiff !== 0) return severityDiff;
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return String(a.path || '').localeCompare(String(b.path || ''));
      })
    }));

  summary.totalEndpoints = endpoints.length;
  summary.intent = buildIntentSummary(endpoints);
  const highestSeverity = endpoints.reduce((highest, endpoint) => (
    SEVERITY_RANK[endpoint.highestSeverity] > SEVERITY_RANK[highest] ? endpoint.highestSeverity : highest
  ), 'none');

  return {
    summary,
    highestSeverity,
    endpoints
  };
}

export function analyzeSnapshotData(sourceSnapshot, targetSnapshot) {
  const sourceInteractions = sourceSnapshot?.interactions || [];
  const targetInteractions = targetSnapshot?.interactions || [];
  const analysis = compareInteractionsForAnalysis(sourceInteractions, targetInteractions);

  return {
    generatedAt: new Date().toISOString(),
    source: {
      tag: sourceSnapshot?.tag || 'source',
      timestamp: sourceSnapshot?.timestamp
    },
    target: {
      tag: targetSnapshot?.tag || 'target',
      timestamp: targetSnapshot?.timestamp
    },
    summary: analysis.summary,
    highestSeverity: analysis.highestSeverity,
    endpoints: analysis.endpoints
  };
}

function colorForSeverity(severity) {
  if (severity === 'critical') return chalk.redBright;
  if (severity === 'high') return chalk.red;
  if (severity === 'medium') return chalk.yellow;
  if (severity === 'low') return chalk.blue;
  return chalk.gray;
}

function shouldFail(report, failOnSeverity) {
  const threshold = String(failOnSeverity || '').toLowerCase();
  if (!SEVERITY_RANK[threshold]) return false;
  return SEVERITY_RANK[report.highestSeverity] >= SEVERITY_RANK[threshold];
}

async function maybeTranslate(text, lang) {
  if (!lang) return text;
  return translateText(text, lang);
}

async function requestGroqSummary(report, { model, maxTokens, apiKey }) {
  const endpointPreview = report.endpoints.slice(0, 30).map((endpoint) => ({
    method: endpoint.method,
    path: endpoint.path,
    highestSeverity: endpoint.highestSeverity,
    issues: endpoint.issues.slice(0, 6).map((issue) => ({
      type: issue.type,
      severity: issue.effectiveSeverity || issue.severity,
      message: issue.message,
      intentLabels: issue.intentLabels || [],
      migrationHints: issue.migrationHints || []
    }))
  }));

  const prompt = [
    'You are a senior API reviewer.',
    'Return concise output only as bullet points.',
    'Rules:',
    '- Maximum 5 bullet points',
    '- Each bullet must be <= 14 words',
    '- Focus on impact + risk + actionable fix',
    '- Do not include headings or paragraphs',
    '',
    stableJSONStringify({
      sourceTag: report.source.tag,
      targetTag: report.target.tag,
      summary: report.summary,
      highestSeverity: report.highestSeverity,
      impact: report.impact,
      endpoints: endpointPreview
    }, 2)
  ].join('\n');

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: 'You are an API contract analysis assistant.' },
        { role: 'user', content: prompt }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const text = response.data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`No summary text returned by Groq model ${model}`);
  }
  return text.trim();
}

function toConciseBullets(rawText, report) {
  let cleanedText = String(rawText || '');
  cleanedText = cleanedText.replace(/<think>[\s\S]*?<\/think>/gi, ' ');
  if (cleanedText.includes('<think>')) {
    cleanedText = cleanedText.split('<think>')[0];
  }

  const lines = cleanedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const normalized = lines
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((line) => !/^<\/?think>$/i.test(line))
    .filter((line) => !/^(okay|let'?s|first,|then,|on the flip side|i need to)/i.test(line))
    .filter(Boolean);

  if (normalized.length === 0 || normalized.every((line) => line.length < 8)) {
    return fallbackBullets(report);
  }

  const bullets = normalized
    .slice(0, 5)
    .map((line) => {
      const compact = line.replace(/\s+/g, ' ');
      const clipped = compact.length > 100 ? `${compact.slice(0, 97)}...` : compact;
      return `- ${clipped}`;
    });

  return bullets;
}

function fallbackBullets(report) {
  const s = report.summary;
  const bullets = [];
  bullets.push(`- Highest severity: ${String(report.highestSeverity).toUpperCase()}.`);
  bullets.push(`- High/Critical issues: ${s.bySeverity.high + s.bySeverity.critical}.`);
  bullets.push(`- Removed endpoints: ${s.byType.endpoint_removed || 0}.`);
  bullets.push(`- Status changes: ${s.byType.status_changed || 0}.`);
  bullets.push('- Action: patch clients first, then add compatibility aliases.');
  return bullets;
}

export function resolveGroqApiKey() {
  return getEnvVar('GROQ_API_KEY');
}

async function generateAiSummary(report, options) {
  const apiKey = resolveGroqApiKey();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not found in .kiroo/env.json. Run "kiroo env set GROQ_API_KEY <your_key>" or re-run "kiroo init".');
  }

  const modelCandidates = options.model
    ? [options.model]
    : (options.modelPriority?.length ? options.modelPriority : DEFAULT_MODEL_PRIORITY);

  const failures = [];
  for (const model of modelCandidates) {
    try {
      const summary = await requestGroqSummary(report, {
        model,
        maxTokens: options.maxTokens,
        apiKey
      });
      return { summary, model };
    } catch (error) {
      failures.push(`${model}: ${error.message}`);
    }
  }

  throw new Error(`Groq summary failed for all candidate models. ${failures.join(' | ')}`);
}

export async function analyzeSnapshots(tag1, tag2, options = {}) {
  try {
    const config = loadKirooConfig();
    const failOnSeverity = options.failOn || null;
    const maxTokens = Number.parseInt(options.maxTokens, 10) || config.settings?.analysis?.maxCompletionTokens || 900;
    const modelPriority = config.settings?.analysis?.modelPriority || DEFAULT_MODEL_PRIORITY;

    const sourceSnapshot = loadSnapshotData(tag1);
    const targetSnapshot = loadSnapshotData(tag2);
    let report = analyzeSnapshotData(sourceSnapshot, targetSnapshot);
    report = applyLocaleRiskBoost(report, options.lang);
    report.impact = buildImpactSummary(report);

    if (options.json) {
      console.log(stableJSONStringify(report));
    } else {
      let header = '🧠 Blast Radius Analysis';
      if (options.lang) header = await translateText(header, options.lang);
      console.log(chalk.cyan(`\n  ${header}`));
      console.log(chalk.gray(`  Source: ${tag1}`));
      console.log(chalk.gray(`  Target: ${tag2}\n`));

      const shownEndpoints = report.endpoints.slice(0, 6);
      for (const endpoint of shownEndpoints) {
        const endpointSeverity = endpoint.effectiveHighestSeverity || endpoint.highestSeverity;
        let severityLabel = endpointSeverity.toUpperCase();
        if (options.lang) severityLabel = await translateText(severityLabel, options.lang);
        const severityColor = colorForSeverity(endpointSeverity);
        console.log(`  ${severityColor(severityLabel)} ${chalk.white(endpoint.method)} ${chalk.gray(endpoint.path)}`);
        
        for (const issue of endpoint.issues.slice(0, 4)) {
          const displaySeverity = issue.effectiveSeverity || issue.severity;
          const issueColor = colorForSeverity(displaySeverity);
          let issueMsg = issue.message;
          if (options.lang) issueMsg = await translateText(issueMsg, options.lang);
          const labels = issue.intentLabels?.length
            ? ` ${chalk.gray(`[${issue.intentLabels.join(', ')}]`)}`
            : '';
          const boostedNote = issue.localeRiskBoosted ? chalk.gray(' [locale-risk-boost]') : '';
          console.log(`    - ${issueColor(displaySeverity)} ${issueMsg}${labels}${boostedNote}`);
          if (issue.migrationHints?.length) {
            let hintLine = `Hint: ${issue.migrationHints[0]}`;
            if (options.lang) hintLine = await maybeTranslate(hintLine, options.lang);
            console.log(chalk.gray(`      ↳ ${hintLine}`));
          }
        }
        if (endpoint.issues.length > 4) {
          console.log(chalk.gray(`    - ... +${endpoint.issues.length - 4} more issues`));
        }
      }
      if (report.endpoints.length > shownEndpoints.length) {
        console.log(chalk.gray(`  ... +${report.endpoints.length - shownEndpoints.length} more endpoints`));
      }

      const summaryLine = `Issues: ${report.summary.totalIssues} | Endpoints: ${report.summary.totalEndpoints} | Highest severity: ${report.highestSeverity.toUpperCase()}`;
      const translatedSummary = await maybeTranslate(summaryLine, options.lang);
      console.log(chalk.cyan(`\n  ${translatedSummary}`));

      let impactTitle = '🌍 Localized Blast Radius';
      if (options.lang) impactTitle = await translateText(impactTitle, options.lang);
      console.log(chalk.cyan(`\n  ${impactTitle}`));
      const devImpact = await maybeTranslate(`Developer impact: ${report.impact.developerImpact}`, options.lang);
      const productImpact = await maybeTranslate(`Product impact: ${report.impact.productImpact}`, options.lang);
      const consumerImpact = await maybeTranslate(`Consumer impact: ${report.impact.consumerImpact}`, options.lang);
      console.log(chalk.gray(`  ${devImpact}`));
      console.log(chalk.gray(`  ${productImpact}`));
      console.log(chalk.gray(`  ${consumerImpact}`));
    }

    if (options.ai) {
      const ai = await generateAiSummary(report, {
        model: options.model,
        modelPriority,
        maxTokens
      });
      let aiSectionTitle = `🤖 AI Summary (${ai.model})`;
      if (options.lang) aiSectionTitle = await translateText(aiSectionTitle, options.lang);
      console.log(chalk.magenta(`\n  ${aiSectionTitle}`));
      
      const bullets = toConciseBullets(ai.summary, report);
      for (const bullet of bullets) {
        let finalBullet = bullet;
        if (options.lang) {
          // Translate the text part of the bullet
          const bulletText = bullet.replace(/^- /, '');
          const translatedBullet = await translateText(bulletText, options.lang);
          finalBullet = `- ${translatedBullet}`;
        }
        console.log(`  ${finalBullet}`);
      }
    }

    if (failOnSeverity && shouldFail(report, failOnSeverity)) {
      console.error(chalk.red(`\n  ✗ Severity gate blocked: threshold=${failOnSeverity}, highest=${report.highestSeverity}.`));
      console.log(chalk.gray('  ℹ Analysis completed successfully; only the fail-on policy returned non-zero exit.\n'));
      process.exit(1);
    }

    console.log(chalk.green('\n  ✅ Analysis complete.\n'));
  } catch (error) {
    console.error(chalk.red('\n  ✗ Analysis failed:'), error.message, '\n');
    process.exit(1);
  }
}
