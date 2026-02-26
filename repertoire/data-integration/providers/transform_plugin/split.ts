// Transform Plugin Provider: split
// Split a string into an array by configurable delimiter.
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'split';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

export class SplitTransformProvider {
  transform(value: unknown, config: TransformConfig): unknown {
    if (value === null || value === undefined) {
      return [];
    }

    const str = String(value);
    const delimiter = (config.options?.delimiter as string) ?? ',';
    const isRegex = config.options?.regex === true;
    const limit = config.options?.limit as number | undefined;
    const trimEntries = config.options?.trim !== false;
    const filterEmpty = config.options?.filterEmpty !== false;

    let splitter: string | RegExp;
    if (isRegex) {
      const flags = (config.options?.regexFlags as string) ?? '';
      splitter = new RegExp(delimiter, flags);
    } else {
      splitter = delimiter;
    }

    let parts: string[];
    if (limit !== undefined && limit > 0) {
      parts = str.split(splitter);
      if (parts.length > limit) {
        // Keep first (limit-1) parts and join the rest as the last part
        const head = parts.slice(0, limit - 1);
        const tail = parts.slice(limit - 1).join(
          isRegex ? delimiter : delimiter
        );
        parts = [...head, tail];
      }
    } else {
      parts = str.split(splitter);
    }

    if (trimEntries) {
      parts = parts.map(p => p.trim());
    }

    if (filterEmpty) {
      parts = parts.filter(p => p !== '');
    }

    return parts;
  }

  inputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'array' };
  }
}

export default SplitTransformProvider;
