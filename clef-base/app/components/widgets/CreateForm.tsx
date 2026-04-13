'use client';

/**
 * CreateForm — 4-tier creation dispatcher.
 *
 * PRD:  docs/plans/creation-ux-prd.md §2 (4-tier resolution order)
 * Card: CUX-03
 *
 * ## Resolution order
 *
 * When the modal opens with a schemaId and/or destinationId:
 *
 *   Tier 1a — InteractionSpec.create_surface set?
 *     Mount that widget with {mode: "create", context: null}.
 *     Respect create_mode_hint: modal → render inside this container,
 *     page → navigate to /admin/<surface>/new and close modal.
 *     panel → treated as modal in v1.
 *
 *   Tier 1b — Schema has displayWidget Property set (content-native)?
 *     Call useContentNativeCreate().create(schemaId).
 *     The hook creates ContentNode + navigates to /content/<id>.
 *     Don't render any form.
 *
 *   Tier 2 — FormSpec/resolve returns ok for schema + mode: create?
 *     FormRenderer drives the form via FormSpec layout.
 *     (Existing path, unchanged.)
 *
 *   Tier 3 — Primitive fallback.
 *     3-field-type (text/textarea/select) CreateForm behavior.
 *     (Existing path, unchanged.)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useKernelInvoke } from '../../../lib/clef-provider';
import { useContentNativeCreate } from '../../../lib/useContentNativeCreate';
import {
  registerCreateSurface,
  resolveCreateSurface,
} from '../../../lib/create-surfaces';
import FormRenderer from './FormRenderer';

// ---------------------------------------------------------------------------
// Register bespoke create surfaces
// ---------------------------------------------------------------------------
//
// Imported lazily here so that the create-surfaces registry does not need
// to import app-layer components directly (which would create circular
// dependencies in test environments).  All registration happens once when
// this module is first evaluated (which is when CreateForm is first rendered).

import { ViewEditor } from '../ViewEditor';
import { SchemaFieldsEditor } from './SchemaFieldsEditor';
import { FlowBuilder } from './FlowBuilder';
import { UserSyncEditor } from './UserSyncEditor';
import { FormBuilder } from './FormBuilder';

// Register all known create surfaces.  Idempotent — safe to call multiple times.
registerCreateSurface('view-editor', ViewEditor as React.ComponentType<Record<string, unknown>>);
registerCreateSurface('schema-editor', SchemaFieldsEditor as React.ComponentType<Record<string, unknown>>);
registerCreateSurface('flow-builder', FlowBuilder as React.ComponentType<Record<string, unknown>>);
registerCreateSurface('user-sync-editor', UserSyncEditor as React.ComponentType<Record<string, unknown>>);
registerCreateSurface('form-builder', FormBuilder as React.ComponentType<Record<string, unknown>>);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldDef {
  name: string;
  label?: string;
  type?: 'text' | 'textarea' | 'select';
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

export interface CreateFormProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  concept: string;
  action: string;
  title: string;
  fields: FieldDef[];
  /**
   * When provided, triggers Tier 1b and Tier 2 resolution paths.
   * Tier 1b: Property/get(schemaId, "displayWidget") — if set, use content-native create.
   * Tier 2: FormSpec/resolve — if found, FormRenderer drives the form.
   */
  schemaId?: string;
  /**
   * When provided, triggers Tier 1a resolution.
   * InteractionSpec/get(destinationId) — if create_surface is set, mount that widget.
   */
  destinationId?: string;
  /**
   * Pre-filled field values. Merged into the Tier 3 primitive form's initial state
   * when the modal opens. Keys match FieldDef.name values. Also forwarded to the
   * Tier 1a bespoke surface and Tier 2 FormRenderer via the `initialValues` prop so
   * those renderers can honour the prefill (e.g. a date pre-filled from a calendar
   * cell click).
   *
   * Callers that prefill values should reset this to {} or undefined when the modal
   * closes so stale values don't re-appear on the next open.
   */
  initialValues?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Tier resolution state shape
// ---------------------------------------------------------------------------

type TierProbeStatus = 'idle' | 'probing' | 'resolved';

interface TierState {
  status: TierProbeStatus;
  // Tier 1a
  createSurface: string | null;
  createModeHint: 'modal' | 'page' | 'panel' | null;
  // Tier 1b
  displayWidget: string | null;
  // Tier 2
  formSpecResolved: boolean | null;
}

