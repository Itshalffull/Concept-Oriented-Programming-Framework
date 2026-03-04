import { uid } from '../shared/uid.js';

export interface PluginDetailPageProps {
  pluginName: string;
  authorName: string;
  version?: string;
  description?: string;
  readme?: string;
  changelog?: string;
  screenshots?: string[];
  rating?: number;
  ratingCount?: number;
  installCount?: number;
  tags?: string[];
  state?: 'available' | 'installed' | 'enabled';
  loading?: boolean;
  activeTab?: string;
  onInstall?: () => void;
  onUninstall?: () => void;
  onEnable?: () => void;
  onDisable?: () => void;
  onTabChange?: (tab: string) => void;
  renderMarkdown?: (source: string) => string;
  children?: string | HTMLElement;
}

export interface PluginDetailPageInstance {
  element: HTMLElement;
  update(props: Partial<PluginDetailPageProps>): void;
  destroy(): void;
}

export function createPluginDetailPage(options: {
  target: HTMLElement;
  props: PluginDetailPageProps;
}): PluginDetailPageInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'plugin-detail-page');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'article');
  root.id = id;

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  root.appendChild(headerEl);

  const nameEl = document.createElement('h1');
  nameEl.setAttribute('data-part', 'name');
  headerEl.appendChild(nameEl);

  const metaEl = document.createElement('div');
  metaEl.setAttribute('data-part', 'meta');
  headerEl.appendChild(metaEl);

  const actionBtn = document.createElement('button');
  actionBtn.setAttribute('data-part', 'action-button');
  actionBtn.setAttribute('type', 'button');
  headerEl.appendChild(actionBtn);

  const tabsEl = document.createElement('div');
  tabsEl.setAttribute('data-part', 'tabs');
  tabsEl.setAttribute('role', 'tablist');
  root.appendChild(tabsEl);

  const contentEl = document.createElement('div');
  contentEl.setAttribute('data-part', 'content');
  contentEl.setAttribute('role', 'tabpanel');
  root.appendChild(contentEl);

  actionBtn.addEventListener('click', () => {
    const st = currentProps.state ?? 'available';
    if (st === 'available') currentProps.onInstall?.();
    else if (st === 'installed') currentProps.onEnable?.();
    else currentProps.onDisable?.();
  });
  cleanups.push(() => {});

  function renderTabs() {
    tabsEl.innerHTML = '';
    const tabs = ['readme', 'changelog', 'screenshots'];
    tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-selected', tab === (currentProps.activeTab ?? 'readme') ? 'true' : 'false');
      btn.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
      btn.addEventListener('click', () => currentProps.onTabChange?.(tab));
      tabsEl.appendChild(btn);
    });
  }

  function renderContent() {
    contentEl.innerHTML = '';
    const tab = currentProps.activeTab ?? 'readme';
    if (tab === 'readme') {
      if (currentProps.renderMarkdown && currentProps.readme) contentEl.innerHTML = currentProps.renderMarkdown(currentProps.readme);
      else contentEl.textContent = currentProps.readme ?? '';
    } else if (tab === 'changelog') {
      if (currentProps.renderMarkdown && currentProps.changelog) contentEl.innerHTML = currentProps.renderMarkdown(currentProps.changelog);
      else contentEl.textContent = currentProps.changelog ?? '';
    } else if (tab === 'screenshots') {
      (currentProps.screenshots ?? []).forEach(src => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = 'Screenshot';
        contentEl.appendChild(img);
      });
    }
  }

  function sync() {
    const loading = currentProps.loading ?? false;
    const st = currentProps.state ?? 'available';
    root.setAttribute('data-state', loading ? 'loading' : st);
    root.setAttribute('aria-busy', loading ? 'true' : 'false');
    nameEl.textContent = currentProps.pluginName;
    metaEl.textContent = 'by ' + currentProps.authorName + (currentProps.version ? ' v' + currentProps.version : '');
    actionBtn.textContent = st === 'available' ? 'Install' : st === 'installed' ? 'Enable' : 'Disable';
    renderTabs();
    renderContent();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createPluginDetailPage;
