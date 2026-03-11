// ============================================================
// Badge — Vanilla DOM Widget
//
// Status badge with filled/outline/dot variants and numeric cap.
// ============================================================

export interface BadgeProps {
  label?: string;
  variant?: 'filled' | 'outline' | 'dot';
  color?: string;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface BadgeOptions { target: HTMLElement; props: BadgeProps; }

export class Badge {
  private el: HTMLElement;
  private props: BadgeProps;
  private labelEl: HTMLElement;

  constructor(options: BadgeOptions) {
    const { target, props } = options;
    this.props = { variant: 'filled', size: 'md', ...props };

    this.el = document.createElement('span');
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'badge');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.labelEl = document.createElement('span');
    this.labelEl.setAttribute('data-part', 'label');
    this.el.appendChild(this.labelEl);

    this.syncState();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<BadgeProps>): void {
    Object.assign(this.props, props);
    if (props.className !== undefined) this.el.className = props.className || '';
    this.syncState();
  }

  destroy(): void { if (this.el.parentNode) this.el.parentNode.removeChild(this.el); }

  private syncState(): void {
    const { label, variant, color, max, size } = this.props;
    const isDot = variant === 'dot';
    let resolvedLabel = '';
    if (!isDot) {
      if (max !== undefined && label !== undefined) {
        const num = Number(label);
        resolvedLabel = !Number.isNaN(num) && num > max ? `${max}+` : (label ?? '');
      } else {
        resolvedLabel = label ?? '';
      }
    }
    this.el.setAttribute('data-state', isDot ? 'dot' : 'static');
    this.el.setAttribute('data-variant', variant!);
    this.el.setAttribute('data-size', size!);
    if (color) this.el.setAttribute('data-color', color);
    this.el.setAttribute('aria-label', label || (isDot ? 'Status indicator' : 'Badge'));
    this.labelEl.textContent = resolvedLabel;
    this.labelEl.setAttribute('aria-hidden', isDot ? 'true' : 'false');
    this.labelEl.style.display = isDot ? 'none' : '';
  }
}
