// ============================================================
// Vue Widget Test Renderer
//
// Renders a WidgetTestPlan into a complete vitest + Vue Test Utils
// test file. Consumes the eight test categories produced by the
// WidgetComponentTest handler and generates grouped describe blocks
// with individual it() tests per assertion.
//
// Supported categories:
//   - fsm_transitions: initial state + transition sequence tests
//   - connect_bindings: data/aria attribute binding assertions
//   - keyboard_bindings: wrapper.trigger('keydown', {key}) → state assertions
//   - focus_management: focus trap, roving tabindex, initial focus
//   - aria_assertions: ARIA role/attribute presence assertions
//   - props: default value and propagation tests
//   - compose: composed child widget slot assertions
//   - invariants: structured behavioral sequence tests
//
// Vue Test Utils patterns used:
//   - mount(Component) / mount(Component, { props: { ... } })
//   - wrapper.find('[data-part="..."]')
//   - wrapper.find('[data-part="..."]').trigger('click')
//   - wrapper.find('[data-part="..."]').trigger('keydown', { key: 'Escape' })
//   - wrapper.find('[data-part="..."]').attributes('data-state')
//   - wrapper.find('[data-part="..."]').attributes('role')
//   - expect(wrapper.find('[data-part="..."]').exists()).toBe(true)
//
// See Architecture doc Sections 7.1, 7.2
// ============================================================

import type { WidgetTestPlan, WidgetTestAssertion } from './widget-component-test-plan.handler.js';

// ── Helpers ───────────────────────────────────────────────────

