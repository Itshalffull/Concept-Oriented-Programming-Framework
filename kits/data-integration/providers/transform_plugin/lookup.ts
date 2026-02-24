// Transform Plugin Provider: lookup
// Map values via a configurable lookup table with case-insensitive matching.
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'lookup';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

export class LookupTransformProvider {
  transform(value: unknown, config: TransformConfig): unknown {
    const table = config.options?.table as Record<string, unknown> | undefined;
    if (!table) {
      throw new Error('Lookup table is required in config.options.table');
    }

    const caseInsensitive = config.options?.caseInsensitive !== false;
    const defaultValue = config.options?.default;
    const hasDefault = 'default' in (config.options ?? {});

    if (value === null || value === undefined) {
      return hasDefault ? defaultValue : null;
    }

    const key = String(value);

    // Direct match first
    if (key in table) {
      return table[key];
    }

    // Case-insensitive match
    if (caseInsensitive) {
      const lowerKey = key.toLowerCase();
      for (const [k, v] of Object.entries(table)) {
        if (k.toLowerCase() === lowerKey) {
          return v;
        }
      }
    }

    // No match found
    if (hasDefault) {
      return defaultValue;
    }

    return value;
  }

  inputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'any', nullable: true };
  }
}

export default LookupTransformProvider;
