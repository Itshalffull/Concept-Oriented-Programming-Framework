// ============================================================
// Playwright Widget Test Renderer
//
// Renders a WidgetTestPlan into a Playwright browser-level test file.
// Uses data-part selectors for framework-agnostic element targeting —
// tests are valid for any framework rendering the widget (React, Vue,
// Svelte, Web Components, etc.) as long as the output uses data-part
// attributes from the Surface connect spec.
//
// Test categories rendered:
//   - fsm_transitions: state machine correctness via data-state attributes
//   - keyboard_bindings: key press → state transition assertions
//   - focus_management: focus trap, initial focus, roving tabindex
//   - aria_assertions: role and ARIA attribute presence/values
//   - connect_bindings: data attribute binding correctness
//   - compose: composed child widget slot visibility
//   - props: prop propagation to connect bindings (skipped — need page context)
//   - invariants: structural descriptions (skipped — browser test cannot model)
//
// See Architecture doc Sections 7.1, 7.2
// ============================================================

import type { WidgetTestPlan, WidgetTestAssertion } from './widget-component-test-plan.handler.js';

// ── Helpers ───────────────────────────────────────────────────

/** Return a Playwright locator expression for a data-part selector */
function part(partName: string): string {
  return `page.locator('[data-part="${partName}"]')`;
}

/** Indent a block of lines by N spaces */
function indent(lines: string[], spaces: number): string[] {
  const pad = ' '.repeat(spaces);
  return lines.map(l => (l.trim() === '' ? '' : pad + l));
}

/** Wrap test lines in a Playwright test() block */
function testBlock(description: string, lines: string[]): string[] {
  return [
    `test(${JSON.stringify(description)}, async ({ page }) => {`,
    ...indent(lines, 2),
    `});`,
    '',
  ];
}

// ── FSM Transitions ───────────────────────────────────────────

function renderFsmTransitions(assertions: WidgetTestAssertion[], pageUrl: string): string[] {
  const lines: string[] = [];

  for (const a of assertions) {
    if (a.type === 'initial_state') {
      const stateName = a.stateName as string;
      lines.push(...testBlock(
        `renders in initial state '${stateName}'`,
        [
          `await page.goto(${JSON.stringify(pageUrl)});`,
          `await expect(${part('root')}).toHaveAttribute('data-state', ${JSON.stringify(stateName)});`,
        ],
      ));
    }

    if (a.type === 'transition') {
      const from = a.from as string;
      const event = a.event as string;
      const to = a.to as string;

      // Map common event names to Playwright interaction patterns
      const interactionLines = eventToInteraction(event);

      lines.push(...testBlock(
        `event '${event}' transitions from '${from}' to '${to}'`,
        [
          `await page.goto(${JSON.stringify(pageUrl)});`,
          // Set up the widget in the 'from' state if it is not the initial state
          ...(from !== 'initial' ? [
            `// Ensure widget is in state '${from}' before triggering event`,
            `// (widget should be navigated or seeded to state '${from}' at this URL)`,
          ] : []),
          `await expect(${part('root')}).toHaveAttribute('data-state', ${JSON.stringify(from)});`,
          ...interactionLines,
          `await expect(${part('root')}).toHaveAttribute('data-state', ${JSON.stringify(to)});`,
        ],
      ));
    }

    if (a.type === 'entry_action') {
      const stateName = a.stateName as string;
      const action = a.action as string;
      lines.push(...testBlock(
        `entering state '${stateName}' triggers entry action '${action}'`,
        [
          `await page.goto(${JSON.stringify(pageUrl)});`,
          `// Verify the widget reflects entry action '${action}' when in state '${stateName}'`,
          `// (implementation-specific — check relevant data-part attributes or visibility)`,
          `await expect(${part('root')}).toHaveAttribute('data-state', ${JSON.stringify(stateName)});`,
        ],
      ));
    }

    if (a.type === 'exit_action') {
      const stateName = a.stateName as string;
      const action = a.action as string;
      lines.push(...testBlock(
        `exiting state '${stateName}' triggers exit action '${action}'`,
        [
          `await page.goto(${JSON.stringify(pageUrl)});`,
          `// Verify exit action '${action}' fires when leaving state '${stateName}'`,
          `// (implementation-specific — check relevant side effects after transition)`,
        ],
      ));
    }

    if (a.type === 'unreachable_state') {
      const stateName = a.stateName as string;
      lines.push(...testBlock(
        `state '${stateName}' is reachable from the initial state`,
        [
          `await page.goto(${JSON.stringify(pageUrl)});`,
          `// Navigate to state '${stateName}' by following the required transition path`,
          `// then assert the widget reflects the state`,
          `await expect(${part('root')}).toHaveAttribute('data-state', ${JSON.stringify(stateName)});`,
        ],
      ));
    }
  }

  return lines;
}

