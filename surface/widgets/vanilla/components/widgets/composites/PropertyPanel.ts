// ============================================================
// PropertyPanel — Vanilla DOM Widget
//
// Sidebar panel for editing object properties by type.
// ============================================================

export interface PropertyPanelProps {
  properties: { key: string; label: string; type: string; value: unknown; options?: unknown }[];
  onChange?: (key: string, value: unknown) => void;
  readOnly?: boolean;
  title?: string;
  className?: string;
}

export interface PropertyPanelOptions { target: HTMLElement; props: PropertyPanelProps; }

let _propertyPanelUid = 0;

export class PropertyPanel {
  private el: HTMLElement;
  private props: PropertyPanelProps;
  private uid: string;
  private state = 'idle';

  constructor(options: PropertyPanelOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `property-panel-${++_propertyPanelUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'property-panel');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<PropertyPanelProps>): void {
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
