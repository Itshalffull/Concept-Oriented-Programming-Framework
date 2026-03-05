import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type TraceTreeState = 'idle' | 'spanSelected' | 'ready' | 'fetching';
export type TraceTreeEvent =
  | { type: 'SELECT_SPAN' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'FILTER' }
  | { type: 'DESELECT' }
  | { type: 'LOAD' }
  | { type: 'LOAD_COMPLETE' };

export function traceTreeReducer(state: TraceTreeState, event: TraceTreeEvent): TraceTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_SPAN') return 'spanSelected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      return state;
    case 'spanSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_SPAN') return 'spanSelected';
      return state;
    case 'ready':
      if (event.type === 'LOAD') return 'fetching';
      return state;
    case 'fetching':
      if (event.type === 'LOAD_COMPLETE') return 'ready';
      return state;
    default:
      return state;
  }
}

export interface TraceTreeProps { [key: string]: unknown; class?: string; }
export interface TraceTreeResult { element: HTMLElement; dispose: () => void; }

export function TraceTree(props: TraceTreeProps): TraceTreeResult {
  const sig = surfaceCreateSignal<TraceTreeState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(traceTreeReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'trace-tree');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'tree');
  root.setAttribute('aria-label', 'Execution trace');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      send('DESELECT');
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      send('EXPAND');
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      send('COLLAPSE');
    }
  });

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  root.appendChild(headerEl);

  const filterBarEl = document.createElement('div');
  filterBarEl.setAttribute('data-part', 'filter-bar');
  filterBarEl.setAttribute('role', 'toolbar');
  filterBarEl.setAttribute('aria-label', 'Filter trace spans');
  root.appendChild(filterBarEl);

  const treeEl = document.createElement('div');
  treeEl.setAttribute('data-part', 'tree');
  treeEl.setAttribute('role', 'group');
  root.appendChild(treeEl);

  const spanNodeEl = document.createElement('div');
  spanNodeEl.setAttribute('data-part', 'span-node');
  spanNodeEl.setAttribute('role', 'treeitem');
  spanNodeEl.setAttribute('tabindex', '-1');
  spanNodeEl.addEventListener('click', () => send('SELECT_SPAN'));
  treeEl.appendChild(spanNodeEl);

  const spanIconEl = document.createElement('span');
  spanIconEl.setAttribute('data-part', 'span-icon');
  spanIconEl.setAttribute('aria-hidden', 'true');
  spanNodeEl.appendChild(spanIconEl);

  const spanLabelEl = document.createElement('span');
  spanLabelEl.setAttribute('data-part', 'span-label');
  spanNodeEl.appendChild(spanLabelEl);

  const spanDurationEl = document.createElement('span');
  spanDurationEl.setAttribute('data-part', 'span-duration');
  spanNodeEl.appendChild(spanDurationEl);

  const spanTokensEl = document.createElement('span');
  spanTokensEl.setAttribute('data-part', 'span-tokens');
  spanNodeEl.appendChild(spanTokensEl);

  const spanStatusEl = document.createElement('span');
  spanStatusEl.setAttribute('data-part', 'span-status');
  spanStatusEl.setAttribute('role', 'status');
  spanNodeEl.appendChild(spanStatusEl);

  const spanChildrenEl = document.createElement('div');
  spanChildrenEl.setAttribute('data-part', 'span-children');
  spanChildrenEl.setAttribute('role', 'group');
  treeEl.appendChild(spanChildrenEl);

  const detailPanelEl = document.createElement('div');
  detailPanelEl.setAttribute('data-part', 'detail-panel');
  detailPanelEl.setAttribute('role', 'complementary');
  detailPanelEl.setAttribute('aria-label', 'Span details');
  detailPanelEl.style.display = 'none';
  root.appendChild(detailPanelEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
    detailPanelEl.style.display = s === 'spanSelected' ? '' : 'none';
    detailPanelEl.setAttribute('data-visible', s === 'spanSelected' ? 'true' : 'false');
    spanNodeEl.setAttribute('data-selected', s === 'spanSelected' ? 'true' : 'false');
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default TraceTree;
