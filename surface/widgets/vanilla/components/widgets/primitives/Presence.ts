// ============================================================
// Presence — Vanilla DOM Widget
//
// Controls mount/unmount lifecycle with animation support.
// States: unmounted, mounting, mounted, unmounting.
// ============================================================

export interface PresenceProps {
  present?: boolean;
  animateOnMount?: boolean;
  forceMount?: boolean;
  className?: string;
}

export interface PresenceOptions {
  target: HTMLElement;
  props: PresenceProps;
}

type PresenceState = 'unmounted' | 'mounting' | 'mounted' | 'unmounting';

function stateToDataState(state: PresenceState): string {
  switch (state) {
    case 'mounting': return 'entering';
    case 'mounted': return 'entered';
    case 'unmounting': return 'exiting';
    default: return 'exited';
  }
}

export class Presence {
  private el: HTMLElement;
  private props: PresenceProps;
  private state: PresenceState;

  constructor(options: PresenceOptions) {
    const { target, props } = options;
    this.props = { present: false, animateOnMount: false, forceMount: false, ...props };

    this.state = this.props.present
      ? (this.props.animateOnMount ? 'mounting' : 'mounted')
      : 'unmounted';

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'presence');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.el.addEventListener('animationend', () => this.handleAnimationEnd());
    this.el.addEventListener('transitionend', () => this.handleAnimationEnd());

    this.syncState();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<PresenceProps>): void {
    const wasPresentProp = this.props.present;
    Object.assign(this.props, props);
    if (props.className !== undefined) this.el.className = props.className || '';

    if (props.present !== undefined && props.present !== wasPresentProp) {
      if (props.present) {
        this.state = 'mounting';
      } else {
        this.state = 'unmounting';
      }
    }
    this.syncState();
  }

  destroy(): void {
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }

  private handleAnimationEnd(): void {
    if (this.state === 'mounting') {
      this.state = 'mounted';
    } else if (this.state === 'unmounting') {
      this.state = 'unmounted';
    }
    this.syncState();
  }

  private syncState(): void {
    const shouldRender = this.props.forceMount || this.state !== 'unmounted';
    this.el.style.display = shouldRender ? '' : 'none';
    this.el.setAttribute('data-state', stateToDataState(this.state));
    this.el.setAttribute('data-present', this.props.present ? 'true' : 'false');
    this.el.setAttribute('data-animate-mount', this.props.animateOnMount ? 'true' : 'false');
    this.el.setAttribute('data-force-mount', this.props.forceMount ? 'true' : 'false');
  }
}
