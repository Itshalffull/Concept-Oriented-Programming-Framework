import { uid } from '../shared/uid.js';

export interface StateDef {
  id: string;
  label: string;
  x: number;
  y: number;
  initial?: boolean;
  final?: boolean;
}

export interface TransitionDef {
  id: string;
  source: string;
  target: string;
  event: string;
  guard?: string;
}

export interface StateMachineDiagramProps {
  states: StateDef[];
  transitions: TransitionDef[];
  currentStateId?: string;
  ariaLabel?: string;
  readOnly?: boolean;
  zoom?: number;
  onStateSelect?: (id: string) => void;
  onTransitionSelect?: (id: string) => void;
  onStatesChange?: (states: StateDef[]) => void;
  children?: string | HTMLElement;
}

export interface StateMachineDiagramInstance {
  element: HTMLElement;
  update(props: Partial<StateMachineDiagramProps>): void;
  destroy(): void;
}

export function createStateMachineDiagram(options: {
  target: HTMLElement;
  props: StateMachineDiagramProps;
}): StateMachineDiagramInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'state-machine-diagram');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'img');
  root.setAttribute('aria-roledescription', 'state machine diagram');
  root.id = id;

  const canvasEl = document.createElement('div');
  canvasEl.setAttribute('data-part', 'canvas');
  canvasEl.style.position = 'relative';
  root.appendChild(canvasEl);

  function renderStates() {
    canvasEl.querySelectorAll('[data-part="state"]').forEach(n => n.remove());
    currentProps.states.forEach(state => {
      const el = document.createElement('div');
      el.setAttribute('data-part', 'state');
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', state.label + (state.id === currentProps.currentStateId ? ' (current)' : ''));
      el.setAttribute('data-current', state.id === currentProps.currentStateId ? 'true' : 'false');
      el.setAttribute('data-initial', state.initial ? 'true' : 'false');
      el.setAttribute('data-final', state.final ? 'true' : 'false');
      el.style.position = 'absolute';
      el.style.left = state.x + 'px';
      el.style.top = state.y + 'px';
      el.textContent = state.label;
      el.addEventListener('click', () => currentProps.onStateSelect?.(state.id));
      el.addEventListener('keydown', ((e: KeyboardEvent) => { if (e.key === 'Enter') currentProps.onStateSelect?.(state.id); }) as EventListener);
      canvasEl.appendChild(el);
    });
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    root.setAttribute('data-readonly', currentProps.readOnly ? 'true' : 'false');
    if (currentProps.ariaLabel) root.setAttribute('aria-label', currentProps.ariaLabel);
    const zoom = currentProps.zoom ?? 1;
    canvasEl.style.transform = 'scale(' + zoom + ')';
    renderStates();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createStateMachineDiagram;
