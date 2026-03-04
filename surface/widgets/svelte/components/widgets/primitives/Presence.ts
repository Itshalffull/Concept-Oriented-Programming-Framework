import { uid } from '../shared/uid.js';

export interface PresenceProps {
  present?: boolean;
  forceMount?: boolean;
  children?: HTMLElement;
  onExitComplete?: () => void;
  className?: string;
}

export interface PresenceInstance {
  element: HTMLElement;
  update(props: Partial<PresenceProps>): void;
  destroy(): void;
}

export function createPresence(options: {
  target: HTMLElement;
  props: PresenceProps;
}): PresenceInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const cleanups: (() => void)[] = [];
  let mounted = currentProps.present || currentProps.forceMount || false;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'presence');
  root.setAttribute('data-part', 'root');

  function handleAnimEnd() {
    if (!currentProps.present) { mounted = false; sync(); currentProps.onExitComplete?.(); }
  }
  root.addEventListener('animationend', handleAnimEnd);
  cleanups.push(() => root.removeEventListener('animationend', handleAnimEnd));

  function sync() {
    const shouldMount = currentProps.present || currentProps.forceMount || false;
    if (shouldMount && !mounted) mounted = true;
    root.setAttribute('data-state', currentProps.present ? 'open' : 'closed');
    root.setAttribute('data-mounted', mounted ? 'true' : 'false');
    root.style.display = mounted ? '' : 'none';
    if (currentProps.children && mounted && !root.contains(currentProps.children)) {
      root.innerHTML = '';
      root.appendChild(currentProps.children);
    }
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) {
      const was = currentProps.present;
      Object.assign(currentProps, next);
      if (!was && currentProps.present) mounted = true;
      sync();
      if (was && !currentProps.present && !root.getAnimations?.().length) {
        mounted = false; sync(); currentProps.onExitComplete?.();
      }
    },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createPresence;
