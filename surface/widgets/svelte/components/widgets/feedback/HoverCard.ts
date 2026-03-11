import { uid } from '../shared/uid.js';

export interface HoverCardProps {
  content?: HTMLElement | string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  openDelay?: number;
  closeDelay?: number;
  children?: HTMLElement;
  className?: string;
}

export interface HoverCardInstance {
  element: HTMLElement;
  update(props: Partial<HoverCardProps>): void;
  destroy(): void;
}

export function createHoverCard(options: {
  target: HTMLElement;
  props: HoverCardProps;
}): HoverCardInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let open = false;
  let openTimer: any = null;
  let closeTimer: any = null;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'hover-card');
  root.setAttribute('data-part', 'root');

  const triggerEl = document.createElement('div');
  triggerEl.setAttribute('data-part', 'trigger');
  root.appendChild(triggerEl);

  const cardEl = document.createElement('div');
  cardEl.setAttribute('data-part', 'card');
  cardEl.setAttribute('role', 'tooltip');
  cardEl.id = id;
  root.appendChild(cardEl);

  function show() { clearTimeout(closeTimer); openTimer = setTimeout(() => { open = true; sync(); }, currentProps.openDelay ?? 200); }
  function hide() { clearTimeout(openTimer); closeTimer = setTimeout(() => { open = false; sync(); }, currentProps.closeDelay ?? 300); }

  triggerEl.addEventListener('mouseenter', show);
  triggerEl.addEventListener('mouseleave', hide);
  cardEl.addEventListener('mouseenter', () => clearTimeout(closeTimer));
  cardEl.addEventListener('mouseleave', hide);
  cleanups.push(() => { clearTimeout(openTimer); clearTimeout(closeTimer); });

  function sync() {
    root.setAttribute('data-state', open ? 'open' : 'closed');
    cardEl.setAttribute('data-placement', currentProps.placement ?? 'bottom');
    cardEl.style.display = open ? '' : 'none';
    triggerEl.setAttribute('aria-describedby', open ? id : '');
    if (currentProps.content) {
      cardEl.innerHTML = '';
      if (typeof currentProps.content === 'string') cardEl.textContent = currentProps.content;
      else cardEl.appendChild(currentProps.content);
    }
    if (currentProps.children && !triggerEl.contains(currentProps.children)) {
      triggerEl.innerHTML = '';
      triggerEl.appendChild(currentProps.children);
    }
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createHoverCard;
