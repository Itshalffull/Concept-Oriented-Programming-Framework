'use client';

/**
 * StepSidebar — Vertical step list for the Process Street-style two-panel layout.
 *
 * Renders every StepRun as a sidebar row with status-coded visual indicators:
 *   - Completed: green checkmark + dimmed text
 *   - Active:    blue left-border + bold label + pulsing dot
 *   - Failed:    red X + red text
 *   - Pending:   plain dimmed text
 *
 * Clicking any row sets it as the focusedStepKey (same click semantics as the
 * original step progress chips).
 */

import React from 'react';

interface StepRunRecord {
  id?: string;
  run_ref?: string;
  step_key?: string;
  step_type?: string;
  status?: string;
  attempt?: number;
  started_at?: string;
  ended_at?: string | null;
  input?: string | null;
  output?: string | null;
  error?: string | null;
}

interface StepSidebarProps {
  stepRuns: StepRunRecord[];
  focusedStepKey: string | null;
  stepLabelMap: Record<string, string>;
  onFocus: (stepKey: string) => void;
}

function prettifyKey(key: string): string {
  return key
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const StepSidebar: React.FC<StepSidebarProps> = ({
  stepRuns,
  focusedStepKey,
  stepLabelMap,
  onFocus,
}) => {
  return (
    <nav
      aria-label="Process steps"
      style={{
        width: '240px',
        flexShrink: 0,
        borderRight: '1px solid var(--palette-outline-variant, #e0e0e0)',
        overflowY: 'auto',
        paddingTop: 'var(--spacing-sm)',
        paddingBottom: 'var(--spacing-sm)',
        background: 'var(--palette-surface)',
      }}
    >
      {stepRuns.length === 0 && (
        <div
          style={{
            padding: '12px 16px',
            fontSize: 'var(--typography-body-sm-size)',
            color: 'var(--palette-on-surface-variant)',
          }}
        >
          No steps yet
        </div>
      )}
      {stepRuns.map((step, index) => {
        const key = step.step_key ?? '';
        const status = step.status ?? 'pending';
        const label = stepLabelMap[key] || prettifyKey(key) || `Step ${index + 1}`;
        const isFocused = focusedStepKey === key;
        const isActive = status === 'active';
        const isCompleted = status === 'completed';
        const isFailed = status === 'failed';

        return (
          <button
            key={step.id ?? key ?? index}
            aria-current={isFocused ? 'step' : undefined}
            onClick={() => onFocus(key)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              border: 'none',
              borderLeft: isActive
                ? '3px solid var(--palette-primary)'
                : isFocused
                ? '3px solid var(--palette-outline)'
                : '3px solid transparent',
              background: isFocused
                ? 'var(--palette-surface-variant, #f5f5f5)'
                : 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 'var(--typography-body-sm-size)',
              color: isFailed
                ? 'var(--palette-error)'
                : isCompleted
                ? 'var(--palette-on-surface-variant)'
                : isActive
                ? 'var(--palette-on-surface)'
                : 'var(--palette-on-surface-variant)',
              fontWeight: isActive || isFocused ? 600 : 400,
              opacity: status === 'pending' && !isFocused ? 0.6 : 1,
              transition: 'background 0.1s',
            }}
          >
            {/* Step index */}
            <span
              style={{
                flexShrink: 0,
                width: '18px',
                fontSize: '11px',
                color: 'var(--palette-on-surface-variant)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {index + 1}
            </span>

            {/* Status icon */}
            <span
              aria-hidden="true"
              style={{ flexShrink: 0, width: '16px', textAlign: 'center', fontSize: '13px' }}
            >
              {isCompleted && <span style={{ color: 'var(--palette-success, #2e7d32)' }}>✓</span>}
              {isFailed && <span style={{ color: 'var(--palette-error)' }}>✗</span>}
              {isActive && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--palette-primary)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
              )}
              {status === 'pending' && <span style={{ opacity: 0.3 }}>·</span>}
              {status === 'skipped' && <span style={{ opacity: 0.4 }}>–</span>}
            </span>

            {/* Label */}
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '13px',
              }}
            >
              {label}
            </span>
          </button>
        );
      })}

      {/* Pulse keyframe injection (CSS-in-JS style) */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </nav>
  );
};

export default StepSidebar;
