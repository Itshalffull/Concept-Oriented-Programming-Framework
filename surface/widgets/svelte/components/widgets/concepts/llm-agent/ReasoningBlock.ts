import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type ReasoningBlockState = 'collapsed' | 'expanded' | 'streaming';
export type ReasoningBlockEvent =
  | { type: 'EXPAND' }
  | { type: 'STREAM_START' }
  | { type: 'COLLAPSE' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' };

export function reasoningBlockReducer(state: ReasoningBlockState, event: ReasoningBlockEvent): ReasoningBlockState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND') return 'expanded';
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE') return 'collapsed';
      return state;
    case 'streaming':
      if (event.type === 'TOKEN') return 'streaming';
      if (event.type === 'STREAM_END') return 'expanded';
      return state;
    default:
      return state;
  }
}

export interface ReasoningBlockProps { [key: string]: unknown; class?: string; }
export interface ReasoningBlockResult { element: HTMLElement; dispose: () => void; }

export function ReasoningBlock(props: ReasoningBlockProps): ReasoningBlockResult {
  const sig = surfaceCreateSignal<ReasoningBlockState>('collapsed');
  const state = () => sig.get();
  const send = (type: string) => sig.set(reasoningBlockReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'reasoning-block');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Reasoning trace');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const s = sig.get();
      if (s === 'collapsed') send('EXPAND');
      else if (s === 'expanded') send('COLLAPSE');
    }
    if (e.key === 'Escape' && sig.get() === 'expanded') {
      e.preventDefault();
      send('COLLAPSE');
    }
  });

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.setAttribute('role', 'button');
  headerEl.setAttribute('aria-expanded', 'false');
  headerEl.style.cursor = 'pointer';
  headerEl.addEventListener('click', () => {
    const s = sig.get();
    if (s === 'collapsed') send('EXPAND');
    else if (s === 'expanded') send('COLLAPSE');
  });
  root.appendChild(headerEl);

  const headerIconEl = document.createElement('span');
  headerIconEl.setAttribute('data-part', 'header-icon');
  headerIconEl.setAttribute('aria-hidden', 'true');
  headerIconEl.textContent = '\u25B6';
  headerEl.appendChild(headerIconEl);

  const headerTextEl = document.createElement('span');
  headerTextEl.setAttribute('data-part', 'header-text');
  headerTextEl.textContent = 'Thinking...';
  headerEl.appendChild(headerTextEl);

  const durationEl = document.createElement('span');
  durationEl.setAttribute('data-part', 'duration');
  headerEl.appendChild(durationEl);

  const bodyEl = document.createElement('div');
  bodyEl.setAttribute('data-part', 'body');
  bodyEl.setAttribute('role', 'region');
  bodyEl.setAttribute('aria-label', 'Reasoning content');
  bodyEl.style.display = 'none';
  root.appendChild(bodyEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
    const isOpen = s === 'expanded' || s === 'streaming';
    headerEl.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    headerIconEl.textContent = isOpen ? '\u25BC' : '\u25B6';
    bodyEl.style.display = isOpen ? '' : 'none';
    bodyEl.setAttribute('data-visible', isOpen ? 'true' : 'false');
    headerTextEl.textContent = s === 'streaming' ? 'Thinking...' : 'Thought process';
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default ReasoningBlock;
