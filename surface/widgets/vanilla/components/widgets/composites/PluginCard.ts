// ============================================================
// PluginCard — Vanilla DOM Widget
//
// Plugin/extension card with install, enable/disable actions.
// ============================================================

export interface PluginCardProps {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  status?: "installed" | "available" | "updating" | "error";
  enabled?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
  onToggle?: (enabled: boolean) => void;
  className?: string;
}

export interface PluginCardOptions { target: HTMLElement; props: PluginCardProps; }

let _pluginCardUid = 0;

export class PluginCard {
  private el: HTMLElement;
  private props: PluginCardProps;
  private uid: string;
  private state = 'idle';

  constructor(options: PluginCardOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `plugin-card-${++_pluginCardUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'plugin-card');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<PluginCardProps>): void {
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
