// WidgetGenFramework — Framework-agnostic TypeScript widget generation provider
// Produces plain class-based components with typed constructor props.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-framework-${++idCounter}`; }

export const widgetGenFrameworkHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:framework';

    const existing = await storage.find('widget-gen-framework', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-framework', id, { id, providerRef, target: 'framework' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'framework',
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
    const propsSignature = props.map(p => `${p.name}: ${p.type || 'any'}`).join('; ');
    const ctorAssignments = props.map(p => `    this.${p.name} = props.${p.name};`).join('\n');
    const fields = props.map(p => `  readonly ${p.name}: ${p.type || 'any'};`).join('\n');

    const propsInterface = props.length > 0
      ? `export interface ${componentName}Props {\n  ${propsSignature};\n}\n\n`
      : '';

    const output = `${propsInterface}export class ${componentName} {\n${fields}\n\n  constructor(${props.length > 0 ? `private props: ${componentName}Props` : ''}) {\n${ctorAssignments}\n  }\n\n  render(): string {\n    return '${componentName}';\n  }\n}`;

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenFrameworkCounter(): void { idCounter = 0; }
