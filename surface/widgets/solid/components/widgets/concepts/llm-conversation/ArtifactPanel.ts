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

const TYPE_ICONS: Record<string, string> = { code: '\u{1F4BB}', document: '\u{1F4C4}', image: '\u{1F5BC}', html: '\u{1F310}' };
const TYPE_LABELS: Record<string, string> = { code: 'Code', document: 'Document', image: 'Image', html: 'HTML' };

export interface ArtifactPanelProps { [key: string]: unknown; class?: string; }
export interface ArtifactPanelResult { element: HTMLElement; dispose: () => void; }

export function ArtifactPanel(props: ArtifactPanelProps): ArtifactPanelResult {
  const sig = surfaceCreateSignal<ArtifactPanelState>('open');
  const send = (event: ArtifactPanelEvent) => { sig.set(artifactPanelReducer(sig.get(), event)); };

  const content = String(props.content ?? '');
  const artifactType = String(props.artifactType ?? 'code');
  const title = String(props.title ?? '');
  const language = props.language as string | undefined;
  const showVersions = props.showVersions !== false;
  const currentVersion = Number(props.currentVersion ?? 1);
  const totalVersions = Number(props.totalVersions ?? 1);
  const onVersionChange = props.onVersionChange as ((v: number) => void) | undefined;
  const onClose = props.onClose as (() => void) | undefined;
  const onCopy = props.onCopy as (() => void) | undefined;
  const onDownload = props.onDownload as (() => void) | undefined;

  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'artifact-panel');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-type', artifactType);
  root.setAttribute('role', 'complementary');
  root.setAttribute('aria-label', `Artifact: ${title}`);
  root.setAttribute('tabindex', '0');
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.overflow = 'hidden';
  root.style.position = 'relative';
  if (props.class) root.className = props.class as string;

  // Header
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.setAttribute('data-state', sig.get());
  headerEl.style.display = 'flex';
  headerEl.style.alignItems = 'center';
  headerEl.style.gap = '8px';
  headerEl.style.padding = '8px 12px';
  headerEl.style.flexShrink = '0';
  root.appendChild(headerEl);

  // Type badge
  const typeBadge = document.createElement('span');
  typeBadge.setAttribute('data-part', 'type-badge');
  typeBadge.setAttribute('aria-label', `Type: ${TYPE_LABELS[artifactType] ?? artifactType}`);
  typeBadge.textContent = `${TYPE_ICONS[artifactType] ?? ''} ${TYPE_LABELS[artifactType] ?? artifactType}`;
  headerEl.appendChild(typeBadge);

  // Title
  const titleEl = document.createElement('span');
  titleEl.setAttribute('data-part', 'title');
  titleEl.setAttribute('data-state', sig.get());
  titleEl.style.flex = '1';
  titleEl.style.fontWeight = '600';
  titleEl.style.overflow = 'hidden';
  titleEl.style.textOverflow = 'ellipsis';
  titleEl.style.whiteSpace = 'nowrap';
  titleEl.textContent = title;
  headerEl.appendChild(titleEl);

  // Toolbar
  const toolbarEl = document.createElement('div');
  toolbarEl.setAttribute('data-part', 'toolbar');
  toolbarEl.setAttribute('data-state', sig.get());
  toolbarEl.setAttribute('role', 'toolbar');
  toolbarEl.setAttribute('aria-label', 'Artifact actions');
  toolbarEl.style.display = 'flex';
  toolbarEl.style.alignItems = 'center';
  toolbarEl.style.gap = '4px';
  headerEl.appendChild(toolbarEl);

  const copyBtn = document.createElement('button');
  copyBtn.setAttribute('type', 'button');
  copyBtn.setAttribute('data-part', 'copy-button');
  copyBtn.setAttribute('data-state', 'idle');
  copyBtn.setAttribute('aria-label', 'Copy artifact content to clipboard');
  copyBtn.setAttribute('aria-live', 'polite');
  copyBtn.setAttribute('tabindex', '0');
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(content); } catch { /* noop */ }
    send({ type: 'COPY' });
    onCopy?.();
  });
  toolbarEl.appendChild(copyBtn);

  const downloadBtn = document.createElement('button');
  downloadBtn.setAttribute('type', 'button');
  downloadBtn.setAttribute('data-part', 'download-button');
  downloadBtn.setAttribute('aria-label', 'Download artifact as file');
  downloadBtn.setAttribute('tabindex', '0');
  downloadBtn.textContent = 'Download';
  downloadBtn.addEventListener('click', () => {
    const extMap: Record<string, string> = { code: language ?? 'txt', document: 'txt', image: 'png', html: 'html' };
    const mimeMap: Record<string, string> = { code: 'text/plain', document: 'text/plain', image: 'application/octet-stream', html: 'text/html' };
    const blob = new Blob([content], { type: mimeMap[artifactType] ?? 'text/plain' });
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${extMap[artifactType] ?? 'txt'}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(blobUrl);
    onDownload?.();
  });
  toolbarEl.appendChild(downloadBtn);

  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.setAttribute('type', 'button');
  fullscreenBtn.setAttribute('data-part', 'fullscreen-button');
  fullscreenBtn.setAttribute('data-state', 'idle');
  fullscreenBtn.setAttribute('aria-label', 'Enter fullscreen');
  fullscreenBtn.setAttribute('tabindex', '0');
  fullscreenBtn.textContent = 'Fullscreen';
  fullscreenBtn.addEventListener('click', () => {
    if (sig.get() === 'fullscreen') send({ type: 'EXIT_FULLSCREEN' });
    else send({ type: 'FULLSCREEN' });
  });
  toolbarEl.appendChild(fullscreenBtn);

  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('type', 'button');
  closeBtn.setAttribute('data-part', 'close-button');
  closeBtn.setAttribute('data-state', sig.get());
  closeBtn.setAttribute('aria-label', 'Close artifact panel');
  closeBtn.setAttribute('tabindex', '0');
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => send({ type: 'CLOSE' }));
  toolbarEl.appendChild(closeBtn);

  // Version bar
  const versionBarEl = document.createElement('div');
  versionBarEl.setAttribute('data-part', 'version-bar');
  versionBarEl.setAttribute('data-visible', 'true');
  versionBarEl.style.display = (showVersions && totalVersions > 1) ? 'flex' : 'none';
  versionBarEl.style.alignItems = 'center';
  versionBarEl.style.gap = '8px';
  versionBarEl.style.padding = '4px 12px';
  versionBarEl.style.fontSize = '12px';
  root.appendChild(versionBarEl);

  const vPrevBtn = document.createElement('button');
  vPrevBtn.setAttribute('type', 'button');
  vPrevBtn.setAttribute('data-part', 'version-prev');
  vPrevBtn.setAttribute('aria-label', 'Previous version');
  vPrevBtn.disabled = currentVersion <= 1;
  vPrevBtn.innerHTML = '&lsaquo;';
  vPrevBtn.addEventListener('click', () => {
    if (currentVersion > 1) { send({ type: 'VERSION_CHANGE' }); onVersionChange?.(currentVersion - 1); }
  });
  versionBarEl.appendChild(vPrevBtn);

  const vIndicator = document.createElement('span');
  vIndicator.setAttribute('data-part', 'version-indicator');
  vIndicator.textContent = `Version ${currentVersion} of ${totalVersions}`;
  versionBarEl.appendChild(vIndicator);

  const vNextBtn = document.createElement('button');
  vNextBtn.setAttribute('type', 'button');
  vNextBtn.setAttribute('data-part', 'version-next');
  vNextBtn.setAttribute('aria-label', 'Next version');
  vNextBtn.disabled = currentVersion >= totalVersions;
  vNextBtn.innerHTML = '&rsaquo;';
  vNextBtn.addEventListener('click', () => {
    if (currentVersion < totalVersions) { send({ type: 'VERSION_CHANGE' }); onVersionChange?.(currentVersion + 1); }
  });
  versionBarEl.appendChild(vNextBtn);

  // Content area
  const contentEl = document.createElement('div');
  contentEl.setAttribute('data-part', 'content');
  contentEl.setAttribute('data-state', sig.get());
  contentEl.setAttribute('data-type', artifactType);
  contentEl.setAttribute('role', 'region');
  contentEl.setAttribute('aria-label', 'Artifact content');
  contentEl.style.flex = '1';
  contentEl.style.overflow = 'auto';
  root.appendChild(contentEl);

  // Render content by type
  if (artifactType === 'code') {
    const pre = document.createElement('pre');
    pre.setAttribute('data-part', 'code-pre');
    pre.style.margin = '0';
    pre.style.padding = '12px';
    pre.style.overflow = 'auto';
    pre.style.fontSize = '13px';
    pre.style.lineHeight = '1.5';
    pre.style.fontFamily = 'monospace';
    if (language) {
      const langLabel = document.createElement('span');
      langLabel.setAttribute('data-part', 'language-label');
      langLabel.style.display = 'block';
      langLabel.style.marginBottom = '8px';
      langLabel.style.fontSize = '11px';
      langLabel.style.textTransform = 'uppercase';
      langLabel.style.opacity = '0.6';
      langLabel.textContent = language;
      pre.appendChild(langLabel);
    }
    const code = document.createElement('code');
    code.setAttribute('data-part', 'code-content');
    if (language) code.setAttribute('data-language', language);
    code.textContent = content;
    pre.appendChild(code);
    contentEl.appendChild(pre);
  } else if (artifactType === 'document') {
    const docDiv = document.createElement('div');
    docDiv.setAttribute('data-part', 'document-content');
    docDiv.style.padding = '16px';
    docDiv.style.lineHeight = '1.6';
    docDiv.style.whiteSpace = 'pre-wrap';
    docDiv.style.wordBreak = 'break-word';
    docDiv.textContent = content;
    contentEl.appendChild(docDiv);
  } else if (artifactType === 'image') {
    const imgWrapper = document.createElement('div');
    imgWrapper.setAttribute('data-part', 'image-wrapper');
    imgWrapper.style.padding = '16px';
    imgWrapper.style.display = 'flex';
    imgWrapper.style.justifyContent = 'center';
    imgWrapper.style.alignItems = 'center';
    const img = document.createElement('img');
    img.src = content;
    img.alt = title;
    img.setAttribute('data-part', 'image-content');
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    imgWrapper.appendChild(img);
    contentEl.appendChild(imgWrapper);
  } else if (artifactType === 'html') {
    const notice = document.createElement('div');
    notice.setAttribute('data-part', 'html-preview-notice');
    notice.style.padding = '16px';
    const noticeText = document.createElement('span');
    noticeText.style.fontSize = '13px';
    noticeText.style.opacity = '0.7';
    noticeText.style.fontStyle = 'italic';
    noticeText.textContent = 'HTML preview is sandboxed for security. Raw HTML is not rendered directly.';
    notice.appendChild(noticeText);
    const pre = document.createElement('pre');
    pre.style.margin = '0';
    pre.style.padding = '12px';
    pre.style.overflow = 'auto';
    pre.style.fontSize = '13px';
    pre.style.lineHeight = '1.5';
    pre.style.fontFamily = 'monospace';
    const code = document.createElement('code');
    code.textContent = content;
    pre.appendChild(code);
    notice.appendChild(pre);
    contentEl.appendChild(notice);
  } else {
    const fallback = document.createElement('div');
    fallback.setAttribute('data-part', 'fallback-content');
    fallback.style.padding = '16px';
    fallback.textContent = content;
    contentEl.appendChild(fallback);
  }

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (sig.get() === 'fullscreen') send({ type: 'EXIT_FULLSCREEN' });
      else send({ type: 'CLOSE' });
    }
    if (e.ctrlKey && !e.shiftKey && e.key === 'c') {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        e.preventDefault();
        navigator.clipboard.writeText(content).catch(() => {});
        send({ type: 'COPY' });
        onCopy?.();
      }
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'f') {
      e.preventDefault();
      if (sig.get() === 'fullscreen') send({ type: 'EXIT_FULLSCREEN' });
      else send({ type: 'FULLSCREEN' });
    }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    if (s === 'closed') {
      root.style.display = 'none';
      onClose?.();
    } else {
      root.style.display = 'flex';
    }
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
    copyBtn.setAttribute('data-state', s === 'copied' ? 'copied' : 'idle');
    copyBtn.setAttribute('aria-label', s === 'copied' ? 'Copied to clipboard' : 'Copy artifact content to clipboard');
    copyBtn.textContent = s === 'copied' ? 'Copied!' : 'Copy';
    fullscreenBtn.setAttribute('data-state', s === 'fullscreen' ? 'active' : 'idle');
    fullscreenBtn.setAttribute('aria-label', s === 'fullscreen' ? 'Exit fullscreen' : 'Enter fullscreen');
    fullscreenBtn.textContent = s === 'fullscreen' ? 'Exit Fullscreen' : 'Fullscreen';
    if (s === 'copied') {
      copyTimer = setTimeout(() => send({ type: 'COPY_TIMEOUT' }), 2000);
    }
  });

  return {
    element: root,
    dispose() { unsub(); if (copyTimer) clearTimeout(copyTimer); root.remove(); },
  };
}

export default ArtifactPanel;
