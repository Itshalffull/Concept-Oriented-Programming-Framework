import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type ExecutionPipelineState = 'idle' | 'stageSelected' | 'failed';
export type ExecutionPipelineEvent =
  | { type: 'ADVANCE' }
  | { type: 'SELECT_STAGE' }
  | { type: 'FAIL' }
  | { type: 'DESELECT' }
  | { type: 'RETRY' }
  | { type: 'RESET' };

export function executionPipelineReducer(state: ExecutionPipelineState, event: ExecutionPipelineEvent): ExecutionPipelineState {
  switch (state) {
    case 'idle':
      if (event.type === 'ADVANCE') return 'idle';
      if (event.type === 'SELECT_STAGE') return 'stageSelected';
      if (event.type === 'FAIL') return 'failed';
      return state;
    case 'stageSelected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    case 'failed':
      if (event.type === 'RETRY') return 'idle';
      if (event.type === 'RESET') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface ExecutionPipelineProps { [key: string]: unknown; class?: string; }
export interface ExecutionPipelineResult { element: HTMLElement; dispose: () => void; }

export function ExecutionPipeline(props: ExecutionPipelineProps): ExecutionPipelineResult {
  const sig = surfaceCreateSignal<ExecutionPipelineState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(executionPipelineReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'execution-pipeline');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Execution pipeline');
  root.setAttribute('data-state', state());
  root.setAttribute('data-compact', 'false');
  if (props.class) root.className = props.class as string;

  /* Pipeline container */
  const pipelineEl = document.createElement('div');
  pipelineEl.setAttribute('data-part', 'pipeline');
  pipelineEl.setAttribute('role', 'list');
  pipelineEl.setAttribute('data-state', state());
  root.appendChild(pipelineEl);

  /* Stage template */
  const stageWrapper = document.createElement('div');
  stageWrapper.style.display = 'inline-flex';
  stageWrapper.style.alignItems = 'center';

  const stageEl = document.createElement('div');
  stageEl.setAttribute('data-part', 'stage');
  stageEl.setAttribute('data-status', 'pending');
  stageEl.setAttribute('data-current', 'false');
  stageEl.setAttribute('data-selected', 'false');
  stageEl.setAttribute('role', 'listitem');
  stageEl.setAttribute('tabindex', '0');
  stageEl.addEventListener('click', () => send('SELECT_STAGE'));
  stageEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      send('SELECT_STAGE');
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      send('DESELECT');
    }
  });

  const stageIconEl = document.createElement('div');
  stageIconEl.setAttribute('data-part', 'stage-icon');
  stageIconEl.setAttribute('aria-hidden', 'true');
  stageEl.appendChild(stageIconEl);

  const stageLabelEl = document.createElement('span');
  stageLabelEl.setAttribute('data-part', 'stage-label');
  stageEl.appendChild(stageLabelEl);

  const stageDetailEl = document.createElement('span');
  stageDetailEl.setAttribute('data-part', 'stage-detail');
  stageEl.appendChild(stageDetailEl);

  stageWrapper.appendChild(stageEl);

  /* Connector */
  const connectorEl = document.createElement('div');
  connectorEl.setAttribute('data-part', 'connector');
  connectorEl.setAttribute('aria-hidden', 'true');
  const connectorSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  connectorSvg.setAttribute('width', '24');
  connectorSvg.setAttribute('height', '16');
  connectorSvg.setAttribute('viewBox', '0 0 24 16');
  connectorSvg.setAttribute('fill', 'none');
  connectorSvg.setAttribute('aria-hidden', 'true');
  const connectorPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  connectorPath.setAttribute('d', 'M0 8H20M20 8L14 3M20 8L14 13');
  connectorPath.setAttribute('stroke', 'currentColor');
  connectorPath.setAttribute('stroke-width', '1.5');
  connectorPath.setAttribute('stroke-linecap', 'round');
  connectorPath.setAttribute('stroke-linejoin', 'round');
  connectorSvg.appendChild(connectorPath);
  connectorEl.appendChild(connectorSvg);
  stageWrapper.appendChild(connectorEl);

  pipelineEl.appendChild(stageWrapper);

  /* Stage detail panel */
  const stageDetailPanelEl = document.createElement('div');
  stageDetailPanelEl.setAttribute('data-part', 'stage-detail-panel');
  stageDetailPanelEl.setAttribute('role', 'region');
  stageDetailPanelEl.setAttribute('aria-live', 'polite');
  stageDetailPanelEl.style.display = 'none';
  root.appendChild(stageDetailPanelEl);

  /* Timelock timer slot */
  const timelockTimerEl = document.createElement('div');
  timelockTimerEl.setAttribute('data-part', 'timelock-timer');
  timelockTimerEl.setAttribute('data-visible', 'true');
  const timelockLabel = document.createElement('span');
  timelockLabel.setAttribute('aria-live', 'polite');
  timelockLabel.setAttribute('role', 'timer');
  timelockLabel.textContent = 'Timelock countdown active';
  timelockTimerEl.appendChild(timelockLabel);
  root.appendChild(timelockTimerEl);

  /* Failure banner */
  const failureBannerEl = document.createElement('div');
  failureBannerEl.setAttribute('data-part', 'failure-banner');
  failureBannerEl.setAttribute('role', 'alert');
  failureBannerEl.setAttribute('aria-live', 'assertive');
  failureBannerEl.style.display = 'none';
  const failureText = document.createElement('span');
  failureText.textContent = 'Pipeline execution failed';
  failureBannerEl.appendChild(failureText);
  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.setAttribute('data-part', 'retry-button');
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', () => send('RETRY'));
  failureBannerEl.appendChild(retryBtn);
  root.appendChild(failureBannerEl);

  /* Action bar */
  const actionsEl = document.createElement('div');
  actionsEl.setAttribute('data-part', 'actions');
  actionsEl.setAttribute('data-visible', 'true');
  actionsEl.setAttribute('role', 'toolbar');
  actionsEl.setAttribute('aria-label', 'Pipeline actions');

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.setAttribute('data-part', 'cancel-button');
  cancelBtn.textContent = 'Cancel';
  actionsEl.appendChild(cancelBtn);

  const forceExecuteBtn = document.createElement('button');
  forceExecuteBtn.type = 'button';
  forceExecuteBtn.setAttribute('data-part', 'force-execute-button');
  forceExecuteBtn.textContent = 'Force Execute';
  actionsEl.appendChild(forceExecuteBtn);

  root.appendChild(actionsEl);

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    pipelineEl.setAttribute('data-state', s);
    const isFailed = s === 'failed';
    failureBannerEl.style.display = isFailed ? 'block' : 'none';
    stageDetailPanelEl.style.display = s === 'stageSelected' ? 'block' : 'none';
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default ExecutionPipeline;
