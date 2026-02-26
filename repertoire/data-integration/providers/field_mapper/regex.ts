// Regex field mapper — regex capture group extraction from string values
// Supports named groups (?<name>...), numbered groups, flags: i, m, s, g

export interface MapperConfig {
  pathSyntax: string;
  options?: Record<string, unknown>;
}

export const PROVIDER_ID = 'regex';
export const PLUGIN_TYPE = 'field_mapper';

interface RegexOptions {
  flags?: string;
  group?: string | number;
  allMatches?: boolean;
}

function resolveFieldValue(record: Record<string, unknown>, field: string): string | null {
  const parts = field.split('.');
  let current: unknown = record;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[part];
  }
  return current !== null && current !== undefined ? String(current) : null;
}

function parseFlags(flagStr: string): string {
  let result = '';
  const valid = new Set(['i', 'm', 's', 'g']);
  for (const ch of flagStr) {
    if (valid.has(ch)) {
      // 's' (dotall) maps to the JS 's' flag
      result += ch;
    }
  }
  return result;
}

function extractSingleMatch(
  match: RegExpMatchArray,
  groupSpec?: string | number
): unknown {
  if (groupSpec !== undefined && groupSpec !== null) {
    if (typeof groupSpec === 'string' && match.groups) {
      return match.groups[groupSpec] ?? null;
    }
    if (typeof groupSpec === 'number') {
      return match[groupSpec] ?? null;
    }
  }

  // Return named groups if they exist, otherwise numbered groups
  if (match.groups && Object.keys(match.groups).length > 0) {
    return { ...match.groups };
  }

  if (match.length > 1) {
    return match.length === 2 ? match[1] : match.slice(1);
  }

  return match[0];
}

export class RegexMapperProvider {
  resolve(
    record: Record<string, unknown>,
    sourcePath: string,
    config: MapperConfig
  ): unknown {
    // sourcePath format: "fieldName" or "fieldName::/pattern/flags"
    // The regex pattern can also be provided via config.options.pattern
    const opts = (config.options ?? {}) as RegexOptions;

    let fieldName: string;
    let patternStr: string;
    let flags: string;

    const inlineMatch = sourcePath.match(/^(.+?)::\/(.+)\/([gimsuy]*)$/);
    if (inlineMatch) {
      fieldName = inlineMatch[1].trim();
      patternStr = inlineMatch[2];
      flags = parseFlags(inlineMatch[3] + (opts.flags ?? ''));
    } else {
      fieldName = sourcePath.trim();
      patternStr = (config.options?.pattern as string) ?? '';
      flags = parseFlags(opts.flags ?? '');
      if (!patternStr) return null;
    }

    const input = resolveFieldValue(record, fieldName);
    if (input === null) return null;

    const isGlobal = flags.includes('g') || opts.allMatches === true;

    try {
      const regex = new RegExp(patternStr, flags);

      if (isGlobal) {
        const allResults: unknown[] = [];
        let m: RegExpExecArray | null;
        const globalRegex = new RegExp(
          patternStr,
          flags.includes('g') ? flags : flags + 'g'
        );
        while ((m = globalRegex.exec(input)) !== null) {
          allResults.push(extractSingleMatch(m, opts.group));
          if (!globalRegex.global) break;
        }
        return allResults.length === 0 ? null : allResults;
      }

      const match = regex.exec(input);
      if (!match) return null;
      return extractSingleMatch(match, opts.group);
    } catch {
      return null;
    }
  }

  supports(pathSyntax: string): boolean {
    return pathSyntax === 'regex' || pathSyntax === 'regexp' || pathSyntax === 'regular_expression';
  }
}

export default RegexMapperProvider;
