// Transform Plugin Provider: format
// String formatting and interpolation with printf-style and template-style patterns.
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'format';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

export class FormatTransformProvider {
  transform(value: unknown, config: TransformConfig): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    const template = (config.options?.template as string) ?? '%s';
    const style = (config.options?.style as string) ?? 'auto';
    const args = (config.options?.args as unknown[]) ?? [];
    const namedArgs = (config.options?.namedArgs as Record<string, unknown>) ?? {};

    // Combine value into args for positional formatting
    const allArgs = [value, ...args];

    if (style === 'printf' || (style === 'auto' && /%[sdfe%]/.test(template))) {
      return this.printfFormat(template, allArgs);
    }

    if (style === 'template' || (style === 'auto' && /\{[\w\d]+\}/.test(template))) {
      return this.templateFormat(template, allArgs, { value, ...namedArgs });
    }

    // Default: simple %s substitution
    return this.printfFormat(template, allArgs);
  }

  private printfFormat(template: string, args: unknown[]): string {
    let argIndex = 0;
    return template.replace(/%([%sdfe])/g, (match, specifier) => {
      if (specifier === '%') return '%';
      if (argIndex >= args.length) return match;

      const arg = args[argIndex++];

      switch (specifier) {
        case 's':
          return String(arg ?? '');
        case 'd':
          return String(Math.trunc(Number(arg)));
        case 'f': {
          const num = Number(arg);
          return isNaN(num) ? 'NaN' : num.toFixed(6);
        }
        case 'e': {
          const eNum = Number(arg);
          return isNaN(eNum) ? 'NaN' : eNum.toExponential();
        }
        default:
          return match;
      }
    });
  }

  private templateFormat(
    template: string,
    positionalArgs: unknown[],
    namedArgs: Record<string, unknown>
  ): string {
    return template.replace(/\{(\w+)(?::(\w+))?\}/g, (match, key, formatter) => {
      let resolved: unknown;

      // Try numeric index first
      const index = parseInt(key, 10);
      if (!isNaN(index) && index >= 0 && index < positionalArgs.length) {
        resolved = positionalArgs[index];
      } else if (key in namedArgs) {
        resolved = namedArgs[key];
      } else {
        return match;
      }

      if (resolved === null || resolved === undefined) return '';

      // Apply optional formatter
      if (formatter) {
        return this.applyFormatter(resolved, formatter);
      }

      return String(resolved);
    });
  }

  private applyFormatter(value: unknown, formatter: string): string {
    const num = Number(value);
    switch (formatter) {
      case 'upper':
        return String(value).toUpperCase();
      case 'lower':
        return String(value).toLowerCase();
      case 'int':
        return String(Math.trunc(num));
      case 'fixed2':
        return isNaN(num) ? String(value) : num.toFixed(2);
      case 'fixed4':
        return isNaN(num) ? String(value) : num.toFixed(4);
      default:
        return String(value);
    }
  }

  inputType(): TypeSpec {
    return { type: 'any', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }
}

export default FormatTransformProvider;
