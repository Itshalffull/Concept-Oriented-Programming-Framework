// ============================================================
// PreferenceMatrix — Vanilla DOM Widget
//
// User preference matrix with channel toggles per category.
// ============================================================

export interface PreferenceMatrixProps {
  preferences: { id: string; label: string; description?: string }[];
  channels: { id: string; label: string }[];
  values?: Record<string, string[]>;
  onChange?: (preferenceId: string, channelId: string, enabled: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export interface PreferenceMatrixOptions { target: HTMLElement; props: PreferenceMatrixProps; }

let _preferenceMatrixUid = 0;

export class PreferenceMatrix {
  private el: HTMLElement;
  private props: PreferenceMatrixProps;
  private uid: string;
  private state = 'idle';

  constructor(options: PreferenceMatrixOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `preference-matrix-${++_preferenceMatrixUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'preference-matrix');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<PreferenceMatrixProps>): void {
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
