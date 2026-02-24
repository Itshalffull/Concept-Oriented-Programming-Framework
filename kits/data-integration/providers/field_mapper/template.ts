// Template field mapper — string interpolation with field references
// Supports {field_name} placeholders, {field|default} fallback syntax,
// and nested field references like {author.name}

export interface MapperConfig {
  pathSyntax: string;
  options?: Record<string, unknown>;
}

export const PROVIDER_ID = 'template';
export const PLUGIN_TYPE = 'field_mapper';

interface PlaceholderToken {
  type: 'placeholder';
  fieldPath: string;
  defaultValue?: string;
}

interface LiteralToken {
  type: 'literal';
  value: string;
}

type Token = PlaceholderToken | LiteralToken;

function resolveFieldValue(
  record: Record<string, unknown>,
  fieldPath: string
): unknown {
  const parts = fieldPath.split('.');
  let current: unknown = record;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    // Handle bracket array access within template paths
    const bracketMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (bracketMatch) {
      if (typeof current !== 'object') return undefined;
      const obj = (current as Record<string, unknown>)[bracketMatch[1]];
      if (!Array.isArray(obj)) return undefined;
      current = obj[parseInt(bracketMatch[2], 10)];
    } else {
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

function tokenize(template: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let literalStart = 0;

  while (i < template.length) {
    // Escaped brace
    if (template[i] === '\\' && i + 1 < template.length && (template[i + 1] === '{' || template[i + 1] === '}')) {
      tokens.push({ type: 'literal', value: template.slice(literalStart, i) });
      tokens.push({ type: 'literal', value: template[i + 1] });
      i += 2;
      literalStart = i;
      continue;
    }

    if (template[i] === '{') {
      if (i > literalStart) {
        tokens.push({ type: 'literal', value: template.slice(literalStart, i) });
      }

      const closeIdx = template.indexOf('}', i + 1);
      if (closeIdx === -1) {
        // Unclosed brace — treat as literal
        tokens.push({ type: 'literal', value: template.slice(i) });
        return tokens;
      }

      const inner = template.slice(i + 1, closeIdx).trim();
      const pipeIdx = inner.indexOf('|');

      if (pipeIdx !== -1) {
        tokens.push({
          type: 'placeholder',
          fieldPath: inner.slice(0, pipeIdx).trim(),
          defaultValue: inner.slice(pipeIdx + 1).trim(),
        });
      } else {
        tokens.push({
          type: 'placeholder',
          fieldPath: inner,
        });
      }

      i = closeIdx + 1;
      literalStart = i;
    } else {
      i++;
    }
  }

  if (literalStart < template.length) {
    tokens.push({ type: 'literal', value: template.slice(literalStart) });
  }

  return tokens;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export class TemplateMapperProvider {
  resolve(
    record: Record<string, unknown>,
    sourcePath: string,
    _config: MapperConfig
  ): unknown {
    const tokens = tokenize(sourcePath);
    const parts: string[] = [];

    for (const token of tokens) {
      if (token.type === 'literal') {
        parts.push(token.value);
      } else {
        const resolved = resolveFieldValue(record, token.fieldPath);
        if (resolved !== undefined && resolved !== null) {
          parts.push(formatValue(resolved));
        } else if (token.defaultValue !== undefined) {
          parts.push(token.defaultValue);
        } else {
          parts.push('');
        }
      }
    }

    return parts.join('');
  }

  supports(pathSyntax: string): boolean {
    return pathSyntax === 'template' || pathSyntax === 'string_template' || pathSyntax === 'interpolation';
  }
}

export default TemplateMapperProvider;
