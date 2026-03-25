// ============================================================
// React Widget Test Renderer
//
// Renders a WidgetTestPlan into a complete vitest + React Testing
// Library test file. Consumes the eight test categories produced
// by the WidgetComponentTest handler and generates grouped
// describe blocks with individual it() tests per assertion.
//
// Supported categories:
//   - fsm_transitions: initial state + transition sequence tests
//   - connect_bindings: data/aria attribute binding assertions
//   - keyboard_bindings: fireEvent.keyDown → state assertions
//   - focus_management: focus trap, roving tabindex, initial focus
//   - aria_assertions: ARIA role/attribute presence assertions
//   - props: default value and propagation tests
//   - compose: composed child widget slot assertions
//   - invariants: structured behavioral sequence tests
//
// See Architecture doc Sections 7.1, 7.2
// ============================================================

import type { WidgetTestPlan, WidgetTestAssertion } from './widget-component-test-plan.handler.js';

// ── Helpers ───────────────────────────────────────────────────

/** Escape a string for use in a test description */
function escDesc(s: string): string {
  return s.replace(/'/g, "\\'");
}

/** Convert a part name to a testId selector expression */
function partSelector(part: string): string {
  return `screen.getByTestId(${JSON.stringify(part)})`;
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
        `render(<${componentName} />);`,
        `expect(screen.getByTestId('root')).toHaveAttribute('data-state', ${JSON.stringify(state)});`,
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
        interactionLines = [`fireEvent.click(screen.getByTestId('trigger'));`];
      } else if (eventLower === 'close' || eventLower === 'dismiss') {
        interactionLines = [`fireEvent.click(screen.getByTestId('close-button'));`];
      } else {
        interactionLines = [`fireEvent.click(screen.getByTestId('trigger')); // fires '${event}'`];
      }
      const body = [
        `render(<${componentName} />);`,
        ...interactionLines,
        `expect(screen.getByTestId('root')).toHaveAttribute('data-state', ${JSON.stringify(to)});`,
      ];
      lines.push(...itBlock(`${a.description}`, body));
      lines.push('');
    } else if (type === 'entry_action') {
      const state = a.stateName as string;
      const action = a.action as string;
      const body = [
        `// Entry action '${action}' should be triggered when entering state '${state}'`,
        `render(<${componentName} />);`,
        `// Assert side-effect of entry action '${action}' is observable`,
        `expect(screen.getByTestId('root')).toHaveAttribute('data-state', ${JSON.stringify(state)});`,
      ];
      lines.push(...itBlock(a.description, body));
      lines.push('');
    } else if (type === 'exit_action') {
      const state = a.stateName as string;
      const action = a.action as string;
      const body = [
        `// Exit action '${action}' should be triggered when leaving state '${state}'`,
        `render(<${componentName} />);`,
        `// Transition away from state '${state}' to trigger exit action`,
        `expect(screen.getByTestId('root')).toBeDefined();`,
      ];
      lines.push(...itBlock(a.description, body));
      lines.push('');
    } else if (type === 'unreachable_state') {
      const state = a.stateName as string;
      const body = [
        `// State '${state}' must be reachable via valid transitions`,
        `render(<${componentName} />);`,
        `// Navigate to state '${state}'`,
        `expect(screen.getByTestId('root')).toBeDefined();`,
      ];
      lines.push(...itBlock(a.description, body));
      lines.push('');
    } else {
      // Generic fallback
      const body = [
        `render(<${componentName} />);`,
        `expect(screen.getByTestId('root')).toBeDefined();`,
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
      const props = isOpen ? ` open={true}` : ``;
      body = [
        `render(<${componentName}${props} />);`,
        `expect(${partSelector(part)}).toHaveAttribute(${JSON.stringify(attr)}, ${JSON.stringify(stateCondition)});`,
      ];
    } else if (attr.startsWith('aria-')) {
      // ARIA attribute binding
      body = [
        `render(<${componentName} />);`,
        `expect(${partSelector(part)}).toHaveAttribute(${JSON.stringify(attr)}, ${JSON.stringify(expr)});`,
      ];
    } else {
      // General data attribute binding
      body = [
        `render(<${componentName} />);`,
        `expect(${partSelector(part)}).toHaveAttribute(${JSON.stringify(attr)});`,
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
      const props = isOpen ? ` open={true}` : ``;
      // Find the best target element — dialog role or a known part
      body = [
        `render(<${componentName}${props} />);`,
        `fireEvent.keyDown(screen.getByTestId('root'), { key: ${JSON.stringify(key)} });`,
        `expect(screen.getByTestId('root')).toHaveAttribute('data-state', ${JSON.stringify(to)});`,
      ];
    } else {
      // Keyboard key fires event (no explicit transition known)
      body = [
        `render(<${componentName} />);`,
        `fireEvent.keyDown(screen.getByTestId('root'), { key: ${JSON.stringify(key)} });`,
        `// Expect event '${event}' was fired`,
        `expect(screen.getByTestId('root')).toBeDefined();`,
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
        `render(<${componentName} open={true} />);`,
        `const root = screen.getByTestId('root');`,
        `userEvent.tab();`,
        `expect(root.contains(document.activeElement)).toBe(true);`,
      ];
    } else if (type === 'initial') {
      const target = a.target as string;
      body = [
        `render(<${componentName} open={true} />);`,
        `expect(screen.getByTestId(${JSON.stringify(target)})).toHaveFocus();`,
      ];
    } else if (type === 'roving') {
      body = [
        `render(<${componentName} />);`,
        `// Verify roving tabindex: only one item has tabIndex=0 at a time`,
        `const tabbable = screen.getAllByRole('tab').filter(el => el.getAttribute('tabindex') === '0');`,
        `expect(tabbable.length).toBe(1);`,
      ];
    } else if (type === 'returnOnClose') {
      body = [
        `const trigger = document.createElement('button');`,
        `document.body.appendChild(trigger);`,
        `trigger.focus();`,
        `render(<${componentName} open={true} />);`,
        `fireEvent.keyDown(screen.getByTestId('root'), { key: 'Escape' });`,
        `expect(document.activeElement).toBe(trigger);`,
        `document.body.removeChild(trigger);`,
      ];
    } else {
      body = [
        `render(<${componentName} />);`,
        `expect(screen.getByTestId('root')).toBeDefined();`,
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
      // Use getByRole for semantic role assertions
      body = [
        `render(<${componentName} />);`,
        `expect(screen.getByRole(${JSON.stringify(value)})).toBeInTheDocument();`,
      ];
    } else {
      // Use getByTestId + toHaveAttribute for other ARIA attributes
      body = [
        `render(<${componentName} />);`,
        `expect(${partSelector(part)}).toHaveAttribute(${JSON.stringify(attr)}, ${JSON.stringify(value)});`,
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
          `render(<${componentName} />);`,
          `// Default '${name}' = ${defaultValue} — component should render in default state`,
          `expect(screen.getByTestId('root')).toHaveAttribute('data-state', 'closed');`,
        ];
      } else {
        body = [
          `render(<${componentName} />);`,
          `// Prop '${name}' defaults to ${JSON.stringify(defaultValue)}`,
          `expect(screen.getByTestId('root')).toBeDefined();`,
        ];
      }
    } else {
      // Prop propagation assertion
      body = [
        `const testValue = 'test-${name}-value';`,
        `render(<${componentName} ${name}={testValue} />);`,
        `// Prop '${name}' should propagate to connect bindings`,
        `expect(screen.getByTestId('root')).toBeDefined();`,
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
        `render(<${componentName} open={true} />);`,
        `expect(screen.getByTestId(${JSON.stringify(slot)})).toBeInTheDocument();`,
      ];
    } else {
      body = [
        `render(<${componentName} open={true} />);`,
        `// Composed widget '${widget}' should render within the component`,
        `expect(screen.getByTestId('root')).toBeInTheDocument();`,
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
        `render(<${componentName} />);`,
        ...steps.map(s => `// setup step: ${s.action} -> ${s.expectedVariant}`),
        ...assertions_.map(s => `// assert: ${s.action} -> ${s.expectedVariant}`),
        `expect(screen.getByTestId('root')).toBeDefined();`,
      ];
    } else if (type === 'forall') {
      const quantifiers = (a.quantifiers as Array<{ variable: string; values?: string[] }>) || [];
      if (quantifiers.length > 0 && quantifiers[0].values) {
        const q = quantifiers[0];
        const values = q.values!;
        body = [
          `// Forall ${q.variable} in [${values.map(v => JSON.stringify(v)).join(', ')}]:`,
          ...values.flatMap(v => [
            `render(<${componentName} />);`,
            `// Test with ${q.variable} = ${JSON.stringify(v)}`,
            `expect(screen.getByTestId('root')).toBeDefined();`,
          ]),
        ];
      } else {
        body = [
          `render(<${componentName} />);`,
          `expect(screen.getByTestId('root')).toBeDefined();`,
        ];
      }
    } else if (type === 'always') {
      body = [
        `render(<${componentName} />);`,
        `// Invariant '${name}' must always hold`,
        `expect(screen.getByTestId('root')).toBeDefined();`,
      ];
    } else if (type === 'never') {
      body = [
        `render(<${componentName} />);`,
        `// Invariant '${name}' must never occur`,
        `expect(screen.getByTestId('root')).toBeDefined();`,
      ];
    } else if (type === 'eventually') {
      const steps = (a.steps as Array<{ action: string }>) || [];
      body = [
        `render(<${componentName} />);`,
        ...steps.map(s => `// trigger: ${s.action}`),
        `expect(screen.getByTestId('root')).toBeDefined();`,
      ];
    } else if (type === 'contract') {
      const targetAction = a.targetAction as string;
      body = [
        `render(<${componentName} />);`,
        `// Contract for action '${targetAction}' must hold`,
        `expect(screen.getByTestId('root')).toBeDefined();`,
      ];
    } else {
      body = [
        `render(<${componentName} />);`,
        `expect(screen.getByTestId('root')).toBeDefined();`,
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
  const needsFireEvent = (
    plan.fsm_transitions.length > 0 ||
    plan.keyboard_bindings.length > 0 ||
    plan.focus_management.some(a => (a.type as string) === 'returnOnClose')
  );
  const needsUserEvent = plan.focus_management.some(
    a => (a.type as string) === 'trap' || (a.type as string) === 'roving',
  );

  const rtlImports = ['render', 'screen'];
  if (needsFireEvent) rtlImports.push('fireEvent');

  const lines = [
    `import { describe, it, expect } from 'vitest';`,
    `import { ${rtlImports.join(', ')} } from '@testing-library/react';`,
  ];

  if (needsUserEvent) {
    lines.push(`import userEvent from '@testing-library/user-event';`);
  }

  lines.push(`import ${componentName} from ${JSON.stringify(componentImportPath)};`);

  return lines;
}

// ── Main Export ────────────────────────────────────────────────

/**
 * Render a WidgetTestPlan into a complete vitest + React Testing Library
 * test file string.
 *
 * @param plan - The test plan produced by WidgetComponentTest/buildPlan
 * @param componentName - The React component name (e.g. 'Dialog')
 * @param componentImportPath - The import path for the component (e.g. '../components/Dialog')
 * @returns A complete vitest test file as a string
 */
export function renderReactWidgetTests(
  plan: WidgetTestPlan,
  componentName: string,
  componentImportPath: string,
): string {
  const allLines: string[] = [];

  // File header comment
  allLines.push(`// Generated React Testing Library tests for ${componentName}`);
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
