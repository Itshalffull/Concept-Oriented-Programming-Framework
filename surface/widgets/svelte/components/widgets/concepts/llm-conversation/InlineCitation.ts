import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type InlineCitationState = 'idle' | 'previewing' | 'navigating';
export type InlineCitationEvent =
  | { type: 'HOVER' }
  | { type: 'CLICK' }
  | { type: 'LEAVE' }
  | { type: 'NAVIGATE_COMPLETE' };

export function inlineCitationReducer(state: InlineCitationState, event: InlineCitationEvent): InlineCitationState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'previewing';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'previewing':
      if (event.type === 'LEAVE') return 'idle';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'navigating':
      if (event.type === 'NAVIGATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface InlineCitationProps { [key: string]: unknown; class?: string; }
export interface InlineCitationResult { element: HTMLElement; dispose: () => void; }

export function InlineCitation(props: InlineCitationProps): InlineCitationResult {
  const sig = surfaceCreateSignal<InlineCitationState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(inlineCitationReducer(sig.get(), { type } as any));

  const root = document.createElement('span');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'inline-citation');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'link');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  root.style.position = 'relative';
  root.style.display = 'inline';
  root.style.cursor = 'pointer';
  if (props.class) root.className = props.class as string;

  root.addEventListener('mouseenter', () => send('HOVER'));
  root.addEventListener('mouseleave', () => send('LEAVE'));
  root.addEventListener('focus', () => send('HOVER'));
  root.addEventListener('blur', () => send('LEAVE'));
  root.addEventListener('click', () => {
    send('CLICK');
    // Auto-complete navigation
    setTimeout(() => send('NAVIGATE_COMPLETE'), 0);
  });
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      send('CLICK');
      setTimeout(() => send('NAVIGATE_COMPLETE'), 0);
    }
    if (e.key === 'Escape' && sig.get() === 'previewing') {
      e.preventDefault();
      send('LEAVE');
    }
  });

  const badgeEl = document.createElement('sup');
  badgeEl.setAttribute('data-part', 'badge');
  badgeEl.style.fontSize = '0.65em';
  badgeEl.style.lineHeight = '1';
  badgeEl.style.verticalAlign = 'super';
  badgeEl.style.padding = '0 0.15em';
  badgeEl.style.textDecoration = 'underline';
  badgeEl.style.textDecorationStyle = 'dotted';
  root.appendChild(badgeEl);

  const tooltipEl = document.createElement('span');
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.setAttribute('data-part', 'tooltip');
  tooltipEl.setAttribute('aria-hidden', 'true');
  tooltipEl.style.display = 'none';
  tooltipEl.style.position = 'absolute';
  tooltipEl.style.bottom = '100%';
  tooltipEl.style.left = '50%';
  tooltipEl.style.transform = 'translateX(-50%)';
  tooltipEl.style.marginBottom = '0.5em';
  tooltipEl.style.padding = '0.5em 0.75em';
  tooltipEl.style.minWidth = '12em';
  tooltipEl.style.maxWidth = '20em';
  tooltipEl.style.borderRadius = '0.375em';
  tooltipEl.style.fontSize = '0.8125rem';
  tooltipEl.style.lineHeight = '1.4';
  tooltipEl.style.zIndex = '10';
  tooltipEl.style.pointerEvents = 'none';
  tooltipEl.style.whiteSpace = 'normal';
  root.appendChild(tooltipEl);

  const titleEl = document.createElement('span');
  titleEl.setAttribute('data-part', 'title');
  titleEl.style.display = 'block';
  titleEl.style.fontWeight = '600';
  tooltipEl.appendChild(titleEl);

  const excerptEl = document.createElement('span');
  excerptEl.setAttribute('data-part', 'excerpt');
  excerptEl.style.display = 'block';
  excerptEl.style.opacity = '0.85';
  excerptEl.style.fontSize = '0.75rem';
  tooltipEl.appendChild(excerptEl);

  const linkEl = document.createElement('span');
  linkEl.setAttribute('data-part', 'link');
  linkEl.style.display = 'block';
  linkEl.style.fontSize = '0.7rem';
  linkEl.style.opacity = '0.7';
  linkEl.style.overflow = 'hidden';
  linkEl.style.textOverflow = 'ellipsis';
  linkEl.style.whiteSpace = 'nowrap';
  tooltipEl.appendChild(linkEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    badgeEl.setAttribute('data-state', s);
    tooltipEl.setAttribute('data-state', s);
    tooltipEl.setAttribute('data-visible', s === 'previewing' ? 'true' : 'false');
    tooltipEl.setAttribute('aria-hidden', s !== 'previewing' ? 'true' : 'false');
    tooltipEl.style.display = s === 'previewing' ? 'block' : 'none';
    titleEl.setAttribute('data-state', s);
    excerptEl.setAttribute('data-state', s);
    linkEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default InlineCitation;
