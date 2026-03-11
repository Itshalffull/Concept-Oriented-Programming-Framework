import { uid } from '../shared/uid.js';
export interface TabsProps { value?: string; tabs?: Array<{ id: string; label: string; disabled?: boolean; content?: string | HTMLElement }>; orientation?: 'horizontal' | 'vertical'; onChange?: (value: string) => void; className?: string; }
export interface TabsInstance { element: HTMLElement; update(props: Partial<TabsProps>): void; destroy(): void; }
export function createTabs(options: { target: HTMLElement; props: TabsProps; }): TabsInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'tabs'); root.setAttribute('data-part', 'root');
  const listEl = document.createElement('div'); listEl.setAttribute('data-part', 'list'); listEl.setAttribute('role', 'tablist'); root.appendChild(listEl);
  const panelEl = document.createElement('div'); panelEl.setAttribute('data-part', 'panel-container'); root.appendChild(panelEl);
  function sync() {
    const tabs = currentProps.tabs ?? []; const val = currentProps.value ?? tabs[0]?.id;
    root.setAttribute('data-orientation', currentProps.orientation ?? 'horizontal');
    listEl.innerHTML = ''; panelEl.innerHTML = ''; cleanups.length = 0;
    tabs.forEach((tab, i) => {
      const btn = document.createElement('button'); btn.setAttribute('data-part', 'trigger'); btn.setAttribute('role', 'tab'); btn.setAttribute('type', 'button');
      btn.setAttribute('aria-selected', val === tab.id ? 'true' : 'false'); btn.setAttribute('aria-controls', id + '-panel-' + tab.id);
      btn.setAttribute('data-selected', val === tab.id ? 'true' : 'false'); btn.setAttribute('tabindex', val === tab.id ? '0' : '-1');
      btn.id = id + '-tab-' + tab.id; btn.disabled = tab.disabled ?? false; btn.textContent = tab.label;
      btn.addEventListener('click', () => { if (!tab.disabled) { currentProps.value = tab.id; currentProps.onChange?.(tab.id); sync(); } });
      btn.addEventListener('keydown', ((e: KeyboardEvent) => {
        const triggers = Array.from(listEl.querySelectorAll('[role="tab"]')) as HTMLElement[];
        const ci = triggers.indexOf(btn);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); triggers[(ci + 1) % triggers.length]?.focus(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); triggers[(ci - 1 + triggers.length) % triggers.length]?.focus(); }
      }) as EventListener);
      listEl.appendChild(btn);
    });
    const activeTab = tabs.find(t => t.id === val);
    if (activeTab) {
      const panel = document.createElement('div'); panel.setAttribute('data-part', 'panel'); panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', id + '-tab-' + activeTab.id); panel.id = id + '-panel-' + activeTab.id;
      if (activeTab.content) { if (typeof activeTab.content === 'string') panel.textContent = activeTab.content; else panel.appendChild(activeTab.content); }
      panelEl.appendChild(panel);
    }
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createTabs;
