'use client';

/**
 * ContentCreationWidget — React implementation of ContentCreationWidget.widget
 *
 * Rendered in StepInteractionSlot when step_type === 'content-creation'.
 * Presents chrome (header, required-fields indicator, submit button, result
 * summary) around a formSlot. The formSlot carries data-schema so the
 * ComponentMapping runtime can mount a specialized form at Level 1/2/3;
 * the Level 3 fallback (title input + body textarea) is rendered here
 * when no specialized component overrides the slot.
 *
 * Widget spec: surface/ContentCreationWidget.widget
 * Anatomy parts (data-part attributes):
 *   root, header, form-slot, required-fields-indicator,
 *   submit-button, result
 *
 * FSM states (data-state on root):
 *   filling [initial] → submitting → submitted
 *                                  → error → filling (RETRY)
 *
 * API sequence on submit:
 *   POST /api/invoke/ContentNode/create  { title, body, schemaId }
 *   POST /api/invoke/Schema/applyTo      { nodeId, schemaId }
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// FSM state type — mirrors the widget spec states block exactly
// ---------------------------------------------------------------------------

type ContentCreationState = 'filling' | 'submitting' | 'submitted' | 'error';

// ---------------------------------------------------------------------------
// Props — match the interface declared in the task brief
// ---------------------------------------------------------------------------

export interface ContentCreationWidgetProps {
  stepRunId: string;
  processRunId: string;
  currentUserId: string;
  /** Schema ID e.g. "meeting-notes" */
  contentType: string;
  /** Human-readable e.g. "Meeting Notes" */
  contentTypeName: string;
  requiredFields: string[];
  /** "active" | "completed" */
  initialStatus: string;
  /** Set if already completed — node ID of the created content */
  initialNodeId?: string | null;
}

// ---------------------------------------------------------------------------
// Required-field tracking helpers
// ---------------------------------------------------------------------------

/**
 * Build a map of field -> value for all required fields.
 * Initialised to empty strings so the "N of M" indicator starts at 0.
 */
function buildInitialFieldValues(requiredFields: string[]): Record<string, string> {
  const vals: Record<string, string> = {};
  for (const f of requiredFields) {
    vals[f] = '';
  }
  return vals;
}

/** Count how many required fields currently have a non-empty trimmed value. */
function countFilled(
  fieldValues: Record<string, string>,
  requiredFields: string[],
): number {
  return requiredFields.filter((f) => (fieldValues[f] ?? '').trim().length > 0).length;
}

// ---------------------------------------------------------------------------
// Design system token shorthands (same vars used across the process widgets)
// ---------------------------------------------------------------------------

const COLOR_PRIMARY         = 'var(--palette-primary)';
const COLOR_ON_PRIMARY      = 'var(--palette-on-primary)';
const COLOR_SURFACE         = 'var(--palette-surface, #fff)';
const COLOR_ON_SURFACE      = 'var(--palette-on-surface, #1c1b1f)';
const COLOR_ON_SURFACE_VAR  = 'var(--palette-on-surface-variant, #49454f)';
const COLOR_ERROR           = 'var(--palette-error, #b3261e)';
const COLOR_SUCCESS         = 'var(--palette-success, #386a20)';
const COLOR_OUTLINE_VAR     = 'var(--palette-outline-variant, #cac4d0)';
const RADIUS_SM             = 'var(--radius-sm, 4px)';
const RADIUS_MD             = 'var(--radius-md, 8px)';
const SPACING_XS            = 'var(--spacing-xs, 4px)';
const SPACING_SM            = 'var(--spacing-sm, 8px)';
const SPACING_MD            = 'var(--spacing-md, 16px)';
const SPACING_LG            = 'var(--spacing-lg, 24px)';
const FONT_BODY_SM_SIZE     = 'var(--typography-body-sm-size, 13px)';
const FONT_BODY_MD_SIZE     = 'var(--typography-body-md-size, 14px)';
const FONT_LABEL_SIZE       = 'var(--typography-label-size, 12px)';
const FONT_TITLE_SIZE       = 'var(--typography-title-md-size, 16px)';

// ---------------------------------------------------------------------------
// ContentCreationWidget
// ---------------------------------------------------------------------------

