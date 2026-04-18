/**
 * CoerceTransformProvider — coerces the resolved value to a target type.
 *
 * Registered with PluginRegistry under namespace "variable-transform", kind "coerce".
 *
 * Text syntax: |as(string)   |as(number)   |as(boolean)   |as(date)
 *
 * Supported target types:
 *   "string"  — String(value)
 *   "number"  — Number(value); callers that need a safe parse should chain
 *               |as(number)|fallback('0') since Number() returns NaN for
 *               non-parseable input.
 *   "boolean" — Boolean(value) with special handling for the string literals
 *               "false" and "0" which coerce to false (not true).
 *   "date"    — new Date(value) → ISO 8601 string; invalid dates return the
 *               original value unchanged.
 *
 * apply() never throws.
 */

import type { VariableTransformProvider, ArgSpec } from './transform-provider.interface.js';

const SUPPORTED_TYPES = new Set(['string', 'number', 'boolean', 'date']);

function coerce(value: unknown, type: string): unknown {
  switch (type) {
    case 'string':
      return String(value);

    case 'number':
      return Number(value);

    case 'boolean':
      // Special-case the string literals "false" and "0" so that
      // |as(boolean) behaves intuitively for common serialisation formats.
      if (value === 'false' || value === '0') return false;
      return Boolean(value);

    case 'date': {
      const d = new Date(value as string | number | Date);
      if (Number.isNaN(d.getTime())) {
        // Invalid date — return original value unchanged rather than "Invalid Date".
        return value;
      }
      return d.toISOString();
    }

    default:
      // Unknown target type — pass through unchanged.
      return value;
  }
}

const argSpec: ArgSpec[] = [
  { name: 'type', type: 'string', required: true },
];

export const coerceProvider: VariableTransformProvider = {
  kind: 'coerce',
  argSpec,
  apply(value: unknown, args: Record<string, string>): unknown {
    const type = args.type;
    if (!type || !SUPPORTED_TYPES.has(type)) {
      // Unknown or missing type — pass value through.
      return value;
    }
    try {
      return coerce(value, type);
    } catch {
      return value;
    }
  },
};
