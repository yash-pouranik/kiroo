import { writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { getAllInteractions } from './storage.js';
import { stableJSONStringify } from './deterministic.js';
import { loadKirooConfig } from './config.js';

function normalizeInteractions() {
  return getAllInteractions()
    .map((int) => ({
      ...int,
      request: int.request || {},
      response: {
        ...(int.response || {}),
        body: int.response?.body ?? int.response?.data
      }
    }))
    .sort((a, b) => {
      const methodA = String(a.request.method || '').toUpperCase();
      const methodB = String(b.request.method || '').toUpperCase();
      if (methodA !== methodB) return methodA.localeCompare(methodB);
      return String(a.request.url || '').localeCompare(String(b.request.url || ''));
    });
}

function buildPostmanCollection(interactions) {
  return {
    info: {
      name: `Kiroo Export - ${new Date().toISOString().split('T')[0]}`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: interactions.map((int) => {
      const headerList = Object.entries(int.request.headers || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => ({ key, value: String(value), type: 'text' }));

      const rawBody = int.request.body === undefined
        ? ''
        : typeof int.request.body === 'object'
        ? JSON.stringify(int.request.body, null, 2)
        : String(int.request.body);

      const resBodyStr = int.response.body === undefined
        ? ''
        : typeof int.response.body === 'object'
        ? JSON.stringify(int.response.body, null, 2)
        : String(int.response.body);

      return {
        name: `[${String(int.request.method || '').toUpperCase()}] ${int.request.url}`,
        request: {
          method: String(int.request.method || 'GET').toUpperCase(),
          header: headerList,
          url: { raw: int.request.url },
          ...(rawBody ? {
            body: {
              mode: 'raw',
              raw: rawBody,
              options: {
                raw: { language: 'json' }
              }
            }
          } : {})
        },
        response: [
          {
            name: 'Saved Response from Kiroo',
            originalRequest: {
              method: String(int.request.method || 'GET').toUpperCase(),
              header: headerList,
              url: { raw: int.request.url }
            },
            status: 'Saved Response',
            code: int.response.status,
            _postman_previewlanguage: 'json',
            header: [],
            cookie: [],
            body: resBodyStr
          }
        ]
      };
    })
  };
}

function getPathAndOrigin(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return { path: parsed.pathname || '/', origin: parsed.origin, query: parsed.searchParams };
  } catch {
    if (typeof rawUrl === 'string' && rawUrl.startsWith('/')) {
      return { path: rawUrl, origin: null, query: new URLSearchParams() };
    }
    return { path: '/', origin: null, query: new URLSearchParams() };
  }
}

function inferSchema(value) {
  if (value === null) return { nullable: true };
  if (Array.isArray(value)) {
    if (value.length === 0) return { type: 'array', items: {} };
    const mergedItem = value.map((item) => inferSchema(item)).reduce(mergeSchemas, {});
    return { type: 'array', items: mergedItem };
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    const properties = {};
    keys.forEach((key) => {
      properties[key] = inferSchema(value[key]);
    });
    return {
      type: 'object',
      properties,
      required: keys
    };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
  }
  if (typeof value === 'boolean') return { type: 'boolean' };
  if (typeof value === 'string') return { type: 'string' };
  return {};
}

function mergeSchemas(a, b) {
  const left = a || {};
  const right = b || {};
  const leftType = left.type;
  const rightType = right.type;

  if (!leftType) return right;
  if (!rightType) return left;
  if (leftType !== rightType) {
    return { oneOf: [left, right] };
  }

  if (leftType === 'object') {
    const leftProps = left.properties || {};
    const rightProps = right.properties || {};
    const keys = new Set([...Object.keys(leftProps), ...Object.keys(rightProps)]);
    const mergedProperties = {};

    keys.forEach((key) => {
      if (leftProps[key] && rightProps[key]) mergedProperties[key] = mergeSchemas(leftProps[key], rightProps[key]);
      else mergedProperties[key] = leftProps[key] || rightProps[key];
    });

    const leftReq = new Set(left.required || []);
    const rightReq = new Set(right.required || []);
    const mergedRequired = [...leftReq].filter((k) => rightReq.has(k)).sort((x, y) => x.localeCompare(y));

    return {
      type: 'object',
      properties: mergedProperties,
      ...(mergedRequired.length ? { required: mergedRequired } : {})
    };
  }

  if (leftType === 'array') {
    return {
      type: 'array',
      items: mergeSchemas(left.items || {}, right.items || {})
    };
  }

  return left;
}

function headerValue(headers, key) {
  if (!headers || typeof headers !== 'object') return '';
  const found = Object.entries(headers).find(([k]) => k.toLowerCase() === key.toLowerCase());
  return found ? String(found[1]) : '';
}

function contentTypeFromHeaders(headers, fallback = 'application/json') {
  const raw = headerValue(headers, 'content-type');
  if (!raw) return fallback;
  return raw.split(';')[0].trim() || fallback;
}

function isLikelyIdSegment(segment) {
  if (!segment) return false;
  if (/^\d+$/.test(segment)) return true;
  if (/^[0-9a-f]{24}$/i.test(segment)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) return true;
  if (/^[A-Za-z0-9_-]{10,}$/.test(segment) && /[A-Za-z]/.test(segment) && /\d/.test(segment)) return true;
  return false;
}

function singularize(word) {
  if (!word) return 'id';
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('s') && word.length > 1) return word.slice(0, -1);
  return word;
}

