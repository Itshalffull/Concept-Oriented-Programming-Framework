/* ---------------------------------------------------------------------------
 * ProposalCard — Vanilla widget
 * States: idle (initial), hovered, focused, navigating
 * ------------------------------------------------------------------------- */

export type ProposalCardState = 'idle' | 'hovered' | 'focused' | 'navigating';
export type ProposalCardEvent =
  | { type: 'HOVER' } | { type: 'UNHOVER' } | { type: 'FOCUS' }
  | { type: 'BLUR' } | { type: 'CLICK' } | { type: 'ENTER' } | { type: 'NAVIGATE_COMPLETE' };

export function proposalCardReducer(state: ProposalCardState, event: ProposalCardEvent): ProposalCardState {
  switch (state) {
    case 'idle': if (event.type === 'HOVER') return 'hovered'; if (event.type === 'FOCUS') return 'focused'; if (event.type === 'CLICK') return 'navigating'; return state;
    case 'hovered': if (event.type === 'UNHOVER') return 'idle'; return state;
    case 'focused': if (event.type === 'BLUR') return 'idle'; if (event.type === 'CLICK') return 'navigating'; if (event.type === 'ENTER') return 'navigating'; return state;
    case 'navigating': if (event.type === 'NAVIGATE_COMPLETE') return 'idle'; return state;
    default: return state;
  }
}

function truncate(text: string, max: number): string { return text.length <= max ? text : text.slice(0, max).trimEnd() + '\u2026'; }

function formatTimeRemaining(ts: string): string {
  const diff = new Date(ts).getTime() - Date.now();
  const abs = Math.abs(diff); const s = Math.floor(abs / 1000); const m = Math.floor(s / 60); const h = Math.floor(m / 60); const d = Math.floor(h / 24);
  const suf = diff < 0 ? ' ago' : ' remaining';
  if (d > 0) return `${d}d${suf}`; if (h > 0) return `${h}h${suf}`; if (m > 0) return `${m}m${suf}`; return `${s}s${suf}`;
}

function actionLabel(status: string): string {
  switch (status) { case 'Active': return 'Vote'; case 'Passed': case 'Approved': return 'Execute'; case 'Draft': return 'Edit'; default: return 'View'; }
}

export type ProposalStatus = 'Draft' | 'Active' | 'Passed' | 'Rejected' | 'Executed' | 'Cancelled' | 'Approved' | (string & {});

export interface ProposalCardProps {
  title: string; description: string; author: string; status: ProposalStatus; timestamp: string;
  variant?: 'full' | 'compact' | 'minimal'; showVoteBar?: boolean; showQuorum?: boolean;
  truncateDescription?: number; onClick?: () => void; onNavigate?: () => void;
  className?: string; [key: string]: unknown;
}

export interface ProposalCardOptions { target: HTMLElement; props: ProposalCardProps; }
let _proposalCardUid = 0;

export class ProposalCard {
  private el: HTMLElement;
  private props: ProposalCardProps;
  private state: ProposalCardState = 'idle';
  private uid = ++_proposalCardUid;
  private disposers: (() => void)[] = [];

