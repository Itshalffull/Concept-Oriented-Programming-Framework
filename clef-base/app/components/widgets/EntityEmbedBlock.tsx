'use client';

/**
 * EntityEmbedBlock — configuration UI for entity-embed block types.
 *
 * Provides an entity ID input with inline validation: on every change
 * (debounced 300 ms) and on blur, the input calls ContentNode/get to
 * verify the ID resolves to a real entity. While the ID is unresolved
 * the save / confirm button is disabled.
 *
 * §2.5 EntityEmbedBlock invalid ID validation
 * (PRD: docs/plans/dead-end-interactions-prd.md §2.5)
 *
 * NOTE: This component will be superseded once the form-field-entity-picker-block
 * widget lands (tracked in clef-base/seeds/MISSING_WIDGETS.md under
 * "form-field-entity-picker-block"). At that point the free-text input here
 * should be replaced with the picker widget so only existing entities can be
 * selected in the first place.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';

// ─── Types ──────────────────────────────────────────────────────────────────

type ValidationStatus = 'idle' | 'validating' | 'ok' | 'not_found' | 'error';

interface ValidationState {
  status: ValidationStatus;
  resolvedTitle: string | null;
  errorMessage: string | null;
}

export interface EntityEmbedBlockProps {
  /** Current entity ID stored in block meta. Empty string = not yet set. */
  entityId: string;
  /**
   * Called when the user commits a (validated) entity ID.
   * The parent is responsible for persisting this value to block.meta.entityId.
   * Not called while status is 'not_found'.
   */
  onEntityIdChange: (newId: string) => void;
  /** When true, hides the input and shows only the resolved entity title. */
  readOnly?: boolean;
}

// ─── DEBOUNCE_MS ────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 300;

// ─── EntityEmbedBlock Component ──────────────────────────────────────────────

/**
 * EntityEmbedBlock provides entity ID entry with real-time validation.
 *
 * Validation flow:
 *   1. User types → debounce 300 ms → invoke ContentNode/get
 *   2. variant ok      → show resolved title below input
 *   3. variant not_found → show "Entity not found" error; save button disabled
 *   4. network/invoke error → show "Error looking up entity" with retry link
 *
 * The save button remains disabled while status is not_found.
 */
