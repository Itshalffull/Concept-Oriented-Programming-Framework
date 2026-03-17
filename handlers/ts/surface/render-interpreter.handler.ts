import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

/**
 * RenderInterpreter handler — imperative (bootstrap).
 *
 * Discovers registered render-interpreter-provider plugins via the
 * plugin-registry and delegates interpretation to the matching target
 * provider. The interpreter itself has no knowledge of any specific
 * target — providers self-register via syncs.
 */
export const renderInterpreterHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const interpreter = input.interpreter as string;
    const target = input.target as string;

    const existing = await storage.get('interpreters', interpreter);
    if (existing) return { variant: 'exists' };

    await storage.put('interpreters', interpreter, { target });
    return { variant: 'ok', interpreter };
  },

  async execute(input: Record<string, unknown>, storage: ConceptStorage) {
    const interpreter = input.interpreter as string;
    const program = input.program as string;
    const snapshot = input.snapshot as string;

    const interp = await storage.get('interpreters', interpreter);
    if (!interp) return { variant: 'notfound' };

    const target = interp.target as string;

    // Discover provider from plugin-registry
    const providers = await storage.find('plugin-registry', { pluginKind: 'render-interpreter-provider' });
    const matchingProvider = providers.find(
      (p: Record<string, unknown>) => p.target === target,
    );

    if (!matchingProvider) {
      const registered = providers.map((p: Record<string, unknown>) => p.target as string).sort();
      return {
        variant: 'error',
        message: `No render-interpreter-provider registered for target "${target}". Registered: ${registered.join(', ') || '(none)'}`,
      };
    }

    // Delegate to the provider — return delegation record so the sync
    // engine routes to the actual provider's interpret action
    const executionId = `render-exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await storage.put('executions', executionId, {
      interpreterId: interpreter,
      target,
      program,
      snapshot,
      status: 'delegated',
      providerRef: matchingProvider.providerRef,
    });

    return {
      variant: 'ok',
      interpreter,
      executionId,
      delegateTo: {
        concept: `RenderInterpreter${capitalize(target)}`,
        action: 'interpret',
        input: { executionId, program, componentName: input.componentName || 'Widget' },
      },
    };
  },

  async dryRun(input: Record<string, unknown>, storage: ConceptStorage) {
    const interpreter = input.interpreter as string;
    const program = input.program as string;

    const interp = await storage.get('interpreters', interpreter);
    if (!interp) return { variant: 'notfound' };

    const target = interp.target as string;

    const providers = await storage.find('plugin-registry', { pluginKind: 'render-interpreter-provider' });
    const matchingProvider = providers.find(
      (p: Record<string, unknown>) => p.target === target,
    );

    if (!matchingProvider) {
      return { variant: 'error', message: `No provider for target "${target}"` };
    }

    return {
      variant: 'ok',
      interpreter,
      delegateTo: {
        concept: `RenderInterpreter${capitalize(target)}`,
        action: 'interpret',
        input: { program, componentName: input.componentName || 'Widget', dryRun: true },
      },
    };
  },

  async listTargets(_input: Record<string, unknown>, storage: ConceptStorage) {
    const providers = await storage.find('plugin-registry', { pluginKind: 'render-interpreter-provider' });
    const targets = providers.map((p: Record<string, unknown>) => p.target as string);
    return { variant: 'ok', targets: JSON.stringify(targets) };
  },
};

function capitalize(s: string): string {
  return s.replace(/(^|[-])(\w)/g, (_, __, c: string) => c.toUpperCase());
}
