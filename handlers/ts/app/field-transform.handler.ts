// @clef-handler style=functional
// FieldTransform Concept Implementation
//
// Executes field-level mappings between concept records and API payloads using
// a full expression language supporting dot-notation paths, array mapping,
// conditional transforms, template substitution, and type coercion.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get as spGet,
  find,
  put,
  branch,
  complete,
  completeFrom,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

// ============================================================
// Expression AST types
// ============================================================

type ExprAST =
  | { type: 'path'; segments: string[] }
  | { type: 'arrayMap'; source: string; field: string }
  | { type: 'arrayFilter'; source: string; predicate: { field: string; op: string; value: string } }
  | { type: 'template'; parts: Array<{ kind: 'literal'; text: string } | { kind: 'var'; name: string }> }
  | { type: 'conditional'; test: { left: string; op: string; right: string }; consequent: string; alternate: string }
  | { type: 'coerce'; fn: string; arg: string }
  | { type: 'fallback'; expr: string; default: string };

// ============================================================
// Expression parsing helpers
// ============================================================

/**
 * Check if a string has balanced brackets (both [ and ]).
 */
function hasBalancedBrackets(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === '[') depth++;
    else if (ch === ']') depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

/**
 * Parse an expression string into an AST node.
 * Returns null if the expression is unrecognised.
 */
function parseExpressionString(expression: string): ExprAST | null {
  const expr = expression.trim();

  if (!expr) return null;

  // Template: contains {{ ... }}
  if (expr.includes('{{')) {
    const parts: ExprAST['parts'] = [];
    let remaining = expr;
    while (remaining.length > 0) {
      const start = remaining.indexOf('{{');
      if (start === -1) {
        parts.push({ kind: 'literal', text: remaining });
        break;
      }
      if (start > 0) {
        parts.push({ kind: 'literal', text: remaining.slice(0, start) });
      }
      const end = remaining.indexOf('}}', start);
      if (end === -1) return null; // unmatched {{
      const varName = remaining.slice(start + 2, end).trim();
      parts.push({ kind: 'var', name: varName });
      remaining = remaining.slice(end + 2);
    }
    return { type: 'template', parts };
  }

  // Conditional: if <test> then <value> else <value>
  const condMatch = /^if\s+(.+?)\s+then\s+"([^"]*)"\s+else\s+"([^"]*)"$/.exec(expr)
    || /^if\s+(.+?)\s+then\s+'([^']*)'\s+else\s+'([^']*)'$/.exec(expr)
    || /^if\s+(.+?)\s+then\s+(\S+)\s+else\s+(\S+)$/.exec(expr);
  if (condMatch) {
    const testExpr = condMatch[1].trim();
    const consequent = condMatch[2];
    const alternate = condMatch[3];
    // Parse test: left op right
    const testMatch = /^(\w+)\s*(==|!=|>=|<=|>|<)\s*"([^"]*)"$/.exec(testExpr)
      || /^(\w+)\s*(==|!=|>=|<=|>|<)\s*'([^']*)'$/.exec(testExpr)
      || /^(\w+)\s*(==|!=|>=|<=|>|<)\s*(\S+)$/.exec(testExpr);
    if (testMatch) {
      return {
        type: 'conditional',
        test: { left: testMatch[1], op: testMatch[2], right: testMatch[3] },
        consequent,
        alternate,
      };
    }
  }

  // Null fallback: expr ?? "default"
  const fallbackMatch = /^(.+?)\s*\?\?\s*"([^"]*)"$/.exec(expr)
    || /^(.+?)\s*\?\?\s*'([^']*)'$/.exec(expr);
  if (fallbackMatch) {
    return {
      type: 'fallback',
      expr: fallbackMatch[1].trim(),
      default: fallbackMatch[2],
    };
  }

  // Type coercion: fn(arg)
  const coerceMatch = /^(toString|parseInt|parseFloat|toBool|toNumber)\(([^)]+)\)$/.exec(expr);
  if (coerceMatch) {
    return { type: 'coerce', fn: coerceMatch[1], arg: coerceMatch[2].trim() };
  }

  // Array filter: items[?field=='value']
  const arrayFilterMatch = /^(\w+)\[\?(\w+)==['"]([^'"]*)['"]\]$/.exec(expr);
  if (arrayFilterMatch) {
    return {
      type: 'arrayFilter',
      source: arrayFilterMatch[1],
      predicate: { field: arrayFilterMatch[2], op: '==', value: arrayFilterMatch[3] },
    };
  }

  // Array map: source[*].field
  const arrayMapMatch = /^(\w+)\[\*\]\.(.+)$/.exec(expr);
  if (arrayMapMatch) {
    return { type: 'arrayMap', source: arrayMapMatch[1], field: arrayMapMatch[2] };
  }

  // Dot path: a.b[0].c or simple identifier
  // Must only contain word chars, dots, brackets, and digits
  if (/^[\w.[\]]+$/.test(expr)) {
    if (!hasBalancedBrackets(expr)) return null;
    // Tokenise into segments
    const segments: string[] = [];
    // Split on . and [n]
    const raw = expr.replace(/\[(\d+)\]/g, '.$1');
    for (const seg of raw.split('.')) {
      if (seg !== '') segments.push(seg);
    }
    return { type: 'path', segments };
  }

  return null;
}

