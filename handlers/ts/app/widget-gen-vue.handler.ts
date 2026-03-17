// WidgetGenVue — Vue 3 Single File Components with <script setup>
// Uses the RenderProgram pipeline: parses widget AST -> builds instructions -> interprets to vue code.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';
import { buildRenderProgram } from '../../ts/surface/render-program-builder.js';
import { interpretVue } from '../../ts/surface/interpreter-targets/vue.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-vue-${++idCounter}`; }

function astToManifest(ast: Record<string, unknown>): Record<string, unknown> {
  const props = ((ast.props || []) as Array<Record<string, unknown>>).map(p => ({
    name: p.name as string,
    type: p.type as string || 'string',
    defaultValue: p.defaultValue as string || p.default as string || '',
  }));

  const anatomy = ((ast.anatomy || ast.parts || []) as Array<Record<string, unknown>>).map(function mapPart(p: Record<string, unknown>): Record<string, unknown> {
    return {
      name: p.name as string || p.part as string,
      role: p.role as string || 'container',
      children: ((p.children || []) as Array<Record<string, unknown>>).map(mapPart),
    };
  });

  // If no anatomy but we have a name, create a root part
  if (anatomy.length === 0) {
    anatomy.push({ name: 'root', role: 'container', children: [] });
  }

  const states = ((ast.states || []) as Array<Record<string, unknown>>).map(s => ({
    name: s.name as string,
    initial: s.initial as boolean || false,
    transitions: ((s.transitions || []) as Array<Record<string, unknown>>).map(t => ({
      event: t.event as string,
      target: t.target as string,
    })),
  }));

  const accessibility = ast.accessibility as Record<string, unknown> || {};

  return {
    name: ast.name as string || 'Widget',
    props,
    anatomy,
    states,
    accessibility: {
      role: accessibility.role as string || null,
      keyboard: (accessibility.keyboard || []) as Array<Record<string, unknown>>,
      focus: accessibility.focus as Record<string, unknown> || {},
      ariaBindings: accessibility.ariaBindings as Array<Record<string, unknown>> || [],
      ariaAttrs: accessibility.ariaAttrs as Array<Record<string, unknown>> || [],
    },
    connect: ast.connect as Array<Record<string, unknown>> || [],
    composedWidgets: ast.composedWidgets as string[] || [],
    invariants: ast.invariants as string[] || [],
  };
}

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

    // Build a WidgetManifest-compatible structure and produce RenderProgram instructions
    const manifest = astToManifest(ast);
    const built = buildRenderProgram(manifest as any);

    // Interpret instructions into vue code
    const { output, trace } = interpretVue(built.instructions, componentName);

    return { variant: 'ok', output, parts: built.parts, props: built.props, trace: JSON.stringify(trace) };
  },
};

export function resetWidgetGenVueCounter(): void { idCounter = 0; }
