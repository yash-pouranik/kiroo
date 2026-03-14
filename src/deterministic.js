function sortObjectKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectKeysDeep(item));
  }

  if (value && typeof value === 'object') {
    const sorted = {};
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      sorted[key] = sortObjectKeysDeep(value[key]);
    }
    return sorted;
  }

  return value;
}

export function stableJSONStringify(value, space = 2) {
  return JSON.stringify(sortObjectKeysDeep(value), null, space);
}

export { sortObjectKeysDeep };
