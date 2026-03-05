/* ---------------------------------------------------------------------------
 * ExecutionMetricsPanel — Vanilla widget
 *
 * Dashboard panel showing execution metrics: step count, token gauge,
 * cost display, latency card, and error rate indicator.
 * States: idle (initial), updating
 * ------------------------------------------------------------------------- */

export type ExecutionMetricsPanelState = 'idle' | 'updating';
export type ExecutionMetricsPanelEvent = | { type: 'UPDATE' } | { type: 'UPDATE_COMPLETE' };

export function executionMetricsPanelReducer(state: ExecutionMetricsPanelState, event: ExecutionMetricsPanelEvent): ExecutionMetricsPanelState {
  switch (state) {
    case 'idle': if (event.type === 'UPDATE') return 'updating'; return state;
    case 'updating': if (event.type === 'UPDATE_COMPLETE') return 'idle'; return state;
    default: return state;
  }
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

const GAUGE_COLORS: Record<string, string> = { red: '#dc2626', yellow: '#ca8a04', green: '#16a34a' };

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
  className?: string;
  [key: string]: unknown;
}
export interface ExecutionMetricsPanelOptions { target: HTMLElement; props: ExecutionMetricsPanelProps; }

let _executionMetricsPanelUid = 0;

export class ExecutionMetricsPanel {
  private el: HTMLElement;
  private props: ExecutionMetricsPanelProps;
  private state: ExecutionMetricsPanelState = 'idle';
  private prevValues: { totalTokens: number; totalCost: number; stepCount: number; errorRate: number };
  private updateTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ExecutionMetricsPanelOptions) {
    this.props = { ...options.props };
    this.prevValues = {
      totalTokens: this.props.totalTokens,
      totalCost: this.props.totalCost,
      stepCount: this.props.stepCount,
      errorRate: this.props.errorRate,
    };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'execution-metrics-panel');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', 'Execution metrics');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'execution-metrics-panel-' + (++_executionMetricsPanelUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  private send(ev: ExecutionMetricsPanelEvent): void {
    this.state = executionMetricsPanelReducer(this.state, ev);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<ExecutionMetricsPanelProps>): void {
    Object.assign(this.props, props);
    // Detect value changes and trigger updating state
    const p = this.props;
    if (
      this.prevValues.totalTokens !== p.totalTokens ||
      this.prevValues.totalCost !== p.totalCost ||
      this.prevValues.stepCount !== p.stepCount ||
      this.prevValues.errorRate !== p.errorRate
    ) {
      this.send({ type: 'UPDATE' });
      if (this.updateTimer) clearTimeout(this.updateTimer);
      this.updateTimer = setTimeout(() => {
        this.send({ type: 'UPDATE_COMPLETE' });
        this.el.innerHTML = '';
        this.render();
      }, 300);
      this.prevValues = { totalTokens: p.totalTokens, totalCost: p.totalCost, stepCount: p.stepCount, errorRate: p.errorRate };
    }
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void {
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.el.remove();
  }

  private render(): void {
    const p = this.props;
    const totalTokens = p.totalTokens ?? 0;
    const totalCost = p.totalCost ?? 0;
    const stepCount = p.stepCount ?? 0;
    const errorRate = p.errorRate ?? 0;
    const tokenLimit = p.tokenLimit;
    const showLatency = p.showLatency !== false;
    const compact = p.compact ?? false;
    const latencyAvg = p.latencyAvg;
    const latencyP95 = p.latencyP95;

    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('data-compact', compact ? 'true' : 'false');
    if (p.className) this.el.className = p.className;

    // Layout style
    if (compact) {
      this.el.style.cssText = 'display:flex;flex-direction:row;gap:8px;align-items:center';
    } else {
      this.el.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px';
    }

    // Step counter
    const sc = document.createElement('div');
    sc.setAttribute('data-part', 'step-counter');
    sc.setAttribute('data-state', this.state);
    sc.setAttribute('role', 'status');
    sc.setAttribute('aria-label', `Steps: ${stepCount}`);
    sc.tabIndex = 0;
    const scIcon = document.createElement('span');
    scIcon.setAttribute('aria-hidden', 'true');
    scIcon.textContent = '\u{1F4CB}';
    sc.appendChild(scIcon);
    sc.appendChild(document.createTextNode(' '));
    const scText = document.createElement('span');
    scText.textContent = `${stepCount} step${stepCount !== 1 ? 's' : ''}`;
    sc.appendChild(scText);
    this.el.appendChild(sc);

    // Token gauge
    const gaugeColor = tokenGaugeColor(totalTokens, tokenLimit);
    const tokenPct = tokenLimit != null && tokenLimit > 0
      ? Math.min((totalTokens / tokenLimit) * 100, 100)
      : null;

    const tg = document.createElement('div');
    tg.setAttribute('data-part', 'token-gauge');
    tg.setAttribute('data-state', this.state);
    tg.setAttribute('data-value', String(totalTokens));
    if (tokenLimit != null) tg.setAttribute('data-max', String(tokenLimit));
    tg.setAttribute('data-color', gaugeColor);
    tg.setAttribute('role', 'meter');
    tg.setAttribute('aria-label', `Tokens: ${totalTokens}`);
    tg.setAttribute('aria-valuenow', String(totalTokens));
    tg.setAttribute('aria-valuemin', '0');
    if (tokenLimit != null) tg.setAttribute('aria-valuemax', String(tokenLimit));
    tg.tabIndex = 0;

    const tgLabel = document.createElement('span');
    tgLabel.textContent = `${totalTokens.toLocaleString()}${tokenLimit != null ? ` / ${tokenLimit.toLocaleString()}` : ''} tokens`;
    tg.appendChild(tgLabel);

    if (tokenPct != null) {
      const tgBar = document.createElement('div');
      tgBar.setAttribute('data-part', 'token-gauge-bar');
      tgBar.style.cssText = 'width:100%;height:6px;background:#e0e0e0;border-radius:3px;margin-top:4px';
      const tgFill = document.createElement('div');
      tgFill.setAttribute('data-part', 'token-gauge-fill');
      tgFill.setAttribute('data-color', gaugeColor);
      tgFill.style.cssText = `width:${tokenPct}%;height:100%;border-radius:3px;background:${GAUGE_COLORS[gaugeColor]};transition:width 0.3s ease`;
      tgBar.appendChild(tgFill);
      tg.appendChild(tgBar);

      const tgPct = document.createElement('span');
      tgPct.setAttribute('data-part', 'token-gauge-pct');
      tgPct.textContent = `${tokenPct.toFixed(1)}%`;
      tg.appendChild(tgPct);
    }
    this.el.appendChild(tg);

    // Cost display
    const cd = document.createElement('div');
    cd.setAttribute('data-part', 'cost');
    cd.setAttribute('data-state', this.state);
    cd.setAttribute('role', 'status');
    cd.setAttribute('aria-label', `Cost: $${totalCost.toFixed(2)}`);
    cd.tabIndex = 0;
    cd.textContent = `$${totalCost.toFixed(2)}`;
    this.el.appendChild(cd);

    // Latency card
    if (showLatency) {
      const hasData = latencyAvg != null && latencyP95 != null;
      const ld = document.createElement('div');
      ld.setAttribute('data-part', 'latency');
      ld.setAttribute('data-state', this.state);
      ld.setAttribute('data-visible', 'true');
      ld.setAttribute('role', 'status');
      ld.setAttribute('aria-label', hasData
        ? `Latency: average ${latencyAvg!.toFixed(1)}s, p95 ${latencyP95!.toFixed(1)}s`
        : 'Latency: no data');
      ld.tabIndex = 0;
      ld.textContent = hasData
        ? `avg ${latencyAvg!.toFixed(1)}s / p95 ${latencyP95!.toFixed(1)}s`
        : 'No latency data';
      this.el.appendChild(ld);
    }

    // Error rate
    const errColor = errorRateColor(errorRate);
    const er = document.createElement('div');
    er.setAttribute('data-part', 'error-rate');
    er.setAttribute('data-state', this.state);
    er.setAttribute('data-color', errColor);
    er.setAttribute('role', 'status');
    er.setAttribute('aria-label', `Error rate: ${errorRate}%`);
    er.tabIndex = 0;
    const erSpan = document.createElement('span');
    erSpan.style.color = GAUGE_COLORS[errColor];
    erSpan.textContent = `${errorRate.toFixed(1)}%`;
    er.appendChild(erSpan);
    this.el.appendChild(er);
  }
}

export default ExecutionMetricsPanel;
