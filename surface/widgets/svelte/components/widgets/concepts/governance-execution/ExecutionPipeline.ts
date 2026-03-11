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

type PipelineStageStatus = 'pending' | 'active' | 'complete' | 'failed' | 'skipped';

interface PipelineStage {
  id: string;
  name: string;
  status: PipelineStageStatus;
  description?: string;
  isTimelock?: boolean;
}

function iconForStatus(status: PipelineStageStatus): string {
  switch (status) {
    case 'complete': return '\u2713';
    case 'failed': return '\u2717';
    case 'skipped': return '\u25B6';
    default: return '\u25CF';
  }
}

function connectorStatus(left: PipelineStageStatus, right: PipelineStageStatus): string {
  if (left === 'complete' && (right === 'complete' || right === 'active')) return 'complete';
  if (left === 'complete' && right === 'pending') return 'upcoming';
  if (left === 'failed' || right === 'failed') return 'failed';
  return 'pending';
}

export interface ExecutionPipelineProps { [key: string]: unknown; class?: string; }
export interface ExecutionPipelineResult { element: HTMLElement; dispose: () => void; }

export function ExecutionPipeline(props: ExecutionPipelineProps): ExecutionPipelineResult {
  const sig = surfaceCreateSignal<ExecutionPipelineState>('idle');
  const send = (type: string) => sig.set(executionPipelineReducer(sig.get(), { type } as any));

  const stages = (props.stages ?? []) as PipelineStage[];
  const currentStage = String(props.currentStage ?? '');
  const pipelineStatus = String(props.status ?? 'in-progress');
  const showTimer = props.showTimer !== false;
  const showActions = props.showActions !== false;
  const compact = props.compact === true;
  const onStageSelect = props.onStageSelect as ((stageId: string) => void) | undefined;
  const onRetry = props.onRetry as (() => void) | undefined;
  const onCancel = props.onCancel as (() => void) | undefined;
  const onForceExecute = props.onForceExecute as (() => void) | undefined;

  const activeIndex = stages.findIndex((s) => s.id === currentStage);
  let selectedIndex = -1;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'execution-pipeline');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', `Execution pipeline: ${pipelineStatus}`);
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-status', pipelineStatus);
  root.setAttribute('data-compact', compact ? 'true' : 'false');
  if (props.class) root.className = props.class as string;

  const pipelineEl = document.createElement('div');
  pipelineEl.setAttribute('data-part', 'pipeline');
  pipelineEl.setAttribute('role', 'list');
  pipelineEl.setAttribute('data-state', sig.get());
  root.appendChild(pipelineEl);

  const stageEls: HTMLDivElement[] = [];
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const isCurrent = stage.id === currentStage;
    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';

    const stageEl = document.createElement('div');
    stageEl.setAttribute('data-part', 'stage');
    stageEl.setAttribute('data-status', stage.status);
    stageEl.setAttribute('data-current', isCurrent ? 'true' : 'false');
    stageEl.setAttribute('data-selected', 'false');
    stageEl.setAttribute('role', 'listitem');
    if (isCurrent) stageEl.setAttribute('aria-current', 'step');
    stageEl.setAttribute('aria-label', `${stage.name} \u2014 ${stage.status}`);
    stageEl.setAttribute('tabindex', i === (activeIndex >= 0 ? activeIndex : 0) ? '0' : '-1');
    const idx = i;
    stageEl.addEventListener('click', () => selectStage(idx));
    stageEl.addEventListener('keydown', (e) => handleStageKeyDown(e, idx));

    const iconEl = document.createElement('div');
    iconEl.setAttribute('data-part', 'stage-icon');
    iconEl.setAttribute('data-status', stage.status);
    iconEl.setAttribute('aria-hidden', 'true');
    if (stage.status === 'active') iconEl.setAttribute('data-animate', 'pulse');
    iconEl.textContent = iconForStatus(stage.status);
    stageEl.appendChild(iconEl);

    const labelEl = document.createElement('span');
    labelEl.setAttribute('data-part', 'stage-label');
    labelEl.textContent = stage.name;
    stageEl.appendChild(labelEl);

    if (!compact && stage.description) {
      const detailEl = document.createElement('span');
      detailEl.setAttribute('data-part', 'stage-detail');
      detailEl.textContent = stage.description;
      stageEl.appendChild(detailEl);
    }

    wrapper.appendChild(stageEl);
    stageEls.push(stageEl);

    if (i < stages.length - 1) {
      const connEl = document.createElement('div');
      connEl.setAttribute('data-part', 'connector');
      connEl.setAttribute('data-status', connectorStatus(stage.status, stages[i + 1].status));
      connEl.setAttribute('aria-hidden', 'true');
      connEl.textContent = '\u2192';
      wrapper.appendChild(connEl);
    }
    pipelineEl.appendChild(wrapper);
  }

  const detailPanelEl = document.createElement('div');
  detailPanelEl.setAttribute('data-part', 'stage-detail-panel');
  detailPanelEl.setAttribute('role', 'region');
  detailPanelEl.setAttribute('aria-live', 'polite');
  detailPanelEl.style.display = 'none';
  root.appendChild(detailPanelEl);

  const hasActiveTimelock = stages.some((s) => s.isTimelock && s.status === 'active');
  if (showTimer && hasActiveTimelock) {
    const timerEl = document.createElement('div');
    timerEl.setAttribute('data-part', 'timelock-timer');
    timerEl.setAttribute('data-visible', 'true');
    const timerText = document.createElement('span');
    timerText.setAttribute('aria-live', 'polite');
    timerText.setAttribute('role', 'timer');
    timerText.textContent = 'Timelock countdown active';
    timerEl.appendChild(timerText);
    root.appendChild(timerEl);
  }

  const failureBannerEl = document.createElement('div');
  failureBannerEl.setAttribute('data-part', 'failure-banner');
  failureBannerEl.setAttribute('role', 'alert');
  failureBannerEl.setAttribute('aria-live', 'assertive');
  failureBannerEl.style.display = pipelineStatus === 'failed' ? '' : 'none';
  const failMsg = document.createElement('span');
  failMsg.textContent = 'Pipeline execution failed';
  failureBannerEl.appendChild(failMsg);
  if (onRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.setAttribute('data-part', 'retry-button');
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => { send('RETRY'); onRetry(); });
    failureBannerEl.appendChild(retryBtn);
  }
  root.appendChild(failureBannerEl);

  if (showActions) {
    const actionsEl = document.createElement('div');
    actionsEl.setAttribute('data-part', 'actions');
    actionsEl.setAttribute('data-visible', 'true');
    actionsEl.setAttribute('role', 'toolbar');
    actionsEl.setAttribute('aria-label', 'Pipeline actions');
    if (onCancel) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-part', 'cancel-button');
      btn.textContent = 'Cancel';
      btn.addEventListener('click', onCancel);
      actionsEl.appendChild(btn);
    }
    if (onForceExecute) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-part', 'force-execute-button');
      btn.textContent = 'Force Execute';
      btn.addEventListener('click', onForceExecute);
      actionsEl.appendChild(btn);
    }
    root.appendChild(actionsEl);
  }

  function selectStage(index: number): void {
    if (index < 0 || index >= stages.length) return;
    selectedIndex = index;
    send('SELECT_STAGE');
    onStageSelect?.(stages[index].id);
    updateUI();
  }

  function deselectStage(): void {
    selectedIndex = -1;
    send('DESELECT');
    updateUI();
  }

  function updateUI(): void {
    for (let i = 0; i < stageEls.length; i++) {
      stageEls[i].setAttribute('data-selected', selectedIndex === i ? 'true' : 'false');
    }
    if (sig.get() === 'stageSelected' && selectedIndex >= 0) {
      const stage = stages[selectedIndex];
      detailPanelEl.style.display = '';
      detailPanelEl.setAttribute('aria-label', `Details for ${stage.name}`);
      detailPanelEl.innerHTML = '';
      const strong = document.createElement('strong');
      strong.textContent = stage.name;
      detailPanelEl.appendChild(strong);
      if (stage.description) {
        const desc = document.createElement('span');
        desc.setAttribute('data-part', 'stage-detail');
        desc.textContent = stage.description;
        detailPanelEl.appendChild(desc);
      }
      const badge = document.createElement('span');
      badge.setAttribute('data-part', 'stage-status-badge');
      badge.setAttribute('data-status', stage.status);
      badge.textContent = stage.status;
      detailPanelEl.appendChild(badge);
    } else {
      detailPanelEl.style.display = 'none';
    }
  }

  function handleStageKeyDown(e: KeyboardEvent, index: number): void {
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown':
        e.preventDefault();
        stageEls[(index < stages.length - 1 ? index + 1 : 0)]?.focus();
        break;
      case 'ArrowLeft': case 'ArrowUp':
        e.preventDefault();
        stageEls[(index > 0 ? index - 1 : stages.length - 1)]?.focus();
        break;
      case 'Enter': case ' ':
        e.preventDefault();
        selectStage(index);
        break;
      case 'Escape':
        e.preventDefault();
        deselectStage();
        break;
    }
  }

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    pipelineEl.setAttribute('data-state', s);
    failureBannerEl.style.display = (pipelineStatus === 'failed' || s === 'failed') ? '' : 'none';
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default ExecutionPipeline;