function normalizePathForOpenApi(path) {
  const rawSegments = String(path || '/').split('/').filter(Boolean);
  if (rawSegments.length === 0) {
    return { path: '/', params: [] };
  }

  const params = [];
  const usedNames = new Set();
  const normalizedSegments = rawSegments.map((segment, index) => {
    if (!isLikelyIdSegment(segment)) {
      return segment;
    }

    const prev = rawSegments[index - 1] || 'id';
    let baseName = singularize(prev).replace(/[^a-zA-Z0-9]/g, '');
    if (!baseName) baseName = 'id';
    let paramName = `${baseName.charAt(0).toLowerCase()}${baseName.slice(1)}Id`;

    let i = 2;
    while (usedNames.has(paramName)) {
      paramName = `${baseName.charAt(0).toLowerCase()}${baseName.slice(1)}Id${i}`;
      i += 1;
    }
    usedNames.add(paramName);
    params.push({ name: paramName, example: segment });
    return `{${paramName}}`;
  });

  return { path: `/${normalizedSegments.join('/')}`, params };
}

function getTagFromPath(path) {
  const segments = String(path || '/').split('/').filter(Boolean);
  if (segments.length === 0) return 'general';
  if (segments[0].toLowerCase() === 'api' && segments.length > 1) {
    return segments[1];
  }
  return segments[0];
}

function toOperationId(method, path) {
  const methodPart = String(method || 'get').toLowerCase();
  const segments = String(path || '/')
    .split('/')
    .filter(Boolean)
    .map((s) => {
      if (s.startsWith('{') && s.endsWith('}')) {
        const p = s.slice(1, -1);
        return `by${p.charAt(0).toUpperCase()}${p.slice(1)}`;
      }
      return s.replace(/[^a-zA-Z0-9]/g, '');
    });
  return [methodPart, ...segments].join('_') || `${methodPart}_root`;
}

function hasHeader(headers, name) {
  return Object.keys(headers || {}).some((k) => k.toLowerCase() === name.toLowerCase());
}

function buildOpenApiSpec(interactions, options = {}) {
  const title = options.title || 'Kiroo Traffic API';
  const version = options.apiVersion || '1.0.0';
  const operations = new Map();
  const origins = new Set();
  const includeBearer = { value: false };
  const includeApiKey = { value: false };

  interactions.forEach((int) => {
    const method = String(int.request.method || 'get').toLowerCase();
    const { path, origin, query } = getPathAndOrigin(int.request.url || '/');
    const normalized = normalizePathForOpenApi(path);
    if (origin) origins.add(origin);

    const key = `${method} ${normalized.path}`;
    if (!operations.has(key)) {
      operations.set(key, {
        method,
        path: normalized.path,
        pathParams: new Map(),
        queryParams: new Set(),
        requestBodies: [],
        requestMimeTypes: new Set(),
        responses: new Map(),
        hasBearerAuth: false,
        hasApiKeyAuth: false
      });
    }

    const op = operations.get(key);
    normalized.params.forEach((p) => {
      if (!op.pathParams.has(p.name)) op.pathParams.set(p.name, p.example);
    });
    for (const queryKey of Array.from(query.keys())) {
      op.queryParams.add(queryKey);
    }

    if (hasHeader(int.request.headers, 'authorization')) {
      op.hasBearerAuth = true;
      includeBearer.value = true;
    }
    if (hasHeader(int.request.headers, 'x-api-key') || hasHeader(int.request.headers, 'api-key')) {
      op.hasApiKeyAuth = true;
      includeApiKey.value = true;
    }

    if (int.request.body !== undefined) {
      op.requestBodies.push(int.request.body);
      op.requestMimeTypes.add(contentTypeFromHeaders(int.request.headers, 'application/json'));
    }

    const statusCode = String(int.response.status || 'default');
    if (!op.responses.has(statusCode)) {
      op.responses.set(statusCode, {
        bodies: [],
        mimeTypes: new Set(),
        example: undefined
      });
    }

    const res = op.responses.get(statusCode);
    if (int.response.body !== undefined) {
      res.bodies.push(int.response.body);
      if (res.example === undefined) res.example = int.response.body;
      res.mimeTypes.add(contentTypeFromHeaders(int.response.headers, 'application/json'));
    }
  });

  const sortedOps = Array.from(operations.values()).sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return a.method.localeCompare(b.method);
  });

  const paths = {};
  sortedOps.forEach((op) => {
    if (!paths[op.path]) paths[op.path] = {};

    const pathParamEntries = Array.from(op.pathParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, example]) => ({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
        example
      }));

    const queryParamEntries = Array.from(op.queryParams)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        in: 'query',
        required: false,
        schema: { type: 'string' }
      }));

    const operation = {
      summary: `${op.method.toUpperCase()} ${op.path}`,
      operationId: toOperationId(op.method, op.path),
      tags: [getTagFromPath(op.path)],
      responses: {}
    };

    if (pathParamEntries.length || queryParamEntries.length) {
      operation.parameters = [...pathParamEntries, ...queryParamEntries];
    }

    if (op.requestBodies.length > 0) {
      const mergedBodySchema = op.requestBodies.map((b) => inferSchema(b)).reduce(mergeSchemas, {});
      const mimeType = Array.from(op.requestMimeTypes)[0] || 'application/json';
      operation.requestBody = {
        required: op.method !== 'get' && op.method !== 'delete',
        content: {
          [mimeType]: {
            schema: mergedBodySchema,
            example: op.requestBodies[0]
          }
        }
      };
    }

    const sortedStatuses = Array.from(op.responses.keys()).sort((a, b) => a.localeCompare(b));
    sortedStatuses.forEach((status) => {
      const res = op.responses.get(status);
      const mimeType = Array.from(res.mimeTypes)[0] || 'application/json';
      const schema = res.bodies.length > 0
        ? res.bodies.map((b) => inferSchema(b)).reduce(mergeSchemas, {})
        : {};

      operation.responses[status] = {
        description: 'Observed response',
        content: {
          [mimeType]: {
            schema,
            ...(res.example !== undefined ? { example: res.example } : {})
          }
        }
      };
    });

    if (op.hasBearerAuth || op.hasApiKeyAuth) {
      operation.security = [];
      if (op.hasBearerAuth) operation.security.push({ bearerAuth: [] });
      if (op.hasApiKeyAuth) operation.security.push({ apiKeyAuth: [] });
    }

    paths[op.path][op.method] = operation;
  });

  const serverList = options.server
    ? [{ url: options.server }]
    : Array.from(origins).sort((a, b) => a.localeCompare(b)).map((url) => ({ url }));

  const spec = {
    openapi: '3.0.3',
    info: { title, version },
    ...(serverList.length ? { servers: serverList } : {}),
    paths
  };

  if (includeBearer.value || includeApiKey.value) {
    spec.components = { securitySchemes: {} };
    if (includeBearer.value) {
      spec.components.securitySchemes.bearerAuth = {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      };
    }
    if (includeApiKey.value) {
      spec.components.securitySchemes.apiKeyAuth = {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key'
      };
    }
  }

  return spec;
}

