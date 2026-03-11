import { uid } from '../shared/uid.js';

export interface OutlineNode {
  id: string;
  content: string;
  children?: OutlineNode[];
  collapsed?: boolean;
}

export interface OutlinerProps {
  nodes: OutlineNode[];
  selectedId?: string;
  readOnly?: boolean;
  indent?: number;
  onNodesChange?: (nodes: OutlineNode[]) => void;
  onSelect?: (id: string) => void;
  children?: string | HTMLElement;
}

export interface OutlinerInstance {
  element: HTMLElement;
  update(props: Partial<OutlinerProps>): void;
  destroy(): void;
}

export function createOutliner(options: {
  target: HTMLElement;
  props: OutlinerProps;
}): OutlinerInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'outliner');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'tree');
  root.setAttribute('aria-label', 'Outliner');
  root.id = id;

  function renderNode(node: OutlineNode, depth: number, container: HTMLElement) {
    const item = document.createElement('div');
    item.setAttribute('data-part', 'outline-item');
    item.setAttribute('role', 'treeitem');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-expanded', node.collapsed ? 'false' : 'true');
    item.setAttribute('aria-selected', node.id === currentProps.selectedId ? 'true' : 'false');
    item.style.paddingLeft = (depth * (currentProps.indent ?? 24)) + 'px';

    const toggle = document.createElement('button');
    toggle.setAttribute('data-part', 'toggle');
    toggle.setAttribute('type', 'button');
    toggle.setAttribute('aria-label', node.collapsed ? 'Expand' : 'Collapse');
    toggle.textContent = (node.children?.length ?? 0) > 0 ? (node.collapsed ? '\u25b6' : '\u25bc') : ' ';
    toggle.addEventListener('click', (e) => { e.stopPropagation(); node.collapsed = !node.collapsed; sync(); });
    item.appendChild(toggle);

    const contentEl = document.createElement('span');
    contentEl.setAttribute('data-part', 'content');
    contentEl.setAttribute('contenteditable', currentProps.readOnly ? 'false' : 'true');
    contentEl.textContent = node.content;
    contentEl.addEventListener('input', () => { node.content = contentEl.textContent ?? ''; currentProps.onNodesChange?.(currentProps.nodes); });
    item.appendChild(contentEl);

    item.addEventListener('click', () => currentProps.onSelect?.(node.id));
    item.addEventListener('keydown', ((e: KeyboardEvent) => { if (e.key === 'Enter') currentProps.onSelect?.(node.id); }) as EventListener);

    container.appendChild(item);
    if (!node.collapsed && node.children) {
      const group = document.createElement('div');
      group.setAttribute('role', 'group');
      node.children.forEach(child => renderNode(child, depth + 1, group));
      container.appendChild(group);
    }
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    root.setAttribute('data-readonly', currentProps.readOnly ? 'true' : 'false');
    root.innerHTML = '';
    currentProps.nodes.forEach(node => renderNode(node, 0, root));
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createOutliner;
