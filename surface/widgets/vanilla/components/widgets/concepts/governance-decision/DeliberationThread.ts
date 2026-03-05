/* ---------------------------------------------------------------------------
 * DeliberationThread — Vanilla widget
 * States: viewing (initial), composing, entrySelected
 * See widget spec: deliberation-thread.widget
 * ------------------------------------------------------------------------- */

export type DeliberationThreadState = 'viewing' | 'composing' | 'entrySelected';
export type DeliberationThreadEvent =
  | { type: 'REPLY_TO'; entryId: string }
  | { type: 'SELECT_ENTRY'; entryId: string }
  | { type: 'SEND' }
  | { type: 'CANCEL' }
  | { type: 'DESELECT' };

export interface DeliberationThreadMachineContext {
  state: DeliberationThreadState;
  replyTargetId: string | null;
  selectedEntryId: string | null;
}

export function deliberationThreadReducer(
  ctx: DeliberationThreadMachineContext,
  event: DeliberationThreadEvent,
): DeliberationThreadMachineContext {
  switch (ctx.state) {
    case 'viewing':
      if (event.type === 'REPLY_TO')
        return { state: 'composing', replyTargetId: event.entryId, selectedEntryId: null };
      if (event.type === 'SELECT_ENTRY')
        return { state: 'entrySelected', replyTargetId: null, selectedEntryId: event.entryId };
      return ctx;
    case 'composing':
      if (event.type === 'SEND')
        return { state: 'viewing', replyTargetId: null, selectedEntryId: null };
      if (event.type === 'CANCEL')
        return { state: 'viewing', replyTargetId: null, selectedEntryId: null };
      return ctx;
    case 'entrySelected':
      if (event.type === 'DESELECT')
        return { state: 'viewing', replyTargetId: null, selectedEntryId: null };
      if (event.type === 'REPLY_TO')
        return { state: 'composing', replyTargetId: event.entryId, selectedEntryId: null };
      return ctx;
    default:
      return ctx;
  }
}

export type ArgumentTag = 'for' | 'against' | 'question' | 'amendment';
export type SortMode = 'time' | 'tag' | 'relevance';

const TAG_COLORS: Record<ArgumentTag, string> = { for: '#22c55e', against: '#ef4444', question: '#3b82f6', amendment: '#eab308' };
const TAG_LABELS: Record<ArgumentTag, string> = { for: 'For', against: 'Against', question: 'Question', amendment: 'Amendment' };

export interface DeliberationEntry {
  id: string; author: string; avatar?: string; content: string;
  timestamp: string; tag: ArgumentTag; parentId?: string | null; relevance?: number;
}

interface EntryNode { entry: DeliberationEntry; children: EntryNode[]; depth: number; }

function buildTree(entries: DeliberationEntry[], maxNesting: number): EntryNode[] {
  const byId = new Map<string, EntryNode>();
  const roots: EntryNode[] = [];
  for (const e of entries) byId.set(e.id, { entry: e, children: [], depth: 0 });
  for (const e of entries) {
    const node = byId.get(e.id)!;
    if (e.parentId && byId.has(e.parentId)) {
      const parent = byId.get(e.parentId)!;
      node.depth = parent.depth < maxNesting ? parent.depth + 1 : maxNesting;
      parent.children.push(node);
    } else { roots.push(node); }
  }
  return roots;
}

function sortEntries(entries: DeliberationEntry[], mode: SortMode): DeliberationEntry[] {
  const s = [...entries];
  if (mode === 'time') return s.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  if (mode === 'tag') { const o: Record<ArgumentTag, number> = { for: 0, against: 1, question: 2, amendment: 3 }; return s.sort((a, b) => o[a.tag] - o[b.tag]); }
  return s.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));
}

function flattenTree(nodes: EntryNode[], collapsed: Set<string>): EntryNode[] {
  const r: EntryNode[] = [];
  for (const n of nodes) { r.push(n); if (!collapsed.has(n.entry.id) && n.children.length) r.push(...flattenTree(n.children, collapsed)); }
  return r;
}

function computeSentiment(entries: DeliberationEntry[]) {
  let f = 0, a = 0;
  for (const e of entries) { if (e.tag === 'for') f++; else if (e.tag === 'against') a++; }
  const t = f + a;
  return { forCount: f, againstCount: a, ratio: t > 0 ? f / t : 0.5 };
}

function fmtTs(iso: string): string {
  try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
}

export interface DeliberationThreadProps {
  entries: DeliberationEntry[]; status: string; summary?: string;
  showSentiment?: boolean; showTags?: boolean; maxNesting?: number; sortMode?: SortMode;
  onReply?: (parentId: string, content: string) => void;
  onSortChange?: (mode: SortMode) => void;
  onEntrySelect?: (entryId: string) => void;
  className?: string; [key: string]: unknown;
}

