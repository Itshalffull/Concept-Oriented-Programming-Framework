// WidgetGenNextjs — Next.js widget generation provider
// Produces TypeScript/JSX client components with 'use client' directive.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-nextjs-${++idCounter}`; }

export const widgetGenNextjsHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:nextjs';

    const existing = await storage.find('widget-gen-nextjs', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-nextjs', id, { id, providerRef, target: 'nextjs' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'nextjs',
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

    const propsType = props.length > 0
      ? `interface ${componentName}Props {\n${props.map(p => `  ${p.name}: ${p.type || 'any'};`).join('\n')}\n}\n\n`
      : '';

    const output = `'use client';\n\n${propsType}export function ${componentName}(${props.length > 0 ? `props: ${componentName}Props` : ''}) {\n  return <div>${componentName}</div>;\n}`;

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenNextjsCounter(): void { idCounter = 0; }
