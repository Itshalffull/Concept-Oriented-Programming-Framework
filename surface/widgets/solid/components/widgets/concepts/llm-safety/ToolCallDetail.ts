import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type ToolCallDetailState = 'idle' | 'retrying';
export type ToolCallDetailEvent =
  | { type: 'EXPAND_ARGS' }
  | { type: 'EXPAND_RESULT' }
  | { type: 'RETRY' }
  | { type: 'RETRY_COMPLETE' }
  | { type: 'RETRY_ERROR' };

export function toolCallDetailReducer(state: ToolCallDetailState, event: ToolCallDetailEvent): ToolCallDetailState {
  switch (state) {
    case 'idle':
      if (event.type === 'EXPAND_ARGS') return 'idle';
      if (event.type === 'EXPAND_RESULT') return 'idle';
      if (event.type === 'RETRY') return 'retrying';
      return state;
    case 'retrying':
      if (event.type === 'RETRY_COMPLETE') return 'idle';
      if (event.type === 'RETRY_ERROR') return 'idle';
      return state;
    default:
      return state;
  }
}

type ToolCallStatus = 'pending' | 'success' | 'error';

const STATUS_STYLES: Record<ToolCallStatus, { background: string; color: string; label: string }> = {
  pending: { background: '#fef3c7', color: '#92400e', label: 'Pending' },
  success: { background: '#d1fae5', color: '#065f46', label: 'Success' },
  error: { background: '#fee2e2', color: '#991b1b', label: 'Error' },
};

function formatJson(value: string | Record<string, unknown> | undefined | null): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') {
    try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
  }
  return JSON.stringify(value, null, 2);
}

