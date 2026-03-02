// WidgetGenWinUI — WinUI 3 widget generation provider
// Produces C# sealed partial UserControl classes for Windows desktop.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-winui-${++idCounter}`; }

function toCSharpType(type: string): string {
  switch (type) {
    case 'string': return 'string';
    case 'number': return 'double';
    case 'boolean': return 'bool';
    case 'int': case 'integer': return 'int';
    default: return 'object';
  }
}

export const widgetGenWinUIHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:winui';

    const existing = await storage.find('widget-gen-winui', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-winui', id, { id, providerRef, target: 'winui' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'winui',
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
    const fields = props.map(p => `        public ${toCSharpType(p.type)} ${p.name.charAt(0).toUpperCase() + p.name.slice(1)} { get; set; }`).join('\n');

    const output = `using Microsoft.UI.Xaml.Controls;\n\nnamespace Widgets\n{\n    public sealed partial class ${componentName} : UserControl\n    {\n${fields}\n\n        public ${componentName}()\n        {\n            this.InitializeComponent();\n        }\n    }\n}`;

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenWinUICounter(): void { idCounter = 0; }
