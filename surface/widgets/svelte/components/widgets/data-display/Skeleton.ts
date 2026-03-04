import { uid } from '../shared/uid.js';
export interface SkeletonProps { variant?: 'text'|'circular'|'rectangular'; width?: string; height?: string; animation?: 'pulse'|'wave'|'none'; lines?: number; className?: string; }
export interface SkeletonInstance { element: HTMLElement; update(props: Partial<SkeletonProps>): void; destroy(): void; }
export function createSkeleton(options: { target: HTMLElement; props: SkeletonProps; }): SkeletonInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = [];
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'skeleton'); root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'status'); root.setAttribute('aria-label', 'Loading');
  function sync() {
    root.setAttribute('data-variant', currentProps.variant ?? 'text'); root.setAttribute('data-animation', currentProps.animation ?? 'pulse');
    root.innerHTML = '';
    const lines = currentProps.lines ?? 1;
    for (let i = 0; i < lines; i++) {
      const line = document.createElement('div'); line.setAttribute('data-part', 'line'); line.setAttribute('aria-hidden', 'true');
      if (currentProps.width) line.style.width = currentProps.width; if (currentProps.height) line.style.height = currentProps.height;
      if (currentProps.variant === 'circular') { line.style.borderRadius = '50%'; line.style.width = currentProps.width ?? '40px'; line.style.height = currentProps.height ?? '40px'; }
      root.appendChild(line);
    }
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createSkeleton;