  constructor(private options: ProposalCardOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('article');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'proposal-card');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'article');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'proposal-card-' + this.uid;

    const handlers: [string, EventListener][] = [
      ['click', () => this.send({ type: 'CLICK' })],
      ['mouseenter', () => this.send({ type: 'HOVER' })],
      ['mouseleave', () => this.send({ type: 'UNHOVER' })],
      ['focus', () => this.send({ type: 'FOCUS' })],
      ['blur', () => this.send({ type: 'BLUR' })],
      ['keydown', ((e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.send({ type: this.state === 'focused' ? 'ENTER' : 'CLICK' }); } }) as EventListener],
    ];
    for (const [evt, fn] of handlers) { this.el.addEventListener(evt, fn); this.disposers.push(() => this.el.removeEventListener(evt, fn)); }

    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  private send(event: ProposalCardEvent): void {
    const prev = this.state;
    this.state = proposalCardReducer(this.state, event);
    this.el.setAttribute('data-state', this.state);
    if (this.state === 'navigating' && prev !== 'navigating') {
      this.props.onClick?.();
      this.props.onNavigate?.();
      setTimeout(() => { this.state = proposalCardReducer(this.state, { type: 'NAVIGATE_COMPLETE' }); this.el.setAttribute('data-state', this.state); }, 0);
    }
    if (prev !== this.state) this.render();
  }

  update(props: Partial<ProposalCardProps>): void { Object.assign(this.props, props); this.render(); }
  destroy(): void { this.disposers.forEach(d => d()); this.el.remove(); }

  private render(): void {
    this.el.innerHTML = '';
    const p = this.props;
    const variant = p.variant ?? 'full';
    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('data-variant', variant);
    this.el.setAttribute('data-status', p.status);
    this.el.setAttribute('aria-label', `${p.status} proposal: ${p.title}`);
    if (p.className) this.el.className = p.className;

    // Status badge
    const sb = document.createElement('div'); sb.setAttribute('data-part', 'status-badge'); sb.setAttribute('data-status', p.status); sb.setAttribute('role', 'status'); sb.setAttribute('aria-label', `Status: ${p.status}`); sb.textContent = p.status; this.el.appendChild(sb);

    // Title
    const h3 = document.createElement('h3'); h3.setAttribute('data-part', 'title'); h3.setAttribute('role', 'heading'); h3.setAttribute('aria-level', '3'); h3.textContent = p.title; this.el.appendChild(h3);

    // Description
    if (variant !== 'minimal') {
      const desc = document.createElement('p'); desc.setAttribute('data-part', 'description');
      desc.setAttribute('data-visible', variant !== 'minimal' ? 'true' : 'false');
      desc.textContent = truncate(p.description, p.truncateDescription ?? 120); this.el.appendChild(desc);
    }

    // Proposer
    if (variant !== 'minimal') {
      const pr = document.createElement('div'); pr.setAttribute('data-part', 'proposer'); pr.setAttribute('data-author', p.author); pr.setAttribute('aria-label', `Proposed by ${p.author}`);
      const av = document.createElement('span'); av.setAttribute('data-part', 'avatar'); av.setAttribute('aria-hidden', 'true'); pr.appendChild(av);
      const nm = document.createElement('span'); nm.textContent = p.author; pr.appendChild(nm);
      this.el.appendChild(pr);
    }

    // Vote bar slot
    if ((p.showVoteBar !== false) && p.status === 'Active' && variant !== 'minimal') {
      const vb = document.createElement('div'); vb.setAttribute('data-part', 'vote-bar'); vb.setAttribute('data-visible', 'true'); this.el.appendChild(vb);
    }

    // Quorum gauge slot
    if (p.showQuorum && variant === 'full') {
      const qg = document.createElement('div'); qg.setAttribute('data-part', 'quorum-gauge'); qg.setAttribute('data-visible', 'true'); this.el.appendChild(qg);
    }

    // Time remaining
    const tr = document.createElement('span'); tr.setAttribute('data-part', 'time-remaining'); tr.setAttribute('data-timestamp', p.timestamp); tr.setAttribute('role', 'timer'); tr.setAttribute('aria-live', 'off'); tr.textContent = formatTimeRemaining(p.timestamp); this.el.appendChild(tr);

    // Action button
    if (variant !== 'minimal') {
      const btn = document.createElement('button'); btn.type = 'button'; btn.setAttribute('data-part', 'action'); btn.setAttribute('role', 'button'); btn.setAttribute('aria-label', `View proposal: ${p.title}`); btn.tabIndex = 0; btn.textContent = actionLabel(p.status);
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.send({ type: 'CLICK' }); }); this.el.appendChild(btn);
    }
  }
}

export default ProposalCard;
