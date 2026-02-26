// Direct field mapper — key-to-key mapping with dot notation for nested traversal
// Supports dot-separated paths and bracket notation for array indexing

export interface MapperConfig {
  pathSyntax: string;
  options?: Record<string, unknown>;
}

export const PROVIDER_ID = 'direct';
export const PLUGIN_TYPE = 'field_mapper';

/**
 * Parse a source path into traversal segments.
 * "user.addresses[0].city" => ["user", "addresses", 0, "city"]
 */
function parseSegments(sourcePath: string): (string | number)[] {
  const segments: (string | number)[] = [];
  const parts = sourcePath.split('.');

  for (const part of parts) {
    const bracketMatch = part.match(/^([^[]*)\[(\d+)\]$/);
    if (bracketMatch) {
      if (bracketMatch[1]) {
        segments.push(bracketMatch[1]);
      }
      segments.push(parseInt(bracketMatch[2], 10));
    } else {
      // Handle consecutive bracket accesses like "items[0][1]"
      const multiBracket = part.match(/^([^[]*)((?:\[\d+\])+)$/);
      if (multiBracket) {
        if (multiBracket[1]) {
          segments.push(multiBracket[1]);
        }
        const indices = multiBracket[2].match(/\[(\d+)\]/g) ?? [];
        for (const idx of indices) {
          segments.push(parseInt(idx.slice(1, -1), 10));
        }
      } else {
        segments.push(part);
      }
    }
  }
  return segments;
}

/**
 * Traverse into a nested structure following the parsed segments.
 */
function traversePath(root: unknown, segments: (string | number)[]): unknown {
  let current: unknown = root;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof segment === 'number') {
      if (Array.isArray(current)) {
        current = current[segment];
      } else {
        return undefined;
      }
    } else {
      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }
  }

  return current;
}

export class DirectMapperProvider {
  resolve(
    record: Record<string, unknown>,
    sourcePath: string,
    _config: MapperConfig
  ): unknown {
    if (!sourcePath || sourcePath.trim() === '') {
      return undefined;
    }

    const segments = parseSegments(sourcePath.trim());
    if (segments.length === 0) {
      return undefined;
    }

    const value = traversePath(record, segments);
    return value === undefined ? null : value;
  }

  supports(pathSyntax: string): boolean {
    return pathSyntax === 'dot_notation' || pathSyntax === 'direct' || pathSyntax === 'bracket';
  }
}

export default DirectMapperProvider;