/**
 * Validate a single expression string.
 * Returns an error message or null if valid.
 */
function validateExpression(expr: string): string | null {
  if (!expr || expr.trim() === '') return 'expression is empty';
  if (!hasBalancedBrackets(expr)) return `unbalanced brackets in expression: ${expr}`;
  const ast = parseExpressionString(expr);
  if (!ast) return `unrecognised expression syntax: ${expr}`;
  return null;
}

// ============================================================
// Path resolution helpers
// ============================================================

/**
 * Resolve a dot-notation path (with optional array indices) in an object.
 * E.g. resolvePathValue({ user: { name: 'Alice' } }, 'user.name') → 'Alice'
 */
function resolvePathValue(obj: unknown, path: string): unknown {
  const normalised = path.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalised.split('.').filter(Boolean);
  let cursor: unknown = obj;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

/**
 * Set a value at a dot-notation path, creating intermediate objects as needed.
 */
function setPathValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const normalised = path.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalised.split('.').filter(Boolean);
  if (parts.length === 0) return obj;

  const result = { ...obj };
  let cursor: Record<string, unknown> = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const existing = cursor[part];
    const next: Record<string, unknown> =
      existing != null && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};
    cursor[part] = next;
    cursor = next;
  }
  cursor[parts[parts.length - 1]] = value;
  return result;
}

// ============================================================
// Expression evaluation
// ============================================================

/**
 * Evaluate a parsed expression AST against a source object.
 */
function evaluateExpr(ast: ExprAST, source: Record<string, unknown>): unknown {
  switch (ast.type) {
    case 'path':
      return resolvePathValue(source, ast.segments.join('.'));

    case 'arrayMap': {
      const arr = source[ast.source];
      if (!Array.isArray(arr)) return [];
      return arr.map((item) => resolvePathValue(item as Record<string, unknown>, ast.field));
    }

    case 'arrayFilter': {
      const arr = source[ast.source];
      if (!Array.isArray(arr)) return [];
      return arr.filter((item) => {
        const val = (item as Record<string, unknown>)[ast.predicate.field];
        if (ast.predicate.op === '==') return String(val) === ast.predicate.value;
        return false;
      });
    }

    case 'template': {
      return ast.parts.map((p) => {
        if (p.kind === 'literal') return p.text;
        const val = resolvePathValue(source, p.name);
        return val != null ? String(val) : '';
      }).join('');
    }

    case 'conditional': {
      const val = resolvePathValue(source, ast.test.left);
      let result = false;
      switch (ast.test.op) {
        case '==': result = String(val) === ast.test.right; break;
        case '!=': result = String(val) !== ast.test.right; break;
        default: break;
      }
      return result ? ast.consequent : ast.alternate;
    }

    case 'coerce': {
      const raw = resolvePathValue(source, ast.arg);
      switch (ast.fn) {
        case 'toString': return raw != null ? String(raw) : '';
        case 'parseInt': return parseInt(String(raw), 10);
        case 'parseFloat': return parseFloat(String(raw));
        case 'toNumber': return Number(raw);
        case 'toBool': return Boolean(raw) && raw !== 'false' && raw !== '0';
        default: return raw;
      }
    }

    case 'fallback': {
      const val = resolvePathValue(source, ast.expr);
      return val != null ? val : ast.default;
    }

    default:
      return undefined;
  }
}

// ============================================================
// Transform engine: request direction (concept → API)
// ============================================================

/**
 * Apply a mapping (concept field → API field) to an input object.
 * Returns the API-shaped output object.
 */
