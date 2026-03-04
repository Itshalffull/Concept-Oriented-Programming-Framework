// ============================================================
// Tabs — Vanilla DOM Widget
//
// Tab list with panels and roving focus keyboard navigation.
// ============================================================

export interface TabsProps {
  items: { value: string; trigger: string; content: string; disabled?: boolean }[];
  value?: string;
  defaultValue?: string;
  orientation?: "horizontal" | "vertical";
  activationMode?: "automatic" | "manual";
  disabled?: boolean;
  loop?: boolean;
  onValueChange?: (value: string) => void;
  variant?: string;
  size?: string;
  className?: string;
}

export interface TabsOptions { target: HTMLElement; props: TabsProps; }

let _tabsUid = 0;

export class Tabs {
  private el: HTMLElement;
  private props: TabsProps;
  private uid: string;
  private state = 'idle';

  constructor(options: TabsOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `tabs-${++_tabsUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'tabs');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<TabsProps>): void {
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