const INITIAL_TIER_STATE: TierState = {
  status: 'idle',
  createSurface: null,
  createModeHint: null,
  displayWidget: null,
  formSpecResolved: null,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CreateForm: React.FC<CreateFormProps> = ({
  concept,
  action,
  fields,
  title,
  open,
  onClose,
  onCreated,
  schemaId,
  destinationId,
  initialValues,
}) => {
  const invoke = useKernelInvoke();
  const router = useRouter();
  const { create: contentNativeCreate, isPending: contentNativeIsPending } =
    useContentNativeCreate();

  // Seed form values from initialValues when the modal opens; reset on close.
  const [values, setValues] = useState<Record<string, string>>(initialValues ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorVariant, setErrorVariant] = useState<string | null>(null);

  // Tier probe state — all tiers resolved together in a single useEffect.
  const [tierState, setTierState] = useState<TierState>(INITIAL_TIER_STATE);

  // -------------------------------------------------------------------------
  // Sync initialValues into form state on open/change
  // -------------------------------------------------------------------------
  // When the modal opens (or when the caller changes initialValues between
  // opens), merge the prefill values into the current field state so they
  // appear as pre-populated inputs in Tier 3 and can be forwarded to Tier 2
  // (FormRenderer) and Tier 1a (bespoke surface).
  useEffect(() => {
    if (open && initialValues && Object.keys(initialValues).length > 0) {
      setValues((prev) => ({ ...prev, ...initialValues }));
    }
    if (!open) {
      // Reset to empty on close so the next open starts fresh unless the
      // caller supplies new initialValues.
      setValues({});
    }
  }, [open, initialValues]);

  // -------------------------------------------------------------------------
  // Tier probing — runs when modal opens and we have schemaId or destinationId
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!open) {
      // Reset when modal closes so probes run fresh on next open.
      setTierState(INITIAL_TIER_STATE);
      return;
    }

    if (!schemaId && !destinationId) {
      // Nothing to probe — drop straight through to primitive fallback.
      setTierState((s) => ({ ...s, status: 'resolved' }));
      return;
    }

    let cancelled = false;
    setTierState((s) => ({ ...s, status: 'probing' }));

    async function probe() {
      let createSurface: string | null = null;
      let createModeHint: 'modal' | 'page' | 'panel' | null = null;
      let displayWidget: string | null = null;
      let formSpecResolved: boolean | null = null;

      // ------ Tier 1a: InteractionSpec.create_surface ----------------------
      if (destinationId) {
        try {
          const specResult = await invoke('InteractionSpec', 'get', {
            name: destinationId,
          });
          if (specResult.variant === 'ok') {
            const cs = specResult.create_surface as string | undefined;
            const cmh = specResult.create_mode_hint as string | undefined;
            if (cs && typeof cs === 'string' && cs.trim() !== '') {
              createSurface = cs;
              createModeHint =
                cmh === 'page' ? 'page' :
                cmh === 'panel' ? 'panel' :
                'modal';
            }
          }
        } catch {
          // InteractionSpec/get failure → skip Tier 1a
        }
      }

      // ------ Tier 1b: Schema displayWidget Property -----------------------
      // Only probe when Tier 1a did not match and we have a schemaId.
      if (!createSurface && schemaId) {
        try {
          const propResult = await invoke('Property', 'get', {
            entity: schemaId,
            key: 'displayWidget',
          });
          if (propResult.variant === 'ok') {
            const dw = propResult.value as string | undefined;
            if (dw && typeof dw === 'string' && dw.trim() !== '') {
              displayWidget = dw;
            }
          }
        } catch {
          // Property/get failure → skip Tier 1b
        }
      }

      // ------ Tier 2: FormSpec/resolve -------------------------------------
      // Only probe when neither Tier 1a nor 1b matched.
      if (!createSurface && !displayWidget && schemaId) {
        try {
          const fsResult = await invoke('FormSpec', 'resolve', {
            schemaId,
            mode: 'create',
          });
          formSpecResolved = fsResult.variant === 'ok';
        } catch {
          formSpecResolved = false;
        }
      }

      if (!cancelled) {
        setTierState({
          status: 'resolved',
          createSurface,
          createModeHint,
          displayWidget,
          formSpecResolved,
        });
      }
    }

    probe();
    return () => { cancelled = true; };
  }, [open, schemaId, destinationId, invoke]);

  // -------------------------------------------------------------------------
  // Tier 1b — content-native create (fires once tier state resolves)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!open) return;
    if (tierState.status !== 'resolved') return;
    if (!tierState.displayWidget) return;
    if (!schemaId) return;

    // Fire content-native create automatically — no form to show.
    contentNativeCreate(schemaId).then((result) => {
      if ('error' in result) {
        setError(result.error);
      } else {
        // Navigation already happened inside the hook. Close the modal.
        onClose();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierState.status, tierState.displayWidget]);

  // -------------------------------------------------------------------------
  // Tier 1a — navigate to page route when create_mode_hint is "page"
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!open) return;
    if (tierState.status !== 'resolved') return;
    if (!tierState.createSurface) return;
    if (tierState.createModeHint !== 'page') return;

    // Navigate to /admin/<surface>/new and close the modal.
    // Convention: /admin/<widget-id>/new mounts that widget in create mode.
    // The admin catch-all page.tsx resolves this route segment.
    router.push(`/admin/${encodeURIComponent(tierState.createSurface)}/new`);
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierState.status, tierState.createSurface, tierState.createModeHint]);

  // -------------------------------------------------------------------------
  // Primitive fallback submit handler (Tier 3)
  // -------------------------------------------------------------------------

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setErrorVariant(null);
    try {
      const result = await invoke(concept, action, values);
      if (result.variant === 'ok') {
        setValues({});
        onCreated();
        onClose();
      } else {
        setErrorVariant(result.variant as string);
        setError(result.message as string ?? `Action returned: ${result.variant}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }, [invoke, concept, action, values, onCreated, onClose]);

  // -------------------------------------------------------------------------
  // FormRenderer submit handler (Tier 2)
  // -------------------------------------------------------------------------

  const handleFormRendererSubmit = useCallback(
    async (formValues: Record<string, unknown>) => {
      const result = await invoke(concept, action, formValues);
      if (result.variant === 'ok') {
        onCreated();
        onClose();
      } else {
        throw new Error(
          result.message as string ?? `Failed: ${result.variant}`,
        );
      }
    },
    [invoke, concept, action, onCreated, onClose],
  );

  // -------------------------------------------------------------------------
  // Render guard
  // -------------------------------------------------------------------------

  if (!open) return null;

  const { status, createSurface, createModeHint, displayWidget, formSpecResolved } =
    tierState;

  // While probing (or before probing when schemaId/destinationId provided),
  // show a minimal loading state.
  const stillProbing =
    (schemaId != null || destinationId != null) && status !== 'resolved';

  // -------------------------------------------------------------------------
  // Tier 1a — modal mount: widget registered AND hint is modal/panel/null
  // -------------------------------------------------------------------------

  const SurfaceComp = createSurface ? resolveCreateSurface(createSurface) : undefined;
  const tier1aModal =
    SurfaceComp != null &&
    createModeHint !== 'page' &&
    status === 'resolved';

  // -------------------------------------------------------------------------
  // Tier 1b — content-native: suppress form, show pending/error
  // -------------------------------------------------------------------------

  // displayWidget being set means the hook is either in-flight or done.
  const tier1b = displayWidget != null && status === 'resolved';

  // -------------------------------------------------------------------------
  // Tier 2 — FormSpec path
  // -------------------------------------------------------------------------

  const tier2 = !tier1aModal && !tier1b && formSpecResolved === true;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      data-surface="mag651-form-overlay"
      data-keybinding-scope="app.form"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div data-surface="mag651-field-panel">
        <h2 data-part="field-panel-title">{title}</h2>

        {stillProbing ? (
          // Loading state while any tier probe is in flight.
          <div data-part="field-panel-subtitle">Loading form...</div>

        ) : tier1aModal && SurfaceComp ? (
          // Tier 1a — bespoke widget mounted inside the modal container.
          // initialValues forwarded so the bespoke surface can prefill fields
          // (e.g. a date pre-selected from a calendar cell click).
          <SurfaceComp mode="create" context={null} initialValues={initialValues ?? {}} />

        ) : tier1b ? (
          // Tier 1b — content-native create; hook navigates automatically.
          // While the kernel round-trip is in flight, show a spinner.
          // If the hook returned an error (captured in the error state), show it.
          <div data-part="field-panel-subtitle">
            {error ? (
              <span data-part="field-error">{error}</span>
            ) : (
              contentNativeIsPending
                ? 'Creating...'
                : 'Redirecting to editor...'
            )}
          </div>

        ) : tier2 ? (
          // Tier 2 — FormSpec-driven rendering via FormRenderer.
          // initialValues forwarded so FormRenderer can prefill matching fields.
          <FormRenderer
            schemaId={schemaId!}
            mode="create"
            onSubmit={handleFormRendererSubmit}
            onCancel={onClose}
            compact={true}
            initialValues={initialValues}
          />

        ) : (
          // Tier 3 — primitive fallback: text / textarea / select fields.
          <>
            {error && (
              <div data-part="field-error">
                {errorVariant && errorVariant !== 'error' && (
                  <span data-part="field-error-variant">[{errorVariant}]</span>
                )}
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {fields.map((field) => (
                <div key={field.name} data-part="field-panel-row">
                  <label
                    htmlFor={`field-${field.name}`}
                    data-part="field-label"
                  >
                    {field.label ?? field.name}
                    {field.required && (
                      <span data-part="field-required"> *</span>
                    )}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      id={`field-${field.name}`}
                      value={values[field.name] ?? ''}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [field.name]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      required={field.required}
                      rows={3}
                      data-surface="mag651-field-control"
                      data-contract="field-control"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      id={`field-${field.name}`}
                      value={values[field.name] ?? ''}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [field.name]: e.target.value }))
                      }
                      required={field.required}
                      data-surface="mag651-field-control"
                      data-contract="field-control"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`field-${field.name}`}
                      type="text"
                      value={values[field.name] ?? ''}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [field.name]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      required={field.required}
                      data-surface="mag651-field-control"
                      data-contract="field-control"
                    />
                  )}
                </div>
              ))}

              <div
                data-part="field-actions"
                style={{ marginTop: 'var(--spacing-lg)' }}
              >
                <button
                  type="button"
                  data-part="button"
                  data-variant="outlined"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-part="button"
                  data-variant="filled"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateForm;
