// ============================================================
// Disclosure — Vanilla DOM Widget
//
// Simple expandable section with trigger and content.
// ============================================================

export interface DisclosureProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  triggerLabel?: string;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export interface DisclosureOptions { target: HTMLElement; props: DisclosureProps; }

let _disclosureUid = 0;

export class Disclosure {
  private el: HTMLElement;
  private props: DisclosureProps;
  private uid: string;
  private state = 'idle';

  constructor(options: DisclosureOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `disclosure-${++_disclosureUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'disclosure');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<DisclosureProps>): void {
    Object.assign(this.props, props);
    if (props.className !== undefined) this.el.className = props.className || '';
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { if (this.el.parentNode) this.el.parentNode.removeChild(this.el); }

  private render(): void {
    this.syncState();
  }

  private syncState(): void {
    this.el.setAttribute('data-state', this.state);
  }
}
