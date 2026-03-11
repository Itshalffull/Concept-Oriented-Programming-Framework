import { uid } from '../shared/uid.js';
export interface SplitterProps { orientation?: 'horizontal' | 'vertical'; defaultSize?: number; min?: number; max?: number; children?: [HTMLElement, HTMLElement]; onResize?: (size: number) => void; className?: string; }
export interface SplitterInstance { element: HTMLElement; update(props: Partial<SplitterProps>): void; destroy(): void; }
export function createSplitter(options: { target: HTMLElement; props: SplitterProps; }): SplitterInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  let size = currentProps.defaultSize ?? 50; let dragging = false;
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'splitter'); root.setAttribute('data-part', 'root');
  const panelA = document.createElement('div'); panelA.setAttribute('data-part', 'panel-a'); root.appendChild(panelA);
  const handle = document.createElement('div'); handle.setAttribute('data-part', 'handle'); handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-valuenow', String(size)); handle.setAttribute('tabindex', '0'); root.appendChild(handle);
  const panelB = document.createElement('div'); panelB.setAttribute('data-part', 'panel-b'); root.appendChild(panelB);
  function clamp(v: number) { return Math.max(currentProps.min ?? 10, Math.min(currentProps.max ?? 90, v)); }
  handle.addEventListener('mousedown', () => { dragging = true; });
  const handleMove = (e: MouseEvent) => {
    if (!dragging) return; const rect = root.getBoundingClientRect();
    const isH = (currentProps.orientation ?? 'horizontal') === 'horizontal';
    const pct = isH ? ((e.clientX - rect.left) / rect.width) * 100 : ((e.clientY - rect.top) / rect.height) * 100;
    size = clamp(pct); currentProps.onResize?.(size); sync();
  };
  const handleUp = () => { dragging = false; };
  document.addEventListener('mousemove', handleMove); document.addEventListener('mouseup', handleUp);
  cleanups.push(() => { document.removeEventListener('mousemove', handleMove); document.removeEventListener('mouseup', handleUp); });
  handle.addEventListener('keydown', ((e: KeyboardEvent) => {
    const step = 2;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); size = clamp(size + step); currentProps.onResize?.(size); sync(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); size = clamp(size - step); currentProps.onResize?.(size); sync(); }
  }) as EventListener);
  function sync() {
    const isH = (currentProps.orientation ?? 'horizontal') === 'horizontal';
    root.setAttribute('data-orientation', currentProps.orientation ?? 'horizontal');
    root.style.display = 'flex'; root.style.flexDirection = isH ? 'row' : 'column';
    panelA.style[isH ? 'width' : 'height'] = size + '%'; panelB.style[isH ? 'width' : 'height'] = (100 - size) + '%';
    handle.setAttribute('aria-valuenow', String(Math.round(size)));
    handle.setAttribute('aria-orientation', currentProps.orientation ?? 'horizontal');
    if (currentProps.children) {
      if (currentProps.children[0] && !panelA.contains(currentProps.children[0])) { panelA.innerHTML = ''; panelA.appendChild(currentProps.children[0]); }
      if (currentProps.children[1] && !panelB.contains(currentProps.children[1])) { panelB.innerHTML = ''; panelB.appendChild(currentProps.children[1]); }
    }
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createSplitter;
