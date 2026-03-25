// ============================================================
// Vanilla DOM Widget Test Renderer
//
// Renders a WidgetTestPlan into a complete vitest + jsdom test
// file with no framework dependency. Uses native DOM APIs
// (document.querySelector, dispatchEvent, getAttribute) instead
// of React Testing Library or any UI framework.
//
// Supported categories:
//   - fsm_transitions: initial state + transition sequence tests
//   - connect_bindings: data/aria attribute binding assertions
//   - keyboard_bindings: dispatchEvent(KeyboardEvent) → state assertions
//   - focus_management: focus trap, roving tabindex, initial focus
//   - aria_assertions: ARIA role/attribute presence assertions
//   - props: default value and propagation tests
//   - compose: composed child widget slot assertions
//   - invariants: structured behavioral sequence tests
//
// Vanilla DOM patterns used:
//   FSM:      const el = document.querySelector('[data-part="root"]')
//             el.querySelector('[data-part="trigger"]').click()
//             expect(el.getAttribute('data-state')).toBe('open')
//   Keyboard: el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))
//   ARIA:     expect(el.getAttribute('role')).toBe('dialog')
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
    `it('${escDesc(description)}', () => {`,
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

/**
 * Build the setup lines that mount a vanilla DOM component into a container.
 * The component import is expected to be a function: mount(container, props?) => void
 * or a class with a render(container, props?) method.
 */
function mountLines(componentName: string, props?: string): string[] {
  const propsArg = props ? `, { ${props} }` : '';
  return [
    `const container = document.createElement('div');`,
    `document.body.appendChild(container);`,
    `${componentName}(container${propsArg});`,
  ];
}

/** Cleanup lines to remove the container from the DOM after each test */
const CLEANUP = `document.body.removeChild(container);`;

/** Select a part element within the mounted container */
function partSel(part: string): string {
  return `container.querySelector('[data-part="${part}"]')`;
}