export function exportInteractions(options = {}) {
  try {
    const config = loadKirooConfig();
    const sortKeys = config.settings?.determinism?.sortKeys !== false;
    let interactions = normalizeInteractions();
    const pathPrefix = options.pathPrefix ? String(options.pathPrefix) : '';
    const minSamples = Number.parseInt(options.minSamples, 10);

    if (pathPrefix) {
      interactions = interactions.filter((int) => {
        const { path } = getPathAndOrigin(int.request.url || '/');
        return path.startsWith(pathPrefix);
      });
    }

    if (interactions.length === 0) {
      console.log(chalk.yellow('\n  ⚠️ No interactions found to export.'));
      console.log(chalk.gray('  Run some requests first before exporting.\n'));
      return;
    }

    const format = String(options.format || 'postman').toLowerCase();
    const outFileName = options.out || (format === 'openapi' ? 'openapi.json' : 'kiroo-collection.json');
    const outputPath = join(process.cwd(), outFileName);

    let payloadObject;
    if (format === 'postman') {
      payloadObject = buildPostmanCollection(interactions);
    } else if (format === 'openapi') {
      if (!Number.isNaN(minSamples) && minSamples > 1) {
        const counts = new Map();
        interactions.forEach((int) => {
          const method = String(int.request.method || '').toLowerCase();
          const { path } = getPathAndOrigin(int.request.url || '/');
          const normalizedPath = normalizePathForOpenApi(path).path;
          const key = `${method} ${normalizedPath}`;
          counts.set(key, (counts.get(key) || 0) + 1);
        });
        interactions = interactions.filter((int) => {
          const method = String(int.request.method || '').toLowerCase();
          const { path } = getPathAndOrigin(int.request.url || '/');
          const normalizedPath = normalizePathForOpenApi(path).path;
          const key = `${method} ${normalizedPath}`;
          return (counts.get(key) || 0) >= minSamples;
        });
      }
      payloadObject = buildOpenApiSpec(interactions, options);
    } else {
      console.error(chalk.red(`\n  ✗ Unsupported export format: ${format}`));
      console.log(chalk.gray('  Use: postman | openapi\n'));
      process.exit(1);
    }

    const payload = sortKeys ? stableJSONStringify(payloadObject, 2) : JSON.stringify(payloadObject, null, 2);
    writeFileSync(outputPath, payload);

    console.log(chalk.green(`\n  ✅ Export successful (${format})`));
    console.log(chalk.gray(`  Saved to: ${outputPath}\n`));
  } catch (error) {
    console.error(chalk.red('\n  ✗ Export failed:'), error.message, '\n');
    process.exit(1);
  }
}

export function exportToPostman(outFileName) {
  exportInteractions({ format: 'postman', out: outFileName });
}
