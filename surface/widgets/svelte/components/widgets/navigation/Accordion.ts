import { uid } from '../shared/uid.js';
export interface AccordionProps { items?: Array<{ id: string; title: string; content?: string | HTMLElement; disabled?: boolean }>; type?: 'single' | 'multiple'; value?: string[]; collapsible?: boolean; onChange?: (value: string[]) => void; className?: string; }
export interface AccordionInstance { element: HTMLElement; update(props: Partial<AccordionProps>): void; destroy(): void; }
export function createAccordion(options: { target: HTMLElement; props: AccordionProps; }): AccordionInstance {
  const { target, props } = options; let currentProps = { ...props }; const baseId = uid(); const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'accordion'); root.setAttribute('data-part', 'root');
  function toggle(itemId: string) {
    let vals = [...(currentProps.value ?? [])];
    const idx = vals.indexOf(itemId);
    if (idx >= 0) { if (currentProps.collapsible !== false || vals.length > 1) vals.splice(idx, 1); }
    else { if (currentProps.type === 'single') vals = [itemId]; else vals.push(itemId); }
    currentProps.value = vals; currentProps.onChange?.(vals); sync();
  }
  function sync() {
    const items = currentProps.items ?? []; const vals = currentProps.value ?? [];
    root.setAttribute('data-type', currentProps.type ?? 'single');
    root.innerHTML = ''; cleanups.length = 0;
    items.forEach((item, i) => {
      const itemEl = document.createElement('div'); itemEl.setAttribute('data-part', 'item'); itemEl.setAttribute('data-state', vals.includes(item.id) ? 'open' : 'closed');
      const trigger = document.createElement('button'); trigger.setAttribute('data-part', 'trigger'); trigger.setAttribute('type', 'button');
      trigger.setAttribute('aria-expanded', vals.includes(item.id) ? 'true' : 'false');
      trigger.setAttribute('aria-controls', baseId + '-panel-' + item.id); trigger.id = baseId + '-trigger-' + item.id;
      trigger.disabled = item.disabled ?? false; trigger.textContent = item.title;
      const handler = () => { if (!item.disabled) toggle(item.id); };
      trigger.addEventListener('click', handler); cleanups.push(() => trigger.removeEventListener('click', handler));
      trigger.addEventListener('keydown', ((e: KeyboardEvent) => {
        const triggers = Array.from(root.querySelectorAll('[data-part="trigger"]')) as HTMLElement[];
        const ci = triggers.indexOf(trigger);
        if (e.key === 'ArrowDown') { e.preventDefault(); triggers[(ci + 1) % triggers.length]?.focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); triggers[(ci - 1 + triggers.length) % triggers.length]?.focus(); }
        if (e.key === 'Home') { e.preventDefault(); triggers[0]?.focus(); }
        if (e.key === 'End') { e.preventDefault(); triggers[triggers.length - 1]?.focus(); }
      }) as EventListener);
      itemEl.appendChild(trigger);
      const panel = document.createElement('div'); panel.setAttribute('data-part', 'panel'); panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', baseId + '-trigger-' + item.id); panel.id = baseId + '-panel-' + item.id;
      panel.style.display = vals.includes(item.id) ? '' : 'none';
      if (item.content) { if (typeof item.content === 'string') panel.textContent = item.content; else panel.appendChild(item.content); }
      itemEl.appendChild(panel); root.appendChild(itemEl);
    });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createAccordion;