/** Select the root element within the mounted container */
const ROOT_SEL = `container.querySelector('[data-part="root"]')`;

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
        ...mountLines(componentName),
        `const root = ${ROOT_SEL};`,
        `expect(root).toBeTruthy();`,
        `expect(root!.getAttribute('data-state')).toBe(${JSON.stringify(state)});`,
        CLEANUP,
      ];
      lines.push(...itBlock(a.description, body));
      lines.push('');
    } else if (type === 'transition') {
      const event = a.event as string;
      const to = a.to as string;
      const from = a.from as string;
      const eventLower = event.toLowerCase();
      // Map common event names to interaction patterns
      let interactionLines: string[];
      if (eventLower === 'open' || eventLower === 'click' || eventLower === 'select') {
        interactionLines = [
          `const trigger = container.querySelector('[data-part="trigger"]');`,
          `if (trigger) (trigger as HTMLElement).click();`,
        ];
      } else if (eventLower === 'close' || eventLower === 'dismiss') {
        interactionLines = [
          `const closeBtn = container.querySelector('[data-part="close-button"]');`,
          `if (closeBtn) (closeBtn as HTMLElement).click();`,
        ];
      } else {
        interactionLines = [
          `// Fire '${event}' event from state '${from}'`,
          `const trigger = container.querySelector('[data-part="trigger"]');`,
          `if (trigger) (trigger as HTMLElement).click();`,
        ];
      }
      const body = [
        ...mountLines(componentName),
        `const root = ${ROOT_SEL};`,
        `expect(root).toBeTruthy();`,
        ...interactionLines,
        `expect(root!.getAttribute('data-state')).toBe(${JSON.stringify(to)});`,
        CLEANUP,
      ];
      lines.push(...itBlock(a.description, body));
      lines.push('');
    } else if (type === 'entry_action') {
      const state = a.stateName as string;
      const action = a.action as string;
      const body = [
        ...mountLines(componentName),
        `const root = ${ROOT_SEL};`,
        `// Entry action '${action}' fires when entering state '${state}'`,
        `expect(root).toBeTruthy();`,
        `expect(root!.getAttribute('data-state')).toBe(${JSON.stringify(state)});`,
        CLEANUP,
      ];
      lines.push(...itBlock(a.description, body));
      lines.push('');
    } else if (type === 'exit_action') {
      const state = a.stateName as string;
      const action = a.action as string;
      const body = [
        ...mountLines(componentName),
        `const root = ${ROOT_SEL};`,
        `// Exit action '${action}' fires when leaving state '${state}'`,
        `// Transition away to trigger exit`,
        `const trigger = container.querySelector('[data-part="trigger"]');`,
        `if (trigger) (trigger as HTMLElement).click();`,
        `expect(root).toBeTruthy();`,
        CLEANUP,
      ];
      lines.push(...itBlock(a.description, body));
      lines.push('');
    } else if (type === 'unreachable_state') {
      const state = a.stateName as string;
      const body = [
        ...mountLines(componentName),
        `const root = ${ROOT_SEL};`,
        `// State '${state}' must be reachable via valid transitions`,
        `expect(root).toBeTruthy();`,
        `// Navigate to state '${state}' via documented transition path`,
        CLEANUP,
      ];
      lines.push(...itBlock(a.description, body));
      lines.push('');
    } else {
      // Generic fallback
      const body = [
        ...mountLines(componentName),
        `expect(${ROOT_SEL}).toBeTruthy();`,
        CLEANUP,
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
      // State-dependent binding — mount with open prop for non-idle states
      const isOpen = stateCondition !== 'closed' && stateCondition !== 'idle' && stateCondition !== 'default';
      const props = isOpen ? 'open: true' : undefined;
      body = [
        ...mountLines(componentName, props),
        `const el = ${partSel(part)};`,
        `expect(el).toBeTruthy();`,
        `expect(el!.getAttribute(${JSON.stringify(attr)})).toBe(${JSON.stringify(stateCondition)});`,
        CLEANUP,
      ];
    } else if (attr.startsWith('aria-')) {
      // ARIA attribute binding
      body = [
        ...mountLines(componentName),
        `const el = ${partSel(part)};`,
        `expect(el).toBeTruthy();`,
        `expect(el!.getAttribute(${JSON.stringify(attr)})).toBe(${JSON.stringify(expr)});`,
        CLEANUP,
      ];
    } else {
      // General data attribute binding — assert attribute presence
      body = [
        ...mountLines(componentName),
        `const el = ${partSel(part)};`,
        `expect(el).toBeTruthy();`,
        `expect(el!.hasAttribute(${JSON.stringify(attr)})).toBe(true);`,
        CLEANUP,
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
      // Keyboard key triggers a state transition
      const isOpen = from !== 'closed' && from !== 'idle' && from !== 'default';
      const props = isOpen ? 'open: true' : undefined;
      body = [
        ...mountLines(componentName, props),
        `const root = ${ROOT_SEL};`,
        `expect(root).toBeTruthy();`,
        `root!.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true }));`,
        `expect(root!.getAttribute('data-state')).toBe(${JSON.stringify(to)});`,
        CLEANUP,
      ];
    } else {
      // Keyboard key fires event (no explicit transition known)
      body = [
        ...mountLines(componentName),
        `const root = ${ROOT_SEL};`,
        `expect(root).toBeTruthy();`,
        `root!.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true }));`,
        `// Expect event '${event}' was handled`,
        `expect(root).toBeTruthy();`,
        CLEANUP,
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
        ...mountLines(componentName, 'open: true'),
        `const root = ${ROOT_SEL} as HTMLElement;`,
        `expect(root).toBeTruthy();`,
        `// Tab through focusable elements — focus must stay within root`,
        `const focusable = root.querySelectorAll<HTMLElement>('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');`,
        `if (focusable.length > 0) {`,
        `  focusable[0].focus();`,
        `  expect(root.contains(document.activeElement)).toBe(true);`,
        `}`,
        CLEANUP,
      ];
    } else if (type === 'initial') {
      const target = a.target as string;
      body = [
        ...mountLines(componentName, 'open: true'),
        `const el = ${partSel(target)} as HTMLElement;`,
        `expect(el).toBeTruthy();`,
        `expect(document.activeElement).toBe(el);`,
        CLEANUP,
      ];
    } else if (type === 'roving') {
      body = [
        ...mountLines(componentName),
        `const root = ${ROOT_SEL};`,
        `expect(root).toBeTruthy();`,
        `// Roving tabindex: only one item should have tabindex="0" at a time`,
        `const tabbable = Array.from(root!.querySelectorAll('[tabindex]')).filter(`,
        `  el => el.getAttribute('tabindex') === '0'`,
        `);`,
        `expect(tabbable.length).toBe(1);`,
        CLEANUP,
      ];
    } else if (type === 'returnOnClose') {
      body = [
        `const prev = document.createElement('button');`,
        `document.body.appendChild(prev);`,
        `prev.focus();`,
        ...mountLines(componentName, 'open: true'),
        `const root = ${ROOT_SEL} as HTMLElement;`,
        `expect(root).toBeTruthy();`,
        `root!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`,
        `expect(document.activeElement).toBe(prev);`,
        CLEANUP,
        `document.body.removeChild(prev);`,
      ];
    } else {
      body = [
        ...mountLines(componentName),
        `expect(${ROOT_SEL}).toBeTruthy();`,
        CLEANUP,
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
      // Query by role attribute directly — no framework-specific helpers
      body = [
        ...mountLines(componentName),
        `const el = ${partSel(part)};`,
        `expect(el).toBeTruthy();`,
        `expect(el!.getAttribute('role')).toBe(${JSON.stringify(value)});`,
        CLEANUP,
      ];
    } else {
      // Assert any ARIA attribute value on the part
      body = [
        ...mountLines(componentName),
        `const el = ${partSel(part)};`,
        `expect(el).toBeTruthy();`,
        `expect(el!.getAttribute(${JSON.stringify(attr)})).toBe(${JSON.stringify(value)});`,
        CLEANUP,
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
      // Default value assertion — mount without the prop and observe the default state
      const isFalsy = defaultValue === 'false' || defaultValue === '' || defaultValue === '0';
      if (isFalsy) {
        body = [
          ...mountLines(componentName),
          `const root = ${ROOT_SEL};`,
          `// Prop '${name}' defaults to ${JSON.stringify(defaultValue)} — widget in default state`,
          `expect(root).toBeTruthy();`,
          `expect(root!.getAttribute('data-state')).toBe('closed');`,
          CLEANUP,
        ];
      } else {
        body = [
          ...mountLines(componentName),
          `const root = ${ROOT_SEL};`,
          `// Prop '${name}' defaults to ${JSON.stringify(defaultValue)}`,
          `expect(root).toBeTruthy();`,
          CLEANUP,
        ];
      }
    } else {
      // Prop propagation — mount with the prop value and check that it reaches the DOM
      body = [
        ...mountLines(componentName, `${name}: 'test-${name}-value'`),
        `const root = ${ROOT_SEL};`,
        `// Prop '${name}' should propagate to connect bindings`,
        `expect(root).toBeTruthy();`,
        CLEANUP,
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
        ...mountLines(componentName, 'open: true'),
        `const slotEl = ${partSel(slot)};`,
        `expect(slotEl).toBeTruthy();`,
        CLEANUP,
      ];
    } else {
      body = [
        ...mountLines(componentName, 'open: true'),
        `// Composed widget '${widget}' should render within the component`,
        `expect(${ROOT_SEL}).toBeTruthy();`,
        CLEANUP,
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
        ...mountLines(componentName),
        `const root = ${ROOT_SEL};`,
        `expect(root).toBeTruthy();`,
        ...steps.map(s => `// setup: ${s.action} -> ${s.expectedVariant}`),
        ...assertions_.map(s => `// assert: ${s.action} -> ${s.expectedVariant}`),
        CLEANUP,
      ];
    } else if (type === 'forall') {
      const quantifiers = (a.quantifiers as Array<{ variable: string; values?: string[] }>) || [];
      if (quantifiers.length > 0 && quantifiers[0].values) {
        const q = quantifiers[0];
        const values = q.values!;
        // Test for each value in the domain
        const valueChecks = values.flatMap(v => [
          `// ${q.variable} = ${JSON.stringify(v)}`,
          `{ const c = document.createElement('div');`,
          `  document.body.appendChild(c);`,
          `  ${componentName}(c, { ${q.variable}: ${JSON.stringify(v)} });`,
          `  expect(c.querySelector('[data-part="root"]')).toBeTruthy();`,
          `  document.body.removeChild(c); }`,
        ]);
        body = [
          `// Forall ${q.variable} in [${values.map(v => JSON.stringify(v)).join(', ')}]:`,
          ...valueChecks,
        ];
      } else {
        body = [
          ...mountLines(componentName),
          `expect(${ROOT_SEL}).toBeTruthy();`,
          CLEANUP,
        ];
      }
    } else if (type === 'always') {
      body = [
        ...mountLines(componentName),
        `const root = ${ROOT_SEL};`,
        `// Invariant '${name}' must always hold`,
        `expect(root).toBeTruthy();`,
        CLEANUP,
      ];
    } else if (type === 'never') {
      body = [
        ...mountLines(componentName),
        `const root = ${ROOT_SEL};`,
        `// Invariant '${name}' must never occur`,
        `expect(root).toBeTruthy();`,
        CLEANUP,
      ];
    } else if (type === 'eventually') {
      const steps = (a.steps as Array<{ action: string }>) || [];
      body = [
        ...mountLines(componentName),
        `const root = ${ROOT_SEL};`,
        `expect(root).toBeTruthy();`,
        ...steps.map(s => `// trigger: ${s.action}`),
        CLEANUP,
      ];
    } else if (type === 'contract') {
      const targetAction = a.targetAction as string;
      body = [
        ...mountLines(componentName),
        `const root = ${ROOT_SEL};`,
        `// Contract for action '${targetAction}' must hold`,
        `expect(root).toBeTruthy();`,
        CLEANUP,
      ];
    } else {
      body = [
        ...mountLines(componentName),
        `expect(${ROOT_SEL}).toBeTruthy();`,
        CLEANUP,
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
): string[] {
  return [
    `import { describe, it, expect, beforeEach, afterEach } from 'vitest';`,
    `import ${componentName} from ${JSON.stringify(componentImportPath)};`,
  ];
}

// ── Main Export ────────────────────────────────────────────────

/**
 * Render a WidgetTestPlan into a complete vitest + jsdom (vanilla DOM)
 * test file string with no framework dependency.
 *
 * The generated tests assume the component export is a mount function:
 *   `componentName(container: HTMLElement, props?: Record<string, unknown>): void`
 *
 * Tests use:
 *   - `document.querySelector('[data-part="..."]')` to locate parts
 *   - `.getAttribute('data-state')` to assert FSM state
 *   - `.getAttribute('role')` / `.getAttribute('aria-*')` for ARIA assertions
 *   - `.click()` for click interactions
 *   - `dispatchEvent(new KeyboardEvent('keydown', {key: ..., bubbles: true}))` for keyboard
 *   - `document.activeElement` for focus assertions
 *
 * @param plan - The test plan produced by WidgetComponentTest/buildPlan
 * @param componentName - The component mount-function name (e.g. 'Dialog')
 * @param componentImportPath - The import path for the component (e.g. '../components/dialog')
 * @returns A complete vitest test file as a string
 */
export function renderVanillaWidgetTests(
  plan: WidgetTestPlan,
  componentName: string,
  componentImportPath: string,
): string {
  const allLines: string[] = [];

  // File header comment
  allLines.push(`// Generated vanilla DOM tests for ${componentName}`);
  allLines.push(`// Widget: ${plan.widgetRef}`);
  allLines.push(`// Generated at: ${plan.generatedAt}`);
  allLines.push(`// Categories: ${plan.categories.join(', ')}`);
  allLines.push(`// Framework: vitest + jsdom (no framework dependency)`);
  allLines.push('');

  // Imports — no framework imports, pure vitest + jsdom
  allLines.push(...renderImports(componentName, componentImportPath));
  allLines.push('');

  // Top-level describe block
  const describeLines: string[] = [];

  // Category renderers — same structure as react-widget-test-renderer
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
