import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type ReasoningBlockState = 'collapsed' | 'expanded' | 'streaming';
export type ReasoningBlockEvent =
  | { type: 'EXPAND' }
  | { type: 'STREAM_START' }
  | { type: 'COLLAPSE' }
  | { type: 'TOGGLE' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' };

export function reasoningBlockReducer(state: ReasoningBlockState, event: ReasoningBlockEvent): ReasoningBlockState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND' || event.type === 'TOGGLE') return 'expanded';
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE' || event.type === 'TOGGLE') return 'collapsed';
      return state;
    case 'streaming':
      if (event.type === 'TOKEN') return 'streaming';
      if (event.type === 'STREAM_END') return 'collapsed';
      return state;
    default:
      return state;
  }
}

export interface ReasoningBlockProps { [key: string]: unknown; class?: string; }
export interface ReasoningBlockResult { element: HTMLElement; dispose: () => void; }

export function ReasoningBlock(props: ReasoningBlockProps): ReasoningBlockResult {
  const streaming = Boolean(props.streaming);
  const defaultExpanded = Boolean(props.defaultExpanded);
  const initialState: ReasoningBlockState = streaming ? 'streaming' : defaultExpanded ? 'expanded' : 'collapsed';
  const sig = surfaceCreateSignal<ReasoningBlockState>(initialState);
  const send = (event: ReasoningBlockEvent) => { sig.set(reasoningBlockReducer(sig.get(), event)); };

  const content = String(props.content ?? '');
  const showDuration = props.showDuration !== false;
  const duration = props.duration as number | undefined;
  const onToggle = props.onToggle as (() => void) | undefined;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'reasoning-block');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Model reasoning');
  if (props.class) root.className = props.class as string;

  // Header
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.setAttribute('role', 'button');
  headerEl.setAttribute('aria-expanded', String(sig.get() === 'expanded' || sig.get() === 'streaming'));
  headerEl.setAttribute('aria-label', 'Toggle reasoning details');
  headerEl.setAttribute('tabindex', '0');
  root.appendChild(headerEl);

  const headerIconEl = document.createElement('div');
  headerIconEl.setAttribute('data-part', 'header-icon');
  headerIconEl.setAttribute('aria-hidden', 'true');
  headerIconEl.textContent = '\uD83E\uDDE0';
  headerEl.appendChild(headerIconEl);

  const headerTextEl = document.createElement('span');
  headerTextEl.setAttribute('data-part', 'header-text');
  headerTextEl.textContent = sig.get() === 'streaming' ? 'Thinking...' : 'Reasoning';
  headerEl.appendChild(headerTextEl);

  const durationEl = document.createElement('span');
  durationEl.setAttribute('data-part', 'duration');
  durationEl.setAttribute('data-visible', (showDuration && sig.get() !== 'streaming' && duration != null) ? 'true' : 'false');
  durationEl.textContent = (showDuration && sig.get() !== 'streaming' && duration != null) ? `${duration}ms` : '';
  headerEl.appendChild(durationEl);

  const handleToggle = () => {
    if (sig.get() === 'streaming') return;
    send({ type: 'TOGGLE' });
    onToggle?.();
  };

  headerEl.addEventListener('click', handleToggle);
  headerEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); }
  });

  // Body
  const bodyEl = document.createElement('div');
  bodyEl.setAttribute('data-part', 'body');
  bodyEl.setAttribute('role', 'region');
  bodyEl.setAttribute('aria-label', 'Reasoning content');
  const isVisible = sig.get() === 'expanded' || sig.get() === 'streaming';
  bodyEl.setAttribute('data-visible', isVisible ? 'true' : 'false');
  root.appendChild(bodyEl);

  const contentEl = document.createElement('div');
  contentEl.setAttribute('data-part', 'content');
  contentEl.textContent = content;
  if (isVisible) bodyEl.appendChild(contentEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    const visible = s === 'expanded' || s === 'streaming';
    headerEl.setAttribute('aria-expanded', String(visible));
    headerTextEl.textContent = s === 'streaming' ? 'Thinking...' : 'Reasoning';
    bodyEl.setAttribute('data-visible', visible ? 'true' : 'false');
    bodyEl.innerHTML = '';
    if (visible) {
      const c = document.createElement('div');
      c.setAttribute('data-part', 'content');
      c.textContent = content;
      bodyEl.appendChild(c);
    }
    durationEl.setAttribute('data-visible', (showDuration && s !== 'streaming' && duration != null) ? 'true' : 'false');
    durationEl.textContent = (showDuration && s !== 'streaming' && duration != null) ? `${duration}ms` : '';
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default ReasoningBlock;
