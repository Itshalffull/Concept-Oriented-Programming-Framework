// Transform Plugin Provider: type_cast
// Cast values between types (string, number, boolean, timestamp).
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'type_cast';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

export class TypeCastTransformProvider {
  transform(value: unknown, config: TransformConfig): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    const targetType = (config.options?.targetType as string) ?? 'string';

    switch (targetType) {
      case 'string':
        return String(value);

      case 'number': {
        if (typeof value === 'number') return value;
        const str = String(value).trim();
        if (str === '') return null;
        const floatVal = parseFloat(str);
        if (isNaN(floatVal)) {
          throw new Error(`Cannot cast "${str}" to number`);
        }
        // Return integer if the string looks like an integer
        if (Number.isInteger(floatVal) && !str.includes('.')) {
          return parseInt(str, 10);
        }
        return floatVal;
      }

      case 'boolean': {
        if (typeof value === 'boolean') return value;
        const boolStr = String(value).trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(boolStr)) return true;
        if (['false', '0', 'no', 'off'].includes(boolStr)) return false;
        throw new Error(`Cannot cast "${value}" to boolean`);
      }

      case 'timestamp': {
        if (typeof value === 'number') return value;
        const dateStr = String(value).trim();
        const parsed = Date.parse(dateStr);
        if (isNaN(parsed)) {
          throw new Error(`Cannot cast "${dateStr}" to timestamp`);
        }
        return parsed;
      }

      case 'integer': {
        if (typeof value === 'number') return Math.trunc(value);
        const intStr = String(value).trim();
        const intVal = parseInt(intStr, 10);
        if (isNaN(intVal)) {
          throw new Error(`Cannot cast "${intStr}" to integer`);
        }
        return intVal;
      }

      case 'float': {
        if (typeof value === 'number') return value;
        const fStr = String(value).trim();
        const fVal = parseFloat(fStr);
        if (isNaN(fVal)) {
          throw new Error(`Cannot cast "${fStr}" to float`);
        }
        return fVal;
      }

      default:
        throw new Error(`Unsupported target type: ${targetType}`);
    }
  }

  inputType(): TypeSpec {
    return { type: 'any', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'any', nullable: true };
  }
}

export default TypeCastTransformProvider;
