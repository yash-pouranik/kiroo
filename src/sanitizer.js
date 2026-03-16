const REDACTED = '<REDACTED>';

const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|set-cookie|token|secret|password|passwd|pwd|api[-_]?key|x-api-key|client[-_]?secret|session|jwt|access[-_]?token|refresh[-_]?token|supabase[-_]?key|service[-_]?role/i;

function redactSensitiveString(value, redactedValue = REDACTED) {
  if (typeof value !== 'string') {
    return redactedValue;
  }

  if (/^bearer\s+/i.test(value)) {
    return `Bearer ${redactedValue}`;
  }

  if (/^basic\s+/i.test(value)) {
    return `Basic ${redactedValue}`;
  }

  return redactedValue;
}

export function isSensitiveKey(key, sensitiveKeyPattern = SENSITIVE_KEY_PATTERN) {
  return sensitiveKeyPattern.test(String(key || ''));
}

export function redactSensitiveInUrl(urlValue, options = {}) {
  const redactedValue = options.redactedValue || REDACTED;
  const sensitiveKeyPattern = options.sensitiveKeyPattern || SENSITIVE_KEY_PATTERN;

  if (typeof urlValue !== 'string' || !urlValue.includes('?')) {
    return urlValue;
  }

  const sanitizeParams = (url) => {
    for (const key of Array.from(url.searchParams.keys())) {
      if (isSensitiveKey(key, sensitiveKeyPattern)) {
        url.searchParams.set(key, redactedValue);
      }
    }
    return url.toString();
  };

  try {
    return sanitizeParams(new URL(urlValue));
  } catch {
    try {
      const parsed = new URL(urlValue, 'http://kiroo.local');
      sanitizeParams(parsed);
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return urlValue;
    }
  }
}

function sanitizeValue(value, currentKey = '', options = {}) {
  const redactedValue = options.redactedValue || REDACTED;
  const sensitiveKeyPattern = options.sensitiveKeyPattern || SENSITIVE_KEY_PATTERN;

  if (isSensitiveKey(currentKey, sensitiveKeyPattern)) {
    return redactSensitiveString(value, redactedValue);
  }

  if (typeof value === 'string') {
    if (currentKey.toLowerCase() === 'url') {
      return redactSensitiveInUrl(value, options);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, currentKey, options));
  }

  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      out[key] = sanitizeValue(nestedValue, key, options);
    }
    return out;
  }

  return value;
}

export function sanitizeInteractionRecord(record, options = {}) {
  const mergedOptions = {
    enabled: options.enabled !== false,
    redactedValue: options.redactedValue || REDACTED,
    sensitiveKeyPattern: options.sensitiveKeyPattern || SENSITIVE_KEY_PATTERN
  };

  if (!mergedOptions.enabled) {
    return record;
  }

  return sanitizeValue(record, '', mergedOptions);
}

export { REDACTED };
