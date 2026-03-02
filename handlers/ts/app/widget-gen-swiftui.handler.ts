// WidgetGenSwiftUI — SwiftUI widget generation provider
// Produces Swift View structs with typed properties.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-swiftui-${++idCounter}`; }

function toSwiftType(type: string): string {
  switch (type) {
    case 'string': return 'String';
    case 'number': return 'Int';
    case 'boolean': return 'Bool';
    default: return 'Any';
  }
}

export const widgetGenSwiftUIHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:swiftui';

    const existing = await storage.find('widget-gen-swiftui', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-swiftui', id, { id, providerRef, target: 'swiftui' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'swiftui',
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
    const swiftProps = props.map(p => `    var ${p.name}: ${toSwiftType(p.type)}`).join('\n');

    const output = `struct ${componentName}: View {\n${swiftProps}\n\n    var body: some View {\n        Text("${componentName}")\n    }\n}`;

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenSwiftUICounter(): void { idCounter = 0; }
