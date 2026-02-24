// Transform Plugin Provider: regex_replace
// Pattern-based find and replace with capture group support.
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'regex_replace';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

export class RegexReplaceTransformProvider {
  transform(value: unknown, config: TransformConfig): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    const str = String(value);
    const pattern = config.options?.pattern as string;
    if (!pattern) {
      throw new Error('regex_replace requires a pattern in config.options.pattern');
    }

    const replacement = (config.options?.replacement as string) ?? '';
    const global = config.options?.global !== false;
    const caseInsensitive = config.options?.caseInsensitive === true;
    const multiline = config.options?.multiline === true;

    let flags = '';
    if (global) flags += 'g';
    if (caseInsensitive) flags += 'i';
    if (multiline) flags += 'm';

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, flags);
    } catch (err) {
      throw new Error(`Invalid regex pattern "${pattern}": ${(err as Error).message}`);
    }

    // The replacement string supports $1, $2, etc. for capture groups natively
    const result = str.replace(regex, replacement);

    return result;
  }

  inputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }
}

export default RegexReplaceTransformProvider;
