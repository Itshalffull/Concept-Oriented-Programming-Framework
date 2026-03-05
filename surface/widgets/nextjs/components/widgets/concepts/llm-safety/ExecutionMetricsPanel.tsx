/* ---------------------------------------------------------------------------
 * ExecutionMetricsPanel — Server Component
 *
 * Dashboard panel displaying LLM execution metrics including step count,
 * token usage gauge, cost, latency, and error rate.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface ExecutionMetricsPanelProps {
  totalTokens: number;
  totalCost: number;
  stepCount: number;
  errorRate: number;
  tokenLimit?: number | undefined;
  showLatency?: boolean;
  compact?: boolean;
  latencyAvg?: number | undefined;
  latencyP95?: number | undefined;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function tokenGaugeColor(totalTokens: number, tokenLimit: number | undefined): string {
  if (tokenLimit == null || tokenLimit <= 0) return 'green';
  const pct = (totalTokens / tokenLimit) * 100;
  if (pct >= 90) return 'red';
  if (pct >= 70) return 'yellow';
  return 'green';
}

function errorRateColor(rate: number): string {
  if (rate >= 5) return 'red';
  if (rate >= 1) return 'yellow';
  return 'green';
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function ExecutionMetricsPanel({
  totalTokens,
  totalCost,
  stepCount,
  errorRate,
  tokenLimit,
  showLatency = true,
  compact = false,
  latencyAvg,
  latencyP95,
  children,
}: ExecutionMetricsPanelProps) {
  const tokenPct = tokenLimit != null && tokenLimit > 0
    ? Math.min((totalTokens / tokenLimit) * 100, 100)
    : null;

  const gaugeColor = tokenGaugeColor(totalTokens, tokenLimit);
  const errColor = errorRateColor(errorRate);

  return (
    <div
      role="region"
      aria-label="Execution metrics"
      data-surface-widget=""
      data-widget-name="execution-metrics-panel"
      data-part="root"
      data-state="idle"
      data-compact={compact ? 'true' : 'false'}
      tabIndex={0}
    >
      {/* Step counter */}
      <div
        data-part="step-counter"
        data-state="idle"
        role="status"
        aria-label={`Steps: ${stepCount}`}
        tabIndex={0}
      >
        <span aria-hidden="true">&#x1F4CB;</span>{' '}
        <span>{stepCount} step{stepCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Token gauge */}
      <div
        data-part="token-gauge"
        data-state="idle"
        data-value={totalTokens}
        data-max={tokenLimit ?? undefined}
        data-color={gaugeColor}
        role="meter"
        aria-label={`Tokens: ${totalTokens}`}
        aria-valuenow={totalTokens}
        aria-valuemin={0}
        aria-valuemax={tokenLimit ?? undefined}
        tabIndex={0}
      >
        <span>{totalTokens.toLocaleString()}{tokenLimit != null ? ` / ${tokenLimit.toLocaleString()}` : ''} tokens</span>
        {tokenPct != null && (
          <div
            data-part="token-gauge-bar"
            style={{ width: '100%', height: '6px', background: '#e0e0e0', borderRadius: '3px', marginTop: '4px' }}
          >
            <div
              data-part="token-gauge-fill"
              data-color={gaugeColor}
              style={{
                width: `${tokenPct}%`,
                height: '100%',
                borderRadius: '3px',
                background: gaugeColor === 'red' ? '#dc2626' : gaugeColor === 'yellow' ? '#ca8a04' : '#16a34a',
              }}
            />
          </div>
        )}
        {tokenPct != null && (
          <span data-part="token-gauge-pct">{tokenPct.toFixed(1)}%</span>
        )}
      </div>

      {/* Cost display */}
      <div
        data-part="cost"
        data-state="idle"
        role="status"
        aria-label={`Cost: $${totalCost.toFixed(2)}`}
        tabIndex={0}
      >
        ${totalCost.toFixed(2)}
      </div>

      {/* Latency card */}
      {showLatency && (
        <div
          data-part="latency"
          data-state="idle"
          data-visible="true"
          role="status"
          aria-label={
            latencyAvg != null && latencyP95 != null
              ? `Latency: average ${latencyAvg.toFixed(1)}s, p95 ${latencyP95.toFixed(1)}s`
              : 'Latency: no data'
          }
          tabIndex={0}
        >
          {latencyAvg != null && latencyP95 != null
            ? `avg ${latencyAvg.toFixed(1)}s / p95 ${latencyP95.toFixed(1)}s`
            : 'No latency data'}
        </div>
      )}

      {/* Error rate */}
      <div
        data-part="error-rate"
        data-state="idle"
        data-color={errColor}
        role="status"
        aria-label={`Error rate: ${errorRate}%`}
        tabIndex={0}
      >
        <span
          style={{
            color: errColor === 'red' ? '#dc2626' : errColor === 'yellow' ? '#ca8a04' : '#16a34a',
          }}
        >
          {errorRate.toFixed(1)}%
        </span>
      </div>

      {children}
    </div>
  );
}

export { ExecutionMetricsPanel };
