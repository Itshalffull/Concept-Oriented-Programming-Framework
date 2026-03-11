import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type ArtifactPanelState = 'open' | 'copied' | 'fullscreen' | 'closed';
export type ArtifactPanelEvent =
  | { type: 'COPY' }
  | { type: 'FULLSCREEN' }
  | { type: 'CLOSE' }
  | { type: 'VERSION_CHANGE' }
  | { type: 'COPY_TIMEOUT' }
  | { type: 'EXIT_FULLSCREEN' }
  | { type: 'OPEN' };

export function artifactPanelReducer(state: ArtifactPanelState, event: ArtifactPanelEvent): ArtifactPanelState {
  switch (state) {
    case 'open':
      if (event.type === 'COPY') return 'copied';
      if (event.type === 'FULLSCREEN') return 'fullscreen';
      if (event.type === 'CLOSE') return 'closed';
      if (event.type === 'VERSION_CHANGE') return 'open';
      return state;
    case 'copied':
      if (event.type === 'COPY_TIMEOUT') return 'open';
      return state;
    case 'fullscreen':
      if (event.type === 'EXIT_FULLSCREEN') return 'open';
      if (event.type === 'CLOSE') return 'closed';
      return state;
    case 'closed':
      if (event.type === 'OPEN') return 'open';
      return state;
    default:
      return state;
  }
}

export interface ArtifactPanelProps { [key: string]: unknown; class?: string; }
export interface ArtifactPanelResult { element: HTMLElement; dispose: () => void; }