export const EntityEmbedBlock: React.FC<EntityEmbedBlockProps> = ({
  entityId: initialEntityId,
  onEntityIdChange,
  readOnly = false,
}) => {
  const invoke = useKernelInvoke();

  // Local input value (may differ from saved entityId during editing)
  const [inputValue, setInputValue] = useState(initialEntityId);

  const [validation, setValidation] = useState<ValidationState>({
    status: initialEntityId ? 'idle' : 'idle',
    resolvedTitle: null,
    errorMessage: null,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef = useRef(false);

  // ── Validate ──────────────────────────────────────────────────────────────

  const validate = useCallback(
    async (id: string) => {
      const trimmed = id.trim();
      if (!trimmed) {
        setValidation({ status: 'idle', resolvedTitle: null, errorMessage: null });
        return;
      }

      setValidation({ status: 'validating', resolvedTitle: null, errorMessage: null });
      cancelRef.current = false;

      try {
        const result = await invoke('ContentNode', 'get', { node: trimmed });
        if (cancelRef.current) return;

        if (result.variant === 'ok') {
          // ContentNode/get returns 'title' (LinkHoverPreview pattern) or
          // 'name' (BlockEmbed pattern) depending on handler version.
          // Fall through both, then the ID as a last resort.
          const title =
            (result.title as string | undefined)?.trim() ||
            (result.name as string | undefined)?.trim() ||
            (result.node as string | undefined) ??
            trimmed;
          setValidation({ status: 'ok', resolvedTitle: title, errorMessage: null });
        } else if (result.variant === 'not_found' || result.variant === 'notfound') {
          setValidation({
            status: 'not_found',
            resolvedTitle: null,
            errorMessage: 'Entity not found',
          });
        } else {
          setValidation({
            status: 'error',
            resolvedTitle: null,
            errorMessage: 'Error looking up entity',
          });
        }
      } catch {
        if (!cancelRef.current) {
          setValidation({
            status: 'error',
            resolvedTitle: null,
            errorMessage: 'Error looking up entity',
          });
        }
      }
    },
    [invoke],
  );

  // ── Debounced validation on input change ──────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Cancel any in-flight request
    cancelRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      void validate(value);
    }, DEBOUNCE_MS);
  };

  // ── Immediate validation on blur ──────────────────────────────────────────

  const handleBlur = () => {
    cancelRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void validate(inputValue);
  };

  // ── Retry (for error state) ───────────────────────────────────────────────

  const handleRetry = () => {
    void validate(inputValue);
  };

  // ── Commit (save button) ──────────────────────────────────────────────────

  const handleSave = () => {
    if (validation.status !== 'ok') return;
    onEntityIdChange(inputValue.trim());
  };

  // ── Validate initial value on mount if one is already set ─────────────────

  useEffect(() => {
    if (initialEntityId) {
      void validate(initialEntityId);
    }
    return () => {
      cancelRef.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // Only run once on mount — intentionally omit validate from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived flags ─────────────────────────────────────────────────────────

  const isNotFound = validation.status === 'not_found';
  const isError = validation.status === 'error';
  const isOk = validation.status === 'ok';
  const isValidating = validation.status === 'validating';
  const saveDisabled = validation.status !== 'ok';

  // ── Read-only rendering ───────────────────────────────────────────────────

  if (readOnly) {
    return (
      <div
        data-part="entity-embed-root"
        data-state="readonly"
        style={{
          fontSize: '12px',
          color: 'var(--palette-on-surface-variant)',
          padding: '4px 0',
        }}
      >
        {isOk && validation.resolvedTitle ? (
          <span style={{ color: 'var(--palette-on-surface)' }}>{validation.resolvedTitle}</span>
        ) : (
          <span style={{ fontFamily: 'var(--typography-font-family-mono)', opacity: 0.7 }}>
            {inputValue || '—'}
          </span>
        )}
      </div>
    );
  }

  // ── Edit rendering ────────────────────────────────────────────────────────

  const borderColor = isNotFound
    ? '#ef4444'
    : isError
    ? '#f59e0b'
    : isOk
    ? '#22c55e'
    : 'var(--palette-outline-variant)';

  return (
    <div
      data-part="entity-embed-root"
      data-state={validation.status}
      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      {/* ── Input row ── */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="text"
          aria-label="Entity ID"
          aria-describedby="entity-embed-feedback"
          aria-invalid={isNotFound || isError}
          placeholder="Entity ID"
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          style={{
            flex: 1,
            background: 'var(--palette-surface)',
            border: `1px solid ${borderColor}`,
            borderRadius: 3,
            padding: '4px 8px',
            fontSize: '12px',
            color: 'var(--palette-on-surface)',
            outline: 'none',
            transition: 'border-color 150ms',
          }}
        />

        {/* Save / confirm button — disabled while not resolved */}
        <button
          onClick={handleSave}
          disabled={saveDisabled}
          aria-disabled={saveDisabled}
          title={saveDisabled ? 'Resolve a valid entity ID first' : 'Save entity ID'}
          style={{
            padding: '4px 10px',
            borderRadius: 3,
            border: '1px solid var(--palette-outline-variant)',
            background: saveDisabled
              ? 'var(--palette-surface-variant)'
              : 'var(--palette-primary)',
            color: saveDisabled
              ? 'var(--palette-on-surface-variant)'
              : 'var(--palette-on-primary)',
            fontSize: '12px',
            cursor: saveDisabled ? 'not-allowed' : 'pointer',
            opacity: saveDisabled ? 0.55 : 1,
            transition: 'background 150ms, opacity 150ms',
          }}
        >
          Save
        </button>
      </div>

      {/* ── Inline feedback ── */}
      <div
        id="entity-embed-feedback"
        role={isNotFound || isError ? 'alert' : 'status'}
        aria-live="polite"
        style={{ fontSize: '11px', minHeight: 16, paddingLeft: 2 }}
      >
        {isValidating && (
          <span style={{ color: 'var(--palette-on-surface-variant)', opacity: 0.7 }}>
            Checking…
          </span>
        )}

        {isOk && validation.resolvedTitle && (
          <span
            data-part="resolved-title"
            style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span aria-hidden="true">✓</span>
            <span>{validation.resolvedTitle}</span>
          </span>
        )}

        {isNotFound && (
          <span
            data-part="error-message"
            style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span aria-hidden="true">✕</span>
            <span>Entity not found</span>
          </span>
        )}

        {isError && (
          <span
            data-part="error-message"
            style={{
              color: '#b45309',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span aria-hidden="true">⚠</span>
            <span>Error looking up entity —{' '}
              <button
                onClick={handleRetry}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'inherit',
                  fontSize: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                retry
              </button>
            </span>
          </span>
        )}
      </div>
    </div>
  );
};

export default EntityEmbedBlock;
