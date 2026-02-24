// Transform Plugin Provider: truncate
// Limit string length with configurable ellipsis and word-boundary awareness.
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'truncate';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

export class TruncateTransformProvider {
  transform(value: unknown, config: TransformConfig): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    const str = String(value);
    const maxLength = (config.options?.maxLength as number) ?? 100;
    const suffix = (config.options?.suffix as string) ?? '...';
    const wordBoundary = config.options?.wordBoundary !== false;
    const preserveWords = config.options?.preserveWords === true;

    if (str.length <= maxLength) {
      return str;
    }

    const effectiveMax = maxLength - suffix.length;

    if (effectiveMax <= 0) {
      return suffix.substring(0, maxLength);
    }

    let truncated = str.substring(0, effectiveMax);

    if (wordBoundary || preserveWords) {
      // Find the last space within the truncated portion
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 0 && lastSpace > effectiveMax * 0.5) {
        truncated = truncated.substring(0, lastSpace);
      }
    }

    // Remove trailing punctuation that would look odd before ellipsis
    truncated = truncated.replace(/[,;:\s]+$/, '');

    return truncated + suffix;
  }

  inputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }
}

export default TruncateTransformProvider;
