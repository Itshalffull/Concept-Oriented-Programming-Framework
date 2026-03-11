/* ---------------------------------------------------------------------------
 * InlineCitation — Vanilla widget
 *
 * Inline citation badge with hover/focus tooltip showing title, excerpt, and
 * link. Keyboard Enter/Space to open URL, Escape to dismiss tooltip.
 * States: idle (initial), previewing, navigating
 * ------------------------------------------------------------------------- */

export type InlineCitationState = 'idle' | 'previewing' | 'navigating';
export type InlineCitationEvent =
  | { type: 'HOVER' }
  | { type: 'CLICK' }
  | { type: 'LEAVE' }
  | { type: 'NAVIGATE_COMPLETE' };

export function inlineCitationReducer(state: InlineCitationState, event: InlineCitationEvent): InlineCitationState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'previewing';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'previewing':
      if (event.type === 'LEAVE') return 'idle';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'navigating':
      if (event.type === 'NAVIGATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface InlineCitationProps {
  /** Citation index number. */
  index: number;
  /** Citation title. */
  title: string;
  /** URL to open when clicked. */
  url?: string | undefined;
  /** Short excerpt shown in tooltip. */
  excerpt?: string | undefined;
  /** Visual size variant. */
  size?: 'sm' | 'md';
  /** Whether to show tooltip preview on hover/focus. */
  showPreviewOnHover?: boolean;
  className?: string;
  [key: string]: unknown;
}
export interface InlineCitationOptions { target: HTMLElement; props: InlineCitationProps; }

let _inlineCitationUid = 0;

export class InlineCitation {
  private el: HTMLElement;
  private props: InlineCitationProps;
  private state: InlineCitationState = 'idle';
  private disposers: Array<() => void> = [];
  private tooltipId: string;

  constructor(options: InlineCitationOptions) {
    this.props = { ...options.props };
    this.tooltipId = `ic-tooltip-${Math.random().toString(36).slice(2, 9)}`;
    this.el = document.createElement('span');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'inline-citation');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'link');
    this.el.setAttribute('tabindex', '0');
    this.el.style.cssText = 'position:relative;display:inline;cursor:pointer';
    this.el.id = 'inline-citation-' + (++_inlineCitationUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  private send(ev: InlineCitationEvent): void {
    this.state = inlineCitationReducer(this.state, ev);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<InlineCitationProps>): void {
    Object.assign(this.props, props);
    this.cleanup();
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { this.cleanup(); this.el.remove(); }

  private cleanup(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
  }

  private handleOpen(): void {
    const url = this.props.url;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    this.send({ type: 'CLICK' });
    // Auto-complete navigation
    this.send({ type: 'NAVIGATE_COMPLETE' });
  }

  private render(): void {
    const index = this.props.index ?? 1;
    const title = this.props.title ?? '';
    const excerpt = this.props.excerpt;
    const url = this.props.url;
    const size = this.props.size ?? 'sm';
    const showPreviewOnHover = this.props.showPreviewOnHover !== false;
    const isPreviewing = this.state === 'previewing';

    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('aria-label', `Citation ${index}: ${title}`);
    this.el.setAttribute('aria-describedby', this.tooltipId);
    if (this.props.className) this.el.className = this.props.className;

    // Badge (superscript)
    const badge = document.createElement('sup');
    badge.setAttribute('data-part', 'badge');
    badge.setAttribute('data-state', this.state);
    badge.setAttribute('data-size', size);
    badge.style.cssText = `font-size:${size === 'sm' ? '0.65em' : '0.75em'};line-height:1;vertical-align:super;padding:0 0.15em;color:var(--citation-color,#2563eb);text-decoration:underline;text-decoration-style:dotted`;
    badge.textContent = `[${index}]`;
    this.el.appendChild(badge);

    // Tooltip
    const tooltip = document.createElement('span');
    tooltip.id = this.tooltipId;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('data-part', 'tooltip');
    tooltip.setAttribute('data-state', this.state);
    tooltip.setAttribute('data-visible', isPreviewing ? 'true' : 'false');
    tooltip.setAttribute('aria-hidden', isPreviewing ? 'false' : 'true');
    tooltip.style.cssText = `display:${isPreviewing ? 'block' : 'none'};position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:0.5em;padding:0.5em 0.75em;min-width:12em;max-width:20em;background:var(--tooltip-bg,#1f2937);color:var(--tooltip-color,#f9fafb);border-radius:0.375em;font-size:0.8125rem;line-height:1.4;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10;pointer-events:none;white-space:normal`;

    // Title inside tooltip
    const titleEl = document.createElement('span');
    titleEl.setAttribute('data-part', 'title');
    titleEl.setAttribute('data-state', this.state);
    titleEl.style.cssText = `display:block;font-weight:600;margin-bottom:${excerpt ? '0.25em' : '0'}`;
    titleEl.textContent = title;
    tooltip.appendChild(titleEl);

    // Excerpt inside tooltip
    if (excerpt) {
      const excerptEl = document.createElement('span');
      excerptEl.setAttribute('data-part', 'excerpt');
      excerptEl.setAttribute('data-state', this.state);
      excerptEl.setAttribute('data-visible', 'true');
      excerptEl.style.cssText = `display:block;opacity:0.85;font-size:0.75rem;margin-bottom:${url ? '0.35em' : '0'}`;
      excerptEl.textContent = excerpt;
      tooltip.appendChild(excerptEl);
    }

    // Link inside tooltip
    if (url) {
      const linkEl = document.createElement('span');
      linkEl.setAttribute('data-part', 'link');
      linkEl.setAttribute('data-state', this.state);
      linkEl.setAttribute('data-url', url);
      linkEl.style.cssText = 'display:block;font-size:0.7rem;opacity:0.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      linkEl.textContent = url;
      tooltip.appendChild(linkEl);
    }

    this.el.appendChild(tooltip);

    // Event handlers
    const onEnter = () => { if (showPreviewOnHover) { this.send({ type: 'HOVER' }); this.rerender(); } };
    const onLeave = () => { this.send({ type: 'LEAVE' }); this.rerender(); };
    const onFocus = () => { if (showPreviewOnHover) { this.send({ type: 'HOVER' }); this.rerender(); } };
    const onBlur = () => { this.send({ type: 'LEAVE' }); this.rerender(); };
    const onClick = () => this.handleOpen();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handleOpen();
      }
      if (e.key === 'Escape' && this.state === 'previewing') {
        e.preventDefault();
        this.send({ type: 'LEAVE' });
        this.rerender();
      }
    };

    this.el.addEventListener('mouseenter', onEnter);
    this.el.addEventListener('mouseleave', onLeave);
    this.el.addEventListener('focus', onFocus);
    this.el.addEventListener('blur', onBlur);
    this.el.addEventListener('click', onClick);
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(
      () => this.el.removeEventListener('mouseenter', onEnter),
      () => this.el.removeEventListener('mouseleave', onLeave),
      () => this.el.removeEventListener('focus', onFocus),
      () => this.el.removeEventListener('blur', onBlur),
      () => this.el.removeEventListener('click', onClick),
      () => this.el.removeEventListener('keydown', onKeyDown),
    );
  }

  private rerender(): void { this.cleanup(); this.el.innerHTML = ''; this.render(); }
}

export default InlineCitation;
