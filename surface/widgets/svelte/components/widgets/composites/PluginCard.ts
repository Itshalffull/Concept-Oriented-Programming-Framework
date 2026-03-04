import { uid } from '../shared/uid.js';

export interface PluginCardProps {
  pluginId: string;
  pluginName: string;
  authorName: string;
  versionString?: string;
  descriptionText: string;
  ratingValue?: number;
  ratingCount?: number;
  installCountValue?: number;
  tags?: string[];
  iconUrl?: string;
  state?: 'available' | 'installed' | 'enabled';
  progress?: number;
  disabled?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
  onEnable?: () => void;
  onDisable?: () => void;
  renderIcon?: () => string | HTMLElement;
  children?: string | HTMLElement;
}

export interface PluginCardInstance {
  element: HTMLElement;
  update(props: Partial<PluginCardProps>): void;
  destroy(): void;
}

export function createPluginCard(options: {
  target: HTMLElement;
  props: PluginCardProps;
}): PluginCardInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'plugin-card');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'article');
  root.id = id;

  const iconEl = document.createElement('div');
  iconEl.setAttribute('data-part', 'icon');
  root.appendChild(iconEl);

  const bodyEl = document.createElement('div');
  bodyEl.setAttribute('data-part', 'body');
  root.appendChild(bodyEl);

  const nameEl = document.createElement('span');
  nameEl.setAttribute('data-part', 'name');
  bodyEl.appendChild(nameEl);

  const authorEl = document.createElement('span');
  authorEl.setAttribute('data-part', 'author');
  bodyEl.appendChild(authorEl);

  const versionEl = document.createElement('span');
  versionEl.setAttribute('data-part', 'version');
  bodyEl.appendChild(versionEl);

  const descEl = document.createElement('p');
  descEl.setAttribute('data-part', 'description');
  bodyEl.appendChild(descEl);

  const tagsEl = document.createElement('div');
  tagsEl.setAttribute('data-part', 'tags');
  tagsEl.setAttribute('role', 'list');
  bodyEl.appendChild(tagsEl);

  const ratingEl = document.createElement('div');
  ratingEl.setAttribute('data-part', 'rating');
  bodyEl.appendChild(ratingEl);

  const statsEl = document.createElement('span');
  statsEl.setAttribute('data-part', 'stats');
  bodyEl.appendChild(statsEl);

  const actionsEl = document.createElement('div');
  actionsEl.setAttribute('data-part', 'actions');
  root.appendChild(actionsEl);

  const primaryBtn = document.createElement('button');
  primaryBtn.setAttribute('data-part', 'primary-action');
  primaryBtn.setAttribute('type', 'button');
  actionsEl.appendChild(primaryBtn);

  const secondaryBtn = document.createElement('button');
  secondaryBtn.setAttribute('data-part', 'secondary-action');
  secondaryBtn.setAttribute('type', 'button');
  actionsEl.appendChild(secondaryBtn);

  primaryBtn.addEventListener('click', () => {
    const st = currentProps.state ?? 'available';
    if (st === 'available') currentProps.onInstall?.();
    else if (st === 'installed') currentProps.onEnable?.();
    else if (st === 'enabled') currentProps.onDisable?.();
  });
  cleanups.push(() => {});
  secondaryBtn.addEventListener('click', () => {
    currentProps.onUninstall?.();
  });

  function sync() {
    const st = currentProps.state ?? 'available';
    root.setAttribute('data-state', st);
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    nameEl.textContent = currentProps.pluginName;
    authorEl.textContent = 'by ' + currentProps.authorName;
    versionEl.textContent = currentProps.versionString ?? '';
    descEl.textContent = currentProps.descriptionText;
    if (currentProps.iconUrl) {
      iconEl.innerHTML = '';
      const img = document.createElement('img');
      img.src = currentProps.iconUrl;
      img.alt = currentProps.pluginName;
      iconEl.appendChild(img);
    } else if (currentProps.renderIcon) {
      iconEl.innerHTML = '';
      const rendered = currentProps.renderIcon();
      if (typeof rendered === 'string') iconEl.innerHTML = rendered;
      else iconEl.appendChild(rendered);
    }
    tagsEl.innerHTML = '';
    (currentProps.tags ?? []).forEach(t => {
      const tag = document.createElement('span');
      tag.setAttribute('role', 'listitem');
      tag.textContent = t;
      tagsEl.appendChild(tag);
    });
    if (currentProps.ratingValue != null) {
      ratingEl.textContent = '\u2605 ' + currentProps.ratingValue.toFixed(1) + (currentProps.ratingCount != null ? ' (' + currentProps.ratingCount + ')' : '');
      ratingEl.style.display = '';
    } else { ratingEl.style.display = 'none'; }
    statsEl.textContent = currentProps.installCountValue != null ? currentProps.installCountValue + ' installs' : '';
    primaryBtn.textContent = st === 'available' ? 'Install' : st === 'installed' ? 'Enable' : 'Disable';
    primaryBtn.disabled = currentProps.disabled ?? false;
    secondaryBtn.textContent = 'Uninstall';
    secondaryBtn.style.display = st !== 'available' ? '' : 'none';
    secondaryBtn.disabled = currentProps.disabled ?? false;
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createPluginCard;
