import { uid } from '../shared/uid.js';
export interface ListProps { items?: Array<{ id: string; primary: string; secondary?: string; icon?: string; href?: string; selected?: boolean; disabled?: boolean }>; selectable?: boolean; onSelect?: (id: string) => void; className?: string; }
export interface ListInstance { element: HTMLElement; update(props: Partial<ListProps>): void; destroy(): void; }
export function createList(options: { target: HTMLElement; props: ListProps; }): ListInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('ul'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'list'); root.setAttribute('data-part', 'root');
  root.setAttribute('role', currentProps.selectable ? 'listbox' : 'list');
  function sync() {
    root.innerHTML = ''; cleanups.length = 0;
    (currentProps.items ?? []).forEach(item => {
      const li = document.createElement('li'); li.setAttribute('data-part', 'item');
      li.setAttribute('role', currentProps.selectable ? 'option' : 'listitem');
      li.setAttribute('data-selected', item.selected ? 'true' : 'false');
      li.setAttribute('data-disabled', item.disabled ? 'true' : 'false');
      if (currentProps.selectable) { li.setAttribute('aria-selected', item.selected ? 'true' : 'false'); li.setAttribute('tabindex', '0'); }
      const primary = document.createElement('span'); primary.setAttribute('data-part', 'primary'); primary.textContent = item.primary; li.appendChild(primary);
      if (item.secondary) { const sec = document.createElement('span'); sec.setAttribute('data-part', 'secondary'); sec.textContent = item.secondary; li.appendChild(sec); }
      if (!item.disabled && currentProps.selectable) {
        const handler = () => currentProps.onSelect?.(item.id);
        li.addEventListener('click', handler); cleanups.push(() => li.removeEventListener('click', handler));
        li.addEventListener('keydown', ((e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } }) as EventListener);
      }
      root.appendChild(li);
    });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createList;