function applyRequestMapping(
  mapping: Record<string, string>,
  input: Record<string, unknown>,
): Record<string, unknown> {
  let output: Record<string, unknown> = {};

  for (const [conceptPath, apiPath] of Object.entries(mapping)) {
    const exprAst = parseExpressionString(apiPath);
    let value: unknown;

    if (exprAst) {
      value = evaluateExpr(exprAst, input);
    } else {
      // Raw path fallback — treat apiPath as literal
      value = resolvePathValue(input, conceptPath);
    }

    // Handle array mapping: items[*].title → entries[*].name
    const srcArrayMapMatch = /^(\w+)\[\*\]\.(.+)$/.exec(conceptPath);
    const destArrayMapMatch = /^(\w+)\[\*\]\.(.+)$/.exec(apiPath);
    if (srcArrayMapMatch && destArrayMapMatch) {
      const srcArr = input[srcArrayMapMatch[1]];
      const srcField = srcArrayMapMatch[2];
      const destArr = destArrayMapMatch[1];
      const destField = destArrayMapMatch[2];

      if (!Array.isArray(srcArr)) continue;

      // Build or extend the dest array
      const existing = output[destArr];
      const destItems: Record<string, unknown>[] = Array.isArray(existing)
        ? (existing as Record<string, unknown>[])
        : srcArr.map(() => ({}));

      for (let i = 0; i < srcArr.length; i++) {
        const item = srcArr[i] as Record<string, unknown>;
        const fieldVal = resolvePathValue(item, srcField);
        const destItem = destItems[i] ?? {};
        destItems[i] = setPathValue(destItem as Record<string, unknown>, destField, fieldVal);
      }

      output[destArr] = destItems;
      continue;
    }

    if (value !== undefined) {
      output = setPathValue(output, apiPath, value);
    }
  }

  return output;
}

// ============================================================
// Transform engine: response direction (API → concept)
// ============================================================

/**
 * Apply a mapping in reverse (API field → concept field).
 * Also handles special _arrayRoot / _itemTransform keys.
 */
function applyResponseMapping(
  mapping: Record<string, string>,
  response: Record<string, unknown>,
): Record<string, unknown> {
  let output: Record<string, unknown> = {};

  // Special array-root pattern
  if ('_arrayRoot' in mapping && '_itemTransform' in mapping) {
    const arrayRootKey = mapping['_arrayRoot'];
    let itemTransform: Record<string, string> = {};
    try {
      const raw = mapping['_itemTransform'];
      itemTransform = typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, string>);
    } catch {
      itemTransform = {};
    }
    const srcArr = response[arrayRootKey];
    if (Array.isArray(srcArr)) {
      output['items'] = (srcArr as Record<string, unknown>[]).map((item) => {
        const out: Record<string, unknown> = {};
        for (const [apiField, conceptField] of Object.entries(itemTransform)) {
          const val = item[apiField];
          if (val !== undefined) {
            (out as Record<string, unknown>)[conceptField] = val;
          }
        }
        return out;
      });
    }
    return output;
  }

  for (const [apiPath, conceptPath] of Object.entries(mapping)) {
    // Array mapping: lineItems[*].productCode → items[*].sku
    const srcArrayMapMatch = /^(\w+)\[\*\]\.(.+)$/.exec(apiPath);
    const destArrayMapMatch = /^(\w+)\[\*\]\.(.+)$/.exec(conceptPath);
    if (srcArrayMapMatch && destArrayMapMatch) {
      const srcArr = response[srcArrayMapMatch[1]];
      const srcField = srcArrayMapMatch[2];
      const destArr = destArrayMapMatch[1];
      const destField = destArrayMapMatch[2];

      if (!Array.isArray(srcArr)) continue;

      const existing = output[destArr];
      const destItems: Record<string, unknown>[] = Array.isArray(existing)
        ? (existing as Record<string, unknown>[])
        : srcArr.map(() => ({}));

      for (let i = 0; i < srcArr.length; i++) {
        const item = srcArr[i] as Record<string, unknown>;
        const fieldVal = resolvePathValue(item, srcField);
        const destItem = destItems[i] ?? {};
        destItems[i] = setPathValue(destItem as Record<string, unknown>, destField, fieldVal);
      }

      output[destArr] = destItems;
      continue;
    }

    const value = resolvePathValue(response, apiPath);
    if (value !== undefined) {
      output = setPathValue(output, conceptPath, value);
    }
  }

  return output;
}