function copyToClipboard(text: string): void {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

export interface ToolCallDetailProps { [key: string]: unknown; class?: string; }
export interface ToolCallDetailResult { element: HTMLElement; dispose: () => void; }

export function ToolCallDetail(props: ToolCallDetailProps): ToolCallDetailResult {
  const sig = surfaceCreateSignal<ToolCallDetailState>('idle');
  const send = (event: ToolCallDetailEvent) => { sig.set(toolCallDetailReducer(sig.get(), event)); };

  const toolName = String(props.toolName ?? '');
  const input = (props.input ?? props.arguments ?? '') as string | Record<string, unknown>;
  const output = (props.output ?? props.result) as string | Record<string, unknown> | undefined;
  const status = (props.error ? 'error' : (props.status ?? 'pending')) as ToolCallStatus;
  const duration = (props.duration ?? props.timing) as number | undefined;
  const timestamp = props.timestamp as string | undefined;
  const tokenUsage = props.tokenUsage as number | undefined;
  const error = props.error as string | undefined;
  const showTiming = props.showTiming !== false;
  const showTokens = props.showTokens !== false;
  const onRetry = props.onRetry as (() => void) | undefined;

  const formattedInput = formatJson(input);
  const formattedOutput = formatJson(output);
  const errorMessage = error ?? (status === 'error' && typeof output === 'string' ? output : undefined);
  const statusInfo = STATUS_STYLES[status];

  let argsExpanded = true;
  let resultExpanded = true;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'tool-call-detail');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('role', 'article');
  root.setAttribute('aria-label', `Tool call: ${toolName}`);
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Header
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.setAttribute('data-state', sig.get());
  root.appendChild(headerEl);

  const toolNameEl = document.createElement('span');
  toolNameEl.setAttribute('data-part', 'tool-name');
  toolNameEl.setAttribute('data-state', sig.get());
  toolNameEl.textContent = toolName;
  headerEl.appendChild(toolNameEl);

  const statusBadgeEl = document.createElement('span');
  statusBadgeEl.setAttribute('data-part', 'status-badge');
  statusBadgeEl.setAttribute('data-state', sig.get());
  statusBadgeEl.setAttribute('role', 'status');
  statusBadgeEl.setAttribute('aria-label', `Status: ${statusInfo.label}`);
  statusBadgeEl.style.background = statusInfo.background;
  statusBadgeEl.style.color = statusInfo.color;
  statusBadgeEl.style.padding = '2px 8px';
  statusBadgeEl.style.borderRadius = '9999px';
  statusBadgeEl.style.fontSize = '12px';
  statusBadgeEl.textContent = statusInfo.label;
  headerEl.appendChild(statusBadgeEl);

  if (duration != null && showTiming) {
    const timingEl = document.createElement('span');
    timingEl.setAttribute('data-part', 'timing-bar');
    timingEl.setAttribute('data-state', sig.get());
    timingEl.setAttribute('data-visible', 'true');
    timingEl.textContent = `${duration}ms`;
    headerEl.appendChild(timingEl);
  }

  // Arguments panel
  const argsPanelEl = document.createElement('div');
  argsPanelEl.setAttribute('data-part', 'arguments-panel');
  argsPanelEl.setAttribute('data-state', sig.get());
  argsPanelEl.setAttribute('role', 'region');
  argsPanelEl.setAttribute('aria-label', 'Arguments');
  argsPanelEl.setAttribute('tabindex', '0');
  root.appendChild(argsPanelEl);

  const argsToggleBtn = document.createElement('button');
  argsToggleBtn.setAttribute('type', 'button');
  argsToggleBtn.setAttribute('aria-expanded', 'true');
  argsToggleBtn.style.width = '100%';
  argsToggleBtn.style.textAlign = 'left';
  argsToggleBtn.style.cursor = 'pointer';
  argsToggleBtn.style.background = 'transparent';
  argsToggleBtn.style.border = 'none';
  argsToggleBtn.style.padding = '8px 12px';
  argsToggleBtn.style.fontWeight = '600';
  argsToggleBtn.style.fontSize = '13px';
  argsPanelEl.appendChild(argsToggleBtn);

  const argsArrow = document.createElement('span');
  argsArrow.style.display = 'inline-block';
  argsArrow.style.marginRight = '6px';
  argsArrow.innerHTML = '&#9654;';
  argsArrow.style.transform = 'rotate(90deg)';
  argsArrow.style.transition = 'transform 150ms';
  argsToggleBtn.appendChild(argsArrow);
  argsToggleBtn.appendChild(document.createTextNode('Input '));

  const argsCopyBtn = document.createElement('button');
  argsCopyBtn.setAttribute('type', 'button');
  argsCopyBtn.setAttribute('aria-label', 'Copy input JSON');
  argsCopyBtn.style.marginLeft = 'auto';
  argsCopyBtn.style.padding = '2px 6px';
  argsCopyBtn.style.fontSize = '11px';
  argsCopyBtn.style.border = '1px solid #d1d5db';
  argsCopyBtn.style.borderRadius = '4px';
  argsCopyBtn.style.background = '#f9fafb';
  argsCopyBtn.style.cursor = 'pointer';
  argsCopyBtn.textContent = 'Copy';
  argsCopyBtn.addEventListener('click', (e) => { e.stopPropagation(); copyToClipboard(formattedInput); });
  argsToggleBtn.appendChild(argsCopyBtn);

  const argsPreEl = document.createElement('pre');
  argsPreEl.setAttribute('role', 'code');
  argsPreEl.setAttribute('aria-label', 'Arguments');
  argsPreEl.style.margin = '0';
  argsPreEl.style.padding = '8px 12px';
  argsPreEl.style.fontSize = '12px';
  argsPreEl.style.fontFamily = 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace';
  argsPreEl.style.background = '#f9fafb';
  argsPreEl.style.overflow = 'auto';
  argsPreEl.style.whiteSpace = 'pre-wrap';
  argsPreEl.style.wordBreak = 'break-word';
  argsPreEl.textContent = formattedInput;
  argsPanelEl.appendChild(argsPreEl);

  argsToggleBtn.addEventListener('click', () => {
    argsExpanded = !argsExpanded;
    argsToggleBtn.setAttribute('aria-expanded', String(argsExpanded));
    argsArrow.style.transform = argsExpanded ? 'rotate(90deg)' : 'rotate(0)';
    argsPreEl.style.display = argsExpanded ? '' : 'none';
    send({ type: 'EXPAND_ARGS' });
  });

  // Result panel
  if (output != null || errorMessage) {
    const resultPanelEl = document.createElement('div');
    resultPanelEl.setAttribute('data-part', 'result-panel');
    resultPanelEl.setAttribute('data-state', sig.get());
    resultPanelEl.setAttribute('data-visible', 'true');
    resultPanelEl.setAttribute('role', 'region');
    resultPanelEl.setAttribute('aria-label', 'Result');
    resultPanelEl.setAttribute('tabindex', '0');
    root.appendChild(resultPanelEl);

    const resultToggleBtn = document.createElement('button');
    resultToggleBtn.setAttribute('type', 'button');
    resultToggleBtn.setAttribute('aria-expanded', 'true');
    resultToggleBtn.style.width = '100%';
    resultToggleBtn.style.textAlign = 'left';
    resultToggleBtn.style.cursor = 'pointer';
    resultToggleBtn.style.background = 'transparent';
    resultToggleBtn.style.border = 'none';
    resultToggleBtn.style.padding = '8px 12px';
    resultToggleBtn.style.fontWeight = '600';
    resultToggleBtn.style.fontSize = '13px';
    resultPanelEl.appendChild(resultToggleBtn);

    const resultArrow = document.createElement('span');
    resultArrow.style.display = 'inline-block';
    resultArrow.style.marginRight = '6px';
    resultArrow.innerHTML = '&#9654;';
    resultArrow.style.transform = 'rotate(90deg)';
    resultArrow.style.transition = 'transform 150ms';
    resultToggleBtn.appendChild(resultArrow);
    resultToggleBtn.appendChild(document.createTextNode('Output '));

    const resultCopyBtn = document.createElement('button');
    resultCopyBtn.setAttribute('type', 'button');
    resultCopyBtn.setAttribute('aria-label', 'Copy output JSON');
    resultCopyBtn.style.marginLeft = 'auto';
    resultCopyBtn.style.padding = '2px 6px';
    resultCopyBtn.style.fontSize = '11px';
    resultCopyBtn.style.border = '1px solid #d1d5db';
    resultCopyBtn.style.borderRadius = '4px';
    resultCopyBtn.style.background = '#f9fafb';
    resultCopyBtn.style.cursor = 'pointer';
    resultCopyBtn.textContent = 'Copy';
    resultCopyBtn.addEventListener('click', (e) => { e.stopPropagation(); copyToClipboard(errorMessage ?? formattedOutput); });
    resultToggleBtn.appendChild(resultCopyBtn);

    let resultContentEl: HTMLElement;
    if (status === 'error' && errorMessage) {
      resultContentEl = document.createElement('div');
      resultContentEl.setAttribute('data-part', 'error-panel');
      resultContentEl.setAttribute('data-state', sig.get());
      resultContentEl.setAttribute('data-visible', 'true');
      resultContentEl.setAttribute('role', 'alert');
      resultContentEl.setAttribute('aria-label', 'Error details');
      resultContentEl.style.margin = '0';
      resultContentEl.style.padding = '8px 12px';
      resultContentEl.style.fontSize = '12px';
      resultContentEl.style.fontFamily = 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace';
      resultContentEl.style.background = '#fef2f2';
      resultContentEl.style.color = '#991b1b';
      resultContentEl.style.overflow = 'auto';
      resultContentEl.style.whiteSpace = 'pre-wrap';
      resultContentEl.style.wordBreak = 'break-word';
      resultContentEl.style.borderLeft = '3px solid #ef4444';
      resultContentEl.textContent = errorMessage;
    } else {
      resultContentEl = document.createElement('pre');
      resultContentEl.setAttribute('role', 'code');
      resultContentEl.setAttribute('aria-label', 'Result');
      resultContentEl.style.margin = '0';
      resultContentEl.style.padding = '8px 12px';
      resultContentEl.style.fontSize = '12px';
      resultContentEl.style.fontFamily = 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace';
      resultContentEl.style.background = '#f9fafb';
      resultContentEl.style.overflow = 'auto';
      resultContentEl.style.whiteSpace = 'pre-wrap';
      resultContentEl.style.wordBreak = 'break-word';
      resultContentEl.textContent = formattedOutput;
    }
    resultPanelEl.appendChild(resultContentEl);

    resultToggleBtn.addEventListener('click', () => {
      resultExpanded = !resultExpanded;
      resultToggleBtn.setAttribute('aria-expanded', String(resultExpanded));
      resultArrow.style.transform = resultExpanded ? 'rotate(90deg)' : 'rotate(0)';
      resultContentEl.style.display = resultExpanded ? '' : 'none';
      send({ type: 'EXPAND_RESULT' });
    });
  }

  // Token badge
  if (showTokens && tokenUsage != null) {
    const tokenBadgeEl = document.createElement('div');
    tokenBadgeEl.setAttribute('data-part', 'token-badge');
    tokenBadgeEl.setAttribute('data-state', sig.get());
    tokenBadgeEl.setAttribute('data-visible', 'true');
    tokenBadgeEl.style.display = 'inline-flex';
    tokenBadgeEl.style.alignItems = 'center';
    tokenBadgeEl.style.margin = '8px 12px';
    tokenBadgeEl.style.padding = '2px 8px';
    tokenBadgeEl.style.fontSize = '12px';
    tokenBadgeEl.style.border = '1px solid #d1d5db';
    tokenBadgeEl.style.borderRadius = '9999px';
    tokenBadgeEl.style.color = '#6b7280';
    tokenBadgeEl.textContent = `${tokenUsage} tokens`;
    root.appendChild(tokenBadgeEl);
  }

  // Timestamp
  if (timestamp) {
    const tsEl = document.createElement('div');
    tsEl.setAttribute('data-part', 'timestamp');
    tsEl.setAttribute('data-state', sig.get());
    tsEl.style.padding = '4px 12px 8px';
    tsEl.style.fontSize = '12px';
    tsEl.style.color = '#9ca3af';
    tsEl.textContent = timestamp;
    root.appendChild(tsEl);
  }

  // Retry button
  if (errorMessage) {
    const retryBtn = document.createElement('button');
    retryBtn.setAttribute('type', 'button');
    retryBtn.setAttribute('data-part', 'retry-button');
    retryBtn.setAttribute('data-state', sig.get());
    retryBtn.setAttribute('data-visible', 'true');
    retryBtn.setAttribute('aria-label', 'Retry tool call');
    retryBtn.setAttribute('tabindex', '0');
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => {
      if (sig.get() === 'retrying') return;
      send({ type: 'RETRY' });
      onRetry?.();
    });
    root.appendChild(retryBtn);
  }

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'r' && !e.ctrlKey && !e.metaKey && errorMessage) {
      e.preventDefault();
      if (sig.get() !== 'retrying') { send({ type: 'RETRY' }); onRetry?.(); }
    }
    if (e.ctrlKey && e.key === 'c') {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-part="arguments-panel"]')) {
        e.preventDefault();
        copyToClipboard(formattedInput);
      } else if (target.closest('[data-part="result-panel"]')) {
        e.preventDefault();
        copyToClipboard(errorMessage ?? formattedOutput);
      }
    }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default ToolCallDetail;
