/* ---------------------------------------------------------------------------
 * ArtifactPanel — Vanilla implementation
 *
 * Panel for displaying generated artifacts (code, documents, images, HTML)
 * with copy, download, fullscreen, version navigation, and close actions.
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

const TYPE_ICONS: Record<string, string> = { code: '\u{1F4BB}', document: '\u{1F4C4}', image: '\u{1F5BC}', html: '\u{1F310}' };
const TYPE_LABELS: Record<string, string> = { code: 'Code', document: 'Document', image: 'Image', html: 'HTML' };

export interface ArtifactPanelProps {
  [key: string]: unknown;
  className?: string;
  title?: string;
  type?: 'code' | 'document' | 'image' | 'html';
  content?: string;
  language?: string;
  currentVersion?: number;
  totalVersions?: number;
  onClose?: () => void;
  onCopy?: () => void;
  onDownload?: () => void;
  onVersionChange?: (version: number) => void;
}
export interface ArtifactPanelOptions { target: HTMLElement; props: ArtifactPanelProps; }

let _artifactPanelUid = 0;

export class ArtifactPanel {
  private el: HTMLElement;
  private props: ArtifactPanelProps;
  private state: ArtifactPanelState = 'open';
  private disposers: Array<() => void> = [];
  private copyTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ArtifactPanelOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'artifact-panel');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'complementary');
    this.el.setAttribute('aria-label', 'Artifact panel');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'artifact-panel-' + (++_artifactPanelUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  send(type: string): void {
    this.state = artifactPanelReducer(this.state, { type } as any);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<ArtifactPanelProps>): void {
    Object.assign(this.props, props);
    this.cleanup();
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { this.cleanup(); if (this.copyTimeout) clearTimeout(this.copyTimeout); this.el.remove(); }

  private cleanup(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
  }

  private rerender(): void { this.cleanup(); this.el.innerHTML = ''; this.render(); }

  private render(): void {
    const { title = 'Artifact', type = 'code', content = '', language = '', currentVersion = 1, totalVersions = 1 } = this.props;
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className;
    if (this.state === 'closed') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (this.state === 'fullscreen') { this.send('EXIT_FULLSCREEN'); } else { this.send('CLOSE'); this.props.onClose?.(); }
        this.rerender();
      }
    };
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));

    // Header
    const header = document.createElement('div');
    header.setAttribute('data-part', 'header');
    const titleText = document.createElement('span');
    titleText.setAttribute('data-part', 'title-text');
    titleText.textContent = title;
    header.appendChild(titleText);
    const typeBadge = document.createElement('span');
    typeBadge.setAttribute('data-part', 'type-badge');
    typeBadge.textContent = `${TYPE_ICONS[type] ?? ''} ${TYPE_LABELS[type] ?? type}`;
    header.appendChild(typeBadge);
    this.el.appendChild(header);

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.setAttribute('data-part', 'toolbar');
    toolbar.setAttribute('role', 'toolbar');

    const copyBtn = document.createElement('button');
    copyBtn.setAttribute('data-part', 'copy-button'); copyBtn.setAttribute('type', 'button');
    copyBtn.setAttribute('aria-label', 'Copy content');
    copyBtn.textContent = this.state === 'copied' ? 'Copied!' : 'Copy';
    const onCopy = () => {
      if (navigator.clipboard && content) navigator.clipboard.writeText(content).catch(() => {});
      this.send('COPY'); copyBtn.textContent = 'Copied!'; this.props.onCopy?.();
      this.copyTimeout = setTimeout(() => { this.send('COPY_TIMEOUT'); copyBtn.textContent = 'Copy'; }, 2000);
    };
    copyBtn.addEventListener('click', onCopy);
    this.disposers.push(() => copyBtn.removeEventListener('click', onCopy));
    toolbar.appendChild(copyBtn);

    const downloadBtn = document.createElement('button');
    downloadBtn.setAttribute('data-part', 'download-button'); downloadBtn.setAttribute('type', 'button');
    downloadBtn.setAttribute('aria-label', 'Download'); downloadBtn.textContent = 'Download';
    const onDownload = () => {
      this.props.onDownload?.();
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = title; a.click();
      URL.revokeObjectURL(url);
    };
    downloadBtn.addEventListener('click', onDownload);
    this.disposers.push(() => downloadBtn.removeEventListener('click', onDownload));
    toolbar.appendChild(downloadBtn);

    const fsBtn = document.createElement('button');
    fsBtn.setAttribute('data-part', 'fullscreen-button'); fsBtn.setAttribute('type', 'button');
    fsBtn.textContent = this.state === 'fullscreen' ? 'Exit' : 'Fullscreen';
    const onFs = () => { this.send(this.state === 'fullscreen' ? 'EXIT_FULLSCREEN' : 'FULLSCREEN'); this.rerender(); };
    fsBtn.addEventListener('click', onFs);
    this.disposers.push(() => fsBtn.removeEventListener('click', onFs));
    toolbar.appendChild(fsBtn);

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-part', 'close-button'); closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Close'); closeBtn.textContent = '\u2715';
    const onClose = () => { this.send('CLOSE'); this.props.onClose?.(); this.rerender(); };
    closeBtn.addEventListener('click', onClose);
    this.disposers.push(() => closeBtn.removeEventListener('click', onClose));
    toolbar.appendChild(closeBtn);
    this.el.appendChild(toolbar);

    // Content
    const contentArea = document.createElement('div');
    contentArea.setAttribute('data-part', 'content-area');
    contentArea.setAttribute('data-type', type);
    if (type === 'code') {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      if (language) code.setAttribute('data-language', language);
      code.textContent = content; pre.appendChild(code); contentArea.appendChild(pre);
    } else if (type === 'image') {
      const img = document.createElement('img');
      img.setAttribute('src', content); img.setAttribute('alt', title); contentArea.appendChild(img);
    } else if (type === 'html') {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', 'allow-scripts'); iframe.setAttribute('srcdoc', content); contentArea.appendChild(iframe);
    } else {
      contentArea.textContent = content;
    }
    this.el.appendChild(contentArea);

    // Version bar
    if (totalVersions > 1) {
      const versionBar = document.createElement('div');
      versionBar.setAttribute('data-part', 'version-bar');
      const prevBtn = document.createElement('button');
      prevBtn.setAttribute('type', 'button'); prevBtn.setAttribute('data-part', 'version-prev');
      prevBtn.textContent = '\u2190'; if (currentVersion <= 1) prevBtn.setAttribute('disabled', '');
      const onPrev = () => { this.send('VERSION_CHANGE'); this.props.onVersionChange?.(currentVersion - 1); };
      prevBtn.addEventListener('click', onPrev); this.disposers.push(() => prevBtn.removeEventListener('click', onPrev));
      versionBar.appendChild(prevBtn);
      const label = document.createElement('span');
      label.setAttribute('data-part', 'version-label'); label.textContent = `v${currentVersion} / ${totalVersions}`;
      versionBar.appendChild(label);
      const nextBtn = document.createElement('button');
      nextBtn.setAttribute('type', 'button'); nextBtn.setAttribute('data-part', 'version-next');
      nextBtn.textContent = '\u2192'; if (currentVersion >= totalVersions) nextBtn.setAttribute('disabled', '');
      const onNext = () => { this.send('VERSION_CHANGE'); this.props.onVersionChange?.(currentVersion + 1); };
      nextBtn.addEventListener('click', onNext); this.disposers.push(() => nextBtn.removeEventListener('click', onNext));
      versionBar.appendChild(nextBtn);
      this.el.appendChild(versionBar);
    }
  }
}

export default ArtifactPanel;
