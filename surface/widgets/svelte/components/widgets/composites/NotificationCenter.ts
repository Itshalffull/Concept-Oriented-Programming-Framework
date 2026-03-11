import { uid } from '../shared/uid.js';

export interface NotificationDef {
  id: string;
  type: string;
  title: string;
  body?: string;
  timestamp: string;
  read: boolean;
}

export interface NotificationCenterProps {
  open?: boolean;
  notifications?: NotificationDef[];
  unreadCount?: number;
  activeTab?: string;
  tabs?: string[];
  loading?: boolean;
  hasMore?: boolean;
  placement?: string;
  onOpen?: () => void;
  onClose?: () => void;
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  onNavigate?: (id: string) => void;
  onLoadMore?: () => void;
  onTabChange?: (tab: string) => void;
  children?: string | HTMLElement;
}

export interface NotificationCenterInstance {
  element: HTMLElement;
  update(props: Partial<NotificationCenterProps>): void;
  destroy(): void;
}

export function createNotificationCenter(options: {
  target: HTMLElement;
  props: NotificationCenterProps;
}): NotificationCenterInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'notification-center');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Notifications');
  root.id = id;

  const triggerBtn = document.createElement('button');
  triggerBtn.setAttribute('data-part', 'trigger');
  triggerBtn.setAttribute('type', 'button');
  triggerBtn.setAttribute('aria-haspopup', 'true');
  root.appendChild(triggerBtn);

  const badgeEl = document.createElement('span');
  badgeEl.setAttribute('data-part', 'badge');
  badgeEl.setAttribute('aria-live', 'polite');
  triggerBtn.appendChild(badgeEl);

  const panelEl = document.createElement('div');
  panelEl.setAttribute('data-part', 'panel');
  panelEl.setAttribute('role', 'dialog');
  panelEl.setAttribute('aria-label', 'Notification panel');
  root.appendChild(panelEl);

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  panelEl.appendChild(headerEl);

  const markAllBtn = document.createElement('button');
  markAllBtn.setAttribute('data-part', 'mark-all-read');
  markAllBtn.setAttribute('type', 'button');
  markAllBtn.textContent = 'Mark all as read';
  headerEl.appendChild(markAllBtn);

  const tabsEl = document.createElement('div');
  tabsEl.setAttribute('data-part', 'tabs');
  tabsEl.setAttribute('role', 'tablist');
  panelEl.appendChild(tabsEl);

  const listEl = document.createElement('div');
  listEl.setAttribute('data-part', 'list');
  listEl.setAttribute('role', 'list');
  panelEl.appendChild(listEl);

  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.setAttribute('data-part', 'load-more');
  loadMoreBtn.setAttribute('type', 'button');
  loadMoreBtn.textContent = 'Load more';
  panelEl.appendChild(loadMoreBtn);

  triggerBtn.addEventListener('click', () => {
    if (currentProps.open) currentProps.onClose?.();
    else currentProps.onOpen?.();
  });
  cleanups.push(() => {});
  markAllBtn.addEventListener('click', () => currentProps.onMarkAllRead?.());
  loadMoreBtn.addEventListener('click', () => currentProps.onLoadMore?.());

  function renderTabs() {
    tabsEl.innerHTML = '';
    (currentProps.tabs ?? []).forEach(tab => {
      const btn = document.createElement('button');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-selected', tab === currentProps.activeTab ? 'true' : 'false');
      btn.textContent = tab;
      btn.addEventListener('click', () => currentProps.onTabChange?.(tab));
      tabsEl.appendChild(btn);
    });
  }

  function renderList() {
    listEl.innerHTML = '';
    (currentProps.notifications ?? []).forEach(n => {
      const item = document.createElement('div');
      item.setAttribute('data-part', 'notification-item');
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');
      item.setAttribute('data-read', n.read ? 'true' : 'false');
      const title = document.createElement('span');
      title.setAttribute('data-part', 'notification-title');
      title.textContent = n.title;
      item.appendChild(title);
      if (n.body) {
        const body = document.createElement('span');
        body.setAttribute('data-part', 'notification-body');
        body.textContent = n.body;
        item.appendChild(body);
      }
      const time = document.createElement('span');
      time.setAttribute('data-part', 'notification-time');
      time.textContent = n.timestamp;
      item.appendChild(time);
      item.addEventListener('click', () => {
        currentProps.onMarkRead?.(n.id);
        currentProps.onNavigate?.(n.id);
      });
      item.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') { currentProps.onMarkRead?.(n.id); currentProps.onNavigate?.(n.id); }
      });
      listEl.appendChild(item);
    });
  }

  function sync() {
    const open = currentProps.open ?? false;
    root.setAttribute('data-state', open ? 'open' : 'closed');
    panelEl.style.display = open ? '' : 'none';
    triggerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    const unread = currentProps.unreadCount ?? 0;
    badgeEl.textContent = unread > 0 ? String(unread) : '';
    badgeEl.style.display = unread > 0 ? '' : 'none';
    loadMoreBtn.style.display = currentProps.hasMore ? '' : 'none';
    root.setAttribute('aria-busy', currentProps.loading ? 'true' : 'false');
    renderTabs();
    renderList();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createNotificationCenter;
