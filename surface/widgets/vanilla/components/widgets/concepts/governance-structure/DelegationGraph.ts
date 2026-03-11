/* ---------------------------------------------------------------------------
 * DelegationGraph — Vanilla widget
 * States: browsing, searching, selected, delegating, undelegating
 * ------------------------------------------------------------------------- */

export type DelegationGraphState = 'browsing' | 'searching' | 'selected' | 'delegating' | 'undelegating';
export type DelegationGraphEvent =
  | { type: 'SEARCH'; query: string } | { type: 'SELECT_DELEGATE'; id: string } | { type: 'SWITCH_VIEW' }
  | { type: 'CLEAR_SEARCH' } | { type: 'DESELECT' } | { type: 'DELEGATE' } | { type: 'UNDELEGATE' }
  | { type: 'DELEGATE_COMPLETE' } | { type: 'DELEGATE_ERROR' } | { type: 'UNDELEGATE_COMPLETE' } | { type: 'UNDELEGATE_ERROR' };

export function delegationGraphReducer(state: DelegationGraphState, event: DelegationGraphEvent): DelegationGraphState {
  switch (state) {
    case 'browsing': if (event.type === 'SEARCH') return 'searching'; if (event.type === 'SELECT_DELEGATE') return 'selected'; if (event.type === 'SWITCH_VIEW') return 'browsing'; return state;
    case 'searching': if (event.type === 'CLEAR_SEARCH') return 'browsing'; if (event.type === 'SELECT_DELEGATE') return 'selected'; return state;
    case 'selected': if (event.type === 'DESELECT') return 'browsing'; if (event.type === 'DELEGATE') return 'delegating'; if (event.type === 'UNDELEGATE') return 'undelegating'; return state;
    case 'delegating': if (event.type === 'DELEGATE_COMPLETE') return 'browsing'; if (event.type === 'DELEGATE_ERROR') return 'selected'; return state;
    case 'undelegating': if (event.type === 'UNDELEGATE_COMPLETE') return 'browsing'; if (event.type === 'UNDELEGATE_ERROR') return 'selected'; return state;
    default: return state;
  }
}

export interface DelegationNode { id: string; label: string; weight?: number; avatar?: string; }
export interface DelegationEdge { from: string; to: string; weight?: number; }

function compEW(nodeId: string, nodes: DelegationNode[], edges: DelegationEdge[], visited = new Set<string>()): number {
  if (visited.has(nodeId)) return 0; visited.add(nodeId);
  const n = nodes.find(n => n.id === nodeId); const base = n?.weight ?? 1;
  let del = 0; for (const e of edges.filter(e => e.to === nodeId)) del += compEW(e.from, nodes, edges, new Set(visited)) * (e.weight ?? 1);
  return base + del;
}

function findUp(nodeId: string, edges: DelegationEdge[], visited = new Set<string>()): string[] {
  if (visited.has(nodeId)) return []; visited.add(nodeId);
  const direct = edges.filter(e => e.to === nodeId).map(e => e.from);
  const r = [...direct]; for (const d of direct) r.push(...findUp(d, edges, new Set(visited)));
  return [...new Set(r)];
}

function fmtW(w: number): string { return Number.isInteger(w) ? String(w) : w.toFixed(2); }

export interface DelegationGraphProps {
  nodes: DelegationNode[]; edges: DelegationEdge[]; currentUserId?: string;
  viewMode?: 'list' | 'graph'; sortBy?: 'power' | 'participation' | 'name';
  showCurrentDelegation?: boolean;
  onDelegate?: (fromId: string, toId: string) => void; onUndelegate?: (fromId: string, toId: string) => void;
  onSelectNode?: (nodeId: string) => void; className?: string; [key: string]: unknown;
}
export interface DelegationGraphOptions { target: HTMLElement; props: DelegationGraphProps; }
let _uid = 0;

export class DelegationGraph {
  private el: HTMLElement;
  private props: DelegationGraphProps;
  private state: DelegationGraphState = 'browsing';
  private uid = ++_uid;
  private disposers: (() => void)[] = [];
  private searchQ = '';
  private selNodeId: string | null = null;
  private focusIdx = 0;
  private activeView: 'list' | 'graph';

