// WidgetGenSvelte — Svelte widget generation provider
// Produces Svelte components with <script lang="ts"> and exported props.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-svelte-${++idCounter}`; }

export const widgetGenSvelteHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:svelte';

    const existing = await storage.find('widget-gen-svelte', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-svelte', id, { id, providerRef, target: 'svelte' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'svelte',
      providerRef,
      instanceId: id,
    });

    return { variant: 'ok', instance: id };
  },

  async generate(input: Record<string, unknown>, storage: ConceptStorage) {
    const widgetAst = input.widgetAst as string;

    let ast: Record<string, unknown>;
    try {
      ast = JSON.parse(widgetAst);
    } catch {
      return { variant: 'error', message: 'Failed to parse widget AST as JSON' };
    }

    const componentName = (ast.name as string) || 'Widget';
    const props = (ast.props || []) as Array<{ name: string; type: string }>;
    const scriptProps = props.map(p => `  export let ${p.name}: ${p.type || 'any'};`).join('\n');

    const output = `<script lang="ts">\n${scriptProps}\n</script>\n\n<div>${componentName}</div>`;

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenSvelteCounter(): void { idCounter = 0; }
