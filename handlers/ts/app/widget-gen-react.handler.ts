// WidgetGenReact — React widget generation provider
// Produces TypeScript/JSX functional components with typed props interfaces.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-react-${++idCounter}`; }

export const widgetGenReactHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:react';

    const existing = await storage.find('widget-gen-react', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-react', id, { id, providerRef, target: 'react' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'react',
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
      ? `interface ${componentName}Props {\n${props.map(p => `  ${p.name}: ${p.type || 'any'};`).join('\n')}\n}`
      : '';

    const output = `${propsType}\n\nexport function ${componentName}(${props.length > 0 ? `props: ${componentName}Props` : ''}) {\n  return <div>${componentName}</div>;\n}`;

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenReactCounter(): void { idCounter = 0; }