/**
 * Map a widget event name to Playwright interaction lines.
 * Event names come from the widget's FSM transition definitions.
 */
function eventToInteraction(event: string): string[] {
  const lower = event.toLowerCase();

  if (lower === 'click' || lower === 'open' || lower === 'toggle' || lower === 'select') {
    return [`await ${part('trigger')}.click();`];
  }
  if (lower === 'close' || lower === 'dismiss' || lower === 'cancel') {
    return [`await ${part('close')}.click();`];
  }
  if (lower === 'focus' || lower === 'focusin') {
    return [`await ${part('trigger')}.focus();`];
  }
  if (lower === 'blur' || lower === 'focusout') {
    return [`await ${part('trigger')}.blur();`];
  }
  if (lower === 'submit') {
    return [`await ${part('trigger')}.click();`];
  }
  if (lower.startsWith('key') || lower.startsWith('press')) {
    // e.g., "keyEscape" → Escape, "pressEnter" → Enter
    const key = event.replace(/^(key|press)/i, '');
    return [`await ${part('root')}.press(${JSON.stringify(key)});`];
  }

  // Generic fallback: emit a comment + click on trigger
  return [
    `// Event '${event}': perform the corresponding interaction`,
    `await ${part('trigger')}.click();`,
  ];
}

// ── Keyboard Bindings ─────────────────────────────────────────

function renderKeyboardBindings(assertions: WidgetTestAssertion[], pageUrl: string): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const a of assertions) {
    const key = a.key as string;
    const event = a.event as string;
    const from = a.from as string | undefined;
    const to = a.to as string | undefined;

    if (from && to) {
      // Transition-specific keyboard assertion
      const testKey = `${key}:${from}->${to}`;
      if (seen.has(testKey)) continue;
      seen.add(testKey);

      lines.push(...testBlock(
        `pressing '${key}' in state '${from}' transitions to '${to}'`,
        [
          `await page.goto(${JSON.stringify(pageUrl)});`,
          `await expect(${part('root')}).toHaveAttribute('data-state', ${JSON.stringify(from)});`,
          `await ${part('root')}.press(${JSON.stringify(normalizeKey(key))});`,
          `await expect(${part('root')}).toHaveAttribute('data-state', ${JSON.stringify(to)});`,
        ],
      ));
    } else {
      // Generic key fires event assertion
      const testKey = `${key}:${event}`;
      if (seen.has(testKey)) continue;
      seen.add(testKey);

      lines.push(...testBlock(
        `pressing '${key}' fires event '${event}'`,
        [
          `await page.goto(${JSON.stringify(pageUrl)});`,
          `await ${part('root')}.press(${JSON.stringify(normalizeKey(key))});`,
          `// Verify widget responded to '${event}' event triggered by '${key}'`,
        ],
      ));
    }
  }

  return lines;
}

/**
 * Normalize key names from widget spec format to Playwright key names.
 * Playwright uses "Enter", "Escape", "ArrowDown", "Tab" etc.
 */
function normalizeKey(key: string): string {
  const map: Record<string, string> = {
    'Enter': 'Enter',
    'Return': 'Enter',
    'Escape': 'Escape',
    'Esc': 'Escape',
    'Tab': 'Tab',
    'Space': 'Space',
    ' ': 'Space',
    'ArrowUp': 'ArrowUp',
    'ArrowDown': 'ArrowDown',
    'ArrowLeft': 'ArrowLeft',
    'ArrowRight': 'ArrowRight',
    'Home': 'Home',
    'End': 'End',
    'PageUp': 'PageUp',
    'PageDown': 'PageDown',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
  };
  return map[key] ?? key;
}

// ── Focus Management ──────────────────────────────────────────

