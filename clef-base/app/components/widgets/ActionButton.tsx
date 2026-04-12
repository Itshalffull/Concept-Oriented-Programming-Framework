'use client';

/**
 * ActionButton — React adapter for the action-button.widget spec.
 *
 * Connects to ActionBinding through the Clef kernel exclusively via
 * useKernelInvoke. All action invocation, confirmation gating, and
 * outcome state are owned by ActionBinding's handler; this component
 * only renders the widget anatomy and maps ActionBinding's completion
 * variants to FSM states.
 *
 * Widget spec: surface/widgets/action-button.widget
 * Anatomy parts (data-part attributes): root, button, label, icon,
 *   spinner, success-icon, error-message, retry-button
 *
 * FSM states (data-state on root): idle, confirming, executing,
 *   success, error, invalid, notfound, unauthorized
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ActionButtonProps {
  /** ActionBinding ID — references a pre-created binding */
  binding: string;
  /** Runtime context (row data, page state, etc.) for parameter resolution */
  context: Record<string, unknown>;
  /** Override label (otherwise read from ActionBinding on mount) */
  label?: string;
  /** Override icon */
  icon?: string;
  /** Visual variant override */
  buttonVariant?: 'default' | 'primary' | 'destructive' | 'ghost';
  /** Called after successful action */
  onSuccess?: (result: Record<string, unknown>) => void;
  /** Called after failed action */
  onError?: (variant: string, message: string) => void;
  /** Disable the button externally */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// FSM state type — mirrors the widget spec states block exactly
// ---------------------------------------------------------------------------

type ActionButtonState =
  | 'idle'
  | 'confirming'
  | 'executing'
  | 'success'
  | 'error'
  | 'invalid'
  | 'notfound'
  | 'unauthorized';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map an ActionBinding completion variant to the widget's FSM state.
 * Section 16.12 — widget spec states / connect blocks.
 */
function variantToState(variant: string): ActionButtonState {
  switch (variant) {
    case 'ok':           return 'success';
    case 'error':        return 'error';
    case 'invalid':      return 'invalid';
    case 'notfound':     return 'notfound';
    case 'unauthorized': return 'unauthorized';
    case 'confirming':   return 'confirming';
    default:             return 'error';
  }
}

// ---------------------------------------------------------------------------
// ActionButton (full variant)
// ---------------------------------------------------------------------------

