import { uid } from '../shared/uid.js';

export interface LinkedRef {
  sourceId: string;
  sourceTitle: string;
  sourcePath: string[];
  contextSnippet: string;
  highlightRange?: { start: number; end: number };
}

export interface UnlinkedRef {
  sourceId: string;
  sourceTitle: string;
  mentionId: string;
  contextSnippet: string;
}

export interface BacklinkPanelProps {
  targetId: string;
  targetTitle: string;
  linkedReferences?: LinkedRef[];
  unlinkedMentions?: UnlinkedRef[];
  loading?: boolean;
  showUnlinked?: boolean;
  contextChars?: number;
  onNavigate?: (sourceId: string) => void;
  onLink?: (sourceId: string, mentionId: string) => void;
  children?: string | HTMLElement;
}

export interface BacklinkPanelInstance {
  element: HTMLElement;
  update(props: Partial<BacklinkPanelProps>): void;
  destroy(): void;
}

export function createBacklinkPanel(options: {
  target: HTMLElement;
  props: BacklinkPanelProps;
}): BacklinkPanelInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let collapsed = false;
  let unlinkedCollapsed = true;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'backlink-panel');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'complementary');
  root.id = id;

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  root.appendChild(headerEl);

  const titleEl = document.createElement('span');
  titleEl.setAttribute('data-part', 'title');
  headerEl.appendChild(titleEl);

  const countEl = document.createElement('span');
  countEl.setAttribute('data-part', 'count');
  headerEl.appendChild(countEl);

  const collapseToggleEl = document.createElement('button');
  collapseToggleEl.setAttribute('data-part', 'collapse-toggle');
  collapseToggleEl.setAttribute('type', 'button');
  collapseToggleEl.setAttribute('aria-label', 'Toggle backlinks panel');
  headerEl.appendChild(collapseToggleEl);

  const linkedSectionEl = document.createElement('div');
  linkedSectionEl.setAttribute('data-part', 'linked-section');
  linkedSectionEl.setAttribute('role', 'region');
  linkedSectionEl.setAttribute('aria-label', 'Linked mentions');
  root.appendChild(linkedSectionEl);

  const linkedListEl = document.createElement('div');
  linkedListEl.setAttribute('data-part', 'linked-list');
  linkedListEl.setAttribute('role', 'list');
  linkedListEl.setAttribute('aria-label', 'Linked references');
  linkedSectionEl.appendChild(linkedListEl);

  const unlinkedSectionEl = document.createElement('div');
  unlinkedSectionEl.setAttribute('data-part', 'unlinked-section');
  unlinkedSectionEl.setAttribute('role', 'region');
  unlinkedSectionEl.setAttribute('aria-label', 'Unlinked mentions');
  root.appendChild(unlinkedSectionEl);

  const unlinkedToggleEl = document.createElement('button');
  unlinkedToggleEl.setAttribute('data-part', 'unlinked-toggle');
  unlinkedToggleEl.setAttribute('type', 'button');
  unlinkedToggleEl.setAttribute('aria-expanded', 'false');
  unlinkedSectionEl.appendChild(unlinkedToggleEl);

  const unlinkedListEl = document.createElement('div');
  unlinkedListEl.setAttribute('data-part', 'unlinked-list');
  unlinkedListEl.setAttribute('role', 'list');
  unlinkedListEl.setAttribute('aria-label', 'Unlinked mentions');
  unlinkedSectionEl.appendChild(unlinkedListEl);

  function renderLinkedItems() {
    linkedListEl.innerHTML = '';
    const refs = currentProps.linkedReferences ?? [];
    refs.forEach(ref => {
      const item = document.createElement('div');
      item.setAttribute('data-part', 'linked-item');
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');
      const titleSpan = document.createElement('span');
      titleSpan.setAttribute('data-part', 'linked-item-title');
      titleSpan.textContent = ref.sourceTitle;
      item.appendChild(titleSpan);
      if (ref.sourcePath.length) {
        const breadcrumb = document.createElement('nav');
        breadcrumb.setAttribute('data-part', 'linked-item-breadcrumb');
        breadcrumb.textContent = ref.sourcePath.join(' > ');
        item.appendChild(breadcrumb);
      }
      const ctx = document.createElement('span');
      ctx.setAttribute('data-part', 'linked-item-context');
      ctx.textContent = ref.contextSnippet;
      item.appendChild(ctx);
      item.addEventListener('click', () => currentProps.onNavigate?.(ref.sourceId));
      item.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') currentProps.onNavigate?.(ref.sourceId); });
      linkedListEl.appendChild(item);
    });
  }

  function renderUnlinkedItems() {
    unlinkedListEl.innerHTML = '';
    const mentions = currentProps.unlinkedMentions ?? [];
    mentions.forEach(ref => {
      const item = document.createElement('div');
      item.setAttribute('data-part', 'unlinked-item');
      item.setAttribute('role', 'listitem');
      const titleSpan = document.createElement('span');
      titleSpan.textContent = ref.sourceTitle;
      item.appendChild(titleSpan);
      const linkBtn = document.createElement('button');
      linkBtn.setAttribute('type', 'button');
      linkBtn.setAttribute('data-part', 'link-button');
      linkBtn.setAttribute('aria-label', 'Link mention from ' + ref.sourceTitle);
      linkBtn.textContent = 'Link';
      linkBtn.addEventListener('click', () => currentProps.onLink?.(ref.sourceId, ref.mentionId));
      item.appendChild(linkBtn);
      unlinkedListEl.appendChild(item);
    });
  }

  collapseToggleEl.addEventListener('click', () => {
    collapsed = !collapsed;
    sync();
  });
  cleanups.push(() => {});

  unlinkedToggleEl.addEventListener('click', () => {
    unlinkedCollapsed = !unlinkedCollapsed;
    sync();
  });

  function sync() {
    const loading = currentProps.loading ?? false;
    root.setAttribute('data-state', loading ? 'loading' : collapsed ? 'collapsed' : 'idle');
    root.setAttribute('aria-busy', loading ? 'true' : 'false');
    root.setAttribute('aria-label', 'Backlinks to ' + (currentProps.targetTitle ?? ''));
    titleEl.textContent = 'Backlinks';
    const linkedCount = (currentProps.linkedReferences ?? []).length;
    const unlinkedCount = (currentProps.unlinkedMentions ?? []).length;
    countEl.textContent = String(linkedCount + unlinkedCount);
    collapseToggleEl.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    collapseToggleEl.textContent = collapsed ? 'Expand' : 'Collapse';
    linkedSectionEl.style.display = collapsed ? 'none' : '';
    unlinkedSectionEl.style.display = (collapsed || !currentProps.showUnlinked) ? 'none' : '';
    unlinkedToggleEl.setAttribute('aria-expanded', unlinkedCollapsed ? 'false' : 'true');
    unlinkedToggleEl.textContent = 'Unlinked mentions (' + unlinkedCount + ')';
    unlinkedListEl.style.display = unlinkedCollapsed ? 'none' : '';
    renderLinkedItems();
    renderUnlinkedItems();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createBacklinkPanel;
