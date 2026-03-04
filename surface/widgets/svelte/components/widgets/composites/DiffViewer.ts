import { uid } from '../shared/uid.js';

export interface FileDiff {
  fileName: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  range: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'addition' | 'deletion' | 'context';
  content: string;
  oldNumber?: number;
  newNumber?: number;
}

export interface DiffViewerProps {
  original?: string;
  modified?: string;
  mode?: 'side-by-side' | 'unified';
  language?: string;
  fileName?: string;
  files?: FileDiff[];
  contextLines?: number;
  showLineNumbers?: boolean;
  showInlineHighlight?: boolean;
  showFileList?: boolean;
  expandCollapsed?: boolean;
  loading?: boolean;
  additions?: number;
  deletions?: number;
  onModeChange?: (mode: 'side-by-side' | 'unified') => void;
  onFileSelect?: (fileName: string) => void;
  children?: string | HTMLElement;
}

export interface DiffViewerInstance {
  element: HTMLElement;
  update(props: Partial<DiffViewerProps>): void;
  destroy(): void;
}

export function createDiffViewer(options: {
  target: HTMLElement;
  props: DiffViewerProps;
}): DiffViewerInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'diff-viewer');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Diff viewer');
  root.id = id;

  const toolbarEl = document.createElement('div');
  toolbarEl.setAttribute('data-part', 'toolbar');
  toolbarEl.setAttribute('role', 'toolbar');
  toolbarEl.setAttribute('aria-label', 'Diff controls');
  root.appendChild(toolbarEl);

  const modeToggleEl = document.createElement('button');
  modeToggleEl.setAttribute('data-part', 'mode-toggle');
  modeToggleEl.setAttribute('type', 'button');
  modeToggleEl.setAttribute('aria-label', 'Toggle diff view mode');
  toolbarEl.appendChild(modeToggleEl);

  const changeStatsEl = document.createElement('span');
  changeStatsEl.setAttribute('data-part', 'change-stats');
  changeStatsEl.setAttribute('aria-live', 'polite');
  toolbarEl.appendChild(changeStatsEl);

  const fileListEl = document.createElement('div');
  fileListEl.setAttribute('data-part', 'file-list');
  fileListEl.setAttribute('role', 'list');
  fileListEl.setAttribute('aria-label', 'Changed files');
  root.appendChild(fileListEl);

  const diffPanelEl = document.createElement('div');
  diffPanelEl.setAttribute('data-part', 'diff-panel');
  diffPanelEl.setAttribute('role', 'document');
  diffPanelEl.setAttribute('tabindex', '0');
  root.appendChild(diffPanelEl);

  modeToggleEl.addEventListener('click', () => {
    const next = currentProps.mode === 'side-by-side' ? 'unified' : 'side-by-side';
    currentProps.onModeChange?.(next);
  });
  cleanups.push(() => {});

  function renderFileList() {
    fileListEl.innerHTML = '';
    if (!currentProps.showFileList || !currentProps.files) { fileListEl.style.display = 'none'; return; }
    fileListEl.style.display = '';
    currentProps.files.forEach(f => {
      const item = document.createElement('div');
      item.setAttribute('data-part', 'file-item');
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');
      const nameSpan = document.createElement('span');
      nameSpan.setAttribute('data-part', 'file-item-name');
      nameSpan.textContent = f.fileName;
      item.appendChild(nameSpan);
      const statsSpan = document.createElement('span');
      statsSpan.setAttribute('data-part', 'file-item-stats');
      statsSpan.textContent = '+' + f.additions + ' -' + f.deletions;
      item.appendChild(statsSpan);
      item.addEventListener('click', () => currentProps.onFileSelect?.(f.fileName));
      item.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') currentProps.onFileSelect?.(f.fileName); });
      fileListEl.appendChild(item);
    });
  }

  function sync() {
    const loading = currentProps.loading ?? false;
    root.setAttribute('data-state', loading ? 'loading' : 'idle');
    root.setAttribute('aria-busy', loading ? 'true' : 'false');
    root.setAttribute('data-mode', currentProps.mode ?? 'unified');
    modeToggleEl.textContent = currentProps.mode === 'side-by-side' ? 'Unified' : 'Side by side';
    const adds = currentProps.additions ?? 0;
    const dels = currentProps.deletions ?? 0;
    changeStatsEl.textContent = '+' + adds + ' -' + dels;
    renderFileList();
    if (currentProps.fileName) root.setAttribute('data-filename', currentProps.fileName);
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createDiffViewer;