export const ActionButton: React.FC<ActionButtonProps> = ({
  binding,
  context,
  label: labelProp,
  icon: iconProp,
  buttonVariant: buttonVariantProp,
  onSuccess,
  onError,
  disabled = false,
}) => {
  const invoke = useKernelInvoke();

  // ------- kernel-sourced config from ActionBinding --------
  const [resolvedLabel, setResolvedLabel] = useState<string>(labelProp ?? '');
  const [resolvedIcon, setResolvedIcon] = useState<string | undefined>(iconProp);
  const [resolvedVariant, setResolvedVariant] = useState<string>(buttonVariantProp ?? 'default');
  const [retryable, setRetryable] = useState<boolean>(false);

  // ------- FSM state --------
  const [fsmState, setFsmState] = useState<ActionButtonState>('idle');

  // ------- outcome data --------
  const [errorText, setErrorText] = useState<string>('');
  const [violations, setViolations] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<Record<string, unknown>>({});

  // ------- auto-dismiss timer ref --------
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ------- stable context ref so callbacks don't stale-close over context --------
  const contextRef = useRef(context);
  useEffect(() => { contextRef.current = context; }, [context]);

  // ------- mount: read ActionBinding config --------
  useEffect(() => {
    // Props always override kernel defaults
    if (labelProp !== undefined && iconProp !== undefined && buttonVariantProp !== undefined) {
      return;
    }

    let cancelled = false;
    async function fetchConfig() {
      try {
        const result = await invoke('ActionBinding', 'get', { binding });
        if (cancelled) return;
        if (result.variant === 'ok') {
          if (labelProp === undefined && typeof result.label === 'string') {
            setResolvedLabel(result.label);
          }
          if (iconProp === undefined && typeof result.icon === 'string') {
            setResolvedIcon(result.icon);
          }
          if (buttonVariantProp === undefined && typeof result.buttonVariant === 'string') {
            setResolvedVariant(result.buttonVariant);
          }
          if (typeof result.retryable === 'boolean') {
            setRetryable(result.retryable);
          }
        }
      } catch {
        // Silently fall back to prop defaults — non-fatal
      }
    }

    fetchConfig();
    return () => { cancelled = true; };
  }, [binding, labelProp, iconProp, buttonVariantProp, invoke]);

  // ------- prop overrides update resolved values when changed --------
  useEffect(() => { if (labelProp !== undefined) setResolvedLabel(labelProp); }, [labelProp]);
  useEffect(() => { if (iconProp !== undefined) setResolvedIcon(iconProp); }, [iconProp]);
  useEffect(() => { if (buttonVariantProp !== undefined) setResolvedVariant(buttonVariantProp); }, [buttonVariantProp]);

  // ------- auto-dismiss from success after 2s (startAutoDismissTimer entry action) --------
  useEffect(() => {
    if (fsmState === 'success') {
      autoDismissRef.current = setTimeout(() => {
        setFsmState('idle');
      }, 2000);
    }
    return () => {
      if (autoDismissRef.current !== null) {
        clearTimeout(autoDismissRef.current);
        autoDismissRef.current = null;
      }
    };
  }, [fsmState]);

  // ------- core execution: calls ActionBinding/invoke through the kernel --------
  const executeAction = useCallback(async () => {
    setFsmState('executing');
    setErrorText('');
    setViolations([]);

    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding,
        context: JSON.stringify(contextRef.current),
      });

      const nextState = variantToState(result.variant as string);
      setLastResult(result as Record<string, unknown>);

      if (nextState === 'success') {
        setFsmState('success');
        onSuccess?.(result as Record<string, unknown>);
      } else if (nextState === 'confirming') {
        // ActionBinding is requesting explicit confirmation before proceeding
        setFsmState('confirming');
      } else {
        // error / invalid / notfound / unauthorized
        const msg =
          typeof result.message === 'string' ? result.message :
          typeof result.reason  === 'string' ? result.reason  :
          `Action returned: ${result.variant}`;
        const vs = Array.isArray(result.violations)
          ? (result.violations as string[])
          : [];
        setErrorText(msg);
        setViolations(vs);
        setFsmState(nextState);
        onError?.(result.variant as string, msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setErrorText(msg);
      setFsmState('error');
      onError?.('error', msg);
    }
  }, [binding, invoke, onSuccess, onError]);

  // ------- event handlers mapped to FSM transitions --------

  // CLICK from idle → confirming (widget spec) or CLICK_DIRECT → executing
  // We use CLICK_DIRECT semantics here: the confirmation gate is handled by
  // ActionBinding returning variant 'confirming'. If ActionBinding returns
  // 'confirming' the component transitions to the confirming state above.
  const handleClick = useCallback(() => {
    if (fsmState !== 'idle' || disabled) return;
    executeAction();
  }, [fsmState, disabled, executeAction]);

  // CONFIRM from confirming → executing via ActionBinding/confirm
  const handleConfirm = useCallback(async () => {
    if (fsmState !== 'confirming') return;
    setFsmState('executing');
    setErrorText('');
    try {
      const result = await invoke('ActionBinding', 'confirm', { binding });
      const nextState = variantToState(result.variant as string);
      setLastResult(result as Record<string, unknown>);

      if (nextState === 'success') {
        setFsmState('success');
        onSuccess?.(result as Record<string, unknown>);
      } else {
        const msg =
          typeof result.message === 'string' ? result.message :
          `Action returned: ${result.variant}`;
        setErrorText(msg);
        setFsmState(nextState);
        onError?.(result.variant as string, msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setErrorText(msg);
      setFsmState('error');
      onError?.('error', msg);
    }
  }, [fsmState, binding, invoke, onSuccess, onError]);

  // CANCEL from confirming → idle via ActionBinding/cancel
  const handleCancel = useCallback(async () => {
    if (fsmState !== 'confirming') return;
    try {
      await invoke('ActionBinding', 'cancel', { binding });
    } catch {
      // Ignore cancel errors; state resets regardless
    }
    setFsmState('idle');
  }, [fsmState, binding, invoke]);

  // RETRY from error → executing (re-invoke with same context)
  const handleRetry = useCallback(() => {
    if (fsmState !== 'error') return;
    executeAction();
  }, [fsmState, executeAction]);

  // DISMISS from error/invalid/notfound/unauthorized → idle
  const handleDismiss = useCallback(() => {
    if (
      fsmState === 'error' ||
      fsmState === 'invalid' ||
      fsmState === 'notfound' ||
      fsmState === 'unauthorized'
    ) {
      setFsmState('idle');
    }
  }, [fsmState]);

  // ------- keyboard bindings (Enter/Space → CLICK, Escape → CANCEL/DISMISS) --------
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (fsmState === 'confirming') {
        handleCancel();
      } else if (
        fsmState === 'error' ||
        fsmState === 'invalid' ||
        fsmState === 'notfound' ||
        fsmState === 'unauthorized'
      ) {
        handleDismiss();
      }
    }
  }, [fsmState, handleClick, handleCancel, handleDismiss]);

  // ------- derived booleans for connect bindings --------
  const isButtonDisabled =
    fsmState === 'executing' || fsmState === 'confirming' || disabled;

  const showSpinner     = fsmState === 'executing';
  const showSuccessIcon = fsmState === 'success';
  const showError       = fsmState === 'error' || fsmState === 'invalid' ||
                          fsmState === 'notfound' || fsmState === 'unauthorized';
  const showRetry       = fsmState === 'error' && retryable;
  const showIcon        = !!resolvedIcon;

  // ------- label: show confirming cue when in confirming state --------
  const displayLabel =
    fsmState === 'confirming' ? (resolvedLabel || 'Confirm?') : resolvedLabel;

  return (
    <div
      data-part="root"
      data-state={fsmState}
      data-variant={resolvedVariant}
      data-disabled={disabled ? 'true' : 'false'}
      role="none"
      aria-live="polite"
      aria-atomic="true"
      style={{ display: 'inline-flex', flexDirection: 'column', gap: 'var(--spacing-xs, 4px)' }}
    >
      {/* Primary button — anatomy part: button */}
      <button
        data-part="button"
        data-variant={resolvedVariant}
        data-loading={showSpinner ? 'true' : 'false'}
        disabled={isButtonDisabled}
        aria-label={resolvedLabel || undefined}
        aria-busy={showSpinner ? 'true' : 'false'}
        aria-disabled={isButtonDisabled || disabled ? 'true' : 'false'}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs, 4px)',
          cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        {/* icon — anatomy part: icon */}
        {showIcon && (
          <span
            data-part="icon"
            data-icon={resolvedIcon}
            role="presentation"
            aria-hidden="true"
          >
            {resolvedIcon}
          </span>
        )}

        {/* label — anatomy part: label */}
        <span
          data-part="label"
          role="none"
          aria-hidden="true"
        >
          {displayLabel}
        </span>

        {/* spinner — anatomy part: spinner; visible only in executing */}
        <span
          data-part="spinner"
          role="presentation"
          aria-hidden="true"
          data-active={showSpinner ? 'true' : 'false'}
          hidden={!showSpinner}
          style={showSpinner ? undefined : { display: 'none' }}
        />
      </button>

      {/* Confirmation row — shown in confirming state */}
      {fsmState === 'confirming' && (
        <div style={{ display: 'flex', gap: 'var(--spacing-xs, 4px)' }}>
          <button
            data-part="confirm-button"
            onClick={handleConfirm}
            aria-label="Confirm"
          >
            Confirm
          </button>
          <button
            data-part="cancel-button"
            onClick={handleCancel}
            aria-label="Cancel"
          >
            Cancel
          </button>
        </div>
      )}

      {/* successIcon — anatomy part: success-icon; visible only in success */}
      <span
        data-part="success-icon"
        role="presentation"
        aria-hidden="true"
        data-active={showSuccessIcon ? 'true' : 'false'}
        hidden={!showSuccessIcon}
        style={showSuccessIcon ? undefined : { display: 'none' }}
      />

      {/* errorMessage — anatomy part: error-message; visible in error variants */}
      <span
        data-part="error-message"
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        data-active={showError ? 'true' : 'false'}
        hidden={!showError}
        style={showError ? undefined : { display: 'none' }}
      >
        {errorText}
        {violations.length > 0 && (
          <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: '0.875em' }}>
            {violations.map((v, i) => <li key={i}>{v}</li>)}
          </ul>
        )}
      </span>

      {/* retryButton — anatomy part: retry-button; visible in error state when retryable */}
      <button
        data-part="retry-button"
        role="button"
        aria-label="Retry"
        data-visible={showRetry ? 'true' : 'false'}
        hidden={!showRetry}
        tabIndex={showRetry ? 0 : -1}
        onClick={handleRetry}
        style={showRetry ? undefined : { display: 'none' }}
      >
        Retry
      </button>

      {/* dismiss button — visible in error/invalid/notfound/unauthorized states */}
      {showError && (
        <button
          data-part="dismiss-button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          style={{ fontSize: '0.75em' }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ActionButtonCompact — inline variant for tables and lists
// ---------------------------------------------------------------------------

/**
 * Compact variant for row actions — just icon + loading spinner, no inline
 * error display. Errors and non-ok outcomes call onError; caller decides
 * how to surface them (toast, row highlight, etc.).
 *
 * Uses the same kernel pathway as ActionButton: all invocation goes through
 * invoke('ActionBinding', 'invoke', { binding, context }).
 */
export const ActionButtonCompact: React.FC<ActionButtonProps> = ({
  binding,
  context,
  label: labelProp,
  icon: iconProp,
  buttonVariant: buttonVariantProp,
  onSuccess,
  onError,
  disabled = false,
}) => {
  const invoke = useKernelInvoke();

  const [resolvedLabel, setResolvedLabel] = useState<string>(labelProp ?? '');
  const [resolvedIcon, setResolvedIcon] = useState<string | undefined>(iconProp);
  const [resolvedVariant, setResolvedVariant] = useState<string>(buttonVariantProp ?? 'default');

  const [fsmState, setFsmState] = useState<ActionButtonState>('idle');

  const contextRef = useRef(context);
  useEffect(() => { contextRef.current = context; }, [context]);

  // Mount: read label/icon/variant from ActionBinding if props don't override
  useEffect(() => {
    if (labelProp !== undefined && iconProp !== undefined && buttonVariantProp !== undefined) {
      return;
    }
    let cancelled = false;
    async function fetchConfig() {
      try {
        const result = await invoke('ActionBinding', 'get', { binding });
        if (cancelled) return;
        if (result.variant === 'ok') {
          if (labelProp === undefined && typeof result.label === 'string') {
            setResolvedLabel(result.label);
          }
          if (iconProp === undefined && typeof result.icon === 'string') {
            setResolvedIcon(result.icon);
          }
          if (buttonVariantProp === undefined && typeof result.buttonVariant === 'string') {
            setResolvedVariant(result.buttonVariant);
          }
        }
      } catch { /* non-fatal */ }
    }
    fetchConfig();
    return () => { cancelled = true; };
  }, [binding, labelProp, iconProp, buttonVariantProp, invoke]);

  useEffect(() => { if (labelProp !== undefined) setResolvedLabel(labelProp); }, [labelProp]);
  useEffect(() => { if (iconProp !== undefined) setResolvedIcon(iconProp); }, [iconProp]);
  useEffect(() => { if (buttonVariantProp !== undefined) setResolvedVariant(buttonVariantProp); }, [buttonVariantProp]);

  // Auto-return to idle after success (no inline success icon in compact)
  useEffect(() => {
    if (fsmState !== 'success') return;
    const t = setTimeout(() => setFsmState('idle'), 2000);
    return () => clearTimeout(t);
  }, [fsmState]);

  const handleClick = useCallback(async () => {
    if (fsmState !== 'idle' || disabled) return;
    setFsmState('executing');
    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding,
        context: JSON.stringify(contextRef.current),
      });

      if (result.variant === 'ok') {
        setFsmState('success');
        onSuccess?.(result as Record<string, unknown>);
      } else {
        // Compact: hand all non-ok outcomes to onError; reset to idle
        const msg =
          typeof result.message === 'string' ? result.message :
          typeof result.reason  === 'string' ? result.reason  :
          `Action returned: ${result.variant}`;
        setFsmState('idle');
        onError?.(result.variant as string, msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setFsmState('idle');
      onError?.('error', msg);
    }
  }, [fsmState, disabled, binding, invoke, onSuccess, onError]);

  const isExecuting = fsmState === 'executing';
  const showIcon    = !!resolvedIcon;

  return (
    <button
      data-part="button"
      data-state={fsmState}
      data-variant={resolvedVariant}
      data-loading={isExecuting ? 'true' : 'false'}
      disabled={isExecuting || disabled}
      aria-label={resolvedLabel || undefined}
      aria-busy={isExecuting ? 'true' : 'false'}
      aria-disabled={isExecuting || disabled ? 'true' : 'false'}
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs, 4px)',
        cursor: isExecuting || disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {/* icon */}
      {showIcon && !isExecuting && (
        <span
          data-part="icon"
          data-icon={resolvedIcon}
          role="presentation"
          aria-hidden="true"
        >
          {resolvedIcon}
        </span>
      )}

      {/* spinner — replaces icon while executing */}
      <span
        data-part="spinner"
        role="presentation"
        aria-hidden="true"
        data-active={isExecuting ? 'true' : 'false'}
        hidden={!isExecuting}
        style={isExecuting ? undefined : { display: 'none' }}
      />

      {/* label — always shown for screen readers */}
      <span data-part="label" role="none" aria-hidden="true">
        {resolvedLabel}
      </span>
    </button>
  );
};

export default ActionButton;
