// @migrated dsl-constructs 2026-03-18
// WidgetGenFramework — Framework-agnostic TypeScript widget generation provider
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, put, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string { return `widget-gen-framework-${++idCounter}`; }

const _widgetGenFrameworkHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId(); const providerRef = 'widget-gen-provider:framework';
    let p = createProgram();
    p = find(p, 'widget-gen-framework', { providerRef }, 'existing');
    p = mapBindings(p, (bindings) => {
      const existing = (bindings.existing as Array<Record<string, unknown>>) || [];
      return existing.length > 0 ? (existing[0] as Record<string, unknown>).id as string : null;
    }, 'existingId');
    // If existing, return it; otherwise create new
    p = put(p, 'widget-gen-framework', id, { id, providerRef, target: 'framework' });
    p = put(p, 'plugin-registry', `widget-gen-provider:${id}`, { id: `widget-gen-provider:${id}`, pluginKind: 'widget-gen-provider', target: 'framework', providerRef, instanceId: id });
    return complete(p, 'ok', { instance: id }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  generate(input: Record<string, unknown>) {
    const widgetAst = input.widgetAst as string;
    let ast: Record<string, unknown>;
    try { ast = JSON.parse(widgetAst); } catch { let p = createProgram(); return complete(p, 'error', { message: 'Failed to parse widget AST as JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    const componentName = (ast.name as string) || 'Widget';
    const props = (ast.props || []) as Array<{ name: string; type: string }>;
    const propsSignature = props.map(p => `${p.name}: ${p.type || 'any'}`).join('; ');
    const ctorAssignments = props.map(p => `    this.${p.name} = props.${p.name};`).join('\n');
    const fields = props.map(p => `  readonly ${p.name}: ${p.type || 'any'};`).join('\n');
    const propsInterface = props.length > 0 ? `export interface ${componentName}Props {\n  ${propsSignature};\n}\n\n` : '';
    const output = `${propsInterface}export class ${componentName} {\n${fields}\n\n  constructor(${props.length > 0 ? `private props: ${componentName}Props` : ''}) {\n${ctorAssignments}\n  }\n\n  render(): string {\n    return '${componentName}';\n  }\n}`;
    let p = createProgram();
    return complete(p, 'ok', { output }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const widgetGenFrameworkHandler = autoInterpret(_widgetGenFrameworkHandler);


export function resetWidgetGenFrameworkCounter(): void { idCounter = 0; }
