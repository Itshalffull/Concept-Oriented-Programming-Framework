import { uid } from '../shared/uid.js';
export interface CardProps { variant?: 'elevated'|'filled'|'outlined'; clickable?: boolean; href?: string; padding?: 'none'|'sm'|'md'|'lg'; size?: 'sm'|'md'|'lg'; header?: string|HTMLElement; media?: string|HTMLElement; footer?: string|HTMLElement; actions?: string|HTMLElement; title?: string; description?: string; onClick?: (e?: Event) => void; className?: string; children?: string|HTMLElement; }
export interface CardInstance { element: HTMLElement; update(props: Partial<CardProps>): void; destroy(): void; }
export function createCard(options: { target: HTMLElement; props: CardProps; }): CardInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = []; let state = 'idle';
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'card'); root.setAttribute('data-part', 'root');
  const headerEl = document.createElement('div'); headerEl.setAttribute('data-part', 'header'); root.appendChild(headerEl);
  const mediaEl = document.createElement('div'); mediaEl.setAttribute('data-part', 'media'); root.appendChild(mediaEl);
  const bodyEl = document.createElement('div'); bodyEl.setAttribute('data-part', 'body'); root.appendChild(bodyEl);
  const titleEl = document.createElement('div'); titleEl.setAttribute('data-part', 'title'); bodyEl.appendChild(titleEl);
  const descEl = document.createElement('div'); descEl.setAttribute('data-part', 'description'); bodyEl.appendChild(descEl);
  const footerEl = document.createElement('div'); footerEl.setAttribute('data-part', 'footer'); root.appendChild(footerEl);
  const actionsEl = document.createElement('div'); actionsEl.setAttribute('data-part', 'actions'); actionsEl.setAttribute('role', 'group'); root.appendChild(actionsEl);
  root.addEventListener('click', (e) => { if (currentProps.clickable) currentProps.onClick?.(e); });
  root.addEventListener('keydown', ((e: KeyboardEvent) => { if (currentProps.clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); currentProps.onClick?.(e); } }) as EventListener);
  root.addEventListener('mouseenter', () => { if (currentProps.clickable) { state = 'hovered'; sync(); } });
  root.addEventListener('mouseleave', () => { state = 'idle'; sync(); });
  function setSlot(el: HTMLElement, c?: string|HTMLElement) { el.innerHTML = ''; if (typeof c === 'string') el.textContent = c; else if (c instanceof HTMLElement) el.appendChild(c); }
  function sync() {
    root.setAttribute('data-state', state); root.setAttribute('data-variant', currentProps.variant ?? 'elevated');
    root.setAttribute('data-size', currentProps.size ?? 'md'); root.setAttribute('data-padding', currentProps.padding ?? 'md');
    root.setAttribute('data-clickable', currentProps.clickable ? 'true' : 'false');
    if (currentProps.clickable) { root.setAttribute('role', 'button'); root.setAttribute('tabindex', '0'); } else { root.removeAttribute('role'); root.removeAttribute('tabindex'); }
    titleEl.textContent = currentProps.title ?? ''; titleEl.style.display = currentProps.title ? '' : 'none';
    descEl.textContent = currentProps.description ?? ''; descEl.style.display = currentProps.description ? '' : 'none';
    setSlot(headerEl, currentProps.header); headerEl.style.display = currentProps.header ? '' : 'none';
    setSlot(mediaEl, currentProps.media); mediaEl.style.display = currentProps.media ? '' : 'none';
    setSlot(footerEl, currentProps.footer); footerEl.style.display = currentProps.footer ? '' : 'none';
    setSlot(actionsEl, currentProps.actions); actionsEl.style.display = currentProps.actions ? '' : 'none';
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createCard;
