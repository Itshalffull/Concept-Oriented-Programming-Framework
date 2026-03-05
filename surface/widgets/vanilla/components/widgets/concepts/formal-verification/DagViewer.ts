/* ---------------------------------------------------------------------------
 * DagViewer — Vanilla widget
 * States: idle (initial), nodeSelected, computing
 * ------------------------------------------------------------------------- */

export type DagViewerState = 'idle' | 'nodeSelected' | 'computing';
export type DagViewerEvent =
  | { type: 'SELECT_NODE'; id?: string }
  | { type: 'ZOOM' }
  | { type: 'PAN' }
  | { type: 'LAYOUT' }
  | { type: 'DESELECT' }
  | { type: 'LAYOUT_COMPLETE' };

export function dagViewerReducer(state: DagViewerState, event: DagViewerEvent): DagViewerState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_NODE') return 'nodeSelected';
      if (event.type === 'ZOOM') return 'idle';
      if (event.type === 'PAN') return 'idle';
      if (event.type === 'LAYOUT') return 'computing';
      return state;
    case 'nodeSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_NODE') return 'nodeSelected';
      return state;
    case 'computing':
      if (event.type === 'LAYOUT_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface DagNode { id: string; label: string; type?: string; status?: string; }
export interface DagEdge { from: string; to: string; label?: string; }

function computeLevels(nodes: DagNode[], edges: DagEdge[]): Map<string, number> {
  const inDeg = new Map<string, number>(); const children = new Map<string, string[]>();
  for (const n of nodes) { inDeg.set(n.id, 0); children.set(n.id, []); }
  for (const e of edges) { inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1); children.get(e.from)?.push(e.to); }
  const levels = new Map<string, number>(); const queue: string[] = [];
  for (const [id, deg] of inDeg) { if (deg === 0) { queue.push(id); levels.set(id, 0); } }
  while (queue.length > 0) {
    const cur = queue.shift()!; const curLvl = levels.get(cur)!;
    for (const child of children.get(cur) ?? []) {
      const existing = levels.get(child); const next = curLvl + 1;
      if (existing === undefined || next > existing) levels.set(child, next);
      const nd = (inDeg.get(child) ?? 1) - 1; inDeg.set(child, nd);
      if (nd === 0) queue.push(child);
    }
  }
  for (const n of nodes) { if (!levels.has(n.id)) levels.set(n.id, 0); }
  return levels;
}

function groupByLevel(nodes: DagNode[], levels: Map<string, number>): DagNode[][] {
  const max = Math.max(0, ...levels.values()); const g: DagNode[][] = Array.from({ length: max + 1 }, () => []);
  for (const n of nodes) g[levels.get(n.id) ?? 0].push(n); return g;
}

function getUpstream(nodeId: string, edges: DagEdge[]): Set<string> { const s = new Set<string>(); for (const e of edges) if (e.to === nodeId) s.add(e.from); return s; }
function getDownstream(nodeId: string, edges: DagEdge[]): Set<string> { const s = new Set<string>(); for (const e of edges) if (e.from === nodeId) s.add(e.to); return s; }
function getConnectedEdges(nodeId: string, edges: DagEdge[]): DagEdge[] { return edges.filter(e => e.from === nodeId || e.to === nodeId); }

export interface DagViewerProps {
  nodes: DagNode[]; edges: DagEdge[]; layout?: 'dagre' | 'elk' | 'layered';
  zoom?: number; panX?: number; panY?: number;
  selectedNodeId?: string; onSelectNode?: (id: string | undefined) => void;
  className?: string; [key: string]: unknown;
}
export interface DagViewerOptions { target: HTMLElement; props: DagViewerProps; }
let _uid = 0;

export class DagViewer {
  private el: HTMLElement;
  private props: DagViewerProps;
  private state: DagViewerState = 'idle';
  private uid = ++_uid;
  private disposers: (() => void)[] = [];
  private intSelectedId: string | undefined;
  private focusedIdx = 0;

