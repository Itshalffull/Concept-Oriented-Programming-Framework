// WidgetGen Concept Implementation [G]
// Generates framework-specific widget code from a widget AST.
// Delegates to registered widget-gen-provider plugins discovered
// via the plugin-registry, following the M+N compiler pattern.
import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

export const widgetGenHandler: ConceptHandler = {
  async generate(input, storage) {
    const gen = input.gen as string;
    const target = input.target as string;
    const widgetAst = input.widgetAst as string;

    // Discover registered widget-gen providers from plugin-registry
    const providers = await storage.find('plugin-registry', { pluginKind: 'widget-gen-provider' });
    const matchingProvider = providers.find(
      (p: Record<string, unknown>) => p.target === target,
    );

    if (!matchingProvider) {
      const registered = providers.map((p: Record<string, unknown>) => p.target as string).sort();
      return {
        variant: 'error',
        message: `No widget-gen-provider registered for target "${target}". Registered providers: ${registered.join(', ') || '(none)'}`,
      };
    }

    let ast: Record<string, unknown>;
    try {
      ast = JSON.parse(widgetAst);
    } catch {
      return { variant: 'error', message: 'Failed to parse widget AST as JSON' };
    }

    const id = gen || nextId('G');
    const componentName = (ast.name as string) || 'Widget';

    // Delegate to the matching provider's generate action
    const providerStorageKey = `widget-gen-${target}`;
    const providerInstances = await storage.find(providerStorageKey, { target });
    if (providerInstances.length === 0) {
      return { variant: 'error', message: `Provider "${target}" is registered but not initialized` };
    }

    // Store the delegation record
    await storage.put('widgetGen', id, {
      target,
      input: widgetAst,
      output: null,
      status: 'delegated',
      providerRef: matchingProvider.providerRef,
    });

    return {
      variant: 'ok',
      output: '',
      delegateTo: {
        concept: `WidgetGen${target.charAt(0).toUpperCase() + target.slice(1).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}`,
        action: 'generate',
        input: { gen: id, componentName, props: JSON.stringify(ast.props || []), widgetAst },
      },
    };
  },
};
