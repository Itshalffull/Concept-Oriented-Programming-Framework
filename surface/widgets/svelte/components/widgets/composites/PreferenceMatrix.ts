import { uid } from '../shared/uid.js';

export interface PreferenceDef {
  eventKey: string;
  eventLabel: string;
  description?: string;
  group?: string;
  channels: Record<string, boolean>;
  locked?: Record<string, boolean>;
}

export interface ChannelDef {
  key: string;
  label: string;
}

export interface PreferenceGroupDef {
  key: string;
  name: string;
}

export interface PreferenceMatrixProps {
  preferences: PreferenceDef[];
  channels?: ChannelDef[] | string[];
  groups?: PreferenceGroupDef[];
  showSelectAll?: boolean;
  showDescriptions?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onChange?: (eventKey: string, channel: string, enabled: boolean) => void;
  onSave?: () => void;
  children?: string | HTMLElement;
}

export interface PreferenceMatrixInstance {
  element: HTMLElement;
  update(props: Partial<PreferenceMatrixProps>): void;
  destroy(): void;
}

export function createPreferenceMatrix(options: {
  target: HTMLElement;
  props: PreferenceMatrixProps;
}): PreferenceMatrixInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'preference-matrix');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'grid');
  root.setAttribute('aria-label', 'Notification preferences');
  root.id = id;

  const headerRowEl = document.createElement('div');
  headerRowEl.setAttribute('data-part', 'header-row');
  headerRowEl.setAttribute('role', 'row');
  root.appendChild(headerRowEl);

  const bodyEl = document.createElement('div');
  bodyEl.setAttribute('data-part', 'body');
  root.appendChild(bodyEl);

  function getChannels(): { key: string; label: string }[] {
    const ch = currentProps.channels ?? [];
    return ch.map(c => typeof c === 'string' ? { key: c, label: c } : c);
  }

  function renderHeader() {
    headerRowEl.innerHTML = '';
    const corner = document.createElement('span');
    corner.setAttribute('role', 'columnheader');
    corner.textContent = 'Event';
    headerRowEl.appendChild(corner);
    getChannels().forEach(ch => {
      const cell = document.createElement('span');
      cell.setAttribute('role', 'columnheader');
      cell.textContent = ch.label;
      headerRowEl.appendChild(cell);
    });
  }

  function renderBody() {
    bodyEl.innerHTML = '';
    currentProps.preferences.forEach(pref => {
      const row = document.createElement('div');
      row.setAttribute('data-part', 'pref-row');
      row.setAttribute('role', 'row');
      const label = document.createElement('span');
      label.setAttribute('role', 'rowheader');
      label.textContent = pref.eventLabel;
      row.appendChild(label);
      if (currentProps.showDescriptions && pref.description) {
        const desc = document.createElement('span');
        desc.setAttribute('data-part', 'pref-description');
        desc.textContent = pref.description;
        row.appendChild(desc);
      }
      getChannels().forEach(ch => {
        const cell = document.createElement('span');
        cell.setAttribute('role', 'gridcell');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!pref.channels[ch.key];
        cb.disabled = currentProps.disabled || !!(pref.locked?.[ch.key]);
        cb.setAttribute('aria-label', pref.eventLabel + ' via ' + ch.label);
        cb.addEventListener('change', () => currentProps.onChange?.(pref.eventKey, ch.key, cb.checked));
        cell.appendChild(cb);
        row.appendChild(cell);
      });
      bodyEl.appendChild(row);
    });
  }

  function sync() {
    const loading = currentProps.loading ?? false;
    root.setAttribute('data-state', loading ? 'loading' : 'idle');
    root.setAttribute('aria-busy', loading ? 'true' : 'false');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    renderHeader();
    renderBody();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createPreferenceMatrix;
