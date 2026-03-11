// ============================================================
// FieldMapper — Vanilla DOM Widget
//
// Visual field-to-field mapping with drag connections.
// ============================================================

export interface FieldMapperProps {
  sourceFields: { id: string; label: string; type?: string }[];
  targetFields: { id: string; label: string; type?: string }[];
  mappings?: { sourceId: string; targetId: string }[];
  onMappingsChange?: (mappings: { sourceId: string; targetId: string }[]) => void;
  readOnly?: boolean;
  className?: string;
}

export interface FieldMapperOptions { target: HTMLElement; props: FieldMapperProps; }

let _fieldMapperUid = 0;

export class FieldMapper {
  private el: HTMLElement;
  private props: FieldMapperProps;
  private uid: string;
  private state = 'idle';

  constructor(options: FieldMapperOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `field-mapper-${++_fieldMapperUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'field-mapper');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<FieldMapperProps>): void {
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
