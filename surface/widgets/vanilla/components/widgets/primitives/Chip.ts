// ============================================================
// Chip — Vanilla DOM Widget
//
// Selectable/deletable chip with keyboard support.
// Tracks selected/idle/removed states.
// ============================================================

export interface ChipProps {
  label?: string;
  selected?: boolean;
  deletable?: boolean;
  disabled?: boolean;
  color?: string;
  value?: string;
  onSelect?: () => void;
  onDeselect?: () => void;
  onDelete?: () => void;
  className?: string;
}

export interface ChipOptions {
  target: HTMLElement;
  props: ChipProps;
}

export class Chip {
  private el: HTMLElement;
  private props: ChipProps;
  private state: 'idle' | 'selected' | 'removed' = 'idle';
  private labelEl: HTMLElement;
  private deleteBtn: HTMLButtonElement | null = null;

  constructor(options: ChipOptions) {
    const { target, props } = options;
    this.props = {
      label: '', selected: false, deletable: false, disabled: false, ...props,
    };
    if (this.props.selected) this.state = 'selected';

    this.el = document.createElement('div');
    this.el.setAttribute('role', 'option');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'chip');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    // Label
    this.labelEl = document.createElement('span');
    this.labelEl.setAttribute('data-part', 'label');
    this.labelEl.textContent = this.props.label || '';
    this.el.appendChild(this.labelEl);

    // Delete button
    if (this.props.deletable) {
      this.deleteBtn = document.createElement('button');
      this.deleteBtn.type = 'button';
      this.deleteBtn.setAttribute('data-part', 'delete-button');
      this.deleteBtn.setAttribute('role', 'button');
      this.deleteBtn.setAttribute('aria-label', 'Remove');
      this.deleteBtn.tabIndex = -1;
      this.deleteBtn.setAttribute('data-visible', 'true');
      this.deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.props.disabled) return;
        this.state = 'removed';
        this.props.onDelete?.();
        this.el.style.display = 'none';
      });
      this.el.appendChild(this.deleteBtn);
    }

    this.syncState();

    this.el.addEventListener('click', () => this.handleClick());
    this.el.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.el.addEventListener('mouseenter', () => this.el.setAttribute('data-hover', 'true'));
    this.el.addEventListener('mouseleave', () => this.el.removeAttribute('data-hover'));

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<ChipProps>): void {
    Object.assign(this.props, props);
    if (props.label !== undefined) this.labelEl.textContent = props.label;
    if (props.selected !== undefined) this.state = props.selected ? 'selected' : 'idle';
    if (props.className !== undefined) this.el.className = props.className || '';
    this.syncState();
  }

  destroy(): void {
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }

  private handleClick(): void {
    if (this.props.disabled) return;
    const isSelected = this.props.selected || this.state === 'selected';
    if (isSelected) {
      this.state = 'idle';
      this.props.onDeselect?.();
    } else {
      this.state = 'selected';
      this.props.onSelect?.();
    }
    this.syncState();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.props.disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.handleClick();
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && this.props.deletable) {
      e.preventDefault();
      this.state = 'removed';
      this.props.onDelete?.();
      this.el.style.display = 'none';
    }
  }

  private syncState(): void {
    const isSelected = this.props.selected || this.state === 'selected';
    this.el.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    this.el.setAttribute('aria-disabled', this.props.disabled ? 'true' : 'false');
    this.el.tabIndex = this.props.disabled ? -1 : 0;
    this.el.setAttribute('data-state', isSelected ? 'selected' : 'idle');
    this.el.setAttribute('data-disabled', this.props.disabled ? 'true' : 'false');
    if (this.props.color) this.el.setAttribute('data-color', this.props.color);
  }
}
