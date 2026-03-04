// ============================================================
// CommandPalette — Vanilla DOM Widget
//
// Searchable command palette overlay with keyboard navigation.
// ============================================================

export interface CommandPaletteProps {
  open?: boolean;
  items: { id: string; label: string; shortcut?: string; group?: string; disabled?: boolean }[];
  placeholder?: string;
  onSelect?: (id: string) => void;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export interface CommandPaletteOptions { target: HTMLElement; props: CommandPaletteProps; }

let _commandPaletteUid = 0;

export class CommandPalette {
  private el: HTMLElement;
  private props: CommandPaletteProps;
  private uid: string;
  private state = 'idle';

  constructor(options: CommandPaletteOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `command-palette-${++_commandPaletteUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'command-palette');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<CommandPaletteProps>): void {
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
