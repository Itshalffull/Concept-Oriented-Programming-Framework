/* ---------------------------------------------------------------------------
 * ProofSessionTree — Vanilla widget
 * States: idle (initial), selected
 * ------------------------------------------------------------------------- */

export type ProofSessionTreeState = 'idle' | 'selected' | 'ready' | 'fetching';
export type ProofSessionTreeEvent =
  | { type: 'SELECT' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'DESELECT' }
  | { type: 'LOAD_CHILDREN' }
  | { type: 'LOAD_COMPLETE' }
  | { type: 'LOAD_ERROR' };

export function proofSessionTreeReducer(state: ProofSessionTreeState, event: ProofSessionTreeEvent): ProofSessionTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT') return 'selected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'ready':
      if (event.type === 'LOAD_CHILDREN') return 'fetching';
      return state;
    case 'fetching':
      if (event.type === 'LOAD_COMPLETE') return 'ready';
      if (event.type === 'LOAD_ERROR') return 'ready';
      return state;
    default:
      return state;
  }
}

export interface ProofGoal {
  id: string; label: string; status: 'open' | 'proved' | 'failed' | 'skipped';
  tactic?: string; children?: ProofGoal[]; progress?: number;
}

const STATUS_ICONS: Record<ProofGoal['status'], string> = { proved: '\u2713', failed: '\u2717', open: '\u25CB', skipped: '\u2298' };
const STATUS_LABELS: Record<ProofGoal['status'], string> = { proved: 'Proved', failed: 'Failed', open: 'Open', skipped: 'Skipped' };

function flattenVisible(goals: ProofGoal[], expSet: Set<string>): ProofGoal[] {
  const r: ProofGoal[] = [];
  function walk(nodes: ProofGoal[]) { for (const g of nodes) { r.push(g); if (g.children?.length && expSet.has(g.id)) walk(g.children); } }
  walk(goals); return r;
}

function findGoal(goals: ProofGoal[], id: string): ProofGoal | undefined {
  for (const g of goals) { if (g.id === id) return g; if (g.children?.length) { const f = findGoal(g.children, id); if (f) return f; } }
  return undefined;
}

function countGoals(goals: ProofGoal[]): { total: number; proved: number } {
  let total = 0; let proved = 0;
  function walk(nodes: ProofGoal[]) { for (const g of nodes) { total++; if (g.status === 'proved') proved++; if (g.children?.length) walk(g.children); } }
  walk(goals); return { total, proved };
}

export interface ProofSessionTreeProps {
  goals: ProofGoal[]; selectedId?: string; expandedIds?: string[];
  onSelectGoal?: (id: string | undefined) => void;
  className?: string; [key: string]: unknown;
}
export interface ProofSessionTreeOptions { target: HTMLElement; props: ProofSessionTreeProps; }
let _uid = 0;

export class ProofSessionTree {
  private el: HTMLElement;
  private props: ProofSessionTreeProps;
  private uid = ++_uid;
  private disposers: (() => void)[] = [];
  private intSelectedId: string | undefined;
  private intExpanded: Set<string>;
  private focusedId: string | undefined;
  private nodeRefs = new Map<string, HTMLDivElement>();

