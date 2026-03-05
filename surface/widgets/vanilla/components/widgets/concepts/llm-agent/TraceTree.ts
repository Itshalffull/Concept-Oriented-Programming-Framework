/* ---------------------------------------------------------------------------
 * TraceTree — Vanilla implementation
 *
 * Hierarchical trace tree showing spans with type icons, duration, tokens,
 * status, filter bar, detail panel, and keyboard tree navigation.
 * ------------------------------------------------------------------------- */

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

export interface TraceSpan {
  id: string;
  label: string;
  type: 'llm' | 'tool' | 'agent' | 'chain' | 'retrieval';
  status: 'ok' | 'error' | 'running';
  duration?: number;
  tokens?: number;
  children?: TraceSpan[];
  detail?: string;
}

const TYPE_ICONS: Record<string, string> = { llm: '\u{1F916}', tool: '\u2699', agent: '\u{1F464}', chain: '\u26D3', retrieval: '\u{1F50D}' };
const STATUS_ICONS: Record<string, string> = { ok: '\u2713', error: '\u2717', running: '\u25CF' };

export interface TraceTreeProps {
  [key: string]: unknown;
  className?: string;
  spans?: TraceSpan[];
  traceId?: string;
  onSelectSpan?: (id: string) => void;
}
export interface TraceTreeOptions { target: HTMLElement; props: TraceTreeProps; }

let _traceTreeUid = 0;

export class TraceTree {
  private el: HTMLElement;
  private props: TraceTreeProps;
  private state: TraceTreeState = 'idle';
  private disposers: Array<() => void> = [];
  private expandedIds = new Set<string>();
  private selectedSpanId: string | null = null;
  private focusIndex = 0;
  private flatSpans: TraceSpan[] = [];

