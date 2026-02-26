// ============================================================
// SurfaceComponentScaffoldGen — Clef Surface component scaffold generator
//
// Generates headless component scaffolds including widget spec,
// anatomy definition, machine behavior, and slot composition.
// Follows the Zag.js/Ark UI pattern: behavior and rendering
// agree on part names, nothing else.
//
// See Clef Surface architecture:
//   - surface-component suite: Widget, Machine, Anatomy, Slot concepts
//   - surface-core suite: Signal, Binding, UISchema concepts
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toPascal(name: string): string {
  return name
    .split(/[-_\s]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

interface ComponentConfig {
  name: string;
  parts: string[];
  slots?: string[];
  states?: string[];
  events?: string[];
  a11y?: {
    role?: string;
    ariaProps?: string[];
  };
}

function buildWidgetConcept(config: ComponentConfig): string {
  const name = toPascal(config.name);
  const parts = config.parts.length > 0 ? config.parts : ['root', 'trigger', 'content'];
  const states = config.states || ['idle', 'active'];
  const events = config.events || ['open', 'close'];

  return [
    `# ${name} Widget Specification`,
    '#',
    `# Headless ${name.toLowerCase()} component — behavioral spec without rendering.`,
    `# Parts: ${parts.join(', ')}`,
    `# States: ${states.join(', ')}`,
    '',
    `widget ${name} {`,
    '  anatomy {',
    ...parts.map(p => `    part ${p}`),
    '  }',
    '',
    '  machine {',
    `    initial: ${states[0]}`,
    '',
    ...states.map(s => [
      `    state ${s} {`,
      ...events.map(e => {
        const target = states.find(st => st !== s) || states[0];
        return `      on ${e} -> ${target}`;
      }),
      '    }',
    ]).flat(),
    '  }',
    '',
    '  config {',
    `    # Default configuration for ${name}`,
    '    disabled: false',
    '    readOnly: false',
    '  }',
    '',
    '  connect {',
    ...parts.map(p => [
      `    ${p}Props {`,
      `      data-part: "${p}"`,
      `      data-state: context.state`,
      '    }',
    ]).flat(),
    '  }',
    '',
    ...(config.a11y ? [
      '  accessibility {',
      `    role: "${config.a11y.role || 'widget'}"`,
      ...(config.a11y.ariaProps || []).map(a => `    ${a}`),
      '  }',
    ] : [
      '  accessibility {',
      '    role: "widget"',
      '  }',
    ]),
    '}',
    '',
  ].join('\n');
}

function buildAnatomyConcept(config: ComponentConfig): string {
  const name = toPascal(config.name);
  const parts = config.parts.length > 0 ? config.parts : ['root', 'trigger', 'content'];
  const slots = config.slots || [];

  return [
    `# ${name} Anatomy`,
    '#',
    '# Named parts contract between behavior and rendering.',
    '',
    `anatomy ${name} {`,
    '  parts {',
    ...parts.map(p => `    ${p}: "The ${p} part of ${name.toLowerCase()}."`),
    '  }',
    '',
    ...(slots.length > 0 ? [
      '  slots {',
      ...slots.map(s => `    ${s}: "Slot for custom ${s} content."`),
      '  }',
    ] : []),
    '}',
    '',
  ].join('\n');
}

function buildComponentKitYaml(config: ComponentConfig): string {
  const name = toPascal(config.name);
  const kebab = toKebab(config.name);

  return [
    'kit:',
    `  name: surface-${kebab}`,
    '  version: 0.1.0',
    '  description: >',
    `    Headless ${name} component — behavioral state machine`,
    '    and anatomy definition.',
    '',
    'concepts:',
    `  ${name}Widget:`,
    `    spec: ./${kebab}-widget.concept`,
    '    params:',
    `      W: { as: ${kebab}-widget-ref }`,
    '',
    `  ${name}Anatomy:`,
    `    spec: ./${kebab}-anatomy.concept`,
    '    params:',
    `      A: { as: ${kebab}-anatomy-ref }`,
    '',
    'syncs:',
    '  required: []',
    '  recommended: []',
    '',
    'dependencies:',
    '  - surface-core: ">=0.1.0"',
    '  - surface-component: ">=0.1.0"',
    '',
  ].join('\n');
}

function buildMachineImpl(config: ComponentConfig): string {
  const name = toPascal(config.name);
  const states = config.states || ['idle', 'active'];
  const events = config.events || ['open', 'close'];
  const parts = config.parts.length > 0 ? config.parts : ['root', 'trigger', 'content'];

  return [
    '// ============================================================',
    `// ${name} Machine — state machine implementation`,
    '//',
    `// Finite state machine for the ${name} headless component.`,
    '// ============================================================',
    '',
    "import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';",
    '',
    `interface ${name}Context {`,
    `  state: ${states.map(s => `'${s}'`).join(' | ')};`,
    '  disabled: boolean;',
    '  readOnly: boolean;',
    '}',
    '',
    `const TRANSITIONS: Record<string, Record<string, string>> = {`,
    ...states.map(s => {
      const transitions = events.map(e => {
        const target = states.find(st => st !== s) || states[0];
        return `    ${e}: '${target}'`;
      });
      return `  ${s}: {\n${transitions.join(',\n')}\n  },`;
    }),
    '};',
    '',
    `export const ${toKebab(name).replace(/-/g, '')}MachineHandler: ConceptHandler = {`,
    '  async register() {',
    '    return {',
    "      variant: 'ok',",
    `      name: '${name}Machine',`,
    "      inputKind: 'WidgetSpec',",
    `      outputKind: '${name}Props',`,
    `      capabilities: JSON.stringify(${JSON.stringify(parts)}),`,
    '    };',
    '  },',
    '',
    '  async spawn(input: Record<string, unknown>, storage: ConceptStorage) {',
    '    const id = (input.id as string) || crypto.randomUUID();',
    `    const context: ${name}Context = {`,
    `      state: '${states[0]}',`,
    '      disabled: (input.disabled as boolean) ?? false,',
    '      readOnly: (input.readOnly as boolean) ?? false,',
    '    };',
    `    await storage.put('machines', id, { id, component: '${name}', ...context });`,
    "    return { variant: 'ok', machineId: id, context };",
    '  },',
    '',
    '  async send(input: Record<string, unknown>, storage: ConceptStorage) {',
    '    const id = input.machineId as string;',
    '    const event = input.event as string;',
    "    const machine = await storage.get('machines', id);",
    "    if (!machine) return { variant: 'error', message: `Machine ${id} not found` };",
    '',
    '    const currentState = machine.state as string;',
    '    const nextState = TRANSITIONS[currentState]?.[event];',
    "    if (!nextState) return { variant: 'error', message: `No transition for ${event} in state ${currentState}` };",
    '',
    "    await storage.put('machines', id, { ...machine, state: nextState });",
    "    return { variant: 'ok', previousState: currentState, state: nextState };",
    '  },',
    '',
    '  async connect(input: Record<string, unknown>, storage: ConceptStorage) {',
    '    const id = input.machineId as string;',
    "    const machine = await storage.get('machines', id);",
    "    if (!machine) return { variant: 'error', message: `Machine ${id} not found` };",
    '',
    '    const props: Record<string, Record<string, unknown>> = {};',
    ...parts.map(p => [
      `    props.${p} = {`,
      `      'data-part': '${p}',`,
      "      'data-state': machine.state,",
      '    };',
    ]).flat(),
    '',
    "    return { variant: 'ok', props };",
    '  },',
    '',
    '  async destroy(input: Record<string, unknown>, storage: ConceptStorage) {',
    '    const id = input.machineId as string;',
    "    await storage.del('machines', id);",
    "    return { variant: 'ok' };",
    '  },',
    '};',
    '',
  ].join('\n');
}

export const surfaceComponentScaffoldGenHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'SurfaceComponentScaffoldGen',
      inputKind: 'ComponentConfig',
      outputKind: 'SurfaceComponent',
      capabilities: JSON.stringify(['widget', 'anatomy', 'machine', 'slots']),
    };
  },

  async generate(input: Record<string, unknown>, _storage: ConceptStorage) {
    const name = (input.name as string) || 'MyComponent';

    if (!name || typeof name !== 'string') {
      return { variant: 'error', message: 'Component name is required' };
    }

    try {
      const kebab = toKebab(name);
      const config: ComponentConfig = {
        name,
        parts: (input.parts as string[]) || ['root', 'trigger', 'content'],
        slots: (input.slots as string[]) || [],
        states: (input.states as string[]) || ['idle', 'active'],
        events: (input.events as string[]) || ['open', 'close'],
        a11y: input.a11y as ComponentConfig['a11y'],
      };

      const files: { path: string; content: string }[] = [
        { path: `surface-${kebab}/${kebab}-widget.concept`, content: buildWidgetConcept(config) },
        { path: `surface-${kebab}/${kebab}-anatomy.concept`, content: buildAnatomyConcept(config) },
        { path: `surface-${kebab}/suite.yaml`, content: buildComponentKitYaml(config) },
        { path: `surface-${kebab}/${kebab}-machine.handler.ts`, content: buildMachineImpl(config) },
      ];

      return { variant: 'ok', files, filesGenerated: files.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },

  async preview(input: Record<string, unknown>, storage: ConceptStorage) {
    const result = await surfaceComponentScaffoldGenHandler.generate!(input, storage);
    if (result.variant === 'error') return result;
    const files = result.files as Array<{ path: string; content: string }>;
    return {
      variant: 'ok',
      files,
      wouldWrite: files.length,
      wouldSkip: 0,
    };
  },
};
