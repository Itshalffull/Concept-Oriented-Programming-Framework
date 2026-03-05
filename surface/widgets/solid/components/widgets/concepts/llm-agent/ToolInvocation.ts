import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type ToolInvocationViewState = 'collapsed' | 'hoveredCollapsed' | 'expanded';
export type ToolInvocationExecState = 'pending' | 'running' | 'succeeded' | 'failed';

export type ToolInvocationState = 'collapsed' | 'hoveredCollapsed' | 'expanded' | 'pending' | 'running' | 'succeeded' | 'failed';
export type ToolInvocationEvent =
  | { type: 'EXPAND' }
  | { type: 'HOVER' }
  | { type: 'LEAVE' }
  | { type: 'COLLAPSE' }
  | { type: 'INVOKE' }
  | { type: 'SUCCESS' }
  | { type: 'FAILURE' }
  | { type: 'RESET' }
  | { type: 'RETRY' };

export function toolInvocationReducer(state: ToolInvocationState, event: ToolInvocationEvent): ToolInvocationState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND') return 'expanded';
      if (event.type === 'HOVER') return 'hoveredCollapsed';
      return state;
    case 'hoveredCollapsed':
      if (event.type === 'LEAVE') return 'collapsed';
      if (event.type === 'EXPAND') return 'expanded';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE') return 'collapsed';
      return state;
    case 'pending':
      if (event.type === 'INVOKE') return 'running';
      return state;
    case 'running':
      if (event.type === 'SUCCESS') return 'succeeded';
      if (event.type === 'FAILURE') return 'failed';
      return state;
    case 'succeeded':
      if (event.type === 'RESET') return 'pending';
      return state;
    case 'failed':
      if (event.type === 'RETRY') return 'running';
      if (event.type === 'RESET') return 'pending';
      return state;
    default:
      return state;
  }
}

function formatJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}

function statusToExecState(status: string): ToolInvocationExecState {
  switch (status) {
    case 'running': return 'running';
    case 'succeeded': return 'succeeded';
    case 'failed': return 'failed';
    default: return 'pending';
  }
}

export interface ToolInvocationProps { [key: string]: unknown; class?: string; }
export interface ToolInvocationResult { element: HTMLElement; dispose: () => void; }

