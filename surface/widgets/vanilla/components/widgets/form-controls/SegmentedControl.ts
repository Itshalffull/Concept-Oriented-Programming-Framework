// ============================================================
// SegmentedControl — Vanilla DOM Widget
//
// Segmented button group for mutually exclusive selection.
// ============================================================

export interface SegmentedControlProps {
  value?: string;
  defaultValue?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  label: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface SegmentedControlOptions { target: HTMLElement; props: SegmentedControlProps; }

let _segmentedControlUid = 0;

export class SegmentedControl {
  private el: HTMLElement;
  private props: SegmentedControlProps;
  private uid: string;
  private state = 'idle';

  constructor(options: SegmentedControlOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `segmented-control-${++_segmentedControlUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'segmented-control');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<SegmentedControlProps>): void {
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
