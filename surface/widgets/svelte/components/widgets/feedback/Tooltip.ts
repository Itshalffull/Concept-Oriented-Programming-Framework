import { uid } from '../shared/uid.js';

export interface TooltipProps {
  content?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  children?: HTMLElement;
  className?: string;
}

export interface TooltipInstance {
  element: HTMLElement;
  update(props: Partial<TooltipProps>): void;
  destroy(): void;
}

export function createTooltip(options: {
  target: HTMLElement;
  props: TooltipProps;
}): TooltipInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let open = false;
  let timer: any = null;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'tooltip');
  root.setAttribute('data-part', 'root');

  const triggerEl = document.createElement('div');
  triggerEl.setAttribute('data-part', 'trigger');
  triggerEl.setAttribute('aria-describedby', id);
  root.appendChild(triggerEl);

  const tooltipEl = document.createElement('div');
  tooltipEl.setAttribute('data-part', 'tooltip');
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.id = id;
  root.appendChild(tooltipEl);

  const arrowEl = document.createElement('div');
  arrowEl.setAttribute('data-part', 'arrow');
  tooltipEl.appendChild(arrowEl);

  function show() { timer = setTimeout(() => { open = true; sync(); }, currentProps.delay ?? 200); }
  function hide() { clearTimeout(timer); open = false; sync(); }

  triggerEl.addEventListener('mouseenter', show);
  triggerEl.addEventListener('mouseleave', hide);
  triggerEl.addEventListener('focus', show);
  triggerEl.addEventListener('blur', hide);
  cleanups.push(() => clearTimeout(timer));

  function sync() {
    root.setAttribute('data-state', open ? 'open' : 'closed');
    tooltipEl.setAttribute('data-placement', currentProps.placement ?? 'top');
    tooltipEl.style.display = open ? '' : 'none';
    tooltipEl.textContent = currentProps.content ?? '';
    tooltipEl.appendChild(arrowEl);
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

export default createTooltip;
