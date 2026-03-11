/* ---------------------------------------------------------------------------
 * CircleOrgChart — Vanilla widget
 * States: idle (initial), circleSelected
 * ------------------------------------------------------------------------- */

export type CircleOrgChartState = 'idle' | 'circleSelected';
export type CircleOrgChartEvent = | { type: 'SELECT_CIRCLE'; id: string } | { type: 'DESELECT' } | { type: 'EXPAND'; id: string } | { type: 'COLLAPSE'; id: string };

export function circleOrgChartReducer(state: CircleOrgChartState, event: CircleOrgChartEvent): CircleOrgChartState {
  switch (state) { case 'idle': if (event.type === 'SELECT_CIRCLE') return 'circleSelected'; return state; case 'circleSelected': if (event.type === 'DESELECT') return 'idle'; if (event.type === 'SELECT_CIRCLE') return 'circleSelected'; return state; default: return state; }
}

export interface CircleMember { name: string; role: string; }
export interface Circle { id: string; name: string; purpose: string; parentId?: string; members: CircleMember[]; jurisdiction?: string; policies?: string[]; }

interface TreeNode { circle: Circle; children: TreeNode[]; }

function buildTree(circles: Circle[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(); for (const c of circles) byId.set(c.id, { circle: c, children: [] });
  const roots: TreeNode[] = [];
  for (const c of circles) { const n = byId.get(c.id)!; if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId)!.children.push(n); else roots.push(n); }
  return roots;
}

function flatVis(roots: TreeNode[], exp: Set<string>): Circle[] {
  const r: Circle[] = []; function w(ns: TreeNode[]) { for (const n of ns) { r.push(n.circle); if (n.children.length && exp.has(n.circle.id)) w(n.children); } } w(roots); return r;
}

function findCircle(cs: Circle[], id: string) { return cs.find(c => c.id === id); }
function findNode(ns: TreeNode[], id: string): TreeNode | undefined { for (const n of ns) { if (n.circle.id === id) return n; if (n.children.length) { const f = findNode(n.children, id); if (f) return f; } } return undefined; }

export interface CircleOrgChartProps {
  circles: Circle[]; selectedCircleId?: string; onSelectCircle?: (id: string | undefined) => void;
  layout?: 'tree' | 'nested' | 'radial'; showPolicies?: boolean; showJurisdiction?: boolean;
  maxAvatars?: number; expandedIds?: string[]; className?: string; [key: string]: unknown;
}
export interface CircleOrgChartOptions { target: HTMLElement; props: CircleOrgChartProps; }
let _uid = 0;

export class CircleOrgChart {
  private el: HTMLElement;
  private props: CircleOrgChartProps;
  private uid = ++_uid;
  private disposers: (() => void)[] = [];
  private intSelId: string | undefined;
  private intExpanded = new Set<string>();
  private focusedId: string | undefined;
  private nodeRefs = new Map<string, HTMLDivElement>();