export function ArtifactPanel(props: ArtifactPanelProps): ArtifactPanelResult {
  const sig = surfaceCreateSignal<ArtifactPanelState>('open');
  const state = () => sig.get();
  const send = (type: string) => sig.set(artifactPanelReducer(sig.get(), { type } as any));

  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'artifact-panel');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'complementary');
  root.setAttribute('aria-label', 'Artifact panel');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.overflow = 'hidden';
  root.style.position = 'relative';
  if (props.class) root.className = props.class as string;

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (sig.get() === 'fullscreen') {
        send('EXIT_FULLSCREEN');
      } else {
        send('CLOSE');
      }
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      if (sig.get() === 'fullscreen') {
        send('EXIT_FULLSCREEN');
      } else {
        send('FULLSCREEN');
      }
    }
    if (e.ctrlKey && !e.shiftKey && e.key === 'c') {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        e.preventDefault();
        send('COPY');
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = setTimeout(() => send('COPY_TIMEOUT'), 2000);
      }
    }
  });

  /* Resize handle */
  const resizeHandleEl = document.createElement('div');
  resizeHandleEl.setAttribute('data-part', 'resize-handle');
  resizeHandleEl.setAttribute('aria-hidden', 'true');
  resizeHandleEl.style.position = 'absolute';
  resizeHandleEl.style.top = '0';
  resizeHandleEl.style.left = '0';
  resizeHandleEl.style.width = '4px';
  resizeHandleEl.style.height = '100%';
  resizeHandleEl.style.cursor = 'col-resize';
  resizeHandleEl.style.zIndex = '1';
  root.appendChild(resizeHandleEl);

  /* Header */
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.style.display = 'flex';
  headerEl.style.alignItems = 'center';
  headerEl.style.gap = '8px';
  headerEl.style.padding = '8px 12px';
  headerEl.style.flexShrink = '0';
  root.appendChild(headerEl);

  const typeBadgeEl = document.createElement('span');
  typeBadgeEl.setAttribute('data-part', 'type-badge');
  typeBadgeEl.style.display = 'inline-flex';
  typeBadgeEl.style.alignItems = 'center';
  typeBadgeEl.style.gap = '4px';
  typeBadgeEl.style.fontSize = '12px';
  headerEl.appendChild(typeBadgeEl);

  const titleTextEl = document.createElement('span');
  titleTextEl.setAttribute('data-part', 'title-text');
  titleTextEl.style.flex = '1';
  titleTextEl.style.fontWeight = '600';
  titleTextEl.style.overflow = 'hidden';
  titleTextEl.style.textOverflow = 'ellipsis';
  titleTextEl.style.whiteSpace = 'nowrap';
  headerEl.appendChild(titleTextEl);

  const toolbarEl = document.createElement('div');
  toolbarEl.setAttribute('data-part', 'toolbar');
  toolbarEl.setAttribute('role', 'toolbar');
  toolbarEl.setAttribute('aria-label', 'Artifact actions');
  toolbarEl.style.display = 'flex';
  toolbarEl.style.alignItems = 'center';
  toolbarEl.style.gap = '4px';
  toolbarEl.style.flexShrink = '0';
  headerEl.appendChild(toolbarEl);

  const copyButtonEl = document.createElement('button');
  copyButtonEl.setAttribute('type', 'button');
  copyButtonEl.setAttribute('data-part', 'copy-button');
  copyButtonEl.setAttribute('aria-label', 'Copy artifact content to clipboard');
  copyButtonEl.setAttribute('aria-live', 'polite');
  copyButtonEl.setAttribute('tabindex', '0');
  copyButtonEl.textContent = 'Copy';
  copyButtonEl.addEventListener('click', () => {
    send('COPY');
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => send('COPY_TIMEOUT'), 2000);
  });
  toolbarEl.appendChild(copyButtonEl);

  const downloadButtonEl = document.createElement('button');
  downloadButtonEl.setAttribute('type', 'button');
  downloadButtonEl.setAttribute('data-part', 'download-button');
  downloadButtonEl.setAttribute('aria-label', 'Download artifact as file');
  downloadButtonEl.setAttribute('tabindex', '0');
  downloadButtonEl.textContent = 'Download';
  toolbarEl.appendChild(downloadButtonEl);

  const fullscreenButtonEl = document.createElement('button');
  fullscreenButtonEl.setAttribute('type', 'button');
  fullscreenButtonEl.setAttribute('data-part', 'fullscreen-button');
  fullscreenButtonEl.setAttribute('aria-label', 'Enter fullscreen');
  fullscreenButtonEl.setAttribute('tabindex', '0');
  fullscreenButtonEl.textContent = 'Fullscreen';
  fullscreenButtonEl.addEventListener('click', () => {
    if (sig.get() === 'fullscreen') {
      send('EXIT_FULLSCREEN');
    } else {
      send('FULLSCREEN');
    }
  });
  toolbarEl.appendChild(fullscreenButtonEl);

  const closeButtonEl = document.createElement('button');
  closeButtonEl.setAttribute('type', 'button');
  closeButtonEl.setAttribute('data-part', 'close-button');
  closeButtonEl.setAttribute('aria-label', 'Close artifact panel');
  closeButtonEl.setAttribute('tabindex', '0');
  closeButtonEl.textContent = 'Close';
  closeButtonEl.addEventListener('click', () => send('CLOSE'));
  toolbarEl.appendChild(closeButtonEl);

  /* Version bar */
  const versionBarEl = document.createElement('div');
  versionBarEl.setAttribute('data-part', 'version-bar');
  versionBarEl.style.display = 'flex';
  versionBarEl.style.alignItems = 'center';
  versionBarEl.style.gap = '8px';
  versionBarEl.style.padding = '4px 12px';
  versionBarEl.style.fontSize = '12px';
  versionBarEl.style.flexShrink = '0';
  root.appendChild(versionBarEl);

  const versionPrevEl = document.createElement('button');
  versionPrevEl.setAttribute('type', 'button');
  versionPrevEl.setAttribute('data-part', 'version-prev');
  versionPrevEl.setAttribute('aria-label', 'Previous version');
  versionPrevEl.setAttribute('tabindex', '0');
  versionPrevEl.innerHTML = '&lsaquo;';
  versionPrevEl.addEventListener('click', () => send('VERSION_CHANGE'));
  versionBarEl.appendChild(versionPrevEl);

  const versionIndicatorEl = document.createElement('span');
  versionIndicatorEl.setAttribute('data-part', 'version-indicator');
  versionBarEl.appendChild(versionIndicatorEl);

  const versionNextEl = document.createElement('button');
  versionNextEl.setAttribute('type', 'button');
  versionNextEl.setAttribute('data-part', 'version-next');
  versionNextEl.setAttribute('aria-label', 'Next version');
  versionNextEl.setAttribute('tabindex', '0');
  versionNextEl.innerHTML = '&rsaquo;';
  versionNextEl.addEventListener('click', () => send('VERSION_CHANGE'));
  versionBarEl.appendChild(versionNextEl);

  /* Content area */
  const contentAreaEl = document.createElement('div');
  contentAreaEl.setAttribute('data-part', 'content-area');
  contentAreaEl.setAttribute('role', 'region');
  contentAreaEl.setAttribute('aria-label', 'Artifact content');
  contentAreaEl.style.flex = '1';
  contentAreaEl.style.overflow = 'auto';
  root.appendChild(contentAreaEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
    toolbarEl.setAttribute('data-state', s);
    copyButtonEl.setAttribute('data-state', s === 'copied' ? 'copied' : 'idle');
    copyButtonEl.setAttribute('aria-label', s === 'copied' ? 'Copied to clipboard' : 'Copy artifact content to clipboard');
    copyButtonEl.textContent = s === 'copied' ? 'Copied!' : 'Copy';
    closeButtonEl.setAttribute('data-state', s);
    fullscreenButtonEl.setAttribute('data-state', s === 'fullscreen' ? 'active' : 'idle');
    fullscreenButtonEl.setAttribute('aria-label', s === 'fullscreen' ? 'Exit fullscreen' : 'Enter fullscreen');
    fullscreenButtonEl.textContent = s === 'fullscreen' ? 'Exit Fullscreen' : 'Fullscreen';
    contentAreaEl.setAttribute('data-state', s);
    resizeHandleEl.style.display = s === 'fullscreen' ? 'none' : '';

    if (s === 'fullscreen') {
      root.style.width = '100%';
      root.style.height = '100vh';
      root.style.position = 'fixed';
      root.style.top = '0';
      root.style.left = '0';
      root.style.zIndex = '9999';
    } else {
      root.style.width = '';
      root.style.height = '';
      root.style.position = 'relative';
      root.style.top = '';
      root.style.left = '';
      root.style.zIndex = '';
    }

    if (s === 'closed') {
      root.style.display = 'none';
    } else {
      root.style.display = 'flex';
    }
  });

  return {
    element: root,
    dispose() {
      unsub();
      if (copyTimer) clearTimeout(copyTimer);
      root.remove();
    },
  };
}

export default ArtifactPanel;
