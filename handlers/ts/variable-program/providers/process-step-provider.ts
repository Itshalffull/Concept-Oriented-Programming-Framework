/**
 * ProcessStepVariableProvider — resolves $step.<stepKey>.<fields> expressions.
 *
 * Reads the output of a named process step from context.stepOutputs.
 * Step outputs are JSON-serialized strings placed into context by the
 * ProcessRun execution engine. The provider parses the JSON and returns
 * the resulting object for subsequent .get() traversal.
 *
 * Registered under PluginRegistry key "variable-source:step".
 * Boot sync registration is handled separately.
 */

import type { ArgSpec, PropertySpec, VariableSourceProvider } from './source-provider.interface.ts';

const ARG_SPEC: ArgSpec[] = [
  {
    name: 'stepKey',
    type: 'string',
    required: true,
    description: 'Process step key whose output to read (e.g. "brainstorm", "review")',
  },
];

export const processStepProvider: VariableSourceProvider = {
  kind: 'step',
  prefix: '$step',
  argSpec: ARG_SPEC,
  resolvedType: 'any',

  async resolve(
    args: Record<string, string>,
    context: Record<string, unknown>,
  ): Promise<unknown> {
    const stepKey = args.stepKey;
    if (stepKey == null || stepKey === '') return null;

    const stepOutputs = context.stepOutputs as Record<string, string> | undefined;
    if (stepOutputs == null) return null;

    const raw = stepOutputs[stepKey];
    if (raw == null) return null;

    // Step outputs are JSON-serialized — parse before returning so subsequent
    // .get() traversal steps can access individual fields.
    try {
      return JSON.parse(raw);
    } catch {
      // If the output is not valid JSON, return it as a plain string.
      return raw;
    }
  },

  async listProperties(
    args: Record<string, string>,
  ): Promise<PropertySpec[]> {
    // No context is available at picker time, so this method cannot call
    // concept actions. Return schema fields from context.stepSchema when
    // available, otherwise return empty to indicate the fields are dynamic.
    //
    // Note: the runtime layer that calls listProperties() has no context
    // argument, so we return empty here and rely on the picker runtime to
    // augment via a separate schema-fetch when the stepKey is resolved.
    //
    // args.stepKey is available for the runtime layer to use if it chooses
    // to perform a schema fetch after this call.
    void args;
    return [];
  },
};
