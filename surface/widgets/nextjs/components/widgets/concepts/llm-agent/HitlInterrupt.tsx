/* ---------------------------------------------------------------------------
 * HitlInterrupt — Server Component
 *
 * Human-in-the-loop interrupt banner for agent execution. Displays
 * action, reason, risk level, and approval/deny buttons.
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

const RISK_CONFIG: Record<RiskLevel, { label: string; icon: string }> = {
  low:      { label: 'Low Risk',      icon: '\u2713' },
  medium:   { label: 'Medium Risk',   icon: '\u26A0' },
  high:     { label: 'High Risk',     icon: '\u2622' },
  critical: { label: 'Critical Risk', icon: '\u2716' },
};

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface HitlInterruptProps {
  /** Description of what the agent wants to do. */
  action: string;
  /** Why human approval is required. */
  reason: string;
  /** Risk level of the proposed action. */
  risk: RiskLevel;
  /** Optional additional context (shown in expandable section). */
  context?: string | undefined;
  /** Auto-deny timeout in seconds. */
  autoDenySeconds?: number | undefined;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function HitlInterrupt({
  action,
  reason,
  risk,
  context,
  autoDenySeconds,
}: HitlInterruptProps) {
  const riskInfo = RISK_CONFIG[risk];

  return (
    <div
      role="alertdialog"
      aria-label="Agent requires approval"
      data-surface-widget=""
      data-widget-name="hitl-interrupt"
      data-part="root"
      data-state="pending"
      data-risk={risk}
      tabIndex={0}
    >
      {/* Header with risk badge */}
      <div data-part="header" data-state="pending" data-risk={risk}>
        <span
          data-part="risk-badge"
          data-risk={risk}
          role="status"
          aria-label={riskInfo.label}
        >
          {riskInfo.icon} {riskInfo.label}
        </span>

        {autoDenySeconds != null && autoDenySeconds > 0 && (
          <span
            data-part="countdown"
            aria-live="polite"
            aria-label={`Auto-deny in ${autoDenySeconds} seconds`}
          >
            Auto-deny in {autoDenySeconds}s
          </span>
        )}
      </div>

      {/* Action description */}
      <div data-part="action">
        <strong>Action:</strong> {action}
      </div>

      {/* Reason text */}
      <p data-part="reason">
        <strong>Reason:</strong> {reason}
      </p>

      {/* Optional expandable context */}
      {context != null && (
        <div data-part="context" data-expanded="false">
          <button
            type="button"
            data-part="context-toggle"
            aria-expanded={false}
            aria-label="Show additional context"
            tabIndex={0}
          >
            {'\u25B6'} Additional Context
          </button>
        </div>
      )}

      {/* Action bar */}
      <div data-part="action-bar" data-state="pending">
        <button
          type="button"
          data-part="approve"
          data-state="pending"
          aria-label="Approve"
          tabIndex={0}
        >
          Approve
        </button>

        <button
          type="button"
          data-part="deny"
          data-state="pending"
          aria-label="Deny"
          tabIndex={0}
        >
          Deny
        </button>

        <button
          type="button"
          data-part="request-info"
          data-state="pending"
          aria-label="Ask for more info"
          tabIndex={0}
        >
          Ask for more info
        </button>
      </div>
    </div>
  );
}

export { HitlInterrupt };
