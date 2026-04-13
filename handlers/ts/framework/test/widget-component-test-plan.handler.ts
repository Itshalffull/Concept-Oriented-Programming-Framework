// ============================================================
// WidgetComponentTest Concept Handler — Functional Style
//
// Builds language-neutral test plans from parsed widget specs
// (.widget files), analogous to how TestGen builds test plans
// from concept specs. Extracts eight test categories:
//   - fsm_transitions: state machine correctness
//   - connect_bindings: data/ARIA attribute binding assertions
//   - keyboard_bindings: key → event → state transition assertions
//   - focus_management: trap, roving tabindex, initial focus, returnOnClose
//   - aria_assertions: per-part ARIA attribute presence and values
//   - props: default values and propagation to connect bindings
//   - invariants: structured invariant blocks (shared with TestGen logic)
//   - compose: composed child widget slot assertions
//
// See Architecture doc Sections 7.1, 7.2
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, complete, branch,
  completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

const PLANS = 'widget-test-plans';

type Result = { variant: string; [key: string]: unknown };

// ── Constants ─────────────────────────────────────────────────

const VALID_CATEGORIES = [
  'fsm_transitions',
  'connect_bindings',
  'keyboard_bindings',
  'focus_management',
  'aria_assertions',
  'props',
  'invariants',
  'compose',
] as const;

type Category = typeof VALID_CATEGORIES[number];

// ── Widget Test Plan Types ─────────────────────────────────────

export interface WidgetTestAssertion {
  category: Category;
  type?: string;
  description: string;
  [key: string]: unknown;
}

export interface WidgetTestPlan {
  widgetName: string;
  widgetRef: string;
  generatedAt: string;
  fsm_transitions: WidgetTestAssertion[];
  connect_bindings: WidgetTestAssertion[];
  keyboard_bindings: WidgetTestAssertion[];
  focus_management: WidgetTestAssertion[];
  aria_assertions: WidgetTestAssertion[];
  props: WidgetTestAssertion[];
  invariants: WidgetTestAssertion[];
  compose: WidgetTestAssertion[];
  categories: Category[];
}

// ── Plan Builder ──────────────────────────────────────────────

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'wct-' + Math.abs(hash).toString(16).padStart(12, '0');
}

/**
 * Build a WidgetTestPlan from a parsed WidgetManifest JSON object.
 * Extracts all eight test categories from the manifest structure.
 */
