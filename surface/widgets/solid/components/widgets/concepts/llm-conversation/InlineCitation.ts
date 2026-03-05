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
  const send = (event: InlineCitationEvent) => { sig.set(inlineCitationReducer(sig.get(), event)); };

  const index = Number(props.index ?? 0);
  const title = String(props.title ?? '');
  const url = props.url as string | undefined;
  const excerpt = props.excerpt as string | undefined;
  const size = String(props.size ?? 'sm') as 'sm' | 'md';
  const showPreviewOnHover = props.showPreviewOnHover !== false;

  const handleOpen = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    send({ type: 'CLICK' });
    // Auto-complete navigation
    setTimeout(() => send({ type: 'NAVIGATE_COMPLETE' }), 0);
  };

  const root = document.createElement('span');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'inline-citation');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('role', 'link');
  root.setAttribute('aria-label', `Citation ${index}: ${title}`);
  root.setAttribute('tabindex', '0');
  root.style.position = 'relative';
  root.style.display = 'inline';
  root.style.cursor = 'pointer';
  if (props.class) root.className = props.class as string;

  // Badge
  const badgeEl = document.createElement('sup');
  badgeEl.setAttribute('data-part', 'badge');
  badgeEl.setAttribute('data-state', sig.get());
  badgeEl.setAttribute('data-size', size);
  badgeEl.style.fontSize = size === 'sm' ? '0.65em' : '0.75em';
  badgeEl.style.lineHeight = '1';
  badgeEl.style.verticalAlign = 'super';
  badgeEl.style.padding = '0 0.15em';
  badgeEl.style.color = 'var(--citation-color, #2563eb)';
  badgeEl.style.textDecoration = 'underline';
  badgeEl.style.textDecorationStyle = 'dotted';
  badgeEl.textContent = `[${index}]`;
  root.appendChild(badgeEl);

  // Tooltip
  const tooltipEl = document.createElement('span');
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.setAttribute('data-part', 'tooltip');
  tooltipEl.setAttribute('data-state', sig.get());
  tooltipEl.setAttribute('data-visible', 'false');
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
  tooltipEl.style.background = 'var(--tooltip-bg, #1f2937)';
  tooltipEl.style.color = 'var(--tooltip-color, #f9fafb)';
  tooltipEl.style.borderRadius = '0.375em';
  tooltipEl.style.fontSize = '0.8125rem';
  tooltipEl.style.lineHeight = '1.4';
  tooltipEl.style.zIndex = '10';
  tooltipEl.style.pointerEvents = 'none';
  tooltipEl.style.whiteSpace = 'normal';
  root.appendChild(tooltipEl);

  const titleSpan = document.createElement('span');
  titleSpan.setAttribute('data-part', 'title');
  titleSpan.setAttribute('data-state', sig.get());
  titleSpan.style.display = 'block';
  titleSpan.style.fontWeight = '600';
  titleSpan.style.marginBottom = excerpt ? '0.25em' : '0';
  titleSpan.textContent = title;
  tooltipEl.appendChild(titleSpan);

  if (excerpt) {
    const excerptSpan = document.createElement('span');
    excerptSpan.setAttribute('data-part', 'excerpt');
    excerptSpan.setAttribute('data-state', sig.get());
    excerptSpan.setAttribute('data-visible', 'true');
    excerptSpan.style.display = 'block';
    excerptSpan.style.opacity = '0.85';
    excerptSpan.style.fontSize = '0.75rem';
    excerptSpan.style.marginBottom = url ? '0.35em' : '0';
    excerptSpan.textContent = excerpt;
    tooltipEl.appendChild(excerptSpan);
  }

  if (url) {
    const linkSpan = document.createElement('span');
    linkSpan.setAttribute('data-part', 'link');
    linkSpan.setAttribute('data-state', sig.get());
    linkSpan.setAttribute('data-url', url);
    linkSpan.style.display = 'block';
    linkSpan.style.fontSize = '0.7rem';
    linkSpan.style.opacity = '0.7';
    linkSpan.style.overflow = 'hidden';
    linkSpan.style.textOverflow = 'ellipsis';
    linkSpan.style.whiteSpace = 'nowrap';
    linkSpan.textContent = url;
    tooltipEl.appendChild(linkSpan);
  }

  // Events
  root.addEventListener('mouseenter', () => { if (showPreviewOnHover) send({ type: 'HOVER' }); });
  root.addEventListener('mouseleave', () => send({ type: 'LEAVE' }));
  root.addEventListener('focus', () => { if (showPreviewOnHover) send({ type: 'HOVER' }); });
  root.addEventListener('blur', () => send({ type: 'LEAVE' }));
  root.addEventListener('click', handleOpen);
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(); }
    if (e.key === 'Escape' && sig.get() === 'previewing') { e.preventDefault(); send({ type: 'LEAVE' }); }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    tooltipEl.setAttribute('data-state', s);
    tooltipEl.setAttribute('data-visible', s === 'previewing' ? 'true' : 'false');
    tooltipEl.setAttribute('aria-hidden', s !== 'previewing' ? 'true' : 'false');
    tooltipEl.style.display = s === 'previewing' ? 'block' : 'none';
    badgeEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default InlineCitation;
