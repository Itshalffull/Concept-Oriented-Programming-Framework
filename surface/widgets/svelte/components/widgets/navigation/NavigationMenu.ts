import { uid } from '../shared/uid.js';
export interface NavigationMenuProps { items?: Array<{ label: string; href?: string; active?: boolean; children?: Array<{ label: string; href: string; description?: string }> }>; orientation?: 'horizontal' | 'vertical'; className?: string; }
export interface NavigationMenuInstance { element: HTMLElement; update(props: Partial<NavigationMenuProps>): void; destroy(): void; }
export function createNavigationMenu(options: { target: HTMLElement; props: NavigationMenuProps; }): NavigationMenuInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = [];
  let openIdx = -1;
  const root = document.createElement('nav'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'navigation-menu'); root.setAttribute('data-part', 'root');
  const listEl = document.createElement('ul'); listEl.setAttribute('data-part', 'list'); listEl.setAttribute('role', 'menubar'); root.appendChild(listEl);
  function sync() {
    const items = currentProps.items ?? [];
    root.setAttribute('data-orientation', currentProps.orientation ?? 'horizontal');
    listEl.innerHTML = ''; cleanups.length = 0;
    items.forEach((item, i) => {
      const li = document.createElement('li'); li.setAttribute('data-part', 'item'); li.setAttribute('role', 'none');
      if (item.children?.length) {
        const trigger = document.createElement('button'); trigger.setAttribute('data-part', 'trigger'); trigger.setAttribute('type', 'button');
        trigger.setAttribute('role', 'menuitem'); trigger.setAttribute('aria-expanded', i === openIdx ? 'true' : 'false');
        trigger.setAttribute('data-active', item.active ? 'true' : 'false'); trigger.textContent = item.label;
        trigger.addEventListener('click', () => { openIdx = openIdx === i ? -1 : i; sync(); });
        li.appendChild(trigger);
        if (i === openIdx) {
          const submenu = document.createElement('ul'); submenu.setAttribute('data-part', 'submenu'); submenu.setAttribute('role', 'menu');
          item.children.forEach(child => {
            const subLi = document.createElement('li'); subLi.setAttribute('role', 'none');
            const a = document.createElement('a'); a.setAttribute('role', 'menuitem'); a.href = child.href; a.textContent = child.label;
            if (child.description) { const desc = document.createElement('span'); desc.textContent = child.description; a.appendChild(desc); }
            subLi.appendChild(a); submenu.appendChild(subLi);
          });
          li.appendChild(submenu);
        }
      } else {
        const link = document.createElement('a'); link.setAttribute('data-part', 'link'); link.setAttribute('role', 'menuitem');
        link.setAttribute('data-active', item.active ? 'true' : 'false');
        if (item.href) link.href = item.href; link.textContent = item.label; li.appendChild(link);
      }
      listEl.appendChild(li);
    });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  document.addEventListener('click', (e) => { if (!root.contains(e.target as Node) && openIdx >= 0) { openIdx = -1; sync(); } });
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createNavigationMenu;
