/* ---------------------------------------------------------------------------
 * ExecutionPipeline — Vanilla widget
 * States: idle (initial), stageSelected, failed
 * ------------------------------------------------------------------------- */

export type ExecutionPipelineState = 'idle' | 'stageSelected' | 'failed';
export type ExecutionPipelineEvent =
  | { type: 'ADVANCE' } | { type: 'SELECT_STAGE'; stageId?: string }
  | { type: 'FAIL' } | { type: 'DESELECT' } | { type: 'RETRY' } | { type: 'RESET' };

export function executionPipelineReducer(state: ExecutionPipelineState, event: ExecutionPipelineEvent): ExecutionPipelineState {
  switch (state) {
    case 'idle': if (event.type === 'ADVANCE') return 'idle'; if (event.type === 'SELECT_STAGE') return 'stageSelected'; if (event.type === 'FAIL') return 'failed'; return state;
    case 'stageSelected': if (event.type === 'DESELECT') return 'idle'; return state;
    case 'failed': if (event.type === 'RETRY') return 'idle'; if (event.type === 'RESET') return 'idle'; return state;
    default: return state;
  }
}

export type PipelineStageStatus = 'pending' | 'active' | 'complete' | 'failed' | 'skipped';
export interface PipelineStage { id: string; name: string; status: PipelineStageStatus; description?: string; isTimelock?: boolean; }

function connectorStatus(left: PipelineStageStatus, right: PipelineStageStatus): string {
  if (left === 'complete' && (right === 'complete' || right === 'active')) return 'complete';
  if (left === 'complete' && right === 'pending') return 'upcoming';
  if (left === 'failed' || right === 'failed') return 'failed';
  return 'pending';
}

function iconChar(s: PipelineStageStatus): string {
  switch (s) { case 'complete': return '\u2713'; case 'failed': return '\u2717'; case 'skipped': return '\u25B6'; default: return '\u25CF'; }
}

export interface ExecutionPipelineProps {
  stages: PipelineStage[]; currentStage: string; status: string;
  showTimer?: boolean; showActions?: boolean; compact?: boolean;
  onStageSelect?: (stageId: string) => void; onRetry?: () => void;
  onCancel?: () => void; onForceExecute?: () => void;
  className?: string; [key: string]: unknown;
}
export interface ExecutionPipelineOptions { target: HTMLElement; props: ExecutionPipelineProps; }
let _uid = 0;

export class ExecutionPipeline {
  private el: HTMLElement;
  private props: ExecutionPipelineProps;
  private state: ExecutionPipelineState = 'idle';
  private uid = ++_uid;
  private disposers: (() => void)[] = [];
  private selectedIdx = -1;
  private stageEls: HTMLDivElement[] = [];