export function buildWidgetTestPlan(widgetRef: string, manifest: Record<string, unknown>): WidgetTestPlan {
  const widgetName = (manifest.name as string) || widgetRef.split('/').pop() || 'Unknown';
  const anatomy = (manifest.anatomy as Array<Record<string, unknown>>) || [];
  const states = (manifest.states as Array<Record<string, unknown>>) || [];
  const props = (manifest.props as Array<Record<string, unknown>>) || [];
  const accessibility = (manifest.accessibility as Record<string, unknown>) || {};
  const connect = (manifest.connect as Array<Record<string, unknown>>) || [];
  const composedWidgets = (manifest.composedWidgets as string[]) || [];
  const invariants = (manifest.invariants as Array<Record<string, unknown>>) || [];

  const keyboard = (accessibility.keyboard as Array<Record<string, unknown>>) || [];
  const focus = (accessibility.focus as Record<string, unknown>) || {};
  const ariaBindings = (accessibility.ariaBindings as Array<Record<string, unknown>>) || [];

  const now = new Date().toISOString();

  // ── 1. FSM Transitions ────────────────────────────────────────

  const fsmAssertions: WidgetTestAssertion[] = [];

  // Initial state assertion
  const initialState = states.find(s => s.initial === true);
  if (initialState) {
    fsmAssertions.push({
      category: 'fsm_transitions',
      type: 'initial_state',
      stateName: initialState.name as string,
      description: `widget renders in initial state '${initialState.name}'`,
    });
  }

  // Transition assertions
  for (const state of states) {
    const stateName = state.name as string;
    const transitions = (state.transitions as Array<Record<string, unknown>>) || [];

    for (const transition of transitions) {
      const event = transition.event as string;
      const target = transition.target as string;
      fsmAssertions.push({
        category: 'fsm_transitions',
        type: 'transition',
        from: stateName,
        event,
        to: target,
        description: `when in state '${stateName}' and event '${event}' fires, state becomes '${target}'`,
      });
    }

    // Entry action assertions
    const entryActions = (state.entryActions as string[]) || [];
    for (const action of entryActions) {
      fsmAssertions.push({
        category: 'fsm_transitions',
        type: 'entry_action',
        stateName,
        action,
        description: `entering state '${stateName}' triggers entry action '${action}'`,
      });
    }

    // Exit action assertions
    const exitActions = (state.exitActions as string[]) || [];
    for (const action of exitActions) {
      fsmAssertions.push({
        category: 'fsm_transitions',
        type: 'exit_action',
        stateName,
        action,
        description: `exiting state '${stateName}' triggers exit action '${action}'`,
      });
    }
  }

  // Unreachable state detection
  if (states.length > 1 && initialState) {
    const reachable = new Set<string>([initialState.name as string]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const state of states) {
        if (!reachable.has(state.name as string)) continue;
        const transitions = (state.transitions as Array<Record<string, unknown>>) || [];
        for (const t of transitions) {
          if (!reachable.has(t.target as string)) {
            reachable.add(t.target as string);
            changed = true;
          }
        }
      }
    }
    for (const state of states) {
      const sn = state.name as string;
      if (!reachable.has(sn)) {
        fsmAssertions.push({
          category: 'fsm_transitions',
          type: 'unreachable_state',
          stateName: sn,
          description: `state '${sn}' is reachable from the initial state`,
        });
      }
    }
  }

  // ── 2. Connect Bindings ───────────────────────────────────────

  const connectAssertions: WidgetTestAssertion[] = [];

  for (const binding of connect) {
    const part = binding.part as string;
    const attrs = (binding.attrs as Array<Record<string, unknown>>) || [];

    for (const attr of attrs) {
      const attrName = attr.name as string;
      const attrValue = attr.value as string;

      // Determine if this is a state-dependent binding
      const isStateDependent = attrValue === 'state' || attrName === 'data-state';

      if (isStateDependent && states.length > 0) {
        // Assert for each state value
        for (const state of states) {
          connectAssertions.push({
            category: 'connect_bindings',
            part,
            attr: attrName,
            expr: attrValue,
            stateCondition: state.name as string,
            description: `when state is '${state.name}', part '${part}' has attribute '${attrName}' = '${state.name}'`,
          });
        }
      } else {
        connectAssertions.push({
          category: 'connect_bindings',
          part,
          attr: attrName,
          expr: attrValue,
          description: `part '${part}' has attribute '${attrName}' bound to expression '${attrValue}'`,
        });
      }
    }
  }

  // ── 3. Keyboard Bindings ──────────────────────────────────────

  const keyboardAssertions: WidgetTestAssertion[] = [];

  for (const mapping of keyboard) {
    const key = mapping.key as string;
    const action = mapping.action as string;

    keyboardAssertions.push({
      category: 'keyboard_bindings',
      key,
      event: action,
      description: `pressing key '${key}' fires event '${action}'`,
    });

    // If the event maps to a state transition, assert the transition too
    for (const state of states) {
      const transitions = (state.transitions as Array<Record<string, unknown>>) || [];
      const matchingTransition = transitions.find(t => t.event === action);
      if (matchingTransition) {
        keyboardAssertions.push({
          category: 'keyboard_bindings',
          key,
          event: action,
          from: state.name as string,
          to: matchingTransition.target as string,
          description: `pressing key '${key}' in state '${state.name}' transitions to state '${matchingTransition.target}'`,
        });
      }
    }
  }

  // ── 4. Focus Management ───────────────────────────────────────

  const focusAssertions: WidgetTestAssertion[] = [];

  if (focus.trap === true) {
    focusAssertions.push({
      category: 'focus_management',
      type: 'trap',
      description: 'focus is trapped within the widget when active',
    });
  }

  if (focus.initial) {
    focusAssertions.push({
      category: 'focus_management',
      type: 'initial',
      target: focus.initial as string,
      description: `initial focus is set to '${focus.initial}'`,
    });
  }

  if (focus.roving === true) {
    focusAssertions.push({
      category: 'focus_management',
      type: 'roving',
      description: 'widget uses roving tabindex for focus management',
    });
  }

  // returnOnClose: if there are exit actions that restore focus, assert return
  const allExitActions = states.flatMap(s => (s.exitActions as string[]) || []);
  if (allExitActions.some(a => typeof a === 'string' && a.toLowerCase().includes('restorefocus'))) {
    focusAssertions.push({
      category: 'focus_management',
      type: 'returnOnClose',
      description: 'focus returns to previously focused element when widget closes',
    });
  }

  // ── 5. ARIA Assertions ────────────────────────────────────────

  const ariaAssertions: WidgetTestAssertion[] = [];

  // From per-part ariaBindings
  for (const binding of ariaBindings) {
    const part = binding.part as string;
    const attrs = (binding.attrs as Array<Record<string, unknown>>) || [];
    for (const attr of attrs) {
      ariaAssertions.push({
        category: 'aria_assertions',
        part,
        attr: attr.name as string,
        value: attr.value as string,
        description: `part '${part}' has ARIA attribute '${attr.name}' = '${attr.value}'`,
      });
    }
  }

  // From anatomy part roles
  for (const part of anatomy) {
    const partName = part.name as string;
    const role = part.role as string | undefined;
    if (role) {
      ariaAssertions.push({
        category: 'aria_assertions',
        part: partName,
        attr: 'role',
        value: role,
        description: `part '${partName}' has role '${role}'`,
      });
    }
  }

  // From top-level accessibility role (applied to root)
  if (accessibility.role && anatomy.length > 0) {
    const rootPart = anatomy[0].name as string;
    const alreadyCovered = ariaAssertions.some(
      a => a.part === rootPart && a.attr === 'role',
    );
    if (!alreadyCovered) {
      ariaAssertions.push({
        category: 'aria_assertions',
        part: rootPart,
        attr: 'role',
        value: accessibility.role as string,
        description: `part '${rootPart}' has ARIA role '${accessibility.role}'`,
      });
    }
  }

  // ── 6. Props ──────────────────────────────────────────────────

  const propAssertions: WidgetTestAssertion[] = [];

  for (const prop of props) {
    const propName = prop.name as string;
    const propType = prop.type as string;
    const defaultValue = prop.defaultValue as string | undefined;

    if (defaultValue !== undefined) {
      propAssertions.push({
        category: 'props',
        name: propName,
        type: propType,
        defaultValue,
        description: `prop '${propName}' defaults to '${defaultValue}' when not provided`,
      });
    }

    propAssertions.push({
      category: 'props',
      name: propName,
      type: propType,
      description: `prop '${propName}' changes propagate to connect bindings`,
    });
  }

  // ── 7. Invariants ─────────────────────────────────────────────

  const invariantAssertions: WidgetTestAssertion[] = [];

  for (const inv of invariants) {
    const kind = (inv.kind as string) || 'example';
    const name = (inv.name as string) || `unnamed ${kind}`;
    const afterPatterns = (inv.afterPatterns as Array<Record<string, unknown>>) || [];
    const thenPatterns = (inv.thenPatterns as Array<Record<string, unknown>>) || [];

    switch (kind) {
      case 'example': {
        invariantAssertions.push({
          category: 'invariants',
          type: 'example',
          name,
          steps: afterPatterns.map(ap => ({
            action: (ap.actionName as string) || '',
            expectedVariant: (ap.variantName as string) || 'ok',
          })),
          assertions: thenPatterns.map(tp => ({
            action: (tp.actionName as string) || '',
            expectedVariant: (tp.variantName as string) || 'ok',
          })),
          description: `example invariant: ${name}`,
        });
        break;
      }
      case 'forall': {
        const quantifiers = ((inv.quantifiers as Array<Record<string, unknown>>) || []).map(q => {
          const domain = q.domain as Record<string, unknown> | undefined;
          return {
            variable: (q.variable as string) || '',
            domainType: ((domain?.type as string) || 'state_field'),
            values: (domain?.values as string[]) || undefined,
          };
        });
        invariantAssertions.push({
          category: 'invariants',
          type: 'forall',
          name,
          quantifiers,
          steps: afterPatterns.map(ap => ({
            action: (ap.actionName as string) || '',
          })),
          description: `property invariant: ${name}`,
        });
        break;
      }
      case 'always':
      case 'never': {
        invariantAssertions.push({
          category: 'invariants',
          type: kind,
          name,
          description: `${kind} invariant: ${name}`,
        });
        break;
      }
      case 'eventually': {
        invariantAssertions.push({
          category: 'invariants',
          type: 'eventually',
          name,
          steps: afterPatterns.map(ap => ({
            action: (ap.actionName as string) || '',
          })),
          description: `liveness invariant: ${name}`,
        });
        break;
      }
      case 'requires_ensures': {
        const targetAction = (inv.targetAction as string) || '';
        invariantAssertions.push({
          category: 'invariants',
          type: 'contract',
          name: `contract:${targetAction}`,
          targetAction,
          contracts: (inv.contracts as unknown[]) || [],
          description: `contract invariant for action: ${targetAction}`,
        });
        break;
      }
    }
  }

  // ── 8. Compose ────────────────────────────────────────────────

  const composeAssertions: WidgetTestAssertion[] = [];
  const slots = (manifest.slots as string[]) || [];

  for (const childWidget of composedWidgets) {
    // Try to find a matching slot for this composed widget
    const matchingSlot = slots.find(
      s => s.toLowerCase() === childWidget.toLowerCase() ||
           s.toLowerCase().includes(childWidget.toLowerCase()),
    );

    composeAssertions.push({
      category: 'compose',
      widget: childWidget,
      slot: matchingSlot || null,
      description: matchingSlot
        ? `composed widget '${childWidget}' renders in slot '${matchingSlot}'`
        : `composed widget '${childWidget}' renders within the widget`,
    });
  }

  // ── Assemble plan ─────────────────────────────────────────────

  const categoryMap: Record<Category, WidgetTestAssertion[]> = {
    fsm_transitions: fsmAssertions,
    connect_bindings: connectAssertions,
    keyboard_bindings: keyboardAssertions,
    focus_management: focusAssertions,
    aria_assertions: ariaAssertions,
    props: propAssertions,
    invariants: invariantAssertions,
    compose: composeAssertions,
  };

  const activeCategories: Category[] = VALID_CATEGORIES.filter(
    c => categoryMap[c].length > 0,
  );

  return {
    widgetName,
    widgetRef,
    generatedAt: now,
    fsm_transitions: fsmAssertions,
    connect_bindings: connectAssertions,
    keyboard_bindings: keyboardAssertions,
    focus_management: focusAssertions,
    aria_assertions: ariaAssertions,
    props: propAssertions,
    invariants: invariantAssertions,
    compose: composeAssertions,
    categories: activeCategories,
  };
}