  constructor(private options: CircleOrgChartOptions) {
    this.props = { ...options.props };
    this.intSelId = this.props.selectedCircleId;
    if (this.props.expandedIds) this.intExpanded = new Set(this.props.expandedIds);
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', ''); this.el.setAttribute('data-widget-name', 'circle-org-chart');
    this.el.setAttribute('data-part', 'root'); this.el.setAttribute('role', 'tree');
    this.el.setAttribute('aria-label', 'Governance circles');
    this.el.id = 'circle-org-chart-' + this.uid;
    const kd = (e: KeyboardEvent) => this.onKey(e);
    this.el.addEventListener('keydown', kd); this.disposers.push(() => this.el.removeEventListener('keydown', kd));
    this.render(); options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  update(props: Partial<CircleOrgChartProps>): void { Object.assign(this.props, props); if (props.selectedCircleId !== undefined) this.intSelId = props.selectedCircleId; if (props.expandedIds) this.intExpanded = new Set(props.expandedIds); this.render(); }
  destroy(): void { this.disposers.forEach(d => d()); this.el.remove(); }

  private get selId() { return this.props.selectedCircleId !== undefined ? this.props.selectedCircleId : this.intSelId; }
  private get expSet() { return this.props.expandedIds ? new Set(this.props.expandedIds) : this.intExpanded; }
  private get displayState(): CircleOrgChartState { return this.selId ? 'circleSelected' : 'idle'; }

  private select(id: string): void { const next = id === this.selId ? undefined : id; this.intSelId = next; this.props.onSelectCircle?.(next); this.render(); }
  private toggleExp(id: string): void { if (this.intExpanded.has(id)) this.intExpanded.delete(id); else this.intExpanded.add(id); this.render(); }
  private focusN(id: string): void { this.focusedId = id; this.nodeRefs.get(id)?.focus(); }

  private onKey(e: KeyboardEvent): void {
    const tree = buildTree(this.props.circles);
    const flat = flatVis(tree, this.expSet);
    const idx = flat.findIndex(c => c.id === this.focusedId);
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); { const n = Math.min(idx + 1, flat.length - 1); if (flat[n]) this.focusN(flat[n].id); } break;
      case 'ArrowUp': e.preventDefault(); { const p = Math.max(idx - 1, 0); if (flat[p]) this.focusN(flat[p].id); } break;
      case 'ArrowRight': e.preventDefault(); if (this.focusedId) { const n = findNode(tree, this.focusedId); if (n && n.children.length) { if (!this.expSet.has(this.focusedId)) this.toggleExp(this.focusedId); else this.focusN(n.children[0].circle.id); } } break;
      case 'ArrowLeft': e.preventDefault(); if (this.focusedId) { if (this.expSet.has(this.focusedId)) this.toggleExp(this.focusedId); else { const c = findCircle(this.props.circles, this.focusedId); if (c?.parentId) this.focusN(c.parentId); } } break;
      case 'Enter': e.preventDefault(); if (this.focusedId) this.select(this.focusedId); break;
      case 'Escape': e.preventDefault(); this.intSelId = undefined; this.props.onSelectCircle?.(undefined); this.render(); break;
    }
  }

  private render(): void {
    this.el.innerHTML = ''; this.nodeRefs.clear();
    const p = this.props; const layout = p.layout ?? 'tree'; const showPol = p.showPolicies !== false;
    const showJur = p.showJurisdiction !== false; const maxAv = p.maxAvatars ?? 5;
    const tree = buildTree(p.circles);

    this.el.setAttribute('data-state', this.displayState); this.el.setAttribute('data-layout', layout);
    if (p.className) this.el.className = p.className;

    const renderNode = (node: TreeNode, depth: number): HTMLDivElement => {
      const c = node.circle; const hasC = node.children.length > 0; const isExp = this.expSet.has(c.id);
      const isSel = this.selId === c.id; const isFoc = this.focusedId === c.id;
      const vis = c.members.slice(0, maxAv); const overflow = Math.max(0, c.members.length - maxAv);

      const d = document.createElement('div'); d.setAttribute('role', 'treeitem');
      if (hasC) d.setAttribute('aria-expanded', String(isExp));
      d.setAttribute('aria-selected', String(isSel)); d.setAttribute('aria-label', `${c.name}: ${c.purpose}`);
      d.setAttribute('aria-level', String(depth + 1)); d.setAttribute('data-part', 'circle-node');
      d.setAttribute('data-selected', isSel ? 'true' : 'false'); d.setAttribute('data-id', c.id);
      d.tabIndex = isFoc ? 0 : -1; d.style.paddingLeft = `${depth * 24}px`;
      d.addEventListener('click', (e) => { e.stopPropagation(); this.select(c.id); });
      d.addEventListener('focus', () => { this.focusedId = c.id; });
      this.nodeRefs.set(c.id, d);

      if (hasC) { const t = document.createElement('span'); t.setAttribute('data-part', 'expand-toggle'); t.setAttribute('aria-hidden', 'true'); t.textContent = isExp ? '\u25BC' : '\u25B6'; t.addEventListener('click', (e) => { e.stopPropagation(); this.toggleExp(c.id); }); d.appendChild(t); }

      const lb = document.createElement('span'); lb.setAttribute('data-part', 'circle-label'); lb.textContent = c.name; d.appendChild(lb);
      const pu = document.createElement('span'); pu.setAttribute('data-part', 'circle-purpose'); pu.setAttribute('aria-hidden', 'true'); pu.textContent = c.purpose; d.appendChild(pu);
      const mc = document.createElement('span'); mc.setAttribute('data-part', 'member-count'); mc.textContent = `${c.members.length} member${c.members.length !== 1 ? 's' : ''}`; d.appendChild(mc);

      const ma = document.createElement('div'); ma.setAttribute('data-part', 'member-avatars');
      vis.forEach(m => { const s = document.createElement('span'); s.setAttribute('data-part', 'member-avatar'); s.setAttribute('aria-label', `${m.name}, ${m.role}`); s.title = `${m.name} (${m.role})`; s.textContent = m.name.charAt(0).toUpperCase(); ma.appendChild(s); });
      if (overflow > 0) { const o = document.createElement('span'); o.setAttribute('data-part', 'member-overflow'); o.setAttribute('aria-label', `${overflow} more members`); o.textContent = `+${overflow}`; ma.appendChild(o); }
      d.appendChild(ma);

      if (showPol && c.policies?.length) { const pd = document.createElement('div'); pd.setAttribute('data-part', 'policies'); pd.setAttribute('data-visible', 'true'); c.policies.forEach(p => { const s = document.createElement('span'); s.setAttribute('data-part', 'policy-badge'); s.textContent = p; pd.appendChild(s); }); d.appendChild(pd); }
      if (showJur && c.jurisdiction) { const j = document.createElement('span'); j.setAttribute('data-part', 'jurisdiction'); j.setAttribute('data-visible', 'true'); j.textContent = c.jurisdiction; d.appendChild(j); }

      if (hasC && isExp) { const ch = document.createElement('div'); ch.setAttribute('data-part', 'children'); ch.setAttribute('role', 'group'); ch.setAttribute('data-visible', 'true'); node.children.forEach(cn => ch.appendChild(renderNode(cn, depth + 1))); d.appendChild(ch); }
      return d;
    };
    tree.forEach(n => this.el.appendChild(renderNode(n, 0)));

    // Detail panel
    const selC = this.selId ? findCircle(p.circles, this.selId) : undefined;
    const dp = document.createElement('div'); dp.setAttribute('data-part', 'detail-panel'); dp.setAttribute('role', 'complementary');
    dp.setAttribute('aria-label', 'Circle details'); dp.setAttribute('data-visible', this.displayState === 'circleSelected' ? 'true' : 'false');
    if (selC) {
      const dh = document.createElement('div'); dh.setAttribute('data-part', 'detail-header');
      const dt = document.createElement('span'); dt.setAttribute('data-part', 'detail-title'); dt.textContent = selC.name; dh.appendChild(dt);
      const cb = document.createElement('button'); cb.type = 'button'; cb.setAttribute('data-part', 'detail-close'); cb.setAttribute('aria-label', 'Close detail panel'); cb.tabIndex = 0; cb.textContent = '\u2715';
      cb.addEventListener('click', () => { this.intSelId = undefined; this.props.onSelectCircle?.(undefined); this.render(); }); dh.appendChild(cb);
      dp.appendChild(dh);

      const db = document.createElement('div'); db.setAttribute('data-part', 'detail-body');
      const addField = (label: string, value: string) => { const f = document.createElement('div'); f.setAttribute('data-part', 'detail-field'); const l = document.createElement('span'); l.setAttribute('data-part', 'detail-label'); l.textContent = label; f.appendChild(l); const v = document.createElement('span'); v.setAttribute('data-part', 'detail-value'); v.textContent = value; f.appendChild(v); db.appendChild(f); };
      addField('Purpose', selC.purpose);
      if (selC.jurisdiction) addField('Jurisdiction', selC.jurisdiction);
      if (selC.policies?.length) addField('Policies', selC.policies.join(', '));
      addField('Members', `${selC.members.length} member${selC.members.length !== 1 ? 's' : ''}`);

      const dm = document.createElement('div'); dm.setAttribute('data-part', 'detail-members');
      selC.members.forEach(m => { const md = document.createElement('div'); md.setAttribute('data-part', 'detail-member'); const mn = document.createElement('span'); mn.setAttribute('data-part', 'detail-member-name'); mn.textContent = m.name; md.appendChild(mn); const mr = document.createElement('span'); mr.setAttribute('data-part', 'detail-member-role'); mr.textContent = m.role; md.appendChild(mr); dm.appendChild(md); });
      db.appendChild(dm); dp.appendChild(db);
    }
    this.el.appendChild(dp);
  }
}

export default CircleOrgChart;
