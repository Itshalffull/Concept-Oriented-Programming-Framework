import { uid } from '../shared/uid.js';

export interface FileDef {
  id: string;
  name: string;
  fileType: string;
  isFolder: boolean;
  path: string;
  size?: string;
  modifiedDate?: string;
}

export interface FileBrowserProps {
  files?: FileDef[];
  currentPath?: string;
  selectedIds?: string[];
  viewMode?: 'grid' | 'list';
  sortField?: string;
  sortDirection?: 'ascending' | 'descending';
  showSidebar?: boolean;
  showUpload?: boolean;
  showSearch?: boolean;
  allowMultiSelect?: boolean;
  allowRename?: boolean;
  allowDelete?: boolean;
  allowUpload?: boolean;
  allowNewFolder?: boolean;
  acceptTypes?: string;
  maxFileSize?: number;
  loading?: boolean;
  onNavigate?: (path: string) => void;
  onSelect?: (ids: string[]) => void;
  onUpload?: (files: FileList) => void;
  onDelete?: (ids: string[]) => void;
  onRename?: (id: string, name: string) => void;
  onOpen?: (id: string) => void;
  renderFileItem?: (file: FileDef) => string | HTMLElement;
  children?: string | HTMLElement;
}

export interface FileBrowserInstance {
  element: HTMLElement;
  update(props: Partial<FileBrowserProps>): void;
  destroy(): void;
}

