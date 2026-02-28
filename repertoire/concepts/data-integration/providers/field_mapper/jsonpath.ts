// JSONPath field mapper — JSONPath expression evaluation for complex JSON navigation
// Supports: $ (root), . (child), .. (recursive descent), [*] (wildcard),
// [n] (index), [?(@.field<value)] (filter expressions)

export interface MapperConfig {
  pathSyntax: string;
  options?: Record<string, unknown>;
}

export const PROVIDER_ID = 'jsonpath';
export const PLUGIN_TYPE = 'field_mapper';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function descendants(node: unknown): unknown[] {
  const results: unknown[] = [];
  if (Array.isArray(node)) {
    for (const item of node) {
      results.push(item);
      results.push(...descendants(item));
    }
  } else if (isObject(node)) {
    for (const val of Object.values(node)) {
      results.push(val);
      results.push(...descendants(val));
    }
  }
  return results;
}

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = expr.startsWith('$') ? 1 : 0;

  while (i < expr.length) {
    if (expr[i] === '.') {
      if (expr[i + 1] === '.') {
        tokens.push('..');
        i += 2;
      } else {
        i++;
      }
    } else if (expr[i] === '[') {
      const end = expr.indexOf(']', i);
      if (end === -1) break;
      tokens.push(expr.slice(i, end + 1));
      i = end + 1;
    } else {
      let j = i;
      while (j < expr.length && expr[j] !== '.' && expr[j] !== '[') j++;
      tokens.push(expr.slice(i, j));
      i = j;
    }
  }
  return tokens;
}

function evaluateFilter(node: unknown, filterExpr: string): boolean {
  const match = filterExpr.match(/@\.(\w+)\s*(==|!=|<|>|<=|>=)\s*(.+)/);
  if (!match || !isObject(node)) return false;
  const [, field, op, rawVal] = match;
  const fieldVal = node[field];
  const cmpVal = rawVal.startsWith("'") || rawVal.startsWith('"')
    ? rawVal.slice(1, -1)
    : Number(rawVal);

  switch (op) {
    case '==': return fieldVal == cmpVal;
    case '!=': return fieldVal != cmpVal;
    case '<':  return (fieldVal as number) < (cmpVal as number);
    case '>':  return (fieldVal as number) > (cmpVal as number);
    case '<=': return (fieldVal as number) <= (cmpVal as number);
    case '>=': return (fieldVal as number) >= (cmpVal as number);
    default: return false;
  }
}

function applyToken(nodes: unknown[], token: string): unknown[] {
  const results: unknown[] = [];

  if (token === '..') {
    for (const node of nodes) {
      results.push(...descendants(node));
    }
    return results;
  }

  if (token.startsWith('[') && token.endsWith(']')) {
    const inner = token.slice(1, -1).trim();

    if (inner === '*') {
      for (const node of nodes) {
        if (Array.isArray(node)) results.push(...node);
        else if (isObject(node)) results.push(...Object.values(node));
      }
    } else if (inner.startsWith('?(') && inner.endsWith(')')) {
      const filterExpr = inner.slice(2, -1).trim();
      for (const node of nodes) {
        if (Array.isArray(node)) {
          results.push(...node.filter(item => evaluateFilter(item, filterExpr)));
        }
      }
    } else if (/^-?\d+$/.test(inner)) {
      const idx = parseInt(inner, 10);
      for (const node of nodes) {
        if (Array.isArray(node)) {
          const resolved = idx < 0 ? node.length + idx : idx;
          if (resolved >= 0 && resolved < node.length) results.push(node[resolved]);
        }
      }
    } else {
      const key = inner.replace(/^['"]|['"]$/g, '');
      for (const node of nodes) {
        if (isObject(node) && key in node) results.push(node[key]);
      }
    }
    return results;
  }

  // Plain property name
  for (const node of nodes) {
    if (isObject(node) && token in node) {
      results.push(node[token]);
    }
  }
  return results;
}

export class JsonPathMapperProvider {
  resolve(
    record: Record<string, unknown>,
    sourcePath: string,
    config: MapperConfig
  ): unknown {
    const tokens = tokenize(sourcePath.trim());
    let nodes: unknown[] = [record];

    for (const token of tokens) {
      nodes = applyToken(nodes, token);
      if (nodes.length === 0) return null;
    }

    const returnFirst = config.options?.returnFirst !== false;
    return returnFirst && nodes.length === 1 ? nodes[0] : nodes;
  }

  supports(pathSyntax: string): boolean {
    return pathSyntax === 'jsonpath' || pathSyntax === 'json_path';
  }
}

export default JsonPathMapperProvider;