  constructor(options: TraceTreeOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'trace-tree');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'tree');
    this.el.setAttribute('aria-label', 'Trace tree');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'trace-tree-' + (++_traceTreeUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  send(type: string): void {
    this.state = traceTreeReducer(this.state, { type } as any);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<TraceTreeProps>): void {
    Object.assign(this.props, props);
    this.cleanup();
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { this.cleanup(); this.el.remove(); }

  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private rerender(): void { this.cleanup(); this.el.innerHTML = ''; this.render(); }

  private flattenSpans(spans: TraceSpan[]): TraceSpan[] {
    const result: TraceSpan[] = [];
    const walk = (list: TraceSpan[]) => {
      for (const s of list) {
        result.push(s);
        if (this.expandedIds.has(s.id) && s.children) walk(s.children);
      }
    };
    walk(spans);
    return result;
  }

  private render(): void {
    const spans = (this.props.spans ?? []) as TraceSpan[];
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className;
    this.flatSpans = this.flattenSpans(spans);

    // Keyboard
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.focusIndex = Math.min(this.focusIndex + 1, this.flatSpans.length - 1); this.updateFocus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.focusIndex = Math.max(this.focusIndex - 1, 0); this.updateFocus(); }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const s = this.flatSpans[this.focusIndex];
        if (s?.children?.length && !this.expandedIds.has(s.id)) { this.expandedIds.add(s.id); this.rerender(); }
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const s = this.flatSpans[this.focusIndex];
        if (s && this.expandedIds.has(s.id)) { this.expandedIds.delete(s.id); this.rerender(); }
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const s = this.flatSpans[this.focusIndex];
        if (s) { this.selectedSpanId = s.id; this.send('SELECT_SPAN'); this.props.onSelectSpan?.(s.id); this.rerender(); }
      }
      if (e.key === 'Escape') { e.preventDefault(); this.selectedSpanId = null; this.send('DESELECT'); this.rerender(); }
    };
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));

    // Header
    const header = document.createElement('div');
    header.setAttribute('data-part', 'header');
    header.textContent = this.props.traceId ? `Trace: ${this.props.traceId}` : 'Trace';
    this.el.appendChild(header);

    // Tree
    const tree = document.createElement('div');
    tree.setAttribute('data-part', 'tree');
    tree.setAttribute('role', 'group');
    this.renderSpans(tree, spans, 0);
    this.el.appendChild(tree);

    // Detail panel
    if (this.selectedSpanId) {
      const selected = this.findSpan(spans, this.selectedSpanId);
      if (selected) {
        const detail = document.createElement('div');
        detail.setAttribute('data-part', 'detail-panel');
        detail.setAttribute('data-visible', 'true');
        detail.setAttribute('role', 'complementary');

        const closeBtn = document.createElement('button');
        closeBtn.setAttribute('type', 'button');
        closeBtn.setAttribute('aria-label', 'Close detail');
        closeBtn.textContent = '\u2715';
        const onClose = () => { this.selectedSpanId = null; this.send('DESELECT'); this.rerender(); };
        closeBtn.addEventListener('click', onClose);
        this.disposers.push(() => closeBtn.removeEventListener('click', onClose));
        detail.appendChild(closeBtn);

        const name = document.createElement('div');
        name.textContent = `${selected.label} (${selected.type})`;
        detail.appendChild(name);
        if (selected.detail) {
          const d = document.createElement('pre');
          d.textContent = selected.detail;
          detail.appendChild(d);
        }
        if (selected.duration != null) {
          const d = document.createElement('span');
          d.textContent = `Duration: ${selected.duration}ms`;
          detail.appendChild(d);
        }
        if (selected.tokens != null) {
          const t = document.createElement('span');
          t.textContent = `Tokens: ${selected.tokens}`;
          detail.appendChild(t);
        }
        this.el.appendChild(detail);
      }
    }
  }

  private renderSpans(container: HTMLElement, spans: TraceSpan[], depth: number): void {
    for (const span of spans) {
      const flatIdx = this.flatSpans.indexOf(span);
      const isExpanded = this.expandedIds.has(span.id);
      const isSelected = this.selectedSpanId === span.id;
      const hasChildren = !!span.children?.length;

      const node = document.createElement('div');
      node.setAttribute('data-part', 'span-node');
      node.setAttribute('role', 'treeitem');
      node.setAttribute('aria-expanded', hasChildren ? (isExpanded ? 'true' : 'false') : '');
      node.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      node.setAttribute('data-type', span.type);
      node.setAttribute('data-status', span.status);
      node.setAttribute('tabindex', flatIdx === this.focusIndex ? '0' : '-1');
      node.style.paddingLeft = `${depth * 16}px`;

      const icon = document.createElement('span');
      icon.setAttribute('data-part', 'span-icon');
      icon.textContent = TYPE_ICONS[span.type] ?? '\u25CF';
      node.appendChild(icon);

      const label = document.createElement('span');
      label.setAttribute('data-part', 'span-label');
      label.textContent = span.label;
      node.appendChild(label);

      if (span.duration != null) {
        const dur = document.createElement('span');
        dur.setAttribute('data-part', 'span-duration');
        dur.textContent = `${span.duration}ms`;
        node.appendChild(dur);
      }
      if (span.tokens != null) {
        const tok = document.createElement('span');
        tok.setAttribute('data-part', 'span-tokens');
        tok.textContent = `${span.tokens}tk`;
        node.appendChild(tok);
      }

      const statusEl = document.createElement('span');
      statusEl.setAttribute('data-part', 'span-status');
      statusEl.textContent = STATUS_ICONS[span.status] ?? '';
      node.appendChild(statusEl);

      const onClick = () => {
        if (hasChildren) {
          if (isExpanded) this.expandedIds.delete(span.id); else this.expandedIds.add(span.id);
        }
        this.selectedSpanId = span.id;
        this.focusIndex = flatIdx;
        this.send('SELECT_SPAN');
        this.props.onSelectSpan?.(span.id);
        this.rerender();
      };
      node.addEventListener('click', onClick);
      this.disposers.push(() => node.removeEventListener('click', onClick));

      container.appendChild(node);

      if (isExpanded && span.children?.length) {
        const childContainer = document.createElement('div');
        childContainer.setAttribute('data-part', 'span-children');
        childContainer.setAttribute('role', 'group');
        this.renderSpans(childContainer, span.children, depth + 1);
        container.appendChild(childContainer);
      }
    }
  }

  private findSpan(spans: TraceSpan[], id: string): TraceSpan | undefined {
    for (const s of spans) {
      if (s.id === id) return s;
      if (s.children) { const found = this.findSpan(s.children, id); if (found) return found; }
    }
    return undefined;
  }

  private updateFocus(): void {
    const nodes = this.el.querySelectorAll('[data-part="span-node"]');
    nodes.forEach((n, i) => {
      (n as HTMLElement).setAttribute('tabindex', i === this.focusIndex ? '0' : '-1');
      if (i === this.focusIndex) (n as HTMLElement).focus();
    });
  }
}

export default TraceTree;