  constructor(private options: ExecutionPipelineOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'execution-pipeline');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'group');
    this.el.id = 'execution-pipeline-' + this.uid;
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  private send(ev: ExecutionPipelineEvent): void { this.state = executionPipelineReducer(this.state, ev); this.el.setAttribute('data-state', this.state); this.render(); }
  update(props: Partial<ExecutionPipelineProps>): void { Object.assign(this.props, props); this.render(); }
  destroy(): void { this.disposers.forEach(d => d()); this.el.remove(); }

  private render(): void {
    this.el.innerHTML = '';
    this.stageEls = [];
    const p = this.props;
    const compact = p.compact ?? false;
    const showTimer = p.showTimer !== false;
    const showActions = p.showActions !== false;
    const isFailed = p.status === 'failed' || this.state === 'failed';
    const activeIdx = p.stages.findIndex(s => s.id === p.currentStage);
    const selStage = this.state === 'stageSelected' && this.selectedIdx >= 0 ? p.stages[this.selectedIdx] : null;
    const hasTimelock = p.stages.some(s => s.isTimelock && s.status === 'active');

    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('data-status', p.status);
    this.el.setAttribute('data-compact', compact ? 'true' : 'false');
    this.el.setAttribute('aria-label', `Execution pipeline: ${p.status}`);
    if (p.className) this.el.className = p.className;

    const pipeline = document.createElement('div');
    pipeline.setAttribute('data-part', 'pipeline'); pipeline.setAttribute('role', 'list'); pipeline.setAttribute('data-state', this.state);

    p.stages.forEach((stage, i) => {
      const isCurr = stage.id === p.currentStage;
      const isSel = this.selectedIdx === i && this.state === 'stageSelected';
      const w = document.createElement('div'); w.style.cssText = 'display:inline-flex;align-items:center';

      const sd = document.createElement('div');
      sd.setAttribute('data-part', 'stage'); sd.setAttribute('data-status', stage.status);
      sd.setAttribute('data-current', isCurr ? 'true' : 'false'); sd.setAttribute('data-selected', isSel ? 'true' : 'false');
      sd.setAttribute('role', 'listitem'); if (isCurr) sd.setAttribute('aria-current', 'step');
      sd.setAttribute('aria-label', `${stage.name} \u2014 ${stage.status}`);
      sd.tabIndex = i === (activeIdx >= 0 ? activeIdx : 0) ? 0 : -1;
      sd.addEventListener('click', () => { this.selectedIdx = i; this.send({ type: 'SELECT_STAGE', stageId: stage.id }); p.onStageSelect?.(stage.id); });
      sd.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); this.stageEls[(i + 1) % p.stages.length]?.focus(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); this.stageEls[(i - 1 + p.stages.length) % p.stages.length]?.focus(); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.selectedIdx = i; this.send({ type: 'SELECT_STAGE', stageId: stage.id }); p.onStageSelect?.(stage.id); }
        else if (e.key === 'Escape') { e.preventDefault(); this.selectedIdx = -1; this.send({ type: 'DESELECT' }); }
      });
      this.stageEls.push(sd);

      const ic = document.createElement('div'); ic.setAttribute('data-part', 'stage-icon'); ic.setAttribute('data-status', stage.status); ic.setAttribute('aria-hidden', 'true');
      if (stage.status === 'active') ic.setAttribute('data-animate', 'pulse');
      ic.textContent = iconChar(stage.status); sd.appendChild(ic);

      const lb = document.createElement('span'); lb.setAttribute('data-part', 'stage-label'); lb.textContent = stage.name; sd.appendChild(lb);
      if (!compact && stage.description) { const dt = document.createElement('span'); dt.setAttribute('data-part', 'stage-detail'); dt.textContent = stage.description; sd.appendChild(dt); }
      w.appendChild(sd);

      if (i < p.stages.length - 1) {
        const cn = document.createElement('div'); cn.setAttribute('data-part', 'connector');
        cn.setAttribute('data-status', connectorStatus(stage.status, p.stages[i + 1].status)); cn.setAttribute('aria-hidden', 'true');
        cn.innerHTML = '<svg width="24" height="16" viewBox="0 0 24 16" fill="none"><path d="M0 8H20M20 8L14 3M20 8L14 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        w.appendChild(cn);
      }
      pipeline.appendChild(w);
    });
    this.el.appendChild(pipeline);

    if (this.state === 'stageSelected' && selStage) {
      const dp = document.createElement('div'); dp.setAttribute('data-part', 'stage-detail-panel'); dp.setAttribute('role', 'region'); dp.setAttribute('aria-label', `Details for ${selStage.name}`); dp.setAttribute('aria-live', 'polite');
      const s = document.createElement('strong'); s.textContent = selStage.name; dp.appendChild(s);
      if (selStage.description) { const sp = document.createElement('span'); sp.setAttribute('data-part', 'stage-detail'); sp.textContent = selStage.description; dp.appendChild(sp); }
      const bg = document.createElement('span'); bg.setAttribute('data-part', 'stage-status-badge'); bg.setAttribute('data-status', selStage.status); bg.textContent = selStage.status; dp.appendChild(bg);
      this.el.appendChild(dp);
    }

    if (showTimer && hasTimelock) {
      const tl = document.createElement('div'); tl.setAttribute('data-part', 'timelock-timer'); tl.setAttribute('data-visible', 'true');
      const sp = document.createElement('span'); sp.setAttribute('aria-live', 'polite'); sp.setAttribute('role', 'timer'); sp.textContent = 'Timelock countdown active'; tl.appendChild(sp);
      this.el.appendChild(tl);
    }

    if (isFailed) {
      const fb = document.createElement('div'); fb.setAttribute('data-part', 'failure-banner'); fb.setAttribute('role', 'alert'); fb.setAttribute('aria-live', 'assertive');
      fb.appendChild(document.createTextNode('Pipeline execution failed'));
      if (p.onRetry) { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-part', 'retry-button'); b.textContent = 'Retry'; b.addEventListener('click', () => { this.send({ type: 'RETRY' }); p.onRetry!(); }); fb.appendChild(b); }
      this.el.appendChild(fb);
    }

    if (showActions) {
      const ab = document.createElement('div'); ab.setAttribute('data-part', 'actions'); ab.setAttribute('data-visible', 'true'); ab.setAttribute('role', 'toolbar'); ab.setAttribute('aria-label', 'Pipeline actions');
      if (p.onCancel) { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-part', 'cancel-button'); b.textContent = 'Cancel'; b.addEventListener('click', () => p.onCancel!()); ab.appendChild(b); }
      if (p.onForceExecute) { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-part', 'force-execute-button'); b.textContent = 'Force Execute'; b.addEventListener('click', () => p.onForceExecute!()); ab.appendChild(b); }
      this.el.appendChild(ab);
    }
  }
}

export default ExecutionPipeline;
