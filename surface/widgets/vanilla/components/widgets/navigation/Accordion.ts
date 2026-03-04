// ============================================================
// Accordion — Vanilla DOM Widget
//
// Expandable sections with single or multiple open modes.
// ============================================================

export interface AccordionProps {
  items: { value: string; trigger: string; content: string; disabled?: boolean }[];
  type?: 'single' | 'multiple';
  value?: string[];
  defaultValue?: string[];
  collapsible?: boolean;
  orientation?: "horizontal" | "vertical";
  onValueChange?: (value: string[]) => void;
  className?: string;
}

export interface AccordionOptions { target: HTMLElement; props: AccordionProps; }

let _accordionUid = 0;

export class Accordion {
  private el: HTMLElement;
  private props: AccordionProps;
  private uid: string;
  private state = 'idle';

  constructor(options: AccordionOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `accordion-${++_accordionUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'accordion');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<AccordionProps>): void {
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