  constructor(private options: ProofSessionTreeOptions) {
    this.props = { ...options.props };
    this.intSelectedId = this.props.selectedId;
    this.intExpanded = new Set(this.props.expandedIds ?? []);
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', ''); this.el.setAttribute('data-widget-name', 'proof-session-tree');
    this.el.setAttribute('data-part', 'root'); this.el.setAttribute('role', 'tree');
    this.el.setAttribute('aria-label', 'Proof session tree');
    this.el.id = 'proof-session-tree-' + this.uid;
    const kd = (e: KeyboardEvent) => this.onKey(e);
    this.el.addEventListener('keydown', kd); this.disposers.push(() => this.el.removeEventListener('keydown', kd));
    this.render(); options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  update(props: Partial<ProofSessionTreeProps>): void {
    Object.assign(this.props, props);
    if (props.selectedId !== undefined) this.intSelectedId = props.selectedId;
    if (props.expandedIds) this.intExpanded = new Set(props.expandedIds);
    this.render();
  }
  destroy(): void { this.disposers.forEach(d => d()); this.el.remove(); }

  private get selectedId(): string | undefined { return this.props.selectedId !== undefined ? this.props.selectedId : this.intSelectedId; }
  private get expSet(): Set<string> { return this.props.expandedIds ? new Set(this.props.expandedIds) : this.intExpanded; }
  private get displayState(): ProofSessionTreeState { return this.selectedId ? 'selected' : 'idle'; }

  private handleSelect(id: string): void {
    const next = id === this.selectedId ? undefined : id;
    this.intSelectedId = next; this.props.onSelectGoal?.(next); this.render();
  }

  private toggleExpand(id: string): void {
    if (this.intExpanded.has(id)) this.intExpanded.delete(id); else this.intExpanded.add(id); this.render();
  }

  private focusNode(id: string): void { this.focusedId = id; this.render(); requestAnimationFrame(() => this.nodeRefs.get(id)?.focus()); }

  private onKey(e: KeyboardEvent): void {
    const flat = flattenVisible(this.props.goals, this.expSet);
    const idx = flat.findIndex(g => g.id === this.focusedId);
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); { const n = Math.min(idx + 1, flat.length - 1); if (flat[n]) this.focusNode(flat[n].id); } break;
      case 'ArrowUp': e.preventDefault(); { const p = Math.max(idx - 1, 0); if (flat[p]) this.focusNode(flat[p].id); } break;
      case 'ArrowRight': e.preventDefault(); if (this.focusedId) { const g = findGoal(this.props.goals, this.focusedId); if (g?.children?.length) { if (!this.expSet.has(this.focusedId)) this.toggleExpand(this.focusedId); else this.focusNode(g.children[0].id); } } break;
      case 'ArrowLeft': e.preventDefault(); if (this.focusedId && this.expSet.has(this.focusedId)) this.toggleExpand(this.focusedId); break;
      case 'Enter': e.preventDefault(); if (this.focusedId) this.handleSelect(this.focusedId); break;
      case 'Home': e.preventDefault(); if (flat.length) this.focusNode(flat[0].id); break;
      case 'End': e.preventDefault(); if (flat.length) this.focusNode(flat[flat.length - 1].id); break;
      case 'Escape': e.preventDefault(); this.intSelectedId = undefined; this.props.onSelectGoal?.(undefined); this.render(); break;
    }
  }

  private render(): void {
    this.el.innerHTML = ''; this.nodeRefs.clear();
    const p = this.props; const { total, proved } = countGoals(p.goals);
    this.el.setAttribute('data-state', this.displayState); this.el.setAttribute('data-count', String(p.goals.length));
    if (p.className) this.el.className = p.className;

    // Summary
    const sm = document.createElement('div'); sm.setAttribute('data-part', 'summary'); sm.setAttribute('aria-live', 'polite');
    sm.textContent = `${proved} of ${total} goals proved`; this.el.appendChild(sm);

    // Tree items
    const renderGoal = (goal: ProofGoal, depth: number): HTMLDivElement => {
      const hasC = !!(goal.children?.length); const isExp = this.expSet.has(goal.id);
      const isSel = this.selectedId === goal.id; const isFoc = this.focusedId === goal.id;

      const d = document.createElement('div'); d.setAttribute('role', 'treeitem');
      if (hasC) d.setAttribute('aria-expanded', String(isExp));
      d.setAttribute('aria-selected', String(isSel)); d.setAttribute('aria-level', String(depth + 1));
      d.setAttribute('aria-label', `${goal.label} - ${STATUS_LABELS[goal.status]}`);
      d.setAttribute('data-part', 'tree-item'); d.setAttribute('data-status', goal.status);
      d.setAttribute('data-selected', isSel ? 'true' : 'false'); d.setAttribute('data-id', goal.id);
      d.tabIndex = isFoc ? 0 : -1; d.style.paddingLeft = `${depth * 20}px`;
      d.addEventListener('click', (e) => { e.stopPropagation(); this.handleSelect(goal.id); });
      d.addEventListener('focus', () => { this.focusedId = goal.id; });
      this.nodeRefs.set(goal.id, d);

      // Expand trigger
      const et = document.createElement('button'); et.type = 'button'; et.setAttribute('data-part', 'expand-trigger');
      et.setAttribute('data-expanded', isExp ? 'true' : 'false'); et.setAttribute('data-visible', hasC ? 'true' : 'false');
      et.setAttribute('aria-label', isExp ? 'Collapse' : 'Expand'); et.tabIndex = -1;
      et.style.visibility = hasC ? 'visible' : 'hidden'; et.textContent = isExp ? '\u25BC' : '\u25B6';
      et.addEventListener('click', (e) => { e.stopPropagation(); if (hasC) this.toggleExpand(goal.id); });
      d.appendChild(et);

      // Status badge
      const sb = document.createElement('span'); sb.setAttribute('data-part', 'status-badge'); sb.setAttribute('data-status', goal.status);
      sb.setAttribute('aria-hidden', 'true'); sb.textContent = STATUS_ICONS[goal.status]; d.appendChild(sb);

      // Label
      const lb = document.createElement('span'); lb.setAttribute('data-part', 'item-label'); lb.textContent = goal.label; d.appendChild(lb);

      // Progress bar
      if (goal.progress != null) {
        const pb = document.createElement('span'); pb.setAttribute('data-part', 'progress-bar'); pb.setAttribute('data-visible', 'true');
        pb.setAttribute('data-value', String(goal.progress)); pb.setAttribute('role', 'progressbar');
        pb.setAttribute('aria-valuenow', String(goal.progress)); pb.setAttribute('aria-valuemin', '0'); pb.setAttribute('aria-valuemax', '1');
        pb.setAttribute('aria-label', `${Math.round(goal.progress * 100)}% complete`);
        pb.textContent = `${Math.round(goal.progress * 100)}%`; d.appendChild(pb);
      }

      // Children
      if (hasC && isExp) {
        const ch = document.createElement('div'); ch.setAttribute('data-part', 'children'); ch.setAttribute('role', 'group'); ch.setAttribute('data-visible', 'true');
        goal.children!.forEach(c => ch.appendChild(renderGoal(c, depth + 1)));
        d.appendChild(ch);
      }
      return d;
    };
    p.goals.forEach(g => this.el.appendChild(renderGoal(g, 0)));

    // Detail panel
    const selGoal = this.selectedId ? findGoal(p.goals, this.selectedId) : undefined;
    const dp = document.createElement('div'); dp.setAttribute('data-part', 'detail-panel'); dp.setAttribute('role', 'complementary');
    dp.setAttribute('aria-label', 'Goal details'); dp.setAttribute('data-visible', selGoal ? 'true' : 'false');

    if (selGoal) {
      const dh = document.createElement('div'); dh.setAttribute('data-part', 'detail-header');
      const ds = document.createElement('span'); ds.setAttribute('data-part', 'detail-status'); ds.setAttribute('data-status', selGoal.status);
      ds.textContent = `${STATUS_ICONS[selGoal.status]} ${STATUS_LABELS[selGoal.status]}`; dh.appendChild(ds);
      const cb = document.createElement('button'); cb.type = 'button'; cb.setAttribute('data-part', 'detail-close');
      cb.setAttribute('aria-label', 'Close detail panel'); cb.tabIndex = 0; cb.textContent = '\u2715';
      cb.addEventListener('click', () => { this.intSelectedId = undefined; this.props.onSelectGoal?.(undefined); this.render(); });
      dh.appendChild(cb); dp.appendChild(dh);

      const db = document.createElement('div'); db.setAttribute('data-part', 'detail-body');
      const addField = (label: string, value: string, status?: string) => {
        const f = document.createElement('div'); f.setAttribute('data-part', 'detail-field');
        const l = document.createElement('span'); l.setAttribute('data-part', 'detail-label'); l.textContent = label; f.appendChild(l);
        const v = document.createElement('span'); v.setAttribute('data-part', 'detail-value'); if (status) v.setAttribute('data-status', status); v.textContent = value; f.appendChild(v);
        db.appendChild(f);
      };
      addField('Goal', selGoal.label);
      addField('Status', `${STATUS_ICONS[selGoal.status]} ${STATUS_LABELS[selGoal.status]}`, selGoal.status);
      if (selGoal.tactic) addField('Tactic', selGoal.tactic);
      if (selGoal.progress != null) addField('Progress', `${Math.round(selGoal.progress * 100)}%`);
      if (selGoal.children?.length) addField('Sub-goals', `${selGoal.children.length} goals`);
      dp.appendChild(db);
    }
    this.el.appendChild(dp);
  }
}

export default ProofSessionTree;
