import { uid } from '../shared/uid.js';
export interface RatingProps { value?: number; max?: number; disabled?: boolean; readOnly?: boolean; size?: 'sm'|'md'|'lg'; label?: string; onChange?: (value: number) => void; className?: string; }
export interface RatingInstance { element: HTMLElement; update(props: Partial<RatingProps>): void; destroy(): void; }
export function createRating(options: { target: HTMLElement; props: RatingProps; }): RatingInstance {
  const { target, props } = options; let currentProps = { ...props }; const cleanups: (() => void)[] = []; let hoverVal = 0;
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'rating'); root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'radiogroup'); root.setAttribute('aria-label', currentProps.label ?? 'Rating');
  function sync() {
    const max = currentProps.max ?? 5; const val = currentProps.value ?? 0;
    root.setAttribute('data-size', currentProps.size ?? 'md'); root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-readonly', currentProps.readOnly ? 'true' : 'false');
    root.innerHTML = ''; cleanups.length = 0;
    for (let i = 1; i <= max; i++) {
      const star = document.createElement('span'); star.setAttribute('data-part', 'star'); star.setAttribute('role', 'radio');
      star.setAttribute('aria-checked', i <= val ? 'true' : 'false'); star.setAttribute('aria-label', i + ' star' + (i > 1 ? 's' : ''));
      star.setAttribute('data-filled', i <= (hoverVal || val) ? 'true' : 'false');
      star.setAttribute('tabindex', !currentProps.disabled && !currentProps.readOnly ? '0' : '-1');
      star.textContent = i <= (hoverVal || val) ? '\u2605' : '\u2606';
      if (!currentProps.disabled && !currentProps.readOnly) {
        star.addEventListener('click', () => { currentProps.value = i; currentProps.onChange?.(i); hoverVal = 0; sync(); });
        star.addEventListener('mouseenter', () => { hoverVal = i; sync(); });
        star.addEventListener('mouseleave', () => { hoverVal = 0; sync(); });
        star.addEventListener('keydown', ((e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); currentProps.value = i; currentProps.onChange?.(i); sync(); } }) as EventListener);
      }
      root.appendChild(star);
    }
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }
  sync(); target.appendChild(root);
  return { element: root, update(next) { Object.assign(currentProps, next); sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createRating;