export function ToolInvocation(props: ToolInvocationProps): ToolInvocationResult {
  const defaultExpanded = Boolean(props.defaultExpanded);
  const viewSig = surfaceCreateSignal<ToolInvocationViewState>(defaultExpanded ? 'expanded' : 'collapsed');
  const execSig = surfaceCreateSignal<ToolInvocationExecState>(statusToExecState(String(props.status ?? 'pending')));

  const toolName = String(props.toolName ?? '');
  const args = String(props.arguments ?? '{}');
  const result = props.result as string | undefined;
  const status = String(props.status ?? 'pending');
  const duration = props.duration as number | undefined;
  const onRetry = props.onRetry as (() => void) | undefined;
  const showArguments = props.showArguments !== false;
  const showResult = props.showResult !== false;
  const destructive = Boolean(props['data-destructive']);

  const formattedArgs = formatJson(args);
  const formattedResult = result ? formatJson(result) : undefined;

  const STATUS_ICONS: Record<string, string> = { running: '\u25CB', succeeded: '\u2713', failed: '\u2717', pending: '\u2022' };
  const STATUS_LABELS: Record<string, string> = { running: 'Running', succeeded: 'Succeeded', failed: 'Failed', pending: 'Pending' };

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'tool-invocation');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', viewSig.get());
  root.setAttribute('data-status', execSig.get());
  root.setAttribute('role', 'article');
  root.setAttribute('aria-label', `Tool call: ${toolName}`);
  root.setAttribute('aria-expanded', String(viewSig.get() === 'expanded'));
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Header
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.setAttribute('role', 'button');
  headerEl.setAttribute('aria-label', `${toolName} \u2014 ${STATUS_LABELS[execSig.get()]}`);
  headerEl.setAttribute('tabindex', '0');
  root.appendChild(headerEl);

  const toolIconEl = document.createElement('div');
  toolIconEl.setAttribute('data-part', 'tool-icon');
  toolIconEl.setAttribute('aria-hidden', 'true');
  toolIconEl.textContent = '\u2699';
  headerEl.appendChild(toolIconEl);

  const toolNameEl = document.createElement('span');
  toolNameEl.setAttribute('data-part', 'tool-name');
  toolNameEl.textContent = toolName;
  headerEl.appendChild(toolNameEl);

  if (destructive) {
    const warnBadge = document.createElement('span');
    warnBadge.setAttribute('data-part', 'warning-badge');
    warnBadge.setAttribute('data-visible', 'true');
    warnBadge.setAttribute('role', 'status');
    warnBadge.setAttribute('aria-label', 'Destructive tool');
    warnBadge.textContent = '\u26A0';
    headerEl.appendChild(warnBadge);
  }

  const statusIconEl = document.createElement('div');
  statusIconEl.setAttribute('data-part', 'status-icon');
  statusIconEl.setAttribute('data-status', execSig.get());
  statusIconEl.setAttribute('aria-label', STATUS_LABELS[execSig.get()]);
  statusIconEl.textContent = STATUS_ICONS[execSig.get()];
  headerEl.appendChild(statusIconEl);

  const durationEl = document.createElement('span');
  durationEl.setAttribute('data-part', 'duration');
  durationEl.setAttribute('data-visible', duration != null ? 'true' : 'false');
  durationEl.textContent = duration != null ? `${duration}ms` : '';
  headerEl.appendChild(durationEl);

  // Body
  const bodyEl = document.createElement('div');
  bodyEl.setAttribute('data-part', 'body');
  bodyEl.setAttribute('data-visible', viewSig.get() === 'expanded' ? 'true' : 'false');
  root.appendChild(bodyEl);

  const toggleExpand = () => {
    if (viewSig.get() === 'expanded') viewSig.set('collapsed');
    else viewSig.set('expanded');
  };

  headerEl.addEventListener('click', toggleExpand);
  headerEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleExpand(); }
  });

  root.addEventListener('pointerenter', () => { if (viewSig.get() === 'collapsed') viewSig.set('hoveredCollapsed'); });
  root.addEventListener('pointerleave', () => { if (viewSig.get() === 'hoveredCollapsed') viewSig.set('collapsed'); });
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); toggleExpand(); }
    if (e.key === 'Escape') { e.preventDefault(); viewSig.set('collapsed'); }
    if (e.key === 'r' && execSig.get() === 'failed') { e.preventDefault(); execSig.set('running'); onRetry?.(); }
  });

  const renderBody = () => {
    bodyEl.innerHTML = '';
    if (viewSig.get() !== 'expanded') return;

    if (showArguments) {
      const argsDiv = document.createElement('div');
      argsDiv.setAttribute('data-part', 'arguments');
      argsDiv.setAttribute('data-visible', 'true');
      const argsPre = document.createElement('pre');
      argsPre.setAttribute('role', 'code');
      argsPre.setAttribute('aria-label', 'Tool arguments');
      argsPre.setAttribute('data-part', 'arguments-code');
      const argsCode = document.createElement('code');
      argsCode.textContent = formattedArgs;
      argsPre.appendChild(argsCode);
      argsDiv.appendChild(argsPre);
      bodyEl.appendChild(argsDiv);
    }

    if (showResult && formattedResult) {
      const resultDiv = document.createElement('div');
      resultDiv.setAttribute('data-part', 'result');
      resultDiv.setAttribute('data-visible', 'true');
      const resultPre = document.createElement('pre');
      resultPre.setAttribute('role', 'code');
      resultPre.setAttribute('aria-label', 'Tool result');
      resultPre.setAttribute('data-part', 'result-code');
      const resultCode = document.createElement('code');
      resultCode.textContent = formattedResult;
      resultPre.appendChild(resultCode);
      resultDiv.appendChild(resultPre);
      bodyEl.appendChild(resultDiv);
    }

    if (execSig.get() === 'failed') {
      const retryBtn = document.createElement('button');
      retryBtn.setAttribute('type', 'button');
      retryBtn.setAttribute('data-part', 'retry-button');
      retryBtn.setAttribute('data-visible', 'true');
      retryBtn.setAttribute('aria-label', 'Retry tool call');
      retryBtn.setAttribute('tabindex', '0');
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', (e) => { e.stopPropagation(); execSig.set('running'); onRetry?.(); });
      bodyEl.appendChild(retryBtn);
    }
  };

  if (!destructive) {
    const hiddenBadge = document.createElement('span');
    hiddenBadge.setAttribute('data-part', 'warning-badge');
    hiddenBadge.setAttribute('data-visible', 'false');
    hiddenBadge.setAttribute('aria-hidden', 'true');
    root.appendChild(hiddenBadge);
  }

  renderBody();

  const unsub1 = viewSig.subscribe((s) => {
    root.setAttribute('data-state', s);
    root.setAttribute('aria-expanded', String(s === 'expanded'));
    bodyEl.setAttribute('data-visible', s === 'expanded' ? 'true' : 'false');
    renderBody();
  });

  const unsub2 = execSig.subscribe((s) => {
    root.setAttribute('data-status', s);
    statusIconEl.setAttribute('data-status', s);
    statusIconEl.setAttribute('aria-label', STATUS_LABELS[s]);
    statusIconEl.textContent = STATUS_ICONS[s];
    renderBody();
  });

  return {
    element: root,
    dispose() { unsub1(); unsub2(); root.remove(); },
  };
}

export default ToolInvocation;
