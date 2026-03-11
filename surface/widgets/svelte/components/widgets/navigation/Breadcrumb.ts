import { uid } from '../shared/uid.js';
export interface BreadcrumbProps { items?: Array<{ label: string; href?: string; current?: boolean }>; separator?: string; className?: string; }
export interface BreadcrumbInstance { element: HTMLElement; update(props: Partial<BreadcrumbProps>): void; destroy(): void; }
export function createBreadcrumb(options: { target: HTMLElement; props: BreadcrumbProps; }): BreadcrumbInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('nav'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'breadcrumb'); root.setAttribute('data-part', 'root'); root.setAttribute('aria-label', 'Breadcrumb');
  const listEl = document.createElement('ol'); listEl.setAttribute('data-part', 'list'); root.appendChild(listEl);
  function sync() {
    const items = currentProps.items ?? []; const sep = currentProps.separator ?? '/';
    listEl.innerHTML = '';
    items.forEach((item, i) => {
      const li = document.createElement('li'); li.setAttribute('data-part', 'item');
      if (item.current) { const span = document.createElement('span'); span.setAttribute('data-part', 'current'); span.setAttribute('aria-current', 'page'); span.textContent = item.label; li.appendChild(span); }
      else if (item.href) { const a = document.createElement('a'); a.setAttribute('data-part', 'link'); a.href = item.href; a.textContent = item.label; li.appendChild(a); }
      else { li.textContent = item.label; }
      listEl.appendChild(li);
      if (i < items.length - 1) { const sepEl = document.createElement('li'); sepEl.setAttribute('data-part', 'separator'); sepEl.setAttribute('aria-hidden', 'true'); sepEl.textContent = sep; listEl.appendChild(sepEl); }
    });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createBreadcrumb;
