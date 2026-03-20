// @clef-handler style=functional
// WidgetImplementationEntity diffFromSpec — Functional (Monadic) Implementation
//
// Compares a generated widget implementation against its widget spec to find
// drift: missing anatomy parts, extra parts, missing props, state mismatches,
// slot gaps, accessibility omissions, event/transition gaps, compose
// discrepancies, and keyboard binding gaps. Returns a StorageProgram for full
// traceability through the monadic analysis pipeline.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, branch, pure, pureFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

type Difference = {
  kind: 'missing_part' | 'extra_part' | 'missing_prop' | 'extra_prop'
      | 'missing_state' | 'extra_state' | 'missing_slot' | 'accessibility_gap'
      | 'missing_event' | 'missing_compose' | 'extra_compose' | 'missing_keyboard';
  specValue: string;
  implValue: string;
};

export const widgetDiffFromSpecHandler: FunctionalConceptHandler = {
  diffFromSpec(input) {
    const implId = input.impl as string;

    let p = createProgram();

    // Find the implementation by scanning all widget implementations
    p = find(p, 'widget-implementations', {}, 'allImpls');

    p = branch(
      p,
      (bindings) => {
        const impls = bindings.allImpls as Record<string, unknown>[];
        return !impls || !impls.find(i => i.id === implId);
      },
      pure(createProgram(), { variant: 'inSync' }),
      (() => {
        // Implementation found — now look up the widget entity
        let inner = createProgram();
        inner = find(inner, 'widget-entity', {}, 'allWidgets');

        return pureFrom(inner, (bindings) => {
          const impls = bindings.allImpls as Record<string, unknown>[];
          const impl = impls.find(i => i.id === implId)!;
          const widgetName = impl.widget as string;

          const widgets = bindings.allWidgets as Record<string, unknown>[];
          const widgetEntity = widgets?.find(w => w.name === widgetName);

          if (!widgetEntity) {
            // No spec registered — can't diff, treat as in-sync
            return { variant: 'inSync' };
          }

          const differences: Difference[] = [];

          // --- Anatomy parts ---
          const specParts: Array<{ name: string }> = (() => {
            try { return JSON.parse(widgetEntity.anatomyParts as string || '[]'); }
            catch { return []; }
          })();
          const specPartNames = new Set(specParts.map(p => typeof p === 'string' ? p : p.name));

          const implParts: Array<{ name: string }> = (() => {
            try { return JSON.parse(impl.renderedParts as string || '[]'); }
            catch { return []; }
          })();
          const implPartNames = new Set(implParts.map(p => typeof p === 'string' ? p : p.name));

          for (const name of specPartNames) {
            if (!implPartNames.has(name)) {
              differences.push({ kind: 'missing_part', specValue: name, implValue: '' });
            }
          }
          for (const name of implPartNames) {
            if (!specPartNames.has(name)) {
              differences.push({ kind: 'extra_part', specValue: '', implValue: name });
            }
          }

          // --- Props ---
          const specProps: Array<{ name: string }> = (() => {
            try { return JSON.parse(widgetEntity.props as string || '[]'); }
            catch { return []; }
          })();
          const specPropNames = new Set(specProps.map(p => typeof p === 'string' ? p : p.name));

          const implPropsRaw = (() => {
            try { return JSON.parse(impl.propsInterface as string || '{}'); }
            catch { return {}; }
          })();
          // propsInterface can be { propName: type } or [{ name, type }]
          const implPropNames = new Set(
            Array.isArray(implPropsRaw)
              ? implPropsRaw.map((p: { name: string }) => p.name)
              : Object.keys(implPropsRaw)
          );

          for (const name of specPropNames) {
            if (!implPropNames.has(name)) {
              differences.push({ kind: 'missing_prop', specValue: name, implValue: '' });
            }
          }
          for (const name of implPropNames) {
            if (!specPropNames.has(name)) {
              differences.push({ kind: 'extra_prop', specValue: '', implValue: name });
            }
          }

          // --- States ---
          const specStates: Array<{ name: string }> = (() => {
            try { return JSON.parse(widgetEntity.states as string || '[]'); }
            catch { return []; }
          })();
          const specStateNames = new Set(specStates.map(s => typeof s === 'string' ? s : s.name));

          const implStates: string[] = (() => {
            try { return JSON.parse(impl.stateBindings as string || '[]'); }
            catch { return []; }
          })();
          const implStateNames = new Set(
            implStates.map((s: string | { name: string }) => typeof s === 'string' ? s : s.name)
          );

          for (const name of specStateNames) {
            if (!implStateNames.has(name)) {
              differences.push({ kind: 'missing_state', specValue: name, implValue: '' });
            }
          }
          for (const name of implStateNames) {
            if (!specStateNames.has(name)) {
              differences.push({ kind: 'extra_state', specValue: '', implValue: name });
            }
          }

          // --- Slots ---
          const specSlots: string[] = (() => {
            try { return JSON.parse(widgetEntity.slots as string || '[]'); }
            catch { return []; }
          })();
          const specSlotNames = new Set(specSlots);

          const implSlots: Array<string | { name: string }> = (() => {
            try { return JSON.parse(impl.slotImplementations as string || '[]'); }
            catch { return []; }
          })();
          const implSlotNames = new Set(
            implSlots.map(s => typeof s === 'string' ? s : s.name)
          );

          for (const name of specSlotNames) {
            if (!implSlotNames.has(name)) {
              differences.push({ kind: 'missing_slot', specValue: name, implValue: '' });
            }
          }

          // --- Accessibility ---
          const specRole = widgetEntity.accessibilityRole as string || '';
          const implA11y: Array<{ attr: string; value?: string }> = (() => {
            try { return JSON.parse(impl.accessibilityAttrs as string || '[]'); }
            catch { return []; }
          })();
          const implHasRole = implA11y.some(a => a.attr === 'role');

          if (specRole && !implHasRole) {
            differences.push({
              kind: 'accessibility_gap',
              specValue: `role="${specRole}"`,
              implValue: '',
            });
          }

          // --- Events / Transitions ---
          // Extract events from spec states' transitions
          const specEventsSet = new Set<string>();
          for (const state of specStates) {
            const stateObj = state as unknown as Record<string, unknown>;
            const transitions = (stateObj.transitions || []) as Array<{ event?: string; on?: string }>;
            for (const t of transitions) {
              const event = t.event || t.on;
              if (event) specEventsSet.add(event);
            }
          }

          // Parse impl event handlers
          const implEvents: string[] = (() => {
            try { return JSON.parse(impl.eventHandlers as string || '[]'); }
            catch { return []; }
          })();
          const implEventNames = new Set(
            implEvents.map((e: string | { name: string; event?: string }) =>
              typeof e === 'string' ? e : (e.event || e.name))
          );

          for (const event of specEventsSet) {
            if (!implEventNames.has(event)) {
              differences.push({ kind: 'missing_event', specValue: event, implValue: '' });
            }
          }

          // --- Composed widgets ---
          const specComposed: Array<string | { name: string }> = (() => {
            try { return JSON.parse(widgetEntity.composedWidgets as string || '[]'); }
            catch { return []; }
          })();
          const specComposeNames = new Set(
            specComposed.map(c => typeof c === 'string' ? c : c.name)
          );

          const implComposed: Array<string | { name: string }> = (() => {
            try { return JSON.parse(impl.composedComponents as string || '[]'); }
            catch { return []; }
          })();
          const implComposeNames = new Set(
            implComposed.map(c => typeof c === 'string' ? c : c.name)
          );

          for (const name of specComposeNames) {
            if (!implComposeNames.has(name)) {
              differences.push({ kind: 'missing_compose', specValue: name, implValue: '' });
            }
          }
          for (const name of implComposeNames) {
            if (!specComposeNames.has(name)) {
              differences.push({ kind: 'extra_compose', specValue: '', implValue: name });
            }
          }

          // --- Keyboard bindings ---
          const specKeyboard: Array<{ key?: string; keys?: string }> = (() => {
            try { return JSON.parse(widgetEntity.keyboardBindings as string || '[]'); }
            catch { return []; }
          })();
          const implKeyboard: Array<{ key?: string; keys?: string }> = (() => {
            try { return JSON.parse(impl.keyboardHandlers as string || '[]'); }
            catch { return []; }
          })();

          if (specKeyboard.length > 0 && implKeyboard.length === 0) {
            differences.push({
              kind: 'missing_keyboard',
              specValue: `${specKeyboard.length} keyboard binding(s)`,
              implValue: '',
            });
          }

          if (differences.length === 0) {
            return { variant: 'inSync' };
          }

          return {
            variant: 'ok',
            differences: JSON.stringify(differences),
            missing_parts: differences.filter(d => d.kind === 'missing_part').length,
            extra_parts: differences.filter(d => d.kind === 'extra_part').length,
            missing_props: differences.filter(d => d.kind === 'missing_prop').length,
            missing_events: differences.filter(d => d.kind === 'missing_event').length,
            missing_compose: differences.filter(d => d.kind === 'missing_compose').length,
            extra_compose: differences.filter(d => d.kind === 'extra_compose').length,
            missing_keyboard: differences.filter(d => d.kind === 'missing_keyboard').length,
            accessibility_gaps: differences.filter(d => d.kind === 'accessibility_gap').length,
            total_differences: differences.length,
          };
        }) as StorageProgram<Result>;
      })(),
    );

    return p as StorageProgram<Result>;
  },
};
