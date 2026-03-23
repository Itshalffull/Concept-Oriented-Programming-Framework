// @clef-handler style=functional concept=SurfaceComponentScaffoldGen
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SurfaceComponentScaffoldGen — Clef Surface component scaffold generator
// See Clef Surface architecture: surface-component suite
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function normalizeList(val: unknown): any[] {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object' && (val as any).type === 'list') {
    return ((val as any).items || []).map((i: any) => i.value !== undefined ? i.value : i);
  }
  return [];
}
function toKebab(name: string): string { return name.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase(); }
function toPascal(name: string): string { return name.split(/[-_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''); }

interface ComponentConfig { name: string; parts: string[]; slots?: string[]; states?: string[]; events?: string[]; a11y?: { role?: string; ariaProps?: string[] }; }

function buildWidgetSpec(config: ComponentConfig): string {
  const parts = config.parts.length > 0 ? config.parts : ['root', 'trigger', 'content'];
  const states = config.states || ['idle', 'active'];
  const events = config.events || ['open', 'close'];
  const role = config.a11y?.role || 'widget';
  const lines: string[] = [];
  lines.push(`widget ${toPascal(config.name)} {`, '  purpose {', `    TODO: Describe what the ${toPascal(config.name)} widget does.`, '  }', '');
  lines.push('  anatomy {'); for (const p of parts) lines.push(`    part ${p}: container { The ${p} part of the widget. }`); lines.push('  }', '');
  lines.push('  states {'); for (let i = 0; i < states.length; i++) { const s = states[i]!; lines.push(`    state ${s}${i === 0 ? ' [initial]' : ''} {`); for (const e of events) { const target = states.find(st => st !== s) || states[0]!; lines.push(`      on ${e} -> ${target};`); } lines.push('    }'); } lines.push('  }', '');
  lines.push('  accessibility {', `    role: ${role};`, '    keyboard {', '      Enter -> ACTIVATE;', '      Escape -> CLOSE;', '    }', '    focus {', `      trap: false; initial: ${parts[0]}; roving: false`, '    }', '  }', '');
  lines.push('  props {', '    disabled: Bool (default: false)', '    readOnly: Bool (default: false)', '  }', '');
  lines.push('  connect {'); for (const p of parts) lines.push(`    ${p} -> { data-part: "${p}"; data-state: context.state; }`); lines.push('  }', '}', '');
  return lines.join('\n');
}

function buildAnatomyConcept(config: ComponentConfig): string {
  const name = toPascal(config.name);
  const parts = config.parts.length > 0 ? config.parts : ['root', 'trigger', 'content'];
  const slots = config.slots || [];
  return [`# ${name} Anatomy`, '#', '# Named parts contract between behavior and rendering.', '', `anatomy ${name} {`, '  parts {', ...parts.map(p => `    ${p}: "The ${p} part of ${name.toLowerCase()}."`), '  }', '', ...(slots.length > 0 ? ['  slots {', ...slots.map(s => `    ${s}: "Slot for custom ${s} content."`), '  }'] : []), '}', ''].join('\n');
}

function buildComponentSuiteYaml(config: ComponentConfig): string {
  const name = toPascal(config.name);
  const kebab = toKebab(config.name);
  return ['suite:', `  name: surface-${kebab}`, '  version: 0.1.0', '  description: >', `    Headless ${name} component.`, '', 'concepts:', `  ${name}Widget:`, `    spec: ./${kebab}-widget.concept`, '    params:', `      W: { as: ${kebab}-widget-ref }`, '', 'syncs:', '  required: []', '  recommended: []', '', 'dependencies:', '  - surface-core: ">=0.1.0"', '  - surface-component: ">=0.1.0"', ''].join('\n');
}

function buildMachineImpl(config: ComponentConfig): string {
  const name = toPascal(config.name);
  const states = config.states || ['idle', 'active'];
  const parts = config.parts.length > 0 ? config.parts : ['root', 'trigger', 'content'];
  const stateEnum = states.map(s => `'${s}'`).join(' | ');
  const partsList = parts.map(p => `'${p}'`).join(', ');
  return [
    `// ${name} Machine — state machine implementation`, '',
    "import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';", '',
    `export class ${name}Machine {`,
    `  private state: ${stateEnum} = '${states[0]}';`,
    `  private parts: string[] = [${partsList}];`, '',
    '  async register(): Promise<void> {',
    `    // Register ${name} machine in the component registry`,
    '  }', '',
    '  async spawn(id: string): Promise<void> {',
    `    // Create a new ${name} instance`,
    `    this.state = '${states[0]}';`,
    '  }', '',
    '  async send(event: string): Promise<void> {',
    `    // Process event and transition state`,
    '  }', '',
    '  async connect(part: string, element: unknown): Promise<void> {',
    `    // Connect a DOM element to a part`,
    '  }',
    '}', '',
  ].join('\n');
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'SurfaceComponentScaffoldGen', inputKind: 'ComponentConfig', outputKind: 'SurfaceComponent', capabilities: JSON.stringify(['widget', 'anatomy', 'machine', 'slots', 'accessibility', 'affordance', 'props', 'compose']) }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const name = (input.name as string) || 'MyComponent';
    if (!name || typeof name !== 'string') { const p = createProgram(); return complete(p, 'error', { message: 'Component name is required' }) as StorageProgram<Result>; }
    try {
      const kebab = toKebab(name);
      const config: ComponentConfig = { name, parts: normalizeList(input.parts).length > 0 ? normalizeList(input.parts) : ['root', 'trigger', 'content'], slots: normalizeList(input.slots), states: normalizeList(input.states).length > 0 ? normalizeList(input.states) : ['idle', 'active'], events: normalizeList(input.events).length > 0 ? normalizeList(input.events) : ['open', 'close'], a11y: input.a11y as ComponentConfig['a11y'] };
      const files = [
        { path: `surface-${kebab}/${kebab}-widget.stub.concept`, content: buildWidgetSpec(config) },
        { path: `surface-${kebab}/${kebab}-anatomy.stub.concept`, content: buildAnatomyConcept(config) },
        { path: `surface-${kebab}/suite.stub.yaml`, content: buildComponentSuiteYaml(config) },
        { path: `surface-${kebab}/${kebab}-machine.stub.handler.ts`, content: buildMachineImpl(config) },
      ];
      const p = createProgram();
      return complete(p, 'ok', { files, filesGenerated: files.length }) as StorageProgram<Result>;
    } catch (err: unknown) { const message = err instanceof Error ? err.message : String(err); const p = createProgram(); return complete(p, 'error', { message }) as StorageProgram<Result>; }
  },

  preview(input: Record<string, unknown>) { return _handler.generate(input); },
};

export const surfaceComponentScaffoldGenHandler = autoInterpret(_handler);
