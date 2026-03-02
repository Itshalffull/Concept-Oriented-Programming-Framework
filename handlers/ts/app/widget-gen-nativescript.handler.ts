// WidgetGenNativeScript — NativeScript widget generation provider
// Produces TypeScript View subclasses with createNativeView lifecycle methods.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-nativescript-${++idCounter}`; }

export const widgetGenNativeScriptHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:nativescript';

    const existing = await storage.find('widget-gen-nativescript', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-nativescript', id, { id, providerRef, target: 'nativescript' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'nativescript',
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
    const fields = props.map(p => `  ${p.name}: ${p.type || 'any'};`).join('\n');
    const ctorAssignments = props.map(p => `    this.${p.name} = ${p.name};`).join('\n');
    const ctorParams = props.map(p => `${p.name}: ${p.type || 'any'}`).join(', ');

    const output = `import { View } from '@nativescript/core';\n\nexport class ${componentName} extends View {\n${fields}\n\n  constructor(${ctorParams}) {\n    super();\n${ctorAssignments}\n  }\n\n  createNativeView(): Object {\n    return super.createNativeView();\n  }\n\n  disposeNativeView(): void {\n    super.disposeNativeView();\n  }\n}`;

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenNativeScriptCounter(): void { idCounter = 0; }
