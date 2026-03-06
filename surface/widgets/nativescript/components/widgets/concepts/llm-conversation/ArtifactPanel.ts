import { StackLayout, Label, Button, ScrollView, FlexboxLayout } from '@nativescript/core';

/* ---------------------------------------------------------------------------
 * ArtifactPanel state machine
 * States: open (initial), copied, fullscreen, closed
 * ------------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

const TYPE_LABELS: Record<string, string> = {
  code: 'Code', document: 'Document', image: 'Image', html: 'HTML',
};

export interface ArtifactPanelProps {
  content: string;
  artifactType: 'code' | 'document' | 'image' | 'html';
  title: string;
  language?: string;
  showVersions?: boolean;
  currentVersion?: number;
  totalVersions?: number;
  onVersionChange?: (version: number) => void;
  onClose?: () => void;
  onCopy?: () => void;
  onDownload?: () => void;
}

/* ---------------------------------------------------------------------------
 * Widget
 * ------------------------------------------------------------------------- */

export function createArtifactPanel(props: ArtifactPanelProps): { view: StackLayout; dispose: () => void } {
  const {
    content,
    artifactType,
    title,
    language,
    showVersions = true,
    currentVersion = 1,
    totalVersions = 1,
    onVersionChange,
    onClose,
    onCopy,
    onDownload,
  } = props;

  let state: ArtifactPanelState = 'open';
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  const disposers: (() => void)[] = [];

  function send(event: ArtifactPanelEvent) {
    state = artifactPanelReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'artifact-panel';
  root.automationText = `Artifact: ${title}`;

  // Header
  const header = new FlexboxLayout();
  header.className = 'artifact-panel-header';
  header.flexDirection = 'row' as any;
  header.alignItems = 'center' as any;

  const typeBadge = new Label();
  typeBadge.className = 'artifact-panel-type-badge';
  typeBadge.text = TYPE_LABELS[artifactType] ?? artifactType;
  header.addChild(typeBadge);

  const titleLabel = new Label();
  titleLabel.className = 'artifact-panel-title';
  titleLabel.text = title;
  header.addChild(titleLabel);

  // Toolbar buttons
  const copyBtn = new Button();
  copyBtn.className = 'artifact-panel-copy';
  copyBtn.text = 'Copy';
  copyBtn.automationText = 'Copy artifact content';
  const copyHandler = () => {
    send({ type: 'COPY' });
    onCopy?.();
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => send({ type: 'COPY_TIMEOUT' }), 2000);
  };
  copyBtn.on('tap', copyHandler);
  disposers.push(() => copyBtn.off('tap', copyHandler));
  header.addChild(copyBtn);

  const downloadBtn = new Button();
  downloadBtn.className = 'artifact-panel-download';
  downloadBtn.text = 'Download';
  downloadBtn.automationText = 'Download artifact';
  const downloadHandler = () => { onDownload?.(); };
  downloadBtn.on('tap', downloadHandler);
  disposers.push(() => downloadBtn.off('tap', downloadHandler));
  header.addChild(downloadBtn);

  const fullscreenBtn = new Button();
  fullscreenBtn.className = 'artifact-panel-fullscreen';
  fullscreenBtn.text = 'Fullscreen';
  const fullscreenHandler = () => {
    if (state === 'fullscreen') send({ type: 'EXIT_FULLSCREEN' });
    else send({ type: 'FULLSCREEN' });
  };
  fullscreenBtn.on('tap', fullscreenHandler);
  disposers.push(() => fullscreenBtn.off('tap', fullscreenHandler));
  header.addChild(fullscreenBtn);

  const closeBtn = new Button();
  closeBtn.className = 'artifact-panel-close';
  closeBtn.text = 'Close';
  closeBtn.automationText = 'Close artifact panel';
  const closeHandler = () => {
    send({ type: 'CLOSE' });
    onClose?.();
  };
  closeBtn.on('tap', closeHandler);
  disposers.push(() => closeBtn.off('tap', closeHandler));
  header.addChild(closeBtn);

  root.addChild(header);

  // Version bar
  const versionBar = new FlexboxLayout();
  versionBar.className = 'artifact-panel-version-bar';
  versionBar.flexDirection = 'row' as any;
  versionBar.alignItems = 'center' as any;
  const showVersionBar = showVersions && totalVersions > 1;

  if (showVersionBar) {
    const prevBtn = new Button();
    prevBtn.className = 'artifact-panel-version-prev';
    prevBtn.text = '\u2039';
    prevBtn.automationText = 'Previous version';
    prevBtn.isEnabled = currentVersion > 1;
    const prevHandler = () => {
      if (currentVersion > 1) {
        send({ type: 'VERSION_CHANGE' });
        onVersionChange?.(currentVersion - 1);
      }
    };
    prevBtn.on('tap', prevHandler);
    disposers.push(() => prevBtn.off('tap', prevHandler));
    versionBar.addChild(prevBtn);

    const versionIndicator = new Label();
    versionIndicator.className = 'artifact-panel-version-indicator';
    versionIndicator.text = `Version ${currentVersion} of ${totalVersions}`;
    versionBar.addChild(versionIndicator);

    const nextBtn = new Button();
    nextBtn.className = 'artifact-panel-version-next';
    nextBtn.text = '\u203A';
    nextBtn.automationText = 'Next version';
    nextBtn.isEnabled = currentVersion < totalVersions;
    const nextHandler = () => {
      if (currentVersion < totalVersions) {
        send({ type: 'VERSION_CHANGE' });
        onVersionChange?.(currentVersion + 1);
      }
    };
    nextBtn.on('tap', nextHandler);
    disposers.push(() => nextBtn.off('tap', nextHandler));
    versionBar.addChild(nextBtn);

    root.addChild(versionBar);
  }

  // Content area
  const contentScroll = new ScrollView();
  const contentContainer = new StackLayout();
  contentContainer.className = 'artifact-panel-content';

  if (artifactType === 'code') {
    if (language) {
      const langLabel = new Label();
      langLabel.className = 'artifact-panel-language';
      langLabel.text = language.toUpperCase();
      contentContainer.addChild(langLabel);
    }
    const codeLabel = new Label();
    codeLabel.className = 'artifact-panel-code';
    codeLabel.text = content;
    codeLabel.textWrap = true;
    codeLabel.fontFamily = 'monospace';
    contentContainer.addChild(codeLabel);
  } else if (artifactType === 'html') {
    const noticeLabel = new Label();
    noticeLabel.className = 'artifact-panel-html-notice';
    noticeLabel.text = 'HTML preview is sandboxed for security. Raw HTML is not rendered directly.';
    contentContainer.addChild(noticeLabel);

    const htmlLabel = new Label();
    htmlLabel.className = 'artifact-panel-html';
    htmlLabel.text = content;
    htmlLabel.textWrap = true;
    htmlLabel.fontFamily = 'monospace';
    contentContainer.addChild(htmlLabel);
  } else {
    const textLabel = new Label();
    textLabel.className = 'artifact-panel-text';
    textLabel.text = content;
    textLabel.textWrap = true;
    contentContainer.addChild(textLabel);
  }

  contentScroll.content = contentContainer;
  root.addChild(contentScroll);

  function update() {
    root.visibility = (state === 'closed' ? 'collapse' : 'visible') as any;
    copyBtn.text = state === 'copied' ? 'Copied!' : 'Copy';
    fullscreenBtn.text = state === 'fullscreen' ? 'Exit Fullscreen' : 'Fullscreen';
  }

  return {
    view: root,
    dispose() {
      clearTimeout(copyTimer);
      disposers.forEach((d) => d());
    },
  };
}

export default createArtifactPanel;
