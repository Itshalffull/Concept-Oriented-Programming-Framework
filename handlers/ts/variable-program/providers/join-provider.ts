/**
 * JoinTransformProvider — joins array values into a single string.
 *
 * Registered with PluginRegistry under namespace "variable-transform", kind "join".
 *
 * Text syntax: |join(', ')   |join(' and ')   |join('\n')
 *
 * apply() never throws.
 *
 * Behaviour:
 *   - Array    → elements joined with the sep argument (default ", ")
 *   - String   → returned as-is (already a scalar; no joining needed)
 *   - Anything else → String(value)
 */

import type { VariableTransformProvider, ArgSpec } from './transform-provider.interface.js';

const argSpec: ArgSpec[] = [
  { name: 'sep', type: 'string', required: false, default: ', ' },
];

export const joinProvider: VariableTransformProvider = {
  kind: 'join',
  argSpec,
  apply(value: unknown, args: Record<string, string>): unknown {
    // Use caller-supplied separator; fall back to the default ", ".
    const sep = args.sep ?? ', ';

    if (Array.isArray(value)) {
      try {
        return value.join(sep);
      } catch {
        return String(value);
      }
    }

    if (typeof value === 'string') {
      return value;
    }

    return String(value);
  },
};
