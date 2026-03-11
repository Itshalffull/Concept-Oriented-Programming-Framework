import { uid } from '../shared/uid.js';
export interface TreeNode { id: string; label: string; children?: TreeNode[]; disabled?: boolean; }
export interface TreeSelectProps { value?: string[]; nodes?: TreeNode[]; multiple?: boolean; placeholder?: string; label?: string; onChange?: (value: string[]) => void; className?: string; }
export interface TreeSelectInstance { element: HTMLElement; update(props: Partial<TreeSelectProps>): void; destroy(): void; }
export function createTreeSelect(options: { target: HTMLElement; props: TreeSelectProps; }): TreeSelectInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = [];
  let open = false; const expanded = new Set<string>();
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'tree-select'); root.setAttribute('data-part', 'root');
  const labelEl = document.createElement('label'); labelEl.setAttribute('data-part', 'label'); root.appendChild(labelEl);
  const triggerEl = document.createElement('button'); triggerEl.type = 'button'; triggerEl.setAttribute('data-part', 'trigger'); triggerEl.setAttribute('aria-haspopup', 'tree'); root.appendChild(triggerEl);
  const treeEl = document.createElement('div'); treeEl.setAttribute('data-part', 'tree'); treeEl.setAttribute('role', 'tree'); root.appendChild(treeEl);
  triggerEl.addEventListener('click', () => { open = !open; sync(); });
  document.addEventListener('click', (e) => { if (open && !root.contains(e.target as Node)) { open = false; sync(); } });
  function toggleVal(nodeId: string) {
    const vals = [...(currentProps.value ?? [])]; const idx = vals.indexOf(nodeId);
    if (idx >= 0) vals.splice(idx, 1); else { if (!currentProps.multiple) vals.length = 0; vals.push(nodeId); }
    currentProps.value = vals; currentProps.onChange?.(vals); if (!currentProps.multiple) open = false; sync();
  }
  function renderNode(node: TreeNode, container: HTMLElement, depth: number) {
    const el = document.createElement('div'); el.setAttribute('data-part', 'node'); el.setAttribute('role', 'treeitem');
    el.setAttribute('aria-expanded', expanded.has(node.id) ? 'true' : 'false');
    el.setAttribute('data-selected', (currentProps.value ?? []).includes(node.id) ? 'true' : 'false');
    el.style.paddingLeft = (depth * 16) + 'px';
    if (node.children?.length) {
      const toggle = document.createElement('span'); toggle.setAttribute('data-part', 'toggle'); toggle.textContent = expanded.has(node.id) ? '\u25be' : '\u25b8';
      toggle.addEventListener('click', (e) => { e.stopPropagation(); if (expanded.has(node.id)) expanded.delete(node.id); else expanded.add(node.id); sync(); });
      el.appendChild(toggle);
    }
    const label = document.createElement('span'); label.textContent = node.label;
    if (!node.disabled) el.addEventListener('click', () => toggleVal(node.id));
    el.appendChild(label); container.appendChild(el);
    if (node.children && expanded.has(node.id)) node.children.forEach(c => renderNode(c, container, depth + 1));
  }
  function sync() {
    const vals = currentProps.value ?? [];
    root.setAttribute('data-state', open ? 'open' : 'closed');
    triggerEl.textContent = vals.length ? vals.join(', ') : (currentProps.placeholder ?? 'Select...');
    labelEl.textContent = currentProps.label ?? ''; labelEl.style.display = currentProps.label ? '' : 'none';
    treeEl.innerHTML = ''; treeEl.style.display = open ? '' : 'none';
    (currentProps.nodes ?? []).forEach(n => renderNode(n, treeEl, 0));
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createTreeSelect;
