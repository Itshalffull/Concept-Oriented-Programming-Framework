import { uid } from '../shared/uid.js';
export interface AvatarProps { src?: string; alt?: string; name?: string; size?: 'xs'|'sm'|'md'|'lg'|'xl'; shape?: 'circle'|'square'; className?: string; }
export interface AvatarInstance { element: HTMLElement; update(props: Partial<AvatarProps>): void; destroy(): void; }
function getInitials(name: string): string { return name.split(/s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2); }
export function createAvatar(options: { target: HTMLElement; props: AvatarProps; }): AvatarInstance {
  const { target, props } = options; let currentProps = { ...props }; const id = uid(); const cleanups: (() => void)[] = [];
  let loadState: 'loading'|'loaded'|'error' = currentProps.src ? 'loading' : 'error';
  const root = document.createElement('div'); root.setAttribute('data-surface-widget', ''); root.setAttribute('data-widget-name', 'avatar'); root.setAttribute('data-part', 'root'); root.setAttribute('role', 'img');
  const imageEl = document.createElement('img'); imageEl.setAttribute('data-part', 'image');
  const fallbackEl = document.createElement('span'); fallbackEl.setAttribute('data-part', 'fallback'); fallbackEl.setAttribute('aria-hidden', 'true');
  function onLoad() { loadState = 'loaded'; sync(); } function onError() { loadState = 'error'; sync(); }
  imageEl.addEventListener('load', onLoad); imageEl.addEventListener('error', onError);
  cleanups.push(() => { imageEl.removeEventListener('load', onLoad); imageEl.removeEventListener('error', onError); });
  function sync() {
    root.setAttribute('data-size', currentProps.size ?? 'md'); root.setAttribute('data-shape', currentProps.shape ?? 'circle'); root.setAttribute('data-state', loadState);
    root.setAttribute('aria-label', currentProps.alt || currentProps.name || 'Avatar');
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
    root.innerHTML = '';
    if (loadState === 'loaded' && currentProps.src) { imageEl.src = currentProps.src; imageEl.alt = currentProps.alt || currentProps.name || ''; root.appendChild(imageEl); }
    else { fallbackEl.textContent = currentProps.name ? getInitials(currentProps.name) : ''; root.appendChild(fallbackEl); }
  }
  if (currentProps.src) { imageEl.src = currentProps.src; } sync(); target.appendChild(root);
  return { element: root, update(next) { const srcChanged = next.src !== undefined && next.src !== currentProps.src; Object.assign(currentProps, next); if (srcChanged) { loadState = currentProps.src ? 'loading' : 'error'; if (currentProps.src) imageEl.src = currentProps.src; } sync(); }, destroy() { cleanups.forEach(fn => fn()); root.remove(); } };
}
export default createAvatar;
