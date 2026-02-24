// Transform Plugin Provider: json_extract
// Extract values from JSON strings at a specified path.
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'json_extract';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

export class JsonExtractTransformProvider {
  transform(value: unknown, config: TransformConfig): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    const path = (config.options?.path as string) ?? '$';
    const defaultValue = config.options?.default;
    const hasDefault = config.options !== undefined && 'default' in config.options;

    let parsed: unknown;

    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value);
      } catch (err) {
        throw new Error(`Invalid JSON input: ${(err as Error).message}`);
      }
    } else {
      parsed = value;
    }

    try {
      const result = this.navigatePath(parsed, path);
      if (result === undefined) {
        return hasDefault ? defaultValue : null;
      }
      return result;
    } catch {
      if (hasDefault) return defaultValue;
      throw new Error(`Cannot extract path "${path}" from JSON`);
    }
  }

  private navigatePath(obj: unknown, path: string): unknown {
    if (path === '$' || path === '') {
      return obj;
    }

    // Normalize path: strip leading $. or $
    let normalized = path;
    if (normalized.startsWith('$.')) {
      normalized = normalized.substring(2);
    } else if (normalized.startsWith('$')) {
      normalized = normalized.substring(1);
    }

    // Tokenize path segments: support dot notation and bracket notation
    const segments = this.tokenizePath(normalized);

    let current: unknown = obj;

    for (const segment of segments) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Array index access
      const indexMatch = segment.match(/^\[(\d+)\]$/);
      if (indexMatch) {
        const idx = parseInt(indexMatch[1], 10);
        if (Array.isArray(current)) {
          current = current[idx];
        } else {
          return undefined;
        }
        continue;
      }

      // Wildcard: collect all values
      if (segment === '*' || segment === '[*]') {
        if (Array.isArray(current)) {
          return current;
        }
        if (typeof current === 'object' && current !== null) {
          return Object.values(current);
        }
        return undefined;
      }

      // Property access
      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private tokenizePath(path: string): string[] {
    const segments: string[] = [];
    let i = 0;

    while (i < path.length) {
      if (path[i] === '.') {
        i++;
        continue;
      }

      if (path[i] === '[') {
        const close = path.indexOf(']', i);
        if (close === -1) {
          throw new Error(`Unclosed bracket in path at position ${i}`);
        }
        let key = path.substring(i, close + 1);
        // String key in brackets: ['key'] or ["key"]
        const strMatch = key.match(/^\[['"](.+)['"]\]$/);
        if (strMatch) {
          segments.push(strMatch[1]);
        } else {
          segments.push(key);
        }
        i = close + 1;
        continue;
      }

      // Read until next dot or bracket
      let end = i;
      while (end < path.length && path[end] !== '.' && path[end] !== '[') {
        end++;
      }
      segments.push(path.substring(i, end));
      i = end;
    }

    return segments;
  }

  inputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'any', nullable: true };
  }
}

export default JsonExtractTransformProvider;