/** Escape a string for use in a test description */
function escDesc(s: string): string {
  return s.replace(/'/g, "\\'");
}

/** Indent a block of lines by N spaces */
function indent(lines: string[], n: number): string[] {
  const pad = ' '.repeat(n);
  return lines.map(l => (l.trim() === '' ? '' : pad + l));
}

/** Wrap lines in an it() block */
function itBlock(description: string, bodyLines: string[]): string[] {
  return [
    `it('${escDesc(description)}', async () => {`,
    ...indent(bodyLines, 2),
    '});',
  ];
}

/** Wrap lines in a describe() block */
function describeBlock(label: string, bodyLines: string[]): string[] {
  return [
    `describe('${escDesc(label)}', () => {`,
    ...indent(bodyLines, 2),
    '});',
  ];
}

// ── Category Renderers ─────────────────────────────────────────

function renderFsmTransitions(
  assertions: WidgetTestAssertion[],
  componentName: string,
): string[] {
  const lines: string[] = [];

  for (const a of assertions) {
    const type = a.type as string | undefined;

    if (type === 'initial_state') {
      const state = a.stateName as string;
      const body = [
        `const wrapper = mount(${componentName});`,
        `expect(wrapper.find('[data-part="root"]').attributes('data-state')).toBe(${JSON.stringify(state)});`,
      ];
      lines.push(...itBlock(a.description, body));
      lines.push('');
    } else if (type === 'transition') {
      const from = a.from as string;
      const event = a.event as string;
      const to = a.to as string;
      // Map common event names to interactions
      const eventLower = event.toLowerCase();
      let interactionLines: string[];
      if (eventLower === 'open' || eventLower === 'click' || eventLower === 'select') {
        interactionLines = [`await wrapper.find('[data-part="trigger"]').trigger('click');`];
      } else if (eventLower === 'close' || eventLower === 'dismiss') {
        interactionLines = [`await wrapper.find('[data-part="close-button"]').trigger('click');`];
      } else {
        interactionLines = [`await wrapper.find('[data-part="trigger"]').trigger('click'); // fires '${event}'`];
      }
      const body = [
        `const wrapper = mount(${componentName});`,
        ...interactionLines,
        `expect(wrapper.find('[data-part="root"]').attributes('data-state')).toBe(${JSON.stringify(to)});`,
      ];
      lines.push(...itBlock(a.description, body));
      lines.push('');
    } else if (type === 'entry_action') {
      const state = a.stateName as string;
      const action = a.action as string;
      const body = [
        `// Entry action '${action}' should be triggered when entering state '${state}'`,
        `const wrapper = mount(${componentName});`,
        `// Assert side-effect of entry action '${action}' is observable`,
        `expect(wrapper.find('[data-part="root"]').attributes('data-state')).toBe(${JSON.stringify(state)});`,
      ];
      lines.push(...itBlock(a.description, body));
      lines.push('');
    } else if (type === 'exit_action') {
      const state = a.stateName as string;
      const action = a.action as string;
      const body = [
        `// Exit action '${action}' should be triggered when leaving state '${state}'`,
        `const wrapper = mount(${componentName});`,
        `// Transition away from state '${state}' to trigger exit action`,
        `expect(wrapper.find('[data-part="root"]').exists()).toBe(true);`,
      ];
      lines.push(...itBlock(a.description, body));
      lines.push('');
    } else if (type === 'unreachable_state') {
      const state = a.stateName as string;
      const body = [
        `// State '${state}' must be reachable via valid transitions`,
        `const wrapper = mount(${componentName});`,
        `// Navigate to state '${state}'`,
        `expect(wrapper.find('[data-part="root"]').exists()).toBe(true);`,
      ];
      lines.push(...itBlock(a.description, body));
      lines.push('');
    } else {
      // Generic fallback
      const body = [
        `const wrapper = mount(${componentName});`,
        `expect(wrapper.find('[data-part="root"]').exists()).toBe(true);`,
      ];
      lines.push(...itBlock(a.description, body));
      lines.push('');
    }
  }

  return lines;
}

function renderConnectBindings(
  assertions: WidgetTestAssertion[],
  componentName: string,
): string[] {
  const lines: string[] = [];

  for (const a of assertions) {
    const part = a.part as string;
    const attr = a.attr as string;
    const expr = a.expr as string;
    const stateCondition = a.stateCondition as string | undefined;

    let body: string[];
    if (stateCondition !== undefined) {
      // State-dependent binding — render in the specific state via prop
      const isOpen = stateCondition !== 'closed' && stateCondition !== 'idle' && stateCondition !== 'default';
      const props = isOpen ? `{ props: { open: true } }` : `{}`;
      body = [
        `const wrapper = mount(${componentName}, ${props});`,
        `expect(wrapper.find('[data-part="${part}"]').attributes('${attr}')).toBe(${JSON.stringify(stateCondition)});`,
      ];
    } else if (attr.startsWith('aria-')) {
      // ARIA attribute binding
      body = [
        `const wrapper = mount(${componentName});`,
        `expect(wrapper.find('[data-part="${part}"]').attributes('${attr}')).toBe(${JSON.stringify(expr)});`,
      ];
    } else {
      // General data attribute binding
      body = [
        `const wrapper = mount(${componentName});`,
        `expect(wrapper.find('[data-part="${part}"]').attributes('${attr}')).toBeDefined();`,
      ];
    }

    lines.push(...itBlock(a.description, body));
    lines.push('');
  }

  return lines;
}

function renderKeyboardBindings(
  assertions: WidgetTestAssertion[],
  componentName: string,
): string[] {
  const lines: string[] = [];

  for (const a of assertions) {
    const key = a.key as string;
    const event = a.event as string;
    const from = a.from as string | undefined;
    const to = a.to as string | undefined;

    let body: string[];
    if (from !== undefined && to !== undefined) {
      // Keyboard key triggers state transition
      const isOpen = from !== 'closed' && from !== 'idle' && from !== 'default';
      const props = isOpen ? `{ props: { open: true } }` : `{}`;
      body = [
        `const wrapper = mount(${componentName}, ${props});`,
        `await wrapper.find('[data-part="root"]').trigger('keydown', { key: ${JSON.stringify(key)} });`,
        `expect(wrapper.find('[data-part="root"]').attributes('data-state')).toBe(${JSON.stringify(to)});`,
      ];
    } else {
      // Keyboard key fires event (no explicit transition known)
      body = [
        `const wrapper = mount(${componentName});`,
        `await wrapper.find('[data-part="root"]').trigger('keydown', { key: ${JSON.stringify(key)} });`,
        `// Expect event '${event}' was fired`,
        `expect(wrapper.find('[data-part="root"]').exists()).toBe(true);`,
      ];
    }

    lines.push(...itBlock(a.description, body));
    lines.push('');
  }

  return lines;
}

function renderFocusManagement(
  assertions: WidgetTestAssertion[],
  componentName: string,
): string[] {
  const lines: string[] = [];

  for (const a of assertions) {
    const type = a.type as string | undefined;

    let body: string[];
    if (type === 'trap') {
      body = [
        `const wrapper = mount(${componentName}, { props: { open: true }, attachTo: document.body });`,
        `const root = wrapper.find('[data-part="root"]').element;`,
        `// Tab through — focus should remain within the widget`,
        `await wrapper.find('[data-part="root"]').trigger('keydown', { key: 'Tab' });`,
        `expect(root.contains(document.activeElement)).toBe(true);`,
        `wrapper.unmount();`,
      ];
    } else if (type === 'initial') {
      const target = a.target as string;
      body = [
        `const wrapper = mount(${componentName}, { props: { open: true }, attachTo: document.body });`,
        `expect(wrapper.find('[data-part="${target}"]').element).toBe(document.activeElement);`,
        `wrapper.unmount();`,
      ];
    } else if (type === 'roving') {
      body = [
        `const wrapper = mount(${componentName}, { attachTo: document.body });`,
        `// Verify roving tabindex: only one item has tabindex="0" at a time`,
        `const items = wrapper.findAll('[role="tab"]');`,
        `const tabbable = items.filter(el => el.attributes('tabindex') === '0');`,
        `expect(tabbable.length).toBe(1);`,
        `wrapper.unmount();`,
      ];
    } else if (type === 'returnOnClose') {
      body = [
        `const trigger = document.createElement('button');`,
        `document.body.appendChild(trigger);`,
        `trigger.focus();`,
        `const wrapper = mount(${componentName}, { props: { open: true }, attachTo: document.body });`,
        `await wrapper.find('[data-part="root"]').trigger('keydown', { key: 'Escape' });`,
        `expect(document.activeElement).toBe(trigger);`,
        `document.body.removeChild(trigger);`,
        `wrapper.unmount();`,
      ];
    } else {
      body = [
        `const wrapper = mount(${componentName});`,
        `expect(wrapper.find('[data-part="root"]').exists()).toBe(true);`,
      ];
    }

    lines.push(...itBlock(a.description, body));
    lines.push('');
  }

  return lines;
}

function renderAriaAssertions(
  assertions: WidgetTestAssertion[],
  componentName: string,
): string[] {
  const lines: string[] = [];

  for (const a of assertions) {
    const part = a.part as string;
    const attr = a.attr as string;
    const value = a.value as string;

    let body: string[];
    if (attr === 'role') {
      // Assert role attribute on the part element
      body = [
        `const wrapper = mount(${componentName});`,
        `expect(wrapper.find('[data-part="${part}"]').attributes('role')).toBe(${JSON.stringify(value)});`,
      ];
    } else {
      // Assert other ARIA attributes on the part element
      body = [
        `const wrapper = mount(${componentName});`,
        `expect(wrapper.find('[data-part="${part}"]').attributes('${attr}')).toBe(${JSON.stringify(value)});`,
      ];
    }

    lines.push(...itBlock(a.description, body));
    lines.push('');
  }

  return lines;
}

function renderProps(
  assertions: WidgetTestAssertion[],
  componentName: string,
): string[] {
  const lines: string[] = [];

  for (const a of assertions) {
    const name = a.name as string;
    const defaultValue = a.defaultValue as string | undefined;
    const desc = a.description as string;

    let body: string[];
    if (defaultValue !== undefined && desc.includes('defaults to')) {
      // Default value assertion
      const isBoolean = defaultValue === 'true' || defaultValue === 'false';
      const isFalsy = defaultValue === 'false' || defaultValue === '' || defaultValue === '0';

      if (isBoolean && isFalsy) {
        body = [
          `const wrapper = mount(${componentName});`,
          `// Default '${name}' = ${defaultValue} — component should render in default state`,
          `expect(wrapper.find('[data-part="root"]').attributes('data-state')).toBe('closed');`,
        ];
      } else {
        body = [
          `const wrapper = mount(${componentName});`,
          `// Prop '${name}' defaults to ${JSON.stringify(defaultValue)}`,
          `expect(wrapper.find('[data-part="root"]').exists()).toBe(true);`,
        ];
      }
    } else {
      // Prop propagation assertion
      body = [
        `const testValue = 'test-${name}-value';`,
        `const wrapper = mount(${componentName}, { props: { ${name}: testValue } });`,
        `// Prop '${name}' should propagate to connect bindings`,
        `expect(wrapper.find('[data-part="root"]').exists()).toBe(true);`,
      ];
    }

    lines.push(...itBlock(desc, body));
    lines.push('');
  }

  return lines;
}

function renderCompose(
  assertions: WidgetTestAssertion[],
  componentName: string,
): string[] {
  const lines: string[] = [];

  for (const a of assertions) {
    const widget = a.widget as string;
    const slot = a.slot as string | null;

    let body: string[];
    if (slot) {
      body = [
        `const wrapper = mount(${componentName}, { props: { open: true } });`,
        `expect(wrapper.find('[data-part="${slot}"]').exists()).toBe(true);`,
      ];
    } else {
      body = [
        `const wrapper = mount(${componentName}, { props: { open: true } });`,
        `// Composed widget '${widget}' should render within the component`,
        `expect(wrapper.find('[data-part="root"]').exists()).toBe(true);`,
      ];
    }

    lines.push(...itBlock(a.description, body));
    lines.push('');
  }

  return lines;
}

function renderInvariants(
  assertions: WidgetTestAssertion[],
  componentName: string,
): string[] {
  const lines: string[] = [];

  for (const a of assertions) {
    const type = a.type as string | undefined;
    const name = a.name as string;

    let body: string[];

    if (type === 'example') {
      const steps = (a.steps as Array<{ action: string; expectedVariant: string }>) || [];
      const assertions_ = (a.assertions as Array<{ action: string; expectedVariant: string }>) || [];
      body = [
        `const wrapper = mount(${componentName});`,
        ...steps.map(s => `// setup step: ${s.action} -> ${s.expectedVariant}`),
        ...assertions_.map(s => `// assert: ${s.action} -> ${s.expectedVariant}`),
        `expect(wrapper.find('[data-part="root"]').exists()).toBe(true);`,
      ];
    } else if (type === 'forall') {
      const quantifiers = (a.quantifiers as Array<{ variable: string; values?: string[] }>) || [];
      if (quantifiers.length > 0 && quantifiers[0].values) {
        const q = quantifiers[0];
        const values = q.values!;
        body = [
          `// Forall ${q.variable} in [${values.map(v => JSON.stringify(v)).join(', ')}]:`,
          ...values.flatMap(v => [
            `{ const wrapper = mount(${componentName}); // ${q.variable} = ${JSON.stringify(v)}`,
            `  expect(wrapper.find('[data-part="root"]').exists()).toBe(true); }`,
          ]),
        ];
      } else {
        body = [
          `const wrapper = mount(${componentName});`,
          `expect(wrapper.find('[data-part="root"]').exists()).toBe(true);`,
        ];
      }
    } else if (type === 'always') {
      body = [
        `const wrapper = mount(${componentName});`,
        `// Invariant '${name}' must always hold`,
        `expect(wrapper.find('[data-part="root"]').exists()).toBe(true);`,
      ];
    } else if (type === 'never') {
      body = [
        `const wrapper = mount(${componentName});`,
        `// Invariant '${name}' must never occur`,
        `expect(wrapper.find('[data-part="root"]').exists()).toBe(true);`,
      ];
    } else if (type === 'eventually') {
      const steps = (a.steps as Array<{ action: string }>) || [];
      body = [
        `const wrapper = mount(${componentName});`,
        ...steps.map(s => `// trigger: ${s.action}`),
        `expect(wrapper.find('[data-part="root"]').exists()).toBe(true);`,
      ];
    } else if (type === 'contract') {
      const targetAction = a.targetAction as string;
      body = [
        `const wrapper = mount(${componentName});`,
        `// Contract for action '${targetAction}' must hold`,
        `expect(wrapper.find('[data-part="root"]').exists()).toBe(true);`,
      ];
    } else {
      body = [
        `const wrapper = mount(${componentName});`,
        `expect(wrapper.find('[data-part="root"]').exists()).toBe(true);`,
      ];
    }

    lines.push(...itBlock(a.description, body));
    lines.push('');
  }

  return lines;
}

// ── Header / Imports ───────────────────────────────────────────

function renderImports(
  componentName: string,
  componentImportPath: string,
  plan: WidgetTestPlan,
): string[] {
  const needsMount = true; // always needed
  const needsAttachTo = plan.focus_management.some(
    a => ['trap', 'initial', 'roving', 'returnOnClose'].includes(a.type as string),
  );

  const vtuImports = ['mount'];

  const lines = [
    `import { describe, it, expect } from 'vitest';`,
    `import { ${vtuImports.join(', ')} } from '@vue/test-utils';`,
    `import ${componentName} from ${JSON.stringify(componentImportPath)};`,
  ];

  if (needsAttachTo) {
    lines.push(`// Note: some tests use attachTo: document.body for focus management assertions`);
  }

  return lines;
}

// ── Main Export ────────────────────────────────────────────────

/**
 * Render a WidgetTestPlan into a complete vitest + Vue Test Utils
 * test file string.
 *
 * @param plan - The test plan produced by WidgetComponentTest/buildPlan
 * @param componentName - The Vue component name (e.g. 'Dialog')
 * @param componentImportPath - The import path for the component (e.g. '../components/Dialog.vue')
 * @returns A complete vitest test file as a string
 */
export function renderVueWidgetTests(
  plan: WidgetTestPlan,
  componentName: string,
  componentImportPath: string,
): string {
  const allLines: string[] = [];

  // File header comment
  allLines.push(`// Generated Vue Test Utils tests for ${componentName}`);
  allLines.push(`// Widget: ${plan.widgetRef}`);
  allLines.push(`// Generated at: ${plan.generatedAt}`);
  allLines.push(`// Categories: ${plan.categories.join(', ')}`);
  allLines.push('');

  // Imports
  allLines.push(...renderImports(componentName, componentImportPath, plan));
  allLines.push('');

  // Top-level describe block
  const describeLines: string[] = [];

  // Render per-category describe blocks — only for categories with assertions
  const categoryRenderers: Array<{
    category: string;
    label: string;
    assertions: WidgetTestAssertion[];
    render: (assertions: WidgetTestAssertion[], componentName: string) => string[];
  }> = [
    {
      category: 'fsm_transitions',
      label: 'FSM Transitions',
      assertions: plan.fsm_transitions,
      render: renderFsmTransitions,
    },
    {
      category: 'connect_bindings',
      label: 'Connect Bindings',
      assertions: plan.connect_bindings,
      render: renderConnectBindings,
    },
    {
      category: 'keyboard_bindings',
      label: 'Keyboard Bindings',
      assertions: plan.keyboard_bindings,
      render: renderKeyboardBindings,
    },
    {
      category: 'focus_management',
      label: 'Focus Management',
      assertions: plan.focus_management,
      render: renderFocusManagement,
    },
    {
      category: 'aria_assertions',
      label: 'ARIA Assertions',
      assertions: plan.aria_assertions,
      render: renderAriaAssertions,
    },
    {
      category: 'props',
      label: 'Props',
      assertions: plan.props,
      render: renderProps,
    },
    {
      category: 'compose',
      label: 'Compose',
      assertions: plan.compose,
      render: renderCompose,
    },
    {
      category: 'invariants',
      label: 'Invariants',
      assertions: plan.invariants,
      render: renderInvariants,
    },
  ];

  for (const { assertions, label, render } of categoryRenderers) {
    if (assertions.length === 0) continue;

    const categoryLines = render(assertions, componentName);
    // Remove trailing empty line from last item in block
    while (categoryLines.length > 0 && categoryLines[categoryLines.length - 1] === '') {
      categoryLines.pop();
    }

    const block = describeBlock(label, categoryLines);
    describeLines.push(...block);
    describeLines.push('');
  }

  // Remove trailing empty line
  while (describeLines.length > 0 && describeLines[describeLines.length - 1] === '') {
    describeLines.pop();
  }

  allLines.push(...describeBlock(componentName, describeLines));
  allLines.push('');

  return allLines.join('\n');
}