export const ContentCreationWidget: React.FC<ContentCreationWidgetProps> = ({
  stepRunId,
  processRunId,
  currentUserId,
  contentType,
  contentTypeName,
  requiredFields,
  initialStatus,
  initialNodeId,
}) => {
  // ---- Derive initial FSM state from props --------------------------------
  // If the step was already completed when mounted, jump straight to submitted.
  const computeInitialState = (): ContentCreationState => {
    if (initialStatus === 'completed' && initialNodeId) return 'submitted';
    return 'filling';
  };

  const [fsmState, setFsmState]     = useState<ContentCreationState>(computeInitialState);
  const [nodeId, setNodeId]         = useState<string | null>(initialNodeId ?? null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // ---- Level 3 fallback form values ---------------------------------------
  // title is always tracked; body is optional. Required-field detection
  // maps field names "title" and "body" to these two inputs.
  const [title, setTitle]   = useState<string>('');
  const [body, setBody]     = useState<string>('');

  // Per-required-field value map — used for the "N of M filled" indicator.
  // For the Level 3 fallback the only fields we render are "title" and "body";
  // any other declared required fields are treated as unfilled until a
  // specialized form component (Level 1/2) writes them into the slot.
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    () => buildInitialFieldValues(requiredFields),
  );

  // Sync title and body into fieldValues so the counter stays accurate.
  useEffect(() => {
    setFieldValues((prev) => {
      const next = { ...prev };
      if ('title' in next) next['title'] = title;
      if ('body'  in next) next['body']  = body;
      return next;
    });
  }, [title, body]);

  // ---- Required-field progress -------------------------------------------
  const filledCount = countFilled(fieldValues, requiredFields);
  const totalCount  = requiredFields.length;
  const allFilled   = filledCount === totalCount;

  // Whether the submit button should be interactive.
  // Disabled when: not all required fields filled, OR state is not filling/error.
  const submitDisabled =
    !allFilled ||
    fsmState === 'submitting' ||
    fsmState === 'submitted';

  // ---- Keyboard handling (Enter → SUBMIT, Escape → RETRY) ----------------
  const rootRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // Only trigger submit when focus is NOT inside a textarea (multi-line).
        const target = e.target as HTMLElement;
        if (target.tagName === 'TEXTAREA') return;
        if (fsmState === 'filling' && !submitDisabled) {
          e.preventDefault();
          handleSubmit();
        }
      } else if (e.key === 'Escape') {
        if (fsmState === 'error') {
          e.preventDefault();
          handleRetry();
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fsmState, submitDisabled],
  );

  // ---- Submit: SUBMIT event → submitting → submitted | error -------------
  const handleSubmit = useCallback(async () => {
    if (fsmState !== 'filling' && fsmState !== 'error') return;
    if (submitDisabled) return;

    setFsmState('submitting');
    setErrorMessage('');

    try {
      // Step 1: Create the ContentNode
      const createRes = await fetch('/api/invoke/ContentNode/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body,
          schemaId: contentType,
          processRunId,
          stepRunId,
          userId: currentUserId,
        }),
      });

      if (!createRes.ok) {
        const text = await createRes.text().catch(() => '');
        throw new Error(text || `ContentNode/create failed (${createRes.status})`);
      }

      const createData = await createRes.json() as Record<string, unknown>;

      if (createData.variant !== 'ok') {
        const msg =
          typeof createData.message === 'string'
            ? createData.message
            : `ContentNode/create returned: ${String(createData.variant ?? 'unknown')}`;
        throw new Error(msg);
      }

      const createdNodeId = createData.node as string;

      // Step 2: Apply the schema overlay
      const applyRes = await fetch('/api/invoke/Schema/applyTo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: createdNodeId,
          schemaId: contentType,
        }),
      });

      // Schema/applyTo failure is non-fatal — log but do not block.
      if (!applyRes.ok) {
        console.warn(
          '[ContentCreationWidget] Schema/applyTo failed:',
          await applyRes.text().catch(() => ''),
        );
      } else {
        const applyData = await applyRes.json() as Record<string, unknown>;
        if (applyData.variant !== 'ok') {
          console.warn(
            '[ContentCreationWidget] Schema/applyTo returned:',
            applyData.variant,
          );
        }
      }

      // Transition: submitting → submitted (NODE_CREATED event)
      setNodeId(createdNodeId);
      setFsmState('submitted');
    } catch (err) {
      // Transition: submitting → error (CREATE_FAILED event)
      const msg = err instanceof Error ? err.message : 'Submission failed. Please try again.';
      setErrorMessage(msg);
      setFsmState('error');
    }
  }, [
    fsmState,
    submitDisabled,
    title,
    body,
    contentType,
    processRunId,
    stepRunId,
    currentUserId,
  ]);

  // ---- Retry: RETRY event → filling --------------------------------------
  const handleRetry = useCallback(() => {
    if (fsmState !== 'error') return;
    setErrorMessage('');
    setFsmState('filling');
  }, [fsmState]);

  // ---- Derived booleans for connect bindings -----------------------------
  const formSlotHidden     = fsmState === 'submitted';
  const formSlotDisabled   = fsmState === 'submitting';
  const indicatorHidden    = fsmState === 'submitted' || fsmState === 'submitting';
  const submitHidden       = fsmState === 'submitted';
  const resultHidden       = fsmState !== 'submitted';
  const rootAriaBusy       = fsmState === 'submitting' ? 'true' : 'false';
  const submitAriaDisabled = fsmState === 'submitting' ? 'true' : 'false';

  // ---- Render ------------------------------------------------------------
  return (
    <div
      ref={rootRef}
      data-part="root"
      data-state={fsmState}
      role="form"
      aria-label={`Create ${contentTypeName}`}
      aria-busy={rootAriaBusy}
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING_MD,
        background: COLOR_SURFACE,
        borderRadius: RADIUS_MD,
        border: `1px solid ${COLOR_OUTLINE_VAR}`,
        padding: SPACING_LG,
        color: COLOR_ON_SURFACE,
      }}
    >
      {/* ---- header: anatomy part ---------------------------------------- */}
      <div
        data-part="header"
        style={{
          fontSize: FONT_TITLE_SIZE,
          fontWeight: 600,
          color: COLOR_ON_SURFACE,
          borderBottom: `1px solid ${COLOR_OUTLINE_VAR}`,
          paddingBottom: SPACING_SM,
        }}
      >
        {`Create: ${contentTypeName}`}
      </div>

      {/* ---- formSlot: ComponentMapping extension point ------------------- */}
      {!formSlotHidden && (
        <div
          data-part="form-slot"
          data-schema={contentType}
          role="region"
          aria-label={`${contentTypeName} form`}
          aria-disabled={formSlotDisabled ? 'true' : 'false'}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING_MD,
            opacity: formSlotDisabled ? 0.6 : 1,
            pointerEvents: formSlotDisabled ? 'none' : 'auto',
            transition: 'opacity 0.15s ease',
          }}
        >
          {/*
           * Level 3 fallback — auto-form for title + body.
           * The data-schema attribute allows the runtime ComponentMapping to
           * replace this subtree with a specialized registered form (Level 1/2).
           */}

          {/* Title field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING_XS }}>
            <label
              htmlFor={`ccw-title-${stepRunId}`}
              style={{
                fontSize: FONT_LABEL_SIZE,
                fontWeight: 600,
                color: COLOR_ON_SURFACE_VAR,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Title
              {requiredFields.includes('title') && (
                <span
                  aria-hidden="true"
                  style={{ color: COLOR_ERROR, marginLeft: '2px' }}
                >
                  *
                </span>
              )}
            </label>
            <input
              id={`ccw-title-${stepRunId}`}
              type="text"
              value={title}
              disabled={formSlotDisabled}
              placeholder={`${contentTypeName} title`}
              aria-required={requiredFields.includes('title') ? 'true' : 'false'}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                border: `1px solid ${COLOR_OUTLINE_VAR}`,
                borderRadius: RADIUS_SM,
                fontSize: FONT_BODY_MD_SIZE,
                color: COLOR_ON_SURFACE,
                background: COLOR_SURFACE,
                outline: 'none',
              }}
            />
          </div>

          {/* Body field — always shown as a long-form fallback */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING_XS }}>
            <label
              htmlFor={`ccw-body-${stepRunId}`}
              style={{
                fontSize: FONT_LABEL_SIZE,
                fontWeight: 600,
                color: COLOR_ON_SURFACE_VAR,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Body
              {requiredFields.includes('body') && (
                <span
                  aria-hidden="true"
                  style={{ color: COLOR_ERROR, marginLeft: '2px' }}
                >
                  *
                </span>
              )}
            </label>
            <textarea
              id={`ccw-body-${stepRunId}`}
              value={body}
              disabled={formSlotDisabled}
              placeholder="Add content…"
              rows={5}
              aria-required={requiredFields.includes('body') ? 'true' : 'false'}
              onChange={(e) => setBody(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                border: `1px solid ${COLOR_OUTLINE_VAR}`,
                borderRadius: RADIUS_SM,
                fontSize: FONT_BODY_MD_SIZE,
                color: COLOR_ON_SURFACE,
                background: COLOR_SURFACE,
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
      )}

      {/* ---- requiredFieldsIndicator: anatomy part ------------------------ */}
      {!indicatorHidden && totalCount > 0 && (
        <div
          data-part="required-fields-indicator"
          style={{
            fontSize: FONT_BODY_SM_SIZE,
            color: allFilled ? COLOR_SUCCESS : COLOR_ON_SURFACE_VAR,
          }}
        >
          {filledCount} of {totalCount} required field{totalCount !== 1 ? 's' : ''} filled
        </div>
      )}

      {/* ---- error state: inline message + Retry -------------------------- */}
      {fsmState === 'error' && errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: SPACING_SM,
            background: 'var(--palette-error-container, #f9dedc)',
            color: COLOR_ERROR,
            border: `1px solid ${COLOR_ERROR}`,
            borderRadius: RADIUS_SM,
            padding: `${SPACING_SM} ${SPACING_MD}`,
            fontSize: FONT_BODY_SM_SIZE,
          }}
        >
          <span style={{ flex: 1 }}>{errorMessage}</span>
          <button
            data-part="retry-button"
            onClick={handleRetry}
            style={{
              background: 'none',
              border: `1px solid ${COLOR_ERROR}`,
              borderRadius: RADIUS_SM,
              color: COLOR_ERROR,
              cursor: 'pointer',
              fontSize: FONT_BODY_SM_SIZE,
              fontWeight: 600,
              padding: '2px 10px',
              whiteSpace: 'nowrap',
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* ---- submitButton: anatomy part ----------------------------------- */}
      {!submitHidden && (
        <button
          data-part="submit-button"
          disabled={submitDisabled}
          aria-disabled={submitAriaDisabled}
          onClick={submitDisabled ? undefined : handleSubmit}
          style={{
            alignSelf: 'flex-start',
            background: submitDisabled ? COLOR_OUTLINE_VAR : COLOR_PRIMARY,
            color: submitDisabled ? COLOR_ON_SURFACE_VAR : COLOR_ON_PRIMARY,
            border: 'none',
            borderRadius: RADIUS_SM,
            padding: '9px 22px',
            fontWeight: 600,
            fontSize: FONT_BODY_MD_SIZE,
            cursor: submitDisabled ? 'not-allowed' : 'pointer',
            opacity: fsmState === 'submitting' ? 0.75 : 1,
            transition: 'background 0.15s ease, opacity 0.15s ease',
          }}
        >
          {fsmState === 'submitting' ? 'Submitting…' : 'Submit'}
        </button>
      )}

      {/* ---- result: anatomy part (submitted state only) ------------------ */}
      <div
        data-part="result"
        aria-live="polite"
        aria-atomic="true"
        hidden={resultHidden}
        style={
          resultHidden
            ? { display: 'none' }
            : {
                display: 'flex',
                flexDirection: 'column',
                gap: SPACING_SM,
                padding: `${SPACING_MD} 0`,
              }
        }
      >
        {!resultHidden && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING_SM,
                color: COLOR_SUCCESS,
                fontWeight: 600,
                fontSize: FONT_BODY_MD_SIZE,
              }}
            >
              <span aria-hidden="true">&#10003;</span>
              {`Created: ${title || contentTypeName}`}
            </div>
            {nodeId && (
              <a
                href={`/content/${nodeId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: SPACING_XS,
                  color: COLOR_PRIMARY,
                  fontSize: FONT_BODY_SM_SIZE,
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Open page
                <span aria-hidden="true" style={{ fontSize: '0.9em' }}>&#x2197;</span>
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ContentCreationWidget;
