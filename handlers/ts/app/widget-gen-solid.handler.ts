// WidgetGenSolid — SolidJS widget generation provider
// Produces TypeScript/JSX Component exports with reactive props.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-solid-${++idCounter}`; }

export const widgetGenSolidHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:solid';

    const existing = await storage.find('widget-gen-solid', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-solid', id, { id, providerRef, target: 'solid' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'solid',
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

    const output = `import { Component } from 'solid-js';\n\nexport const ${componentName}: Component<{${propsSignature}}> = (props) => {\n  return <div>${componentName}</div>;\n};`;

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenSolidCounter(): void { idCounter = 0; }
