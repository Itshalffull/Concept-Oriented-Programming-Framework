// WidgetGenInk — Ink (terminal UI) widget generation provider
// Produces TypeScript/JSX components using Box and Text from ink.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-ink-${++idCounter}`; }

export const widgetGenInkHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:ink';

    const existing = await storage.find('widget-gen-ink', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-ink', id, { id, providerRef, target: 'ink' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'ink',
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

    const output = `import { Box, Text } from 'ink';\n\nexport function ${componentName}({${props.map(p => p.name).join(', ')}}: {${propsSignature}}) {\n  return <Box><Text>${componentName}</Text></Box>;\n}`;

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenInkCounter(): void { idCounter = 0; }
