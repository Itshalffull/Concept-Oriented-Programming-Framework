/**
 * FallbackTransformProvider — returns a default value when the resolved
 * value is null, undefined, or empty string.
 *
 * Registered with PluginRegistry under namespace "variable-transform", kind "fallback".
 *
 * Text syntax: |fallback('')   |fallback('Unknown')   |fallback('N/A')
 *
 * apply() never throws.
 */

import type { VariableTransformProvider, ArgSpec } from './transform-provider.interface.js';

const argSpec: ArgSpec[] = [
  { name: 'value', type: 'string', required: true },
];

export const fallbackProvider: VariableTransformProvider = {
  kind: 'fallback',
  argSpec,
  apply(value: unknown, args: Record<string, string>): unknown {
    if (value === null || value === undefined || value === '') {
      // Return the caller-supplied default; fall back to empty string if the
      // arg is somehow missing (which shouldn't happen in normal usage).
      return args.value ?? '';
    }
    return value;
  },
};
