// Transform Plugin Provider: default_value
// Provide fallback values when input is null, undefined, or empty.
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'default_value';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

export class DefaultValueTransformProvider {
  transform(value: unknown, config: TransformConfig): unknown {
    const defaultVal = config.options?.defaultValue ?? null;
    const treatEmptyAsNull = config.options?.treatEmptyAsNull !== false;

    if (value === null || value === undefined) {
      return defaultVal;
    }

    if (treatEmptyAsNull) {
      if (typeof value === 'string' && value.trim() === '') {
        return defaultVal;
      }

      if (Array.isArray(value) && value.length === 0) {
        return defaultVal;
      }

      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) {
        return defaultVal;
      }
    }

    // Type-specific defaults
    const typeDefault = config.options?.typeDefaults as Record<string, unknown> | undefined;
    if (typeDefault) {
      const valueType = typeof value;
      if (valueType === 'number' && isNaN(value as number) && typeDefault.number !== undefined) {
        return typeDefault.number;
      }
    }

    return value;
  }

  inputType(): TypeSpec {
    return { type: 'any', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'any', nullable: false };
  }
}

export default DefaultValueTransformProvider;
