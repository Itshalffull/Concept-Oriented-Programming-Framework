/* ---------------------------------------------------------------------------
 * VerificationStatusBadge — Vanilla widget
 * States: idle (initial), hovered, animating
 * ------------------------------------------------------------------------- */

export type VerificationStatusBadgeState = 'idle' | 'hovered' | 'animating';
export type VerificationStatusBadgeEvent =
  | { type: 'HOVER' }
  | { type: 'STATUS_CHANGE' }
  | { type: 'LEAVE' }
  | { type: 'ANIMATION_END' };

export function verificationStatusBadgeReducer(state: VerificationStatusBadgeState, event: VerificationStatusBadgeEvent): VerificationStatusBadgeState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'STATUS_CHANGE') return 'animating';
      return state;
    case 'hovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    default:
      return state;
  }
}

export type VerificationStatus = 'proved' | 'refuted' | 'unknown' | 'timeout' | 'running';

const STATUS_ICONS: Record<VerificationStatus, string> = { proved: '\u2713', refuted: '\u2717', unknown: '?', timeout: '\u23F3', running: '\u21BB' };

export interface VerificationStatusBadgeProps {
  status?: VerificationStatus; label?: string; duration?: number; solver?: string;
  size?: 'sm' | 'md' | 'lg'; className?: string; [key: string]: unknown;
}
export interface VerificationStatusBadgeOptions { target: HTMLElement; props: VerificationStatusBadgeProps; }
let _uid = 0;

export class VerificationStatusBadge {
  private el: HTMLElement;
  private props: VerificationStatusBadgeProps;
  private state: VerificationStatusBadgeState = 'idle';
  private uid = ++_uid;
  private disposers: (() => void)[] = [];
  private prevStatus: VerificationStatus;
  private animTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private options: VerificationStatusBadgeOptions) {
    this.props = { ...options.props };
    this.prevStatus = this.props.status ?? 'unknown';
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', ''); this.el.setAttribute('data-widget-name', 'verification-status-badge');
    this.el.setAttribute('data-part', 'root'); this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite'); this.el.setAttribute('tabindex', '0');
    this.el.id = 'verification-status-badge-' + this.uid;

    const onEnter = () => this.sm({ type: 'HOVER' });
    const onLeave = () => this.sm({ type: 'LEAVE' });
    const onFocus = () => this.sm({ type: 'HOVER' });
    const onBlur = () => this.sm({ type: 'LEAVE' });
    this.el.addEventListener('pointerenter', onEnter); this.disposers.push(() => this.el.removeEventListener('pointerenter', onEnter));
    this.el.addEventListener('pointerleave', onLeave); this.disposers.push(() => this.el.removeEventListener('pointerleave', onLeave));
    this.el.addEventListener('focus', onFocus); this.disposers.push(() => this.el.removeEventListener('focus', onFocus));
    this.el.addEventListener('blur', onBlur); this.disposers.push(() => this.el.removeEventListener('blur', onBlur));

    this.render(); options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  private sm(ev: VerificationStatusBadgeEvent): void { this.state = verificationStatusBadgeReducer(this.state, ev); this.el.setAttribute('data-state', this.state); this.render(); }

  update(props: Partial<VerificationStatusBadgeProps>): void {
    const oldStatus = this.props.status ?? 'unknown';
    Object.assign(this.props, props);
    const newStatus = this.props.status ?? 'unknown';
    if (oldStatus !== newStatus) {
      this.prevStatus = newStatus;
      this.state = verificationStatusBadgeReducer(this.state, { type: 'STATUS_CHANGE' });
      this.el.setAttribute('data-state', this.state);
      if (this.state === 'animating') {
        if (this.animTimer) clearTimeout(this.animTimer);
        this.animTimer = setTimeout(() => { this.sm({ type: 'ANIMATION_END' }); }, 200);
      }
    }
    this.render();
  }

  destroy(): void {
    if (this.animTimer) clearTimeout(this.animTimer);
    this.disposers.forEach(d => d()); this.el.remove();
  }

  private render(): void {
    this.el.innerHTML = '';
    const p = this.props;
    const status = p.status ?? 'unknown'; const label = p.label ?? 'Unknown';
    const size = p.size ?? 'md';
    this.el.setAttribute('data-state', this.state); this.el.setAttribute('data-status', status); this.el.setAttribute('data-size', size);
    this.el.setAttribute('aria-label', `Verification status: ${label}`);
    if (p.className) this.el.className = p.className;

    const icon = document.createElement('span'); icon.setAttribute('data-part', 'icon'); icon.setAttribute('data-status', status);
    icon.setAttribute('aria-hidden', 'true'); icon.textContent = STATUS_ICONS[status]; this.el.appendChild(icon);

    const lb = document.createElement('span'); lb.setAttribute('data-part', 'label'); lb.textContent = label; this.el.appendChild(lb);

    const hasTooltip = p.solver != null || p.duration != null;
    if (hasTooltip) {
      const parts: string[] = [];
      if (p.solver) parts.push(p.solver);
      if (p.duration != null) parts.push(`${p.duration}ms`);
      const tooltipText = parts.join(' \u2014 ');
      const visible = this.state === 'hovered';
      const tt = document.createElement('div'); tt.setAttribute('role', 'tooltip'); tt.setAttribute('data-part', 'tooltip');
      tt.setAttribute('data-visible', visible ? 'true' : 'false');
      tt.setAttribute('aria-hidden', visible ? 'false' : 'true');
      tt.style.cssText = `visibility:${visible ? 'visible' : 'hidden'};position:absolute;pointer-events:none`;
      tt.textContent = tooltipText; this.el.appendChild(tt);
    }
  }
}

export default VerificationStatusBadge;
