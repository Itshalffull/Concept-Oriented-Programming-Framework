import { uid } from '../shared/uid.js';
export interface SidebarProps { collapsed?: boolean; items?: Array<{ id: string; label: string; icon?: string; href?: string; active?: boolean; children?: Array<{ id: string; label: string; href?: string; active?: boolean }> }>; onToggle?: (collapsed: boolean) => void; onNavigate?: (id: string) => void; className?: string; }
export interface SidebarInstance { element: HTMLElement; update(props: Partial<SidebarProps>): void; destroy(): void; }
export function createSidebar(options: { target: HTMLElement; props: SidebarProps; }): SidebarInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('aside'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'sidebar'); root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'navigation'); root.setAttribute('aria-label', 'Sidebar');
  const toggleBtn = document.createElement('button'); toggleBtn.setAttribute('data-part', 'toggle'); toggleBtn.setAttribute('type', 'button');
  toggleBtn.setAttribute('aria-label', 'Toggle sidebar'); root.appendChild(toggleBtn);
  toggleBtn.addEventListener('click', () => { currentProps.collapsed = !currentProps.collapsed; currentProps.onToggle?.(currentProps.collapsed); sync(); });
  const navEl = document.createElement('nav'); navEl.setAttribute('data-part', 'nav'); root.appendChild(navEl);
  function sync() {
    root.setAttribute('data-collapsed', currentProps.collapsed ? 'true' : 'false');
    navEl.innerHTML = ''; cleanups.length = 0;
    (currentProps.items ?? []).forEach(item => {
      const el = document.createElement('div'); el.setAttribute('data-part', 'item'); el.setAttribute('data-active', item.active ? 'true' : 'false');
      const link = document.createElement('a'); link.setAttribute('data-part', 'link'); if (item.href) link.href = item.href;
      link.textContent = currentProps.collapsed ? '' : item.label; link.setAttribute('aria-label', item.label);
      link.addEventListener('click', (e) => { e.preventDefault(); currentProps.onNavigate?.(item.id); });
      el.appendChild(link);
      if (item.children?.length && !currentProps.collapsed) {
        const subList = document.createElement('div'); subList.setAttribute('data-part', 'sub-items');
        item.children.forEach(child => {
          const subLink = document.createElement('a'); subLink.setAttribute('data-part', 'sub-link'); subLink.setAttribute('data-active', child.active ? 'true' : 'false');
          if (child.href) subLink.href = child.href; subLink.textContent = child.label;
          subLink.addEventListener('click', (e) => { e.preventDefault(); currentProps.onNavigate?.(child.id); });
          subList.appendChild(subLink);
        });
        el.appendChild(subList);
      }
      navEl.appendChild(el);
    });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createSidebar;
