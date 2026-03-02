// WidgetGenVue — Vue widget generation provider
// Produces Vue Single File Components with <template> and <script setup>.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-vue-${++idCounter}`; }

export const widgetGenVueHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:vue';

    const existing = await storage.find('widget-gen-vue', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-vue', id, { id, providerRef, target: 'vue' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'vue',
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
    const propsSignature = props.map(p => `${p.name}: ${p.type || 'any'}`).join(', ');

    const output = `<template>\n  <div>${componentName}</div>\n</template>\n\n<script setup lang="ts">\ndefineProps<{${propsSignature}}>();\n</script>`;

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenVueCounter(): void { idCounter = 0; }
