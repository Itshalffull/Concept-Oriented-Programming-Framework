/* ---------------------------------------------------------------------------
 * HitlInterrupt — Human-in-the-Loop Interrupt Banner
 * Displays a prompt requesting human approval for an agent action.
 * See widget spec: repertoire/concepts/llm-agent/widgets/hitl-interrupt.widget
 * ------------------------------------------------------------------------- */

export type HitlInterruptState = 'pending' | 'editing' | 'approving' | 'rejecting' | 'forking' | 'resolved';
export type HitlInterruptEvent =
  | { type: 'APPROVE' }
  | { type: 'REJECT' }
  | { type: 'MODIFY' }
  | { type: 'FORK' }
  | { type: 'SAVE' }
  | { type: 'CANCEL' }
  | { type: 'COMPLETE' }
  | { type: 'ERROR' };

export function hitlInterruptReducer(state: HitlInterruptState, event: HitlInterruptEvent): HitlInterruptState {
  switch (state) {
    case 'pending':
      if (event.type === 'APPROVE') return 'approving';
      if (event.type === 'REJECT') return 'rejecting';
      if (event.type === 'MODIFY') return 'editing';
      if (event.type === 'FORK') return 'forking';
      return state;
    case 'editing':
      if (event.type === 'SAVE') return 'pending';
      if (event.type === 'CANCEL') return 'pending';
      return state;
    case 'approving':
      if (event.type === 'COMPLETE') return 'resolved';
      if (event.type === 'ERROR') return 'pending';
      return state;
    case 'rejecting':
      if (event.type === 'COMPLETE') return 'resolved';
      return state;
    case 'forking':
      if (event.type === 'COMPLETE') return 'resolved';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type HTMLAttributes,
} from 'react';

/* ---------------------------------------------------------------------------
 * Risk-level configuration
 * ------------------------------------------------------------------------- */

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

const RISK_CONFIG: Record<RiskLevel, { label: string; icon: string }> = {
  low:      { label: 'Low Risk',      icon: '\u2713' },  // checkmark
  medium:   { label: 'Medium Risk',   icon: '\u26A0' },  // warning
  high:     { label: 'High Risk',     icon: '\u2622' },  // biohazard-ish
  critical: { label: 'Critical Risk', icon: '\u2716' },  // heavy x
};

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface HitlInterruptProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'action'> {
  /** Description of what the agent wants to do. */
  action: string;
  /** Why human approval is required. */
  reason: string;
  /** Risk level of the proposed action. */
  risk: RiskLevel;
  /** Optional additional context (shown in expandable section). */
  context?: string | undefined;
  /** Callback when the user approves the action. */
  onApprove?: () => void;
  /** Callback when the user denies the action. */
  onDeny?: () => void;
  /** Callback when the user requests more information. */
  onRequestInfo?: () => void;
  /** Auto-deny timeout in seconds. When set, shows a countdown and auto-denies when it reaches 0. */
  autoDenySeconds?: number | undefined;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const HitlInterrupt = forwardRef<HTMLDivElement, HitlInterruptProps>(function HitlInterrupt(
  {
    action,
    reason,
    risk,
    context,
    onApprove,
    onDeny,
    onRequestInfo,
    autoDenySeconds,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(hitlInterruptReducer, 'pending');
  const [contextExpanded, setContextExpanded] = useState(false);
  const [countdown, setCountdown] = useState(autoDenySeconds ?? 0);

  const approveRef = useRef<HTMLButtonElement>(null);
  const reasonId = useId();
  const actionId = useId();

  const isResolved = state === 'resolved';
  const riskInfo = RISK_CONFIG[risk];

  // Auto-focus the approve button on mount
  useEffect(() => {
    approveRef.current?.focus();
  }, []);

  // Auto-deny countdown timer
  useEffect(() => {
    if (autoDenySeconds == null || autoDenySeconds <= 0 || isResolved) return;
    setCountdown(autoDenySeconds);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoDenySeconds, isResolved]);

  // Fire onDeny when countdown reaches 0
  useEffect(() => {
    if (autoDenySeconds != null && autoDenySeconds > 0 && countdown === 0 && !isResolved) {
      send({ type: 'REJECT' });
      onDeny?.();
    }
  }, [countdown, autoDenySeconds, isResolved, onDeny]);

  const handleApprove = useCallback(() => {
    if (isResolved) return;
    send({ type: 'APPROVE' });
    onApprove?.();
  }, [isResolved, onApprove]);

  const handleDeny = useCallback(() => {
    if (isResolved) return;
    send({ type: 'REJECT' });
    onDeny?.();
  }, [isResolved, onDeny]);

  const handleRequestInfo = useCallback(() => {
    if (isResolved) return;
    onRequestInfo?.();
  }, [isResolved, onRequestInfo]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isResolved) return;

    // Only handle shortcuts when not focused on a button (let buttons handle their own Enter)
    const target = e.target as HTMLElement;
    const isButton = target.tagName === 'BUTTON';

    if (e.key === 'Escape') {
      e.preventDefault();
      handleDeny();
    }

    // Tab is handled natively for focus cycling between buttons
    if (e.key === 'Enter' && !isButton) {
      e.preventDefault();
      handleApprove();
    }
  }, [isResolved, handleApprove, handleDeny]);

  return (
    <div
      ref={ref}
      role="alertdialog"
      aria-label="Agent requires approval"
      aria-describedby={actionId}
      data-surface-widget=""
      data-widget-name="hitl-interrupt"
      data-part="root"
      data-state={state}
      data-risk={risk}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {/* Header with risk badge and status */}
      <div data-part="header" data-state={state} data-risk={risk}>
        <span
          data-part="risk-badge"
          data-risk={risk}
          role="status"
          aria-label={riskInfo.label}
        >
          {riskInfo.icon} {riskInfo.label}
        </span>

        {autoDenySeconds != null && autoDenySeconds > 0 && !isResolved && (
          <span
            data-part="countdown"
            aria-live="polite"
            aria-label={`Auto-deny in ${countdown} seconds`}
          >
            Auto-deny in {countdown}s
          </span>
        )}

        {isResolved && (
          <span data-part="resolution-badge" role="status" aria-label="Resolved">
            Resolved
          </span>
        )}
      </div>

      {/* Action description */}
      <div data-part="action" id={actionId}>
        <strong>Action:</strong> {action}
      </div>

      {/* Reason text */}
      <p data-part="reason" id={reasonId}>
        <strong>Reason:</strong> {reason}
      </p>

      {/* Optional expandable context */}
      {context != null && (
        <div data-part="context" data-expanded={contextExpanded ? 'true' : 'false'}>
          <button
            type="button"
            data-part="context-toggle"
            aria-expanded={contextExpanded}
            aria-label={contextExpanded ? 'Hide additional context' : 'Show additional context'}
            tabIndex={0}
            onClick={() => setContextExpanded((prev) => !prev)}
          >
            {contextExpanded ? '\u25BC' : '\u25B6'} Additional Context
          </button>
          {contextExpanded && (
            <div data-part="context-detail" aria-label="Additional context">
              {context}
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div data-part="action-bar" data-state={state}>
        <button
          ref={approveRef}
          type="button"
          data-part="approve"
          data-state={state}
          aria-label="Approve"
          tabIndex={0}
          disabled={isResolved}
          onClick={handleApprove}
        >
          {state === 'approving' ? 'Approving\u2026' : 'Approve'}
        </button>

        <button
          type="button"
          data-part="deny"
          data-state={state}
          aria-label="Deny"
          tabIndex={0}
          disabled={isResolved}
          onClick={handleDeny}
        >
          {state === 'rejecting' ? 'Denying\u2026' : 'Deny'}
        </button>

        <button
          type="button"
          data-part="request-info"
          data-state={state}
          aria-label="Ask for more info"
          tabIndex={0}
          disabled={isResolved}
          onClick={handleRequestInfo}
        >
          Ask for more info
        </button>
      </div>
    </div>
  );
});

HitlInterrupt.displayName = 'HitlInterrupt';
export { HitlInterrupt };
export default HitlInterrupt;
