export type ExecutionMetricsPanelState = 'idle' | 'updating';
export type ExecutionMetricsPanelEvent =
  | { type: 'UPDATE' }
  | { type: 'UPDATE_COMPLETE' };

export function executionMetricsPanelReducer(state: ExecutionMetricsPanelState, event: ExecutionMetricsPanelEvent): ExecutionMetricsPanelState {
  switch (state) {
    case 'idle':
      if (event.type === 'UPDATE') return 'updating';
      return state;
    case 'updating':
      if (event.type === 'UPDATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useReducer,
  useEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

export interface ExecutionMetricsPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
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

/** Determine token gauge color based on usage percentage */
function tokenGaugeColor(totalTokens: number, tokenLimit: number | undefined): string {
  if (tokenLimit == null || tokenLimit <= 0) return 'green';
  const pct = (totalTokens / tokenLimit) * 100;
  if (pct >= 90) return 'red';
  if (pct >= 70) return 'yellow';
  return 'green';
}

/** Determine error rate color based on threshold */
function errorRateColor(rate: number): string {
  if (rate >= 5) return 'red';
  if (rate >= 1) return 'yellow';
  return 'green';
}

const ExecutionMetricsPanel = forwardRef<HTMLDivElement, ExecutionMetricsPanelProps>(function ExecutionMetricsPanel(
  {
    totalTokens,
    totalCost,
    stepCount,
    errorRate: errorRateProp,
    tokenLimit,
    showLatency = true,
    compact = false,
    latencyAvg,
    latencyP95,
    children,
    style,
    ...restProps
  },
  ref,
) {
  const [state, send] = useReducer(executionMetricsPanelReducer, 'idle');
  const prevValuesRef = useRef({ totalTokens, totalCost, stepCount, errorRate: errorRateProp });

  // Trigger updating state when metric values change
  useEffect(() => {
    const prev = prevValuesRef.current;
    if (
      prev.totalTokens !== totalTokens ||
      prev.totalCost !== totalCost ||
      prev.stepCount !== stepCount ||
      prev.errorRate !== errorRateProp
    ) {
      send({ type: 'UPDATE' });
      const timer = setTimeout(() => {
        send({ type: 'UPDATE_COMPLETE' });
      }, 300);
      prevValuesRef.current = { totalTokens, totalCost, stepCount, errorRate: errorRateProp };
      return () => clearTimeout(timer);
    }
  }, [totalTokens, totalCost, stepCount, errorRateProp]);

  const tokenPct = tokenLimit != null && tokenLimit > 0
    ? Math.min((totalTokens / tokenLimit) * 100, 100)
    : null;

  const gaugeColor = tokenGaugeColor(totalTokens, tokenLimit);
  const errColor = errorRateColor(errorRateProp);

  const gridStyle: React.CSSProperties = compact
    ? { display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center', ...style }
    : { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', ...style };

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Execution metrics"
      data-surface-widget=""
      data-widget-name="execution-metrics-panel"
      data-part="root"
      data-state={state}
      data-compact={compact ? 'true' : 'false'}
      style={gridStyle}
      tabIndex={0}
      {...restProps}
    >
      {/* Step counter */}
      <div
        data-part="step-counter"
        data-state={state}
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
        data-state={state}
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
                transition: 'width 0.3s ease',
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
        data-state={state}
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
          data-state={state}
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
        data-state={state}
        data-color={errColor}
        role="status"
        aria-label={`Error rate: ${errorRateProp}%`}
        tabIndex={0}
      >
        <span
          style={{
            color: errColor === 'red' ? '#dc2626' : errColor === 'yellow' ? '#ca8a04' : '#16a34a',
          }}
        >
          {errorRateProp.toFixed(1)}%
        </span>
      </div>

      {children}
    </div>
  );
});

ExecutionMetricsPanel.displayName = 'ExecutionMetricsPanel';
export { ExecutionMetricsPanel };
export default ExecutionMetricsPanel;