export function createFileBrowser(options: {
  target: HTMLElement;
  props: FileBrowserProps;
}): FileBrowserInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'file-browser');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'File browser');
  root.id = id;

  const toolbarEl = document.createElement('div');
  toolbarEl.setAttribute('data-part', 'toolbar');
  toolbarEl.setAttribute('role', 'toolbar');
  toolbarEl.setAttribute('aria-label', 'File actions');
  root.appendChild(toolbarEl);

  const uploadBtn = document.createElement('button');
  uploadBtn.setAttribute('data-part', 'upload-button');
  uploadBtn.setAttribute('type', 'button');
  uploadBtn.setAttribute('aria-label', 'Upload files');
  uploadBtn.textContent = 'Upload';
  toolbarEl.appendChild(uploadBtn);

  const hiddenFileInput = document.createElement('input');
  hiddenFileInput.type = 'file';
  hiddenFileInput.multiple = true;
  hiddenFileInput.style.display = 'none';
  root.appendChild(hiddenFileInput);

  const newFolderBtn = document.createElement('button');
  newFolderBtn.setAttribute('data-part', 'new-folder-button');
  newFolderBtn.setAttribute('type', 'button');
  newFolderBtn.setAttribute('aria-label', 'New folder');
  newFolderBtn.textContent = 'New Folder';
  toolbarEl.appendChild(newFolderBtn);

  const searchInputEl = document.createElement('input');
  searchInputEl.setAttribute('data-part', 'search-input');
  searchInputEl.setAttribute('type', 'search');
  searchInputEl.setAttribute('aria-label', 'Search files');
  toolbarEl.appendChild(searchInputEl);

  const viewToggleEl = document.createElement('button');
  viewToggleEl.setAttribute('data-part', 'view-toggle');
  viewToggleEl.setAttribute('type', 'button');
  viewToggleEl.setAttribute('aria-label', 'Switch view mode');
  toolbarEl.appendChild(viewToggleEl);

  const breadcrumbEl = document.createElement('nav');
  breadcrumbEl.setAttribute('data-part', 'breadcrumb');
  breadcrumbEl.setAttribute('aria-label', 'File path');
  root.appendChild(breadcrumbEl);

  const dropZoneEl = document.createElement('div');
  dropZoneEl.setAttribute('data-part', 'drop-zone');
  dropZoneEl.setAttribute('role', 'region');
  dropZoneEl.setAttribute('aria-label', 'Drop files here to upload');
  root.appendChild(dropZoneEl);

  const contentEl = document.createElement('div');
  contentEl.setAttribute('data-part', 'content');
  contentEl.setAttribute('role', 'grid');
  contentEl.setAttribute('aria-label', 'Files and folders');
  root.appendChild(contentEl);

  uploadBtn.addEventListener('click', () => { hiddenFileInput.click(); });
  cleanups.push(() => {});
  hiddenFileInput.addEventListener('change', () => { if (hiddenFileInput.files) currentProps.onUpload?.(hiddenFileInput.files); });
  viewToggleEl.addEventListener('click', () => {
    const next = currentProps.viewMode === 'grid' ? 'list' : 'grid';
    currentProps.viewMode = next;
    sync();
  });

  dropZoneEl.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneEl.setAttribute('data-state', 'active'); });
  dropZoneEl.addEventListener('dragleave', () => { dropZoneEl.setAttribute('data-state', 'idle'); });
  dropZoneEl.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZoneEl.setAttribute('data-state', 'idle');
    if (e.dataTransfer?.files) currentProps.onUpload?.(e.dataTransfer.files);
  });

  function renderBreadcrumb() {
    breadcrumbEl.innerHTML = '';
    const parts = (currentProps.currentPath ?? '/').split('/').filter(Boolean);
    const homeCrumb = document.createElement('button');
    homeCrumb.setAttribute('type', 'button');
    homeCrumb.textContent = 'Home';
    homeCrumb.addEventListener('click', () => currentProps.onNavigate?.('/'));
    breadcrumbEl.appendChild(homeCrumb);
    parts.forEach((p, i) => {
      const sep = document.createElement('span');
      sep.textContent = ' / ';
      breadcrumbEl.appendChild(sep);
      const crumb = document.createElement('button');
      crumb.setAttribute('type', 'button');
      crumb.textContent = p;
      crumb.addEventListener('click', () => currentProps.onNavigate?.('/' + parts.slice(0, i + 1).join('/')));
      breadcrumbEl.appendChild(crumb);
    });
  }

  function renderFiles() {
    contentEl.innerHTML = '';
    const selected = new Set(currentProps.selectedIds ?? []);
    (currentProps.files ?? []).forEach(f => {
      const item = document.createElement('div');
      item.setAttribute('data-part', 'file-item');
      item.setAttribute('role', 'row');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-selected', selected.has(f.id) ? 'true' : 'false');
      item.setAttribute('data-file-type', f.isFolder ? 'folder' : f.fileType);
      const icon = document.createElement('span');
      icon.setAttribute('data-part', 'file-icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = f.isFolder ? '\ud83d\udcc1' : '\ud83d\udcc4';
      item.appendChild(icon);
      const nameEl = document.createElement('span');
      nameEl.setAttribute('data-part', 'file-name');
      nameEl.textContent = f.name;
      item.appendChild(nameEl);
      const meta = document.createElement('span');
      meta.setAttribute('data-part', 'file-meta');
      meta.textContent = [f.size, f.modifiedDate].filter(Boolean).join(' | ');
      item.appendChild(meta);
      item.addEventListener('click', (e) => {
        if ((e as MouseEvent).detail === 2) {
          if (f.isFolder) currentProps.onNavigate?.(f.path);
          else currentProps.onOpen?.(f.id);
        } else {
          currentProps.onSelect?.([f.id]);
        }
      });
      item.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') {
          if (f.isFolder) currentProps.onNavigate?.(f.path);
          else currentProps.onOpen?.(f.id);
        } else if ((e as KeyboardEvent).key === 'Delete' && currentProps.allowDelete) {
          currentProps.onDelete?.([f.id]);
        }
      });
      contentEl.appendChild(item);
    });
  }

  function sync() {
    const loading = currentProps.loading ?? false;
    root.setAttribute('data-state', loading ? 'loading' : 'idle');
    root.setAttribute('aria-busy', loading ? 'true' : 'false');
    root.setAttribute('data-view', currentProps.viewMode ?? 'list');
    viewToggleEl.textContent = currentProps.viewMode === 'grid' ? 'List' : 'Grid';
    uploadBtn.style.display = currentProps.allowUpload !== false ? '' : 'none';
    newFolderBtn.style.display = currentProps.allowNewFolder !== false ? '' : 'none';
    searchInputEl.style.display = currentProps.showSearch !== false ? '' : 'none';
    renderBreadcrumb();
    renderFiles();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createFileBrowser;
