import { uid } from '../shared/uid.js';
export interface TimelineProps { items?: Array<{ id: string; title: string; description?: string; timestamp?: string; icon?: string; variant?: string }>; orientation?: 'vertical'|'horizontal'; className?: string; }
export interface TimelineInstance { element: HTMLElement; update(props: Partial<TimelineProps>): void; destroy(): void; }
export function createTimeline(options: { target: HTMLElement; props: TimelineProps; }): TimelineInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'timeline'); root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'list');
  function sync() {
    root.setAttribute('data-orientation', currentProps.orientation ?? 'vertical'); root.innerHTML = '';
    (currentProps.items ?? []).forEach(item => {
      const el = document.createElement('div'); el.setAttribute('data-part', 'item'); el.setAttribute('role', 'listitem');
      el.setAttribute('data-variant', item.variant ?? 'default');
      const indicator = document.createElement('div'); indicator.setAttribute('data-part', 'indicator');
      if (item.icon) indicator.textContent = item.icon; el.appendChild(indicator);
      const connector = document.createElement('div'); connector.setAttribute('data-part', 'connector'); el.appendChild(connector);
      const content = document.createElement('div'); content.setAttribute('data-part', 'content');
      const title = document.createElement('div'); title.setAttribute('data-part', 'title'); title.textContent = item.title; content.appendChild(title);
      if (item.description) { const desc = document.createElement('div'); desc.setAttribute('data-part', 'description'); desc.textContent = item.description; content.appendChild(desc); }
      if (item.timestamp) { const time = document.createElement('time'); time.setAttribute('data-part', 'timestamp'); time.textContent = item.timestamp; content.appendChild(time); }
      el.appendChild(content); root.appendChild(el);
    });
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createTimeline;
