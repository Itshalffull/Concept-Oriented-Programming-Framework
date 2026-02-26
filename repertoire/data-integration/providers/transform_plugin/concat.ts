// Transform Plugin Provider: concat
// Merge multiple values into a single string with configurable separator.
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'concat';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

export class ConcatTransformProvider {
  transform(value: unknown, config: TransformConfig): unknown {
    const separator = (config.options?.separator as string) ?? ' ';
    const skipNulls = config.options?.skipNulls !== false;
    const nullPlaceholder = (config.options?.nullPlaceholder as string) ?? '';
    const prefix = (config.options?.prefix as string) ?? '';
    const suffix = (config.options?.suffix as string) ?? '';
    const trimResult = config.options?.trim !== false;

    let values: unknown[];

    if (Array.isArray(value)) {
      values = value;
    } else if (value !== null && value !== undefined) {
      // If additional values are provided in config, concat them with the input
      const additional = config.options?.values as unknown[] | undefined;
      if (additional) {
        values = [value, ...additional];
      } else {
        return `${prefix}${String(value)}${suffix}`;
      }
    } else {
      const additional = config.options?.values as unknown[] | undefined;
      if (additional) {
        values = additional;
      } else {
        return skipNulls ? null : nullPlaceholder;
      }
    }

    const parts: string[] = [];

    for (const v of values) {
      if (v === null || v === undefined) {
        if (skipNulls) continue;
        parts.push(nullPlaceholder);
      } else if (typeof v === 'string' && v.trim() === '' && skipNulls) {
        continue;
      } else {
        parts.push(String(v));
      }
    }

    if (parts.length === 0) {
      return null;
    }

    let result = parts.join(separator);

    if (trimResult) {
      result = result.trim();
    }

    return `${prefix}${result}${suffix}`;
  }

  inputType(): TypeSpec {
    return { type: 'array', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }
}

export default ConcatTransformProvider;
