import { uid } from '../shared/uid.js';

export type ViewType = 'table' | 'board' | 'calendar' | 'timeline' | 'gallery';

export interface ViewDef {
  id: string;
  name: string;
  type: ViewType;
  config?: Record<string, unknown>;
}

export interface ViewSwitcherProps {
  views: ViewDef[];
  activeView: string;
  availableTypes?: ViewType[];
  allowAdd?: boolean;
  allowDelete?: boolean;
  allowRename?: boolean;
  allowDuplicate?: boolean;
  disabled?: boolean;
  onChange?: (views: ViewDef[], activeView: string) => void;
  renderContent?: (view: ViewDef) => string | HTMLElement;
  children?: string | HTMLElement;
}

export interface ViewSwitcherInstance {
  element: HTMLElement;
  update(props: Partial<ViewSwitcherProps>): void;
  destroy(): void;
}

export function createViewSwitcher(options: {
  target: HTMLElement;
  props: ViewSwitcherProps;
}): ViewSwitcherInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'view-switcher');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'View switcher');
  root.id = id;

  const tabBarEl = document.createElement('div');
  tabBarEl.setAttribute('data-part', 'tab-bar');
  tabBarEl.setAttribute('role', 'tablist');
  root.appendChild(tabBarEl);

  const addViewBtn = document.createElement('button');
  addViewBtn.setAttribute('data-part', 'add-view');
  addViewBtn.setAttribute('type', 'button');
  addViewBtn.setAttribute('aria-label', 'Add view');
  addViewBtn.textContent = '+';
  tabBarEl.appendChild(addViewBtn);

  const contentEl = document.createElement('div');
  contentEl.setAttribute('data-part', 'content');
  contentEl.setAttribute('role', 'tabpanel');
  root.appendChild(contentEl);

  addViewBtn.addEventListener('click', () => {
    const views = [...currentProps.views];
    const type = (currentProps.availableTypes ?? ['table'])[0];
    const newView: ViewDef = { id: uid(), name: 'New view', type };
    views.push(newView);
    currentProps.onChange?.(views, newView.id);
  });
  cleanups.push(() => {});

  function renderTabs() {
    tabBarEl.innerHTML = '';
    currentProps.views.forEach(v => {
      const tab = document.createElement('button');
      tab.setAttribute('data-part', 'view-tab');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('type', 'button');
      tab.setAttribute('aria-selected', v.id === currentProps.activeView ? 'true' : 'false');
      tab.textContent = v.name;
      tab.addEventListener('click', () => currentProps.onChange?.(currentProps.views, v.id));
      if (currentProps.allowDelete && currentProps.views.length > 1) {
        const delBtn = document.createElement('button');
        delBtn.setAttribute('type', 'button');
        delBtn.setAttribute('aria-label', 'Delete view ' + v.name);
        delBtn.textContent = '\u00d7';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const views = currentProps.views.filter(vw => vw.id !== v.id);
          const active = v.id === currentProps.activeView ? views[0]?.id ?? '' : currentProps.activeView;
          currentProps.onChange?.(views, active);
        });
        tab.appendChild(delBtn);
      }
      tabBarEl.appendChild(tab);
    });
    if (currentProps.allowAdd !== false) tabBarEl.appendChild(addViewBtn);
  }

  function renderContent() {
    contentEl.innerHTML = '';
    const active = currentProps.views.find(v => v.id === currentProps.activeView);
    if (active && currentProps.renderContent) {
      const rendered = currentProps.renderContent(active);
      if (typeof rendered === 'string') contentEl.innerHTML = rendered;
      else contentEl.appendChild(rendered);
    }
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
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

export default createViewSwitcher;
