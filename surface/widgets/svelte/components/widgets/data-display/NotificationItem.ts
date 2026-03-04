import { uid } from '../shared/uid.js';
export interface NotificationItemProps { title?: string; description?: string; timestamp?: string; read?: boolean; avatar?: string; variant?: 'default'|'info'|'success'|'warning'|'error'; actions?: Array<{ label: string; onClick: () => void }>; onRead?: () => void; onDismiss?: () => void; className?: string; }
export interface NotificationItemInstance { element: HTMLElement; update(props: Partial<NotificationItemProps>): void; destroy(): void; }
export function createNotificationItem(options: { target: HTMLElement; props: NotificationItemProps; }): NotificationItemInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'notification-item'); root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'article');
  const contentEl = document.createElement('div'); contentEl.setAttribute('data-part', 'content'); root.appendChild(contentEl);
  const titleEl = document.createElement('div'); titleEl.setAttribute('data-part', 'title'); contentEl.appendChild(titleEl);
  const descEl = document.createElement('div'); descEl.setAttribute('data-part', 'description'); contentEl.appendChild(descEl);
  const timeEl = document.createElement('time'); timeEl.setAttribute('data-part', 'timestamp'); contentEl.appendChild(timeEl);
  const actionsEl = document.createElement('div'); actionsEl.setAttribute('data-part', 'actions'); root.appendChild(actionsEl);
  const dismissBtn = document.createElement('button'); dismissBtn.setAttribute('data-part', 'dismiss'); dismissBtn.type = 'button'; dismissBtn.setAttribute('aria-label', 'Dismiss'); dismissBtn.textContent = '\u00d7'; root.appendChild(dismissBtn);
  dismissBtn.addEventListener('click', () => currentProps.onDismiss?.());
  root.addEventListener('click', () => { if (!currentProps.read) { currentProps.read = true; currentProps.onRead?.(); sync(); } });
  function sync() {
    root.setAttribute('data-read', currentProps.read ? 'true' : 'false'); root.setAttribute('data-variant', currentProps.variant ?? 'default');
    titleEl.textContent = currentProps.title ?? ''; descEl.textContent = currentProps.description ?? '';
    timeEl.textContent = currentProps.timestamp ?? ''; timeEl.style.display = currentProps.timestamp ? '' : 'none';
    actionsEl.innerHTML = '';
    (currentProps.actions ?? []).forEach(a => { const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = a.label; btn.addEventListener('click', (e) => { e.stopPropagation(); a.onClick(); }); actionsEl.appendChild(btn); });
    actionsEl.style.display = (currentProps.actions?.length ?? 0) > 0 ? '' : 'none';
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createNotificationItem;