// ============================================================
// Handler
// ============================================================

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {

  // ----------------------------------------------------------
  // register(name, requestMapping, responseMapping)
  //   -> ok(transform: T) | duplicate() | invalid(message)
  // ----------------------------------------------------------
  register(input: Record<string, unknown>) {
    const name = (input.name as string | undefined) ?? '';
    const requestMapping = (input.requestMapping as string | undefined) ?? '';
    const responseMapping = (input.responseMapping as string | undefined) ?? '';

    // Input validation
    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }

    let reqParsed: Record<string, string>;
    try {
      reqParsed = JSON.parse(requestMapping);
      if (typeof reqParsed !== 'object' || reqParsed === null || Array.isArray(reqParsed)) {
        throw new Error('not an object');
      }
    } catch {
      return complete(createProgram(), 'invalid', { message: 'requestMapping must be valid JSON object' }) as StorageProgram<Result>;
    }

    let resParsed: Record<string, string>;
    try {
      resParsed = JSON.parse(responseMapping);
      if (typeof resParsed !== 'object' || resParsed === null || Array.isArray(resParsed)) {
        throw new Error('not an object');
      }
    } catch {
      return complete(createProgram(), 'invalid', { message: 'responseMapping must be valid JSON object' }) as StorageProgram<Result>;
    }

    void reqParsed; void resParsed;

    const key = name.trim();
    let p = createProgram();
    p = spGet(p, 'transform', key, 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'duplicate', {}),
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'transform', key, {
          transform: key,
          name: key,
          requestMapping,
          responseMapping,
          createdAt: now,
        });
        return complete(b2, 'ok', { transform: key });
      },
    ) as StorageProgram<Result>;
  },

  // ----------------------------------------------------------
  // get(transform: T) -> ok(...) | notfound(message)
  // ----------------------------------------------------------
  get(input: Record<string, unknown>) {
    const transform = (input.transform as string | undefined) ?? '';

    let p = createProgram();
    p = spGet(p, 'transform', transform, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.record as Record<string, unknown>;
        return {
          transform: rec.transform as string,
          name: rec.name as string,
          requestMapping: rec.requestMapping as string,
          responseMapping: rec.responseMapping as string,
          createdAt: rec.createdAt as string,
        };
      }),
      (b) => complete(b, 'notfound', { message: `No transform found with id: ${transform}` }),
    ) as StorageProgram<Result>;
  },

  // ----------------------------------------------------------
  // list() -> ok(transforms: String)
  // ----------------------------------------------------------
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'transform', {}, 'items');
    return completeFrom(p, 'ok', (bindings) => ({
      transforms: JSON.stringify((bindings.items as Record<string, unknown>[]) ?? []),
    })) as StorageProgram<Result>;
  },

  // ----------------------------------------------------------
  // transformRequest(mapping, input) -> ok(result) | invalid(message)
  // ----------------------------------------------------------
  transformRequest(input: Record<string, unknown>) {
    const mappingStr = (input.mapping as string | undefined) ?? '';
    const inputStr = (input.input as string | undefined) ?? '';

    let mappingParsed: Record<string, string>;
    try {
      mappingParsed = JSON.parse(mappingStr);
      if (typeof mappingParsed !== 'object' || mappingParsed === null || Array.isArray(mappingParsed)) {
        throw new Error('not an object');
      }
    } catch {
      return complete(createProgram(), 'invalid', { message: 'mapping must be valid JSON object' }) as StorageProgram<Result>;
    }

    let inputParsed: Record<string, unknown>;
    try {
      inputParsed = JSON.parse(inputStr);
      if (typeof inputParsed !== 'object' || inputParsed === null || Array.isArray(inputParsed)) {
        throw new Error('not an object');
      }
    } catch {
      return complete(createProgram(), 'invalid', { message: 'input must be valid JSON object' }) as StorageProgram<Result>;
    }

    try {
      const output = applyRequestMapping(mappingParsed, inputParsed);
      return complete(createProgram(), 'ok', { result: JSON.stringify(output) }) as StorageProgram<Result>;
    } catch (err) {
      return complete(createProgram(), 'invalid', { message: String(err) }) as StorageProgram<Result>;
    }
  },

  // ----------------------------------------------------------
  // transformResponse(mapping, response) -> ok(result) | invalid(message)
  // ----------------------------------------------------------
  transformResponse(input: Record<string, unknown>) {
    const mappingStr = (input.mapping as string | undefined) ?? '';
    const responseStr = (input.response as string | undefined) ?? '';

    let mappingParsed: Record<string, string>;
    try {
      mappingParsed = JSON.parse(mappingStr);
      if (typeof mappingParsed !== 'object' || mappingParsed === null || Array.isArray(mappingParsed)) {
        throw new Error('not an object');
      }
    } catch {
      return complete(createProgram(), 'invalid', { message: 'mapping must be valid JSON object' }) as StorageProgram<Result>;
    }

    let responseParsed: Record<string, unknown>;
    try {
      responseParsed = JSON.parse(responseStr);
      if (typeof responseParsed !== 'object' || responseParsed === null || Array.isArray(responseParsed)) {
        throw new Error('not an object');
      }
    } catch {
      return complete(createProgram(), 'invalid', { message: 'response must be valid JSON object' }) as StorageProgram<Result>;
    }

    try {
      const output = applyResponseMapping(mappingParsed, responseParsed);
      return complete(createProgram(), 'ok', { result: JSON.stringify(output) }) as StorageProgram<Result>;
    } catch (err) {
      return complete(createProgram(), 'invalid', { message: String(err) }) as StorageProgram<Result>;
    }
  },

  // ----------------------------------------------------------
  // validate(mapping) -> ok() | invalid(message, errors)
  // ----------------------------------------------------------
  validate(input: Record<string, unknown>) {
    const mappingStr = (input.mapping as string | undefined) ?? '';

    if (!mappingStr || mappingStr.trim() === '') {
      return complete(createProgram(), 'invalid', {
        message: 'mapping is required',
        errors: JSON.stringify(['mapping is required']),
      }) as StorageProgram<Result>;
    }

    let mappingParsed: Record<string, string>;
    try {
      mappingParsed = JSON.parse(mappingStr);
      if (typeof mappingParsed !== 'object' || mappingParsed === null || Array.isArray(mappingParsed)) {
        throw new Error('not an object');
      }
    } catch {
      return complete(createProgram(), 'invalid', {
        message: 'mapping must be valid JSON object',
        errors: JSON.stringify(['mapping must be valid JSON object']),
      }) as StorageProgram<Result>;
    }

    const errors: string[] = [];
    for (const [key, value] of Object.entries(mappingParsed)) {
      // Validate keys
      const keyErr = validateExpression(key);
      if (keyErr) errors.push(`key "${key}": ${keyErr}`);

      // Validate values — skip special array-root / item-transform values
      if (key === '_arrayRoot' || key === '_itemTransform') continue;

      // Value may be a plain API path or an expression
      if (typeof value === 'string') {
        // Paths used as mapping targets don't need full expression parsing, but
        // they must have balanced brackets
        if (!hasBalancedBrackets(value)) {
          errors.push(`value for "${key}" has unbalanced brackets`);
        } else if (value.trim() === '') {
          errors.push(`value for "${key}" is empty`);
        }
        // Try expression parse only if it looks like a non-trivial expression
        const isExpr = value.startsWith('if ') || value.includes('{{') || value.includes('??')
          || /^(toString|parseInt|parseFloat|toBool|toNumber)\(/.test(value);
        if (isExpr) {
          const exprErr = validateExpression(value);
          if (exprErr) errors.push(`value for "${key}": ${exprErr}`);
        }
      }
    }

    if (errors.length > 0) {
      return complete(createProgram(), 'invalid', {
        message: `Mapping has ${errors.length} invalid expression(s)`,
        errors: JSON.stringify(errors),
      }) as StorageProgram<Result>;
    }

    return complete(createProgram(), 'ok', {}) as StorageProgram<Result>;
  },

  // ----------------------------------------------------------
  // parseExpression(expression) -> ok(ast) | invalid(message)
  // ----------------------------------------------------------
  parseExpression(input: Record<string, unknown>) {
    const expression = (input.expression as string | undefined) ?? '';

    if (!expression || expression.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'expression is required' }) as StorageProgram<Result>;
    }

    if (!hasBalancedBrackets(expression)) {
      return complete(createProgram(), 'invalid', { message: `unbalanced brackets in expression: ${expression}` }) as StorageProgram<Result>;
    }

    // Reject obviously invalid patterns
    if (/\$\$/.test(expression)) {
      return complete(createProgram(), 'invalid', { message: `unsupported syntax in expression: ${expression}` }) as StorageProgram<Result>;
    }

    const ast = parseExpressionString(expression);
    if (!ast) {
      return complete(createProgram(), 'invalid', { message: `unrecognised expression syntax: ${expression}` }) as StorageProgram<Result>;
    }

    return complete(createProgram(), 'ok', { ast: JSON.stringify(ast) }) as StorageProgram<Result>;
  },
};

export const fieldTransformHandler = autoInterpret(_handler);
