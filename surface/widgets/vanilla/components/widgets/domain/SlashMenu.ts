// ============================================================
// SlashMenu — Vanilla DOM Widget
//
// Keyboard-triggered block type menu for editors.
// ============================================================

export interface SlashMenuProps {
  open?: boolean;
  items: { type: string; label: string; description?: string; icon?: string }[];
  query?: string;
  onSelect?: (type: string) => void;
  onClose?: () => void;
  className?: string;
}

export interface SlashMenuOptions { target: HTMLElement; props: SlashMenuProps; }

let _slashMenuUid = 0;

export class SlashMenu {
  private el: HTMLElement;
  private props: SlashMenuProps;
  private uid: string;
  private state = 'idle';

  constructor(options: SlashMenuOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `slash-menu-${++_slashMenuUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'slash-menu');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<SlashMenuProps>): void {
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