export interface DeliberationThreadOptions { target: HTMLElement; props: DeliberationThreadProps; }

let _deliberationThreadUid = 0;

export class DeliberationThread {
  private el: HTMLElement;
  private props: DeliberationThreadProps;
  private ctx: DeliberationThreadMachineContext = { state: 'viewing', replyTargetId: null, selectedEntryId: null };
  private uid = ++_deliberationThreadUid;
  private disposers: (() => void)[] = [];
  private collapsedIds = new Set<string>();
  private focusIndex = 0;
  private intSortMode: SortMode = 'time';
  private composeText = '';
  private entryRefs = new Map<string, HTMLDivElement>();

  constructor(private options: DeliberationThreadOptions) {
    this.props = { ...options.props };
    this.intSortMode = this.props.sortMode ?? 'time';
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'deliberation-thread');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'feed');
    this.el.setAttribute('aria-label', 'Deliberation thread');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'deliberation-thread-' + this.uid;
    const onKD = (e: KeyboardEvent) => this.onRootKeyDown(e);
    this.el.addEventListener('keydown', onKD);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKD));
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  private send(event: DeliberationThreadEvent): void {
    this.ctx = deliberationThreadReducer(this.ctx, event);
    this.el.setAttribute('data-state', this.ctx.state);
    this.render();
  }

  update(props: Partial<DeliberationThreadProps>): void {
    Object.assign(this.props, props);
    if (props.sortMode !== undefined) this.intSortMode = props.sortMode;
    this.render();
  }

  destroy(): void { this.disposers.forEach(d => d()); this.el.remove(); }

  private get sortMode(): SortMode { return this.props.sortMode ?? this.intSortMode; }

  private getFlat() {
    const sorted = sortEntries(this.props.entries, this.sortMode);
    const tree = buildTree(sorted, this.props.maxNesting ?? 3);
    return { tree, flat: flattenTree(tree, this.collapsedIds) };
  }

  private onRootKeyDown(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') { if (e.key === 'Escape') { e.preventDefault(); this.composeText = ''; this.send({ type: 'CANCEL' }); } return; }
    const { flat } = this.getFlat();
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); this.focusIndex = Math.min(this.focusIndex + 1, flat.length - 1); this.focusEntry(flat); break;
      case 'ArrowUp': e.preventDefault(); this.focusIndex = Math.max(this.focusIndex - 1, 0); this.focusEntry(flat); break;
      case 'ArrowRight': { e.preventDefault(); const n = flat[this.focusIndex]; if (n && this.collapsedIds.has(n.entry.id)) { this.collapsedIds.delete(n.entry.id); this.render(); } break; }
      case 'ArrowLeft': { e.preventDefault(); const n = flat[this.focusIndex]; if (n && !this.collapsedIds.has(n.entry.id) && n.children.length > 0) { this.collapsedIds.add(n.entry.id); this.render(); } break; }
      case 'Enter': case 'r': { e.preventDefault(); const n = flat[this.focusIndex]; if (n) this.send({ type: 'REPLY_TO', entryId: n.entry.id }); break; }
      case 'Escape': e.preventDefault(); if (this.ctx.state === 'composing') { this.composeText = ''; this.send({ type: 'CANCEL' }); } else if (this.ctx.state === 'entrySelected') this.send({ type: 'DESELECT' }); break;
    }
  }

  private focusEntry(flat: EntryNode[]): void { const n = flat[this.focusIndex]; if (n) this.entryRefs.get(n.entry.id)?.focus(); }

  private render(): void {
    this.el.innerHTML = '';
    this.entryRefs.clear();
    this.el.setAttribute('data-state', this.ctx.state);
    this.el.setAttribute('data-status', this.props.status);
    if (this.props.className) this.el.className = this.props.className;

    const showSentiment = this.props.showSentiment !== false;
    const showTags = this.props.showTags !== false;

    // Header
    const header = document.createElement('div');
    header.setAttribute('data-part', 'header');
    header.setAttribute('data-state', this.ctx.state);
    const hs = document.createElement('span');
    hs.setAttribute('data-part', 'header-status');
    hs.style.cssText = 'font-weight:600;text-transform:capitalize';
    hs.textContent = this.props.status;
    header.appendChild(hs);
    if (this.props.summary) { const p = document.createElement('p'); p.setAttribute('data-part', 'header-summary'); p.style.marginTop = '4px'; p.textContent = this.props.summary; header.appendChild(p); }

    const sc = document.createElement('div');
    sc.setAttribute('data-part', 'sort-controls');
    sc.setAttribute('role', 'group');
    sc.setAttribute('aria-label', 'Sort entries');
    for (const m of ['time', 'tag', 'relevance'] as SortMode[]) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('data-part', 'sort-button'); b.setAttribute('data-sort', m);
      b.setAttribute('data-active', this.sortMode === m ? 'true' : 'false');
      b.setAttribute('aria-pressed', String(this.sortMode === m));
      b.tabIndex = -1; b.textContent = m.charAt(0).toUpperCase() + m.slice(1);
      b.addEventListener('click', () => { this.intSortMode = m; this.props.onSortChange?.(m); this.render(); });
      sc.appendChild(b);
    }
    header.appendChild(sc);
    this.el.appendChild(header);

    // Sentiment
    if (showSentiment) {
      const s = computeSentiment(this.props.entries);
      const sb = document.createElement('div');
      sb.setAttribute('data-part', 'sentiment'); sb.setAttribute('data-visible', 'true');
      sb.setAttribute('role', 'img'); sb.setAttribute('aria-label', `Sentiment: ${s.forCount} for, ${s.againstCount} against`);
      sb.style.cssText = 'display:flex;height:8px;border-radius:4px;overflow:hidden;margin-bottom:8px';
      const fb = document.createElement('div'); fb.setAttribute('data-part', 'sentiment-for'); fb.setAttribute('aria-hidden', 'true');
      fb.style.cssText = `width:${s.ratio * 100}%;background-color:${TAG_COLORS.for};transition:width 0.3s ease`;
      sb.appendChild(fb);
      const ab = document.createElement('div'); ab.setAttribute('data-part', 'sentiment-against'); ab.setAttribute('aria-hidden', 'true');
      ab.style.cssText = `width:${(1 - s.ratio) * 100}%;background-color:${TAG_COLORS.against};transition:width 0.3s ease`;
      sb.appendChild(ab);
      this.el.appendChild(sb);
    }

    // Entries
    const { tree, flat } = this.getFlat();
    if (this.focusIndex >= flat.length && flat.length > 0) this.focusIndex = flat.length - 1;

    const el = document.createElement('div');
    el.setAttribute('data-part', 'entry-list'); el.setAttribute('role', 'feed'); el.setAttribute('aria-label', 'Contributions');
    if (tree.length === 0) { const p = document.createElement('p'); p.setAttribute('data-part', 'empty-state'); p.style.cssText = 'color:#9ca3af;font-style:italic'; p.textContent = 'No contributions yet.'; el.appendChild(p); }

    const renderNode = (node: EntryNode, _idx: number): HTMLDivElement => {
      const { entry } = node;
      const isCollapsed = this.collapsedIds.has(entry.id);
      const isSelected = this.ctx.selectedEntryId === entry.id;
      const isReplyTarget = this.ctx.replyTargetId === entry.id;
      const isFocused = flat[this.focusIndex]?.entry.id === entry.id;
      const hasChildren = node.children.length > 0;

      const d = document.createElement('div');
      d.setAttribute('role', 'article');
      d.setAttribute('aria-label', `${entry.author}: ${TAG_LABELS[entry.tag]} \u2014 ${fmtTs(entry.timestamp)}`);
      d.setAttribute('data-part', 'entry'); d.setAttribute('data-tag', entry.tag);
      d.setAttribute('data-selected', isSelected ? 'true' : 'false');
      d.setAttribute('data-depth', String(node.depth));
      d.tabIndex = isFocused ? 0 : -1;
      d.style.marginLeft = `${node.depth * 24}px`;
      if (isSelected) d.style.outline = '2px solid var(--ring, #6366f1)';
      this.entryRefs.set(entry.id, d);

      d.addEventListener('click', () => {
        if (this.ctx.state === 'entrySelected' && isSelected) this.send({ type: 'DESELECT' });
        else { this.send({ type: 'SELECT_ENTRY', entryId: entry.id }); this.props.onEntrySelect?.(entry.id); }
      });

      // Avatar
      const av = document.createElement('div'); av.setAttribute('data-part', 'entry-avatar'); av.setAttribute('aria-hidden', 'true');
      if (entry.avatar) { const img = document.createElement('img'); img.src = entry.avatar; img.alt = ''; img.style.cssText = 'width:28px;height:28px;border-radius:50%'; av.appendChild(img); }
      else { const sp = document.createElement('span'); sp.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background-color:#e5e7eb;font-size:14px;font-weight:600'; sp.textContent = entry.author.charAt(0).toUpperCase(); av.appendChild(sp); }
      d.appendChild(av);

      const au = document.createElement('span'); au.setAttribute('data-part', 'entry-author'); au.textContent = entry.author; d.appendChild(au);

      if (showTags) {
        const tg = document.createElement('span'); tg.setAttribute('data-part', 'entry-tag'); tg.setAttribute('data-tag', entry.tag); tg.setAttribute('data-visible', 'true');
        tg.style.cssText = `display:inline-block;padding:2px 8px;border-radius:9999px;font-size:12px;font-weight:600;color:#fff;background-color:${TAG_COLORS[entry.tag]}`; tg.textContent = TAG_LABELS[entry.tag]; d.appendChild(tg);
      }

      const ct = document.createElement('div'); ct.setAttribute('data-part', 'entry-content'); ct.textContent = entry.content; d.appendChild(ct);
      const ts = document.createElement('span'); ts.setAttribute('data-part', 'entry-timestamp'); ts.style.cssText = 'font-size:12px;color:#6b7280'; ts.textContent = fmtTs(entry.timestamp); d.appendChild(ts);

      const rb = document.createElement('button'); rb.type = 'button'; rb.setAttribute('data-part', 'reply'); rb.setAttribute('aria-label', `Reply to ${entry.author}`); rb.tabIndex = -1; rb.textContent = 'Reply';
      rb.addEventListener('click', (e) => { e.stopPropagation(); this.send({ type: 'REPLY_TO', entryId: entry.id }); }); d.appendChild(rb);

      if (hasChildren) {
        const cb = document.createElement('button'); cb.type = 'button'; cb.setAttribute('data-part', 'collapse-toggle');
        cb.setAttribute('aria-label', isCollapsed ? 'Expand replies' : 'Collapse replies'); cb.setAttribute('aria-expanded', String(!isCollapsed));
        cb.tabIndex = -1; cb.textContent = isCollapsed ? `Show replies (${node.children.length})` : 'Hide replies';
        cb.addEventListener('click', (e) => { e.stopPropagation(); if (this.collapsedIds.has(entry.id)) this.collapsedIds.delete(entry.id); else this.collapsedIds.add(entry.id); this.render(); }); d.appendChild(cb);
      }

      if (this.ctx.state === 'composing' && isReplyTarget) {
        const cp = document.createElement('div'); cp.setAttribute('data-part', 'compose'); cp.setAttribute('data-visible', 'true'); cp.setAttribute('role', 'group'); cp.setAttribute('aria-label', 'Reply compose box'); cp.style.cssText = 'margin-left:24px;margin-top:8px';
        const ta = document.createElement('textarea'); ta.setAttribute('data-part', 'compose-input'); ta.setAttribute('aria-label', 'Add contribution'); ta.setAttribute('role', 'textbox'); ta.placeholder = 'Add your contribution...'; ta.value = this.composeText; ta.rows = 3; ta.style.cssText = 'width:100%;resize:vertical';
        ta.addEventListener('input', (ev) => { this.composeText = (ev.target as HTMLTextAreaElement).value; });
        ta.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); if (this.ctx.replyTargetId && this.composeText.trim()) this.props.onReply?.(this.ctx.replyTargetId, this.composeText.trim()); this.composeText = ''; this.send({ type: 'SEND' }); } if (ev.key === 'Escape') { ev.preventDefault(); this.composeText = ''; this.send({ type: 'CANCEL' }); } });
        cp.appendChild(ta);
        const ac = document.createElement('div'); ac.setAttribute('data-part', 'compose-actions'); ac.style.cssText = 'margin-top:4px;display:flex;gap:8px';
        const sb = document.createElement('button'); sb.type = 'button'; sb.setAttribute('data-part', 'compose-send'); sb.setAttribute('aria-label', 'Send reply'); sb.textContent = 'Send';
        sb.addEventListener('click', () => { if (this.ctx.replyTargetId && this.composeText.trim()) this.props.onReply?.(this.ctx.replyTargetId, this.composeText.trim()); this.composeText = ''; this.send({ type: 'SEND' }); }); ac.appendChild(sb);
        const cb2 = document.createElement('button'); cb2.type = 'button'; cb2.setAttribute('data-part', 'compose-cancel'); cb2.setAttribute('aria-label', 'Cancel reply'); cb2.textContent = 'Cancel';
        cb2.addEventListener('click', () => { this.composeText = ''; this.send({ type: 'CANCEL' }); }); ac.appendChild(cb2);
        cp.appendChild(ac); d.appendChild(cp);
        requestAnimationFrame(() => ta.focus());
      }

      if (hasChildren && !isCollapsed) {
        const rp = document.createElement('div'); rp.setAttribute('data-part', 'replies'); rp.setAttribute('role', 'group'); rp.setAttribute('aria-label', `Replies to ${entry.author}`);
        node.children.forEach((c, ci) => rp.appendChild(renderNode(c, ci)));
        d.appendChild(rp);
      }
      return d;
    };

    tree.forEach((n, i) => el.appendChild(renderNode(n, i)));
    this.el.appendChild(el);
  }
}

export default DeliberationThread;