  constructor(private options: DagViewerOptions) {
    this.props = { ...options.props };
    this.intSelectedId = this.props.selectedNodeId;
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', ''); this.el.setAttribute('data-widget-name', 'dag-viewer');
    this.el.setAttribute('data-part', 'root'); this.el.setAttribute('role', 'application');
    this.el.setAttribute('aria-label', 'Dependency graph'); this.el.setAttribute('tabindex', '0');
    this.el.id = 'dag-viewer-' + this.uid;
    const kd = (e: KeyboardEvent) => this.onKey(e);
    this.el.addEventListener('keydown', kd); this.disposers.push(() => this.el.removeEventListener('keydown', kd));
    this.render(); options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  private sm(ev: DagViewerEvent): void { this.state = dagViewerReducer(this.state, ev); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<DagViewerProps>): void { Object.assign(this.props, props); if (props.selectedNodeId !== undefined) this.intSelectedId = props.selectedNodeId; this.render(); }
  destroy(): void { this.disposers.forEach(d => d()); this.el.remove(); }

  private get selectedId(): string | undefined { return this.props.selectedNodeId !== undefined ? this.props.selectedNodeId : this.intSelectedId; }
  private get nodeMap(): Map<string, DagNode> { const m = new Map<string, DagNode>(); for (const n of this.props.nodes) m.set(n.id, n); return m; }

  private selectNode(id: string | undefined): void {
    this.intSelectedId = id; this.props.onSelectNode?.(id);
    if (id !== undefined) this.sm({ type: 'SELECT_NODE', id }); else this.sm({ type: 'DESELECT' });
    this.render();
  }

  private onKey(e: KeyboardEvent): void {
    const levels = computeLevels(this.props.nodes, this.props.edges);
    const flat = groupByLevel(this.props.nodes, levels).flat();
    if (!flat.length) return;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); this.focusedIdx = Math.min(this.focusedIdx + 1, flat.length - 1); this.render(); break;
      case 'ArrowUp': e.preventDefault(); this.focusedIdx = Math.max(this.focusedIdx - 1, 0); this.render(); break;
      case 'Home': e.preventDefault(); this.focusedIdx = 0; this.render(); break;
      case 'End': e.preventDefault(); this.focusedIdx = flat.length - 1; this.render(); break;
      case 'Enter': e.preventDefault(); { const node = flat[this.focusedIdx]; if (node) this.selectNode(node.id === this.selectedId ? undefined : node.id); } break;
      case 'Escape': e.preventDefault(); this.selectNode(undefined); break;
    }
  }

  private render(): void {
    this.el.innerHTML = '';
    const p = this.props; const layout = p.layout ?? 'dagre';
    const zoom = p.zoom ?? 1.0; const panX = p.panX ?? 0; const panY = p.panY ?? 0;
    const nm = this.nodeMap; const selId = this.selectedId;
    const levels = computeLevels(p.nodes, p.edges);
    const levelGroups = groupByLevel(p.nodes, levels);
    const flat = levelGroups.flat();

    const upstream = selId ? getUpstream(selId, p.edges) : new Set<string>();
    const downstream = selId ? getDownstream(selId, p.edges) : new Set<string>();
    const connEdges = selId ? getConnectedEdges(selId, p.edges) : [];
    const isHighlighted = (id: string) => id === selId || upstream.has(id) || downstream.has(id);

    this.el.setAttribute('data-state', this.state); this.el.setAttribute('data-layout', layout);
    if (p.className) this.el.className = p.className;

    // Canvas
    const canvas = document.createElement('div'); canvas.setAttribute('data-part', 'canvas'); canvas.setAttribute('data-state', this.state);
    canvas.setAttribute('data-zoom', String(zoom)); canvas.setAttribute('data-pan-x', String(panX)); canvas.setAttribute('data-pan-y', String(panY));
    canvas.setAttribute('role', 'list'); canvas.setAttribute('aria-label', `DAG with ${p.nodes.length} nodes`);

    levelGroups.forEach((group, lvlIdx) => {
      const lvl = document.createElement('div'); lvl.setAttribute('data-part', 'level'); lvl.setAttribute('data-level', String(lvlIdx));
      lvl.setAttribute('role', 'group'); lvl.setAttribute('aria-label', `Level ${lvlIdx}`);

      group.forEach(node => {
        const gIdx = flat.indexOf(node);
        const isFoc = gIdx === this.focusedIdx;
        const isSel = node.id === selId;
        const hl = isHighlighted(node.id);

        const nd = document.createElement('div'); nd.setAttribute('data-part', 'node'); nd.setAttribute('data-state', this.state);
        nd.setAttribute('data-status', node.status ?? 'unknown');
        nd.setAttribute('data-selected', isSel ? 'true' : 'false');
        nd.setAttribute('data-highlighted', hl ? 'true' : 'false');
        nd.setAttribute('role', 'button'); nd.setAttribute('aria-label', `${node.label} \u2014 ${node.status ?? 'unknown'}`);
        nd.setAttribute('aria-pressed', String(isSel)); nd.tabIndex = isFoc ? 0 : -1;
        nd.addEventListener('click', () => this.selectNode(isSel ? undefined : node.id));
        if (isFoc) requestAnimationFrame(() => nd.focus());

        const nl = document.createElement('span'); nl.setAttribute('data-part', 'node-label'); nl.setAttribute('data-state', this.state);
        nl.textContent = node.label; nd.appendChild(nl);

        if (node.type) {
          const tb = document.createElement('span'); tb.setAttribute('data-part', 'node-badge'); tb.setAttribute('data-state', this.state);
          tb.setAttribute('data-type', node.type); tb.textContent = node.type; nd.appendChild(tb);
        }

        const sb = document.createElement('span'); sb.setAttribute('data-part', 'node-badge'); sb.setAttribute('data-state', this.state);
        sb.setAttribute('data-status', node.status ?? 'unknown'); sb.setAttribute('aria-label', `Status: ${node.status ?? 'unknown'}`);
        sb.textContent = node.status ?? 'unknown'; nd.appendChild(sb);

        lvl.appendChild(nd);
      });
      canvas.appendChild(lvl);
    });
    this.el.appendChild(canvas);

    // Edges
    const edgesDiv = document.createElement('div'); edgesDiv.setAttribute('data-part', 'edges'); edgesDiv.setAttribute('data-state', this.state);
    edgesDiv.setAttribute('role', 'list'); edgesDiv.setAttribute('aria-label', 'Graph edges');
    p.edges.forEach((edge, idx) => {
      const fromLabel = nm.get(edge.from)?.label ?? edge.from;
      const toLabel = nm.get(edge.to)?.label ?? edge.to;
      const hl = selId !== undefined && (edge.from === selId || edge.to === selId);
      const ed = document.createElement('div'); ed.setAttribute('data-part', 'edge'); ed.setAttribute('data-state', this.state);
      ed.setAttribute('data-from', edge.from); ed.setAttribute('data-to', edge.to);
      ed.setAttribute('data-highlighted', hl ? 'true' : 'false'); ed.setAttribute('role', 'listitem');
      const sp = document.createElement('span'); sp.textContent = `${fromLabel} \u2192 ${toLabel}`; ed.appendChild(sp);
      if (edge.label) { const el2 = document.createElement('span'); el2.setAttribute('data-part', 'edge-label'); el2.setAttribute('data-state', this.state); el2.textContent = edge.label; ed.appendChild(el2); }
      edgesDiv.appendChild(ed);
    });
    this.el.appendChild(edgesDiv);

    // Controls
    const ct = document.createElement('div'); ct.setAttribute('data-part', 'controls'); ct.setAttribute('data-state', this.state);
    ct.setAttribute('role', 'toolbar'); ct.setAttribute('aria-label', 'Graph controls');
    this.el.appendChild(ct);

    // Detail panel
    const dp = document.createElement('div'); dp.setAttribute('data-part', 'detail-panel'); dp.setAttribute('data-state', this.state);
    dp.setAttribute('data-visible', selId !== undefined ? 'true' : 'false');
    dp.setAttribute('role', 'complementary'); dp.setAttribute('aria-label', 'Node details');

    if (selId !== undefined) {
      const selected = nm.get(selId);
      if (selected) {
        const h3 = document.createElement('h3'); h3.setAttribute('data-part', 'detail-title'); h3.textContent = selected.label; dp.appendChild(h3);
        if (selected.type) { const dt = document.createElement('div'); dt.setAttribute('data-part', 'detail-type'); dt.innerHTML = `<strong>Type:</strong> ${selected.type}`; dp.appendChild(dt); }
        const ds = document.createElement('div'); ds.setAttribute('data-part', 'detail-status'); ds.innerHTML = `<strong>Status:</strong> ${selected.status ?? 'unknown'}`; dp.appendChild(ds);

        // Upstream
        const du = document.createElement('div'); du.setAttribute('data-part', 'detail-upstream'); du.setAttribute('aria-label', 'Upstream dependencies');
        du.innerHTML = `<strong>Upstream (${upstream.size}):</strong>`;
        if (upstream.size > 0) { const ul = document.createElement('ul'); [...upstream].forEach(id => { const li = document.createElement('li'); li.textContent = nm.get(id)?.label ?? id; ul.appendChild(li); }); du.appendChild(ul); }
        else { const sp = document.createElement('span'); sp.textContent = ' None'; du.appendChild(sp); }
        dp.appendChild(du);

        // Downstream
        const dd = document.createElement('div'); dd.setAttribute('data-part', 'detail-downstream'); dd.setAttribute('aria-label', 'Downstream dependents');
        dd.innerHTML = `<strong>Downstream (${downstream.size}):</strong>`;
        if (downstream.size > 0) { const ul = document.createElement('ul'); [...downstream].forEach(id => { const li = document.createElement('li'); li.textContent = nm.get(id)?.label ?? id; ul.appendChild(li); }); dd.appendChild(ul); }
        else { const sp = document.createElement('span'); sp.textContent = ' None'; dd.appendChild(sp); }
        dp.appendChild(dd);

        // Connected edges
        const de = document.createElement('div'); de.setAttribute('data-part', 'detail-edges'); de.setAttribute('aria-label', 'Connected edges');
        de.innerHTML = `<strong>Connected edges (${connEdges.length}):</strong>`;
        if (connEdges.length > 0) { const ul = document.createElement('ul'); connEdges.forEach(ce => { const li = document.createElement('li'); const fl2 = nm.get(ce.from)?.label ?? ce.from; const tl = nm.get(ce.to)?.label ?? ce.to; li.textContent = `${fl2} \u2192 ${tl}${ce.label ? ` (${ce.label})` : ''}`; ul.appendChild(li); }); de.appendChild(ul); }
        else { const sp = document.createElement('span'); sp.textContent = ' None'; de.appendChild(sp); }
        dp.appendChild(de);
      }
    }
    this.el.appendChild(dp);
  }
}

export default DagViewer;
