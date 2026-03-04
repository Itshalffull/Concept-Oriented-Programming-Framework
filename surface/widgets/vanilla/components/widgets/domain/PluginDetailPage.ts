// ============================================================
// PluginDetailPage — Vanilla DOM Widget
//
// Plugin detail page with screenshots, reviews, and changelog.
// ============================================================

export interface PluginDetailPageProps {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  screenshots?: { src: string; alt?: string }[];
  reviews?: { author: string; rating: number; text: string; date?: string }[];
  changelog?: { version: string; date: string; changes: string[] }[];
  onInstall?: () => void;
  onUninstall?: () => void;
  className?: string;
}

export interface PluginDetailPageOptions { target: HTMLElement; props: PluginDetailPageProps; }

let _pluginDetailPageUid = 0;

export class PluginDetailPage {
  private el: HTMLElement;
  private props: PluginDetailPageProps;
  private uid: string;
  private state = 'idle';

  constructor(options: PluginDetailPageOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `plugin-detail-page-${++_pluginDetailPageUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'plugin-detail-page');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<PluginDetailPageProps>): void {
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