  constructor(private options: DelegationGraphOptions) {
    this.props = { ...options.props };
    this.activeView = this.props.viewMode ?? 'list';
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', ''); this.el.setAttribute('data-widget-name', 'delegation-graph');
    this.el.setAttribute('data-part', 'root'); this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', 'Delegation management'); this.el.setAttribute('tabindex', '0');
    this.el.id = 'delegation-graph-' + this.uid;
    const kd = (e: KeyboardEvent) => this.onKey(e);
    this.el.addEventListener('keydown', kd); this.disposers.push(() => this.el.removeEventListener('keydown', kd));
    this.render(); options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  private sm(ev: DelegationGraphEvent): void { this.state = delegationGraphReducer(this.state, ev); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<DelegationGraphProps>): void { Object.assign(this.props, props); this.render(); }
  destroy(): void { this.disposers.forEach(d => d()); this.el.remove(); }

  private get nodeWeights(): Map<string, number> { const m = new Map<string, number>(); for (const n of this.props.nodes) m.set(n.id, compEW(n.id, this.props.nodes, this.props.edges)); return m; }
  private get filtered(): DelegationNode[] {
    let r = [...this.props.nodes]; const q = this.searchQ.toLowerCase(); if (q) r = r.filter(n => n.label.toLowerCase().includes(q));
    const w = this.nodeWeights; const sb = this.props.sortBy ?? 'power';
    if (sb === 'name') r.sort((a, b) => a.label.localeCompare(b.label)); else r.sort((a, b) => (w.get(b.id) ?? 0) - (w.get(a.id) ?? 0));
    return r;
  }

  private onKey(e: KeyboardEvent): void {
    const f = this.filtered;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); this.focusIdx = Math.min(this.focusIdx + 1, f.length - 1); this.render(); break;
      case 'ArrowUp': e.preventDefault(); this.focusIdx = Math.max(this.focusIdx - 1, 0); this.render(); break;
      case 'Enter': e.preventDefault(); if (f[this.focusIdx]) { this.selNodeId = f[this.focusIdx].id; this.sm({ type: 'SELECT_DELEGATE', id: f[this.focusIdx].id }); this.props.onSelectNode?.(f[this.focusIdx].id); this.render(); } break;
      case 'Escape': e.preventDefault(); this.selNodeId = null; this.sm({ type: 'DESELECT' }); this.render(); break;
    }
  }

  private render(): void {
    this.el.innerHTML = '';
    const p = this.props; const w = this.nodeWeights;
    this.el.setAttribute('data-state', this.state); this.el.setAttribute('data-view', this.activeView);
    if (p.className) this.el.className = p.className;

    // Search
    const si = document.createElement('div'); si.setAttribute('data-part', 'search-input');
    const inp = document.createElement('input'); inp.type = 'search'; inp.placeholder = 'Search delegates...'; inp.value = this.searchQ;
    inp.setAttribute('aria-label', 'Search delegates by name'); inp.setAttribute('data-state', this.state);
    inp.addEventListener('input', () => { this.searchQ = inp.value; if (inp.value && this.state === 'browsing') this.sm({ type: 'SEARCH', query: inp.value }); else if (!inp.value && this.state === 'searching') this.sm({ type: 'CLEAR_SEARCH' }); this.render(); });
    si.appendChild(inp); this.el.appendChild(si);

    // View toggle
    const vt = document.createElement('button'); vt.type = 'button'; vt.setAttribute('data-part', 'view-toggle'); vt.setAttribute('data-mode', this.activeView);
    vt.setAttribute('aria-label', `Switch to ${this.activeView === 'list' ? 'graph' : 'list'} view`);
    vt.textContent = this.activeView === 'list' ? 'Graph' : 'List';
    vt.addEventListener('click', () => { this.activeView = this.activeView === 'list' ? 'graph' : 'list'; this.sm({ type: 'SWITCH_VIEW' }); this.render(); });
    this.el.appendChild(vt);

    // Summary
    const sm = document.createElement('div'); sm.setAttribute('data-part', 'summary'); sm.setAttribute('aria-label', 'Delegation summary');
    const tp = document.createElement('span'); tp.setAttribute('data-part', 'total-participants'); tp.textContent = `${p.nodes.length} participant${p.nodes.length !== 1 ? 's' : ''}`; sm.appendChild(tp);
    const tw = document.createElement('span'); tw.setAttribute('data-part', 'total-weight'); tw.textContent = `${fmtW(p.edges.reduce((s, e) => s + (e.weight ?? 1), 0))} weight delegated`; sm.appendChild(tw);
    this.el.appendChild(sm);

    // Current delegation
    if (p.showCurrentDelegation !== false) {
      const ci = document.createElement('div'); ci.setAttribute('data-part', 'current-info'); ci.setAttribute('data-visible', 'true'); ci.setAttribute('aria-label', 'Your current delegation');
      const curEdge = p.currentUserId ? p.edges.find(e => e.from === p.currentUserId) : null;
      const curDel = curEdge ? p.nodes.find(n => n.id === curEdge.to) : null;
      ci.textContent = curDel ? `Delegating to ${curDel.label} (weight: ${fmtW(curEdge!.weight ?? 1)})` : 'Not currently delegating';
      this.el.appendChild(ci);
    }

    // List view
    const ul = document.createElement('ul'); ul.setAttribute('role', 'tree'); ul.setAttribute('aria-label', 'Delegates');
    ul.setAttribute('data-part', 'delegate-list'); ul.setAttribute('data-visible', this.activeView === 'list' ? 'true' : 'false');
    if (this.activeView !== 'list') ul.style.display = 'none';

    const filtered = this.filtered;
    filtered.forEach((node, i) => {
      const ew = w.get(node.id) ?? 0; const isSel = this.selNodeId === node.id;
      const isDel = p.currentUserId ? p.edges.some(e => e.from === p.currentUserId && e.to === node.id) : false;
      const upCount = findUp(node.id, p.edges).length;

      const li = document.createElement('li'); li.setAttribute('role', 'treeitem');
      li.setAttribute('aria-label', `${node.label} \u2014 voting power: ${fmtW(ew)}`);
      li.setAttribute('aria-selected', String(isSel)); li.setAttribute('data-part', 'delegate-item');
      li.setAttribute('data-selected', isSel ? 'true' : 'false'); li.setAttribute('data-state', this.state);
      li.tabIndex = i === this.focusIdx ? 0 : -1;
      li.addEventListener('click', () => { this.selNodeId = node.id; this.sm({ type: 'SELECT_DELEGATE', id: node.id }); p.onSelectNode?.(node.id); this.render(); });

      const av = document.createElement('span'); av.setAttribute('data-part', 'avatar'); av.setAttribute('aria-hidden', 'true'); av.textContent = node.avatar ?? node.label.charAt(0).toUpperCase(); li.appendChild(av);
      const nm = document.createElement('span'); nm.setAttribute('data-part', 'delegate-name'); nm.textContent = node.label; li.appendChild(nm);
      const vp = document.createElement('span'); vp.setAttribute('data-part', 'voting-power'); vp.setAttribute('aria-label', `Voting power: ${fmtW(ew)}`); vp.textContent = fmtW(ew); li.appendChild(vp);
      const pt = document.createElement('span'); pt.setAttribute('data-part', 'participation'); pt.textContent = `${upCount} delegator${upCount !== 1 ? 's' : ''}`; li.appendChild(pt);

      if (p.currentUserId && node.id !== p.currentUserId) {
        const ab = document.createElement('button'); ab.type = 'button'; ab.setAttribute('data-part', 'delegate-action');
        ab.setAttribute('aria-label', isDel ? `Undelegate from ${node.label}` : `Delegate to ${node.label}`);
        ab.tabIndex = 0; ab.textContent = isDel ? 'Undelegate' : 'Delegate';
        ab.addEventListener('click', (e) => { e.stopPropagation(); if (isDel) { this.sm({ type: 'UNDELEGATE' }); p.onUndelegate?.(p.currentUserId!, node.id); setTimeout(() => { this.sm({ type: 'UNDELEGATE_COMPLETE' }); this.render(); }, 0); } else { this.sm({ type: 'DELEGATE' }); p.onDelegate?.(p.currentUserId!, node.id); setTimeout(() => { this.sm({ type: 'DELEGATE_COMPLETE' }); this.render(); }, 0); } });
        li.appendChild(ab);
      }
      ul.appendChild(li);
    });
    this.el.appendChild(ul);

    // Graph view (adjacency list)
    const gv = document.createElement('div'); gv.setAttribute('data-part', 'graph-view'); gv.setAttribute('data-visible', this.activeView === 'graph' ? 'true' : 'false');
    gv.setAttribute('aria-label', 'Delegation graph');
    if (this.activeView !== 'graph') gv.style.display = 'none';
    const gul = document.createElement('ul'); gul.setAttribute('role', 'tree'); gul.setAttribute('aria-label', 'Delegation relationships');
    filtered.forEach(node => {
      const ew = w.get(node.id) ?? 0;
      const li = document.createElement('li'); li.setAttribute('role', 'treeitem'); li.setAttribute('aria-label', `${node.label}: ${fmtW(ew)} effective weight`);
      li.setAttribute('data-node-id', node.id);
      li.addEventListener('click', () => { this.selNodeId = node.id; this.sm({ type: 'SELECT_DELEGATE', id: node.id }); p.onSelectNode?.(node.id); this.render(); });
      const nm = document.createElement('span'); nm.setAttribute('data-part', 'delegate-name'); nm.textContent = node.label; li.appendChild(nm);
      const vp = document.createElement('span'); vp.setAttribute('data-part', 'voting-power'); vp.textContent = fmtW(ew); li.appendChild(vp);
      gul.appendChild(li);
    });
    gv.appendChild(gul); this.el.appendChild(gv);

    // Detail panel
    if (this.state === 'selected' && this.selNodeId) {
      const sn = p.nodes.find(n => n.id === this.selNodeId);
      if (sn) {
        const dp = document.createElement('div'); dp.setAttribute('data-part', 'detail-panel'); dp.setAttribute('role', 'complementary'); dp.setAttribute('aria-label', `Delegation details for ${sn.label}`);
        const dh = document.createElement('div'); dh.setAttribute('data-part', 'detail-header');
        const h3 = document.createElement('h3'); h3.setAttribute('data-part', 'delegate-name'); h3.textContent = sn.label; dh.appendChild(h3);
        const cb = document.createElement('button'); cb.type = 'button'; cb.setAttribute('aria-label', 'Close detail panel'); cb.textContent = 'Close';
        cb.addEventListener('click', () => { this.selNodeId = null; this.sm({ type: 'DESELECT' }); this.render(); }); dh.appendChild(cb);
        dp.appendChild(dh);

        const dl = document.createElement('dl'); dl.setAttribute('data-part', 'detail-stats');
        const addStat = (dt: string, dd: string) => { const dtel = document.createElement('dt'); dtel.textContent = dt; dl.appendChild(dtel); const ddel = document.createElement('dd'); ddel.textContent = dd; dl.appendChild(ddel); };
        addStat('Effective voting power', fmtW(w.get(sn.id) ?? 0));
        addStat('Base weight', fmtW(sn.weight ?? 1));
        const ups = findUp(sn.id, p.edges);
        addStat('Upstream delegators', String(ups.length));
        dp.appendChild(dl); this.el.appendChild(dp);
      }
    }

    // Confirmation dialog
    if (this.state === 'delegating' || this.state === 'undelegating') {
      const cd = document.createElement('div'); cd.setAttribute('data-part', 'confirmation'); cd.setAttribute('role', 'alertdialog');
      cd.setAttribute('aria-label', this.state === 'delegating' ? 'Confirm delegation' : 'Confirm undelegation');
      const pm = document.createElement('p'); pm.textContent = this.state === 'delegating' ? 'Delegating...' : 'Removing delegation...'; cd.appendChild(pm);
      this.el.appendChild(cd);
    }
  }
}

export default DelegationGraph;