// ── Handler ───────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', {
      name: 'WidgetComponentTest',
    }) as StorageProgram<Result>;
  },

  buildPlan(input: Record<string, unknown>) {
    // Input validation guards — checked before any storage operations
    const widgetRef = input.widget_ref as string;
    const widgetData = input.widget_data as string;

    if (!widgetRef || (widgetRef as string).trim() === '') {
      return complete(createProgram(), 'invalid', {
        message: 'widget_ref is required',
      }) as StorageProgram<Result>;
    }

    if (!widgetData || (widgetData as string).trim() === '') {
      return complete(createProgram(), 'invalid', {
        message: 'widget_data is required',
      }) as StorageProgram<Result>;
    }

    // Parse the widget manifest JSON
    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(widgetData);
    } catch (_e) {
      return complete(createProgram(), 'invalid', {
        message: 'widget_data is not valid JSON',
      }) as StorageProgram<Result>;
    }

    // Validate the manifest has testable structure
    const states = manifest.states as unknown[] | undefined;
    const anatomy = manifest.anatomy as unknown[] | undefined;
    const manifestProps = manifest.props as unknown[] | undefined;

    const hasStates = Array.isArray(states) && states.length > 0;
    const hasAnatomy = Array.isArray(anatomy) && anatomy.length > 0;
    const hasProps = Array.isArray(manifestProps) && manifestProps.length > 0;

    if (!hasStates && !hasAnatomy && !hasProps) {
      return complete(createProgram(), 'invalid', {
        message: 'widget manifest contains no testable structure (no states, no anatomy, no props)',
      }) as StorageProgram<Result>;
    }

    // Build the test plan from the manifest
    const plan = buildWidgetTestPlan(widgetRef, manifest);
    const planId = simpleHash(widgetRef + ':' + widgetData.length);
    const testPlanJson = JSON.stringify(plan);
    const categoriesJson = JSON.stringify(plan.categories);

    let p = createProgram();
    p = put(p, PLANS, planId, {
      id: planId,
      widget_ref: widgetRef,
      widget_name: plan.widgetName,
      generated_at: plan.generatedAt,
      test_plan: testPlanJson,
      categories: categoriesJson,
    });

    return complete(p, 'ok', {
      plan: planId,
      test_plan: testPlanJson,
      categories: plan.categories,
    }) as StorageProgram<Result>;
  },

  listCategories(_input: Record<string, unknown>) {
    let p = createProgram();
    return complete(p, 'ok', {
      categories: [...VALID_CATEGORIES],
    }) as StorageProgram<Result>;
  },

  getCategory(input: Record<string, unknown>) {
    const planId = input.plan as string;
    const category = input.category as string;

    // Validate category name
    if (!VALID_CATEGORIES.includes(category as Category)) {
      return complete(createProgram(), 'notfound', {
        message: `'${category}' is not a recognized category. Valid categories: ${VALID_CATEGORIES.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, PLANS, planId, 'planRecord');

    return branch(p,
      'planRecord',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.planRecord as Record<string, unknown>;
        const testPlanJson = record.test_plan as string;
        let plan: Record<string, unknown>;
        try {
          plan = JSON.parse(testPlanJson);
        } catch (_e) {
          return { assertions: [] };
        }
        const categoryData = plan[category] as Array<Record<string, unknown>> | undefined;
        const assertions = (categoryData || []).map(
          (a: Record<string, unknown>) => (a.description as string) || JSON.stringify(a),
        );
        return { assertions };
      }),
      (_b) => complete(createProgram(), 'notfound', {
        message: `No plan exists with identifier '${planId}'`,
      }),
    ) as StorageProgram<Result>;
  },

};

export const widgetComponentTestPlanHandler = autoInterpret(_handler);

// Re-export types for use by renderers and providers
export type { WidgetTestPlan, WidgetTestAssertion };
export { VALID_CATEGORIES };
