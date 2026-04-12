// EditSurface handler — functional StorageProgram style
// Per-(schema × context) editor bundle registry. Activated on focus change;
// rebinds all five plugin planes (commands, panels, toolbar, context menu,
// input rules, pickers) to schema-specific refs. Optional compile bundle
// fields for compilable schemas (agent-persona, meeting-notes, workflow,
// filter-draft) surface ContentCompiler status + preview + consumers in-place.
//
// context is a closed enum:
//   block-editor | standalone | inspector | canvas | preview-only | page-level
//
// NOTE: The concept action `register` matches the handler lifecycle method name.
// The `register` method here implements the concept action. The conformance test
// generator detects this case and skips lifecycle introspection gracefully.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, get, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const VALID_CONTEXTS = [
  'block-editor',
  'standalone',
  'inspector',
  'canvas',
  'preview-only',
  'page-level',
] as const;

type ValidContext = typeof VALID_CONTEXTS[number];
type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {

  // Lifecycle register — returns concept name for PluginRegistry.
  // When called with action input it serves as the concept action `register`.
  register(input: Record<string, unknown>) {
    // Lifecycle call (no input) — return concept name
    if (input == null || Object.keys(input).length === 0) {
      return { name: 'EditSurface' } as unknown as StorageProgram<Result>;
    }

    const surface = input.surface != null ? String(input.surface) : '';
    const schema_ref = input.schema_ref != null ? String(input.schema_ref) : '';
    const context = input.context != null ? String(input.context) : '';

    // Validate surface identifier
    if (!surface || surface.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'surface identifier is required',
      }) as StorageProgram<Result>;
    }

    // Validate schema_ref is non-empty
    if (!schema_ref || schema_ref.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'schema_ref is required and must not be empty',
      }) as StorageProgram<Result>;
    }

    // Validate context is one of the six allowed values
    if (!VALID_CONTEXTS.includes(context as ValidContext)) {
      return complete(createProgram(), 'invalid_context', {
        message: `context must be one of: ${VALID_CONTEXTS.join(', ')}. Got: "${context}"`,
      }) as StorageProgram<Result>;
    }

    // Read plugin plane fields (arrays default to empty lists, options default to null)
    const command_bindings = Array.isArray(input.command_bindings)
      ? (input.command_bindings as string[])
      : [];
    const panel_widgets = Array.isArray(input.panel_widgets)
      ? (input.panel_widgets as string[])
      : [];
    const toolbar_widget = (input.toolbar_widget != null && input.toolbar_widget !== '')
      ? String(input.toolbar_widget)
      : null;
    const context_menu_bindings = Array.isArray(input.context_menu_bindings)
      ? (input.context_menu_bindings as string[])
      : [];
    const input_rule_refs = Array.isArray(input.input_rule_refs)
      ? (input.input_rule_refs as string[])
      : [];
    const picker_refs = Array.isArray(input.picker_refs)
      ? (input.picker_refs as string[])
      : [];

    // Read optional compile bundle fields
    const compile_action_ref = (input.compile_action_ref != null && input.compile_action_ref !== '')
      ? String(input.compile_action_ref)
      : null;
    const status_decoration_ref = (input.status_decoration_ref != null && input.status_decoration_ref !== '')
      ? String(input.status_decoration_ref)
      : null;
    const output_preview_ref = (input.output_preview_ref != null && input.output_preview_ref !== '')
      ? String(input.output_preview_ref)
      : null;
    const consumers_panel_ref = (input.consumers_panel_ref != null && input.consumers_panel_ref !== '')
      ? String(input.consumers_panel_ref)
      : null;

    // Check for duplicate surface ID
    let p = createProgram();
    p = get(p, 'surfaces', surface, '_existingById');
    return branch(p,
      (b) => b._existingById != null,
      (b) => complete(b, 'duplicate', { surface }) as StorageProgram<Result>,
      (b) => {
        // Check for duplicate schema_ref + context combination
        let b2 = find(b, 'surfaces', {}, '_all_surfaces');
        return branch(b2,
          (bindings) => {
            const all = (bindings._all_surfaces ?? []) as Array<Record<string, unknown>>;
            return all.some(
              (s) => s.schema_ref === schema_ref && s.context === context,
            );
          },
          (bp) => complete(bp, 'duplicate', { surface }) as StorageProgram<Result>,
          (bp) => {
            const sp = put(bp, 'surfaces', surface, {
              surface,
              schema_ref,
              context,
              command_bindings,
              panel_widgets,
              toolbar_widget,
              context_menu_bindings,
              input_rule_refs,
              picker_refs,
              compile_action_ref,
              status_decoration_ref,
              output_preview_ref,
              consumers_panel_ref,
            });
            return complete(sp, 'ok', { surface }) as StorageProgram<Result>;
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  unregister(input: Record<string, unknown>) {
    const surface = input.surface != null ? String(input.surface) : '';

    if (!surface || surface.trim() === '') {
      return complete(createProgram(), 'notfound', {
        message: 'surface identifier is required',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'surfaces', surface, '_existing');
    return branch(p,
      (b) => b._existing == null,
      (b) => complete(b, 'notfound', {
        message: `surface '${surface}' not found`,
      }) as StorageProgram<Result>,
      (b) => {
        const dp = del(b, 'surfaces', surface);
        return complete(dp, 'ok', {}) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const schema_ref = input.schema_ref != null ? String(input.schema_ref) : '';
    const context = input.context != null ? String(input.context) : '';

    let p = createProgram();
    p = find(p, 'surfaces', {}, '_all_surfaces');
    return branch(p,
      (bindings) => {
        const all = (bindings._all_surfaces ?? []) as Array<Record<string, unknown>>;
        return all.some((s) => s.schema_ref === schema_ref && s.context === context);
      },
      (b) => completeFrom(b, 'ok', (bindings) => {
        const all = (bindings._all_surfaces ?? []) as Array<Record<string, unknown>>;
        const match = all.find(
          (s) => s.schema_ref === schema_ref && s.context === context,
        );
        return { surface: (match as Record<string, unknown>).surface };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'no_match', {
        message: `no surface registered for schema "${schema_ref}" in context "${context}"`,
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  activate(input: Record<string, unknown>) {
    const surface = input.surface != null ? String(input.surface) : '';

    if (!surface || surface.trim() === '') {
      return complete(createProgram(), 'notfound', {
        message: 'surface identifier is required',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'surfaces', surface, '_existing');
    return branch(p,
      (b) => b._existing == null,
      (b) => complete(b, 'notfound', {
        message: `surface '${surface}' not found`,
      }) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const s = bindings._existing as Record<string, unknown>;
        // Serialize the full bundle as JSON for the host to consume
        const bundle = JSON.stringify({
          surface: s.surface,
          schema_ref: s.schema_ref,
          context: s.context,
          command_bindings: s.command_bindings,
          panel_widgets: s.panel_widgets,
          toolbar_widget: s.toolbar_widget,
          context_menu_bindings: s.context_menu_bindings,
          input_rule_refs: s.input_rule_refs,
          picker_refs: s.picker_refs,
          compile_action_ref: s.compile_action_ref,
          status_decoration_ref: s.status_decoration_ref,
          output_preview_ref: s.output_preview_ref,
          consumers_panel_ref: s.consumers_panel_ref,
        });
        return { bundle };
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  deactivate(input: Record<string, unknown>) {
    const surface = input.surface != null ? String(input.surface) : '';

    if (!surface || surface.trim() === '') {
      return complete(createProgram(), 'notfound', {
        message: 'surface identifier is required',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'surfaces', surface, '_existing');
    return branch(p,
      (b) => b._existing == null,
      (b) => complete(b, 'notfound', {
        message: `surface '${surface}' not found`,
      }) as StorageProgram<Result>,
      (b) => complete(b, 'ok', {}) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },
};

export const editSurfaceHandler = autoInterpret(_handler);
export default editSurfaceHandler;