function renderFocusManagement(assertions: WidgetTestAssertion[], pageUrl: string): string[] {
  const lines: string[] = [];

  for (const a of assertions) {
    if (a.type === 'trap') {
      lines.push(...testBlock(
        'focus is trapped within the widget when active',
        [
          `await page.goto(${JSON.stringify(pageUrl)});`,
          `await ${part('trigger')}.click();`,
          `// Tab through all focusable elements — focus should not leave the widget`,
          `await page.keyboard.press('Tab');`,
          `const focused = await page.evaluate(() => document.activeElement?.closest('[data-part]')?.getAttribute('data-part'));`,
          `expect(focused).toBeTruthy();`,
        ],
      ));
    }

    if (a.type === 'initial') {
      const target = a.target as string;
      lines.push(...testBlock(
        `initial focus is set to '${target}'`,
        [
          `await page.goto(${JSON.stringify(pageUrl)});`,
          `await ${part('trigger')}.click();`,
          `await expect(${part(target)}).toBeFocused();`,
        ],
      ));
    }

    if (a.type === 'roving') {
      lines.push(...testBlock(
        'widget uses roving tabindex for focus management',
        [
          `await page.goto(${JSON.stringify(pageUrl)});`,
          `// Verify that exactly one item has tabindex="0" and others have tabindex="-1"`,
          `const tabindexZero = await page.locator('[data-part][tabindex="0"]').count();`,
          `const tabindexMinus = await page.locator('[data-part][tabindex="-1"]').count();`,
          `expect(tabindexZero).toBe(1);`,
          `expect(tabindexMinus).toBeGreaterThan(0);`,
        ],
      ));
    }

    if (a.type === 'returnOnClose') {
      lines.push(...testBlock(
        'focus returns to previously focused element when widget closes',
        [
          `await page.goto(${JSON.stringify(pageUrl)});`,
          `await ${part('trigger')}.focus();`,
          `await ${part('trigger')}.click();`,
          `await page.keyboard.press('Escape');`,
          `await expect(${part('trigger')}).toBeFocused();`,
        ],
      ));
    }
  }

  return lines;
}

// ── ARIA Assertions ───────────────────────────────────────────

function renderAriaAssertions(assertions: WidgetTestAssertion[], pageUrl: string): string[] {
  const lines: string[] = [];

  for (const a of assertions) {
    const partName = a.part as string;
    const attr = a.attr as string;
    const value = a.value as string;

    lines.push(...testBlock(
      `part '${partName}' has ${attr} '${value}'`,
      [
        `await page.goto(${JSON.stringify(pageUrl)});`,
        `await expect(${part(partName)}).toHaveAttribute(${JSON.stringify(attr)}, ${JSON.stringify(value)});`,
      ],
    ));
  }

  return lines;
}

// ── Connect Bindings ──────────────────────────────────────────

function renderConnectBindings(assertions: WidgetTestAssertion[], pageUrl: string): string[] {
  const lines: string[] = [];

  for (const a of assertions) {
    const partName = a.part as string;
    const attr = a.attr as string;
    const stateCondition = a.stateCondition as string | undefined;
    const expr = a.expr as string;

    if (stateCondition) {
      lines.push(...testBlock(
        `when state is '${stateCondition}', part '${partName}' has attribute '${attr}' = '${stateCondition}'`,
        [
          `await page.goto(${JSON.stringify(pageUrl)});`,
          `// Navigate widget to state '${stateCondition}' before asserting binding`,
          `await expect(${part('root')}).toHaveAttribute('data-state', ${JSON.stringify(stateCondition)});`,
          `await expect(${part(partName)}).toHaveAttribute(${JSON.stringify(attr)}, ${JSON.stringify(stateCondition)});`,
        ],
      ));
    } else {
      lines.push(...testBlock(
        `part '${partName}' has attribute '${attr}' bound to '${expr}'`,
        [
          `await page.goto(${JSON.stringify(pageUrl)});`,
          `await expect(${part(partName)}).toHaveAttribute(${JSON.stringify(attr)}, ${JSON.stringify(expr)});`,
        ],
      ));
    }
  }

  return lines;
}

// ── Compose ───────────────────────────────────────────────────

