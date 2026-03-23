// Normalize structured AST values from concept specs into plain JS values.
// Handles {type: "record", fields: [...]} and {type: "list", items: [...]}
// and {type: "literal", value: ...} formats.

export function normalizeValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  const obj = val as Record<string, unknown>;

  if (obj.type === 'literal' && 'value' in obj) {
    return obj.value;
  }

  if (obj.type === 'list' && Array.isArray(obj.items)) {
    return (obj.items as unknown[]).map(normalizeValue);
  }

  if (obj.type === 'record' && Array.isArray(obj.fields)) {
    const result: Record<string, unknown> = {};
    for (const field of obj.fields as Array<{ name: string; value: unknown }>) {
      result[field.name] = normalizeValue(field.value);
    }
    return result;
  }

  // Regular object or array — recurse
  if (Array.isArray(val)) {
    return val.map(normalizeValue);
  }

  return val;
}

export function normalizeList(val: unknown): any[] {
  if (Array.isArray(val)) return val;
  const normalized = normalizeValue(val);
  if (Array.isArray(normalized)) return normalized;
  return [];
}

export function normalizeRecord(val: unknown): Record<string, unknown> {
  if (!val || typeof val !== 'object') return {};
  const obj = val as Record<string, unknown>;
  if (obj.type === 'record' && Array.isArray(obj.fields)) {
    return normalizeValue(val) as Record<string, unknown>;
  }
  return obj as Record<string, unknown>;
}