function renderCompose(assertions: WidgetTestAssertion[], pageUrl: string): string[] {
  const lines: string[] = [];

  for (const a of assertions) {
    const widget = a.widget as string;
    const slot = a.slot as string | null;

    if (slot) {
      lines.push(...testBlock(
        `composed widget '${widget}' renders in slot '${slot}'`,
        [
          `await page.goto(${JSON.stringify(pageUrl)});`,
          `await expect(${part(slot)}).toBeVisible();`,
        ],
      ));
    } else {
      lines.push(...testBlock(
        `composed widget '${widget}' renders within the widget`,
        [
          `await page.goto(${JSON.stringify(pageUrl)});`,
          `// Verify the composed '${widget}' widget is present somewhere in the widget tree`,
          `await expect(page.locator('[data-widget="${widget.toLowerCase()}"]').or(${part(widget.toLowerCase())})).toBeVisible();`,
        ],
      ));
    }
  }

  return lines;
}

// ── Main Renderer ─────────────────────────────────────────────

/**
 * Render a WidgetTestPlan into a Playwright test file string.
 *
 * Uses data-part selectors for framework-agnostic targeting:
 *   page.locator('[data-part="root"]')
 *
 * @param plan - The WidgetTestPlan produced by WidgetComponentTest/buildPlan
 * @param componentName - Human-readable component name for describe block labels
 * @param pageUrl - The URL Playwright should navigate to before each test group
 * @returns A complete Playwright test file as a string
 */
export function renderPlaywrightWidgetTests(
  plan: WidgetTestPlan,
  componentName: string,
  pageUrl: string,
): string {
  const sections: string[] = [];

  // ── fsm_transitions ─────────────────────────────────────────
  if (plan.fsm_transitions.length > 0) {
    const tests = renderFsmTransitions(plan.fsm_transitions, pageUrl);
    if (tests.length > 0) {
      sections.push(
        `  test.describe('FSM State Transitions', () => {`,
        ...indent(tests, 4),
        `  });`,
        '',
      );
    }
  }

  // ── keyboard_bindings ────────────────────────────────────────
  if (plan.keyboard_bindings.length > 0) {
    const tests = renderKeyboardBindings(plan.keyboard_bindings, pageUrl);
    if (tests.length > 0) {
      sections.push(
        `  test.describe('Keyboard Interactions', () => {`,
        ...indent(tests, 4),
        `  });`,
        '',
      );
    }
  }

  // ── focus_management ─────────────────────────────────────────
  if (plan.focus_management.length > 0) {
    const tests = renderFocusManagement(plan.focus_management, pageUrl);
    if (tests.length > 0) {
      sections.push(
        `  test.describe('Focus Management', () => {`,
        ...indent(tests, 4),
        `  });`,
        '',
      );
    }
  }

  // ── aria_assertions ──────────────────────────────────────────
  if (plan.aria_assertions.length > 0) {
    const tests = renderAriaAssertions(plan.aria_assertions, pageUrl);
    if (tests.length > 0) {
      sections.push(
        `  test.describe('ARIA Attributes', () => {`,
        ...indent(tests, 4),
        `  });`,
        '',
      );
    }
  }

  // ── connect_bindings ─────────────────────────────────────────
  if (plan.connect_bindings.length > 0) {
    const tests = renderConnectBindings(plan.connect_bindings, pageUrl);
    if (tests.length > 0) {
      sections.push(
        `  test.describe('Connect Bindings', () => {`,
        ...indent(tests, 4),
        `  });`,
        '',
      );
    }
  }

  // ── compose ──────────────────────────────────────────────────
  if (plan.compose.length > 0) {
    const tests = renderCompose(plan.compose, pageUrl);
    if (tests.length > 0) {
      sections.push(
        `  test.describe('Composed Widgets', () => {`,
        ...indent(tests, 4),
        `  });`,
        '',
      );
    }
  }

  // ── Assemble file ─────────────────────────────────────────────

  const fileLines: string[] = [
    `// Generated Playwright tests for ${componentName}`,
    `// Widget: ${plan.widgetName} (${plan.widgetRef})`,
    `// Generated at: ${plan.generatedAt}`,
    `//`,
    `// Uses data-part selectors for framework-agnostic element targeting.`,
    `// Every locator targets [data-part="<name>"] — valid for React, Vue,`,
    `// Svelte, Web Components, or any renderer that applies Surface connect specs.`,
    `//`,
    `// Run with: npx playwright test`,
    '',
    `import { test, expect } from '@playwright/test';`,
    '',
    `// Base URL for this widget's test page`,
    `const PAGE_URL = ${JSON.stringify(pageUrl)};`,
    '',
    `test.describe(${JSON.stringify(componentName)}, () => {`,
    ...sections,
    `});`,
    '',
  ];

  return fileLines.join('\n');
}
