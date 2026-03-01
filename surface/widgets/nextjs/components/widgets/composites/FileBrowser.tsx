'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type DragEvent,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { fileBrowserReducer } from './FileBrowser.reducer.js';

/* ---------------------------------------------------------------------------
 * Types derived from file-browser.widget spec props
 * ------------------------------------------------------------------------- */

export interface FileDef {
  id: string;
  name: string;
  fileType: string;
  isFolder: boolean;
  path: string;
  size?: string;
  modifiedDate?: string;
}

export interface FileBrowserProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
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
  renderFileItem?: (file: FileDef) => ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const FileBrowser = forwardRef<HTMLDivElement, FileBrowserProps>(
  function FileBrowser(
    {
      files = [],
      currentPath = '/',
      selectedIds: controlledSelectedIds,
      viewMode = 'grid',
      sortField = 'name',
      sortDirection = 'ascending',
      showSidebar = true,
      showUpload = true,
      showSearch = true,
      allowMultiSelect = true,
      allowRename = true,
      allowDelete = true,
      allowUpload = true,
      allowNewFolder = true,
      acceptTypes,
      maxFileSize,
      loading = false,
      onNavigate,
      onSelect,
      onUpload,
      onDelete,
      onRename,
      onOpen,
      renderFileItem,
      children,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(fileBrowserReducer, {
      view: viewMode,
      selection: (controlledSelectedIds?.length ?? 0) > 1 ? 'multiple' : (controlledSelectedIds?.length ?? 0) === 1 ? 'single' : 'none',
      upload: 'idle',
      sidebar: 'hidden',
      loading: loading ? 'loading' : 'idle',
      rename: 'idle',
      selectedIds: controlledSelectedIds ?? [],
      renamingId: null,
      renameValue: '',
      searchQuery: '',
    });

    const effectiveSelectedIds = controlledSelectedIds ?? state.selectedIds;
    const selectedFile = files.find((f) => effectiveSelectedIds.includes(f.id));

    const filteredFiles = state.searchQuery
      ? files.filter((f) => f.name.toLowerCase().includes(state.searchQuery.toLowerCase()))
      : files;

    const breadcrumbParts = currentPath.split('/').filter(Boolean);

    const handleSelect = useCallback(
      (id: string, e?: React.MouseEvent) => {
        if (e && (e.ctrlKey || e.metaKey) && allowMultiSelect) {
          send({ type: 'SELECT_ADDITIONAL', id });
          const next = state.selectedIds.includes(id)
            ? state.selectedIds.filter((i) => i !== id)
            : [...state.selectedIds, id];
          onSelect?.(next);
        } else {
          send({ type: 'SELECT', id });
          onSelect?.([id]);
        }
      },
      [allowMultiSelect, state.selectedIds, onSelect],
    );

    const handleDoubleClick = useCallback(
      (file: FileDef) => {
        if (file.isFolder) {
          onNavigate?.(file.path);
        } else {
          onOpen?.(file.id);
        }
      },
      [onNavigate, onOpen],
    );

    const handleDrop = useCallback(
      (e: DragEvent) => {
        e.preventDefault();
        send({ type: 'DROP' });
        if (e.dataTransfer.files.length > 0) {
          onUpload?.(e.dataTransfer.files);
        }
        send({ type: 'UPLOAD_COMPLETE' });
      },
      [onUpload],
    );

    return (
      <div
        ref={ref}
        role="region"
        aria-label="File browser"
        data-surface-widget=""
        data-widget-name="file-browser"
        data-part="root"
        data-view={state.view}
        data-state={loading ? 'loading' : files.length === 0 ? 'empty' : 'idle'}
        data-selection={state.selection}
        data-upload={state.upload === 'dragOver' ? 'drag-over' : state.upload === 'uploading' ? 'uploading' : 'idle'}
        {...rest}
      >
        {/* Toolbar */}
        <div role="toolbar" aria-label="File actions" data-part="toolbar">
          {showUpload && allowUpload && (
            <button
              type="button"
              data-part="upload-button"
              aria-label="Upload files"
              disabled={!allowUpload}
              onClick={() => send({ type: 'DRAG_ENTER' })}
            >
              Upload
            </button>
          )}

          {allowNewFolder && (
            <button
              type="button"
              data-part="new-folder-button"
              aria-label="New folder"
              disabled={!allowNewFolder}
            >
              New folder
            </button>
          )}

          {showSearch && (
            <input
              type="search"
              data-part="search-input"
              placeholder="Search files..."
              aria-label="Search files"
              value={state.searchQuery}
              onChange={(e) => send({ type: 'SET_SEARCH', value: e.target.value })}
            />
          )}

          <button
            type="button"
            data-part="view-toggle"
            aria-label="Switch view mode"
            onClick={() =>
              send({ type: state.view === 'grid' ? 'SWITCH_TO_LIST' : 'SWITCH_TO_GRID' })
            }
          >
            {state.view === 'grid' ? 'List' : 'Grid'}
          </button>
        </div>

        {/* Breadcrumb */}
        <nav data-part="breadcrumb" aria-label="File path">
          <button
            type="button"
            onClick={() => onNavigate?.('/')}
          >
            Home
          </button>
          {breadcrumbParts.map((part, i) => {
            const path = '/' + breadcrumbParts.slice(0, i + 1).join('/');
            return (
              <span key={path}>
                <span aria-hidden="true"> / </span>
                <button type="button" onClick={() => onNavigate?.(path)}>
                  {part}
                </button>
              </span>
            );
          })}
        </nav>

        {/* Drop Zone */}
        <div
          role="region"
          aria-label="Drop files here to upload"
          data-part="drop-zone"
          data-state={state.upload === 'dragOver' ? 'active' : 'idle'}
          hidden={state.upload !== 'dragOver'}
          onDragEnter={(e) => { e.preventDefault(); send({ type: 'DRAG_ENTER' }); }}
          onDragLeave={() => send({ type: 'DRAG_LEAVE' })}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          Drop files here to upload
        </div>

        {/* Content */}
        <div
          role="grid"
          aria-label="Files and folders"
          aria-multiselectable={allowMultiSelect ? 'true' : 'false'}
          aria-busy={loading ? 'true' : 'false'}
          data-part="content"
          data-view={state.view}
          onDragEnter={(e) => { e.preventDefault(); send({ type: 'DRAG_ENTER' }); }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              role="row"
              aria-selected={effectiveSelectedIds.includes(file.id) ? 'true' : 'false'}
              aria-label={file.name}
              data-part="file-item"
              data-type={file.fileType}
              data-selected={effectiveSelectedIds.includes(file.id) ? 'true' : 'false'}
              tabIndex={effectiveSelectedIds.includes(file.id) ? 0 : -1}
              onClick={(e) => handleSelect(file.id, e)}
              onDoubleClick={() => handleDoubleClick(file)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDoubleClick(file);
                if (e.key === 'F2' && allowRename) {
                  send({ type: 'START_RENAME', id: file.id, name: file.name });
                }
              }}
            >
              <span data-part="file-icon" data-type={file.fileType} aria-hidden="true" />

              {state.renamingId === file.id ? (
                <input
                  type="text"
                  data-part="file-name"
                  data-state="editing"
                  value={state.renameValue}
                  onChange={(e) => send({ type: 'UPDATE_RENAME', value: e.target.value })}
                  onBlur={() => {
                    onRename?.(file.id, state.renameValue);
                    send({ type: 'COMMIT_RENAME' });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onRename?.(file.id, state.renameValue);
                      send({ type: 'COMMIT_RENAME' });
                    }
                    if (e.key === 'Escape') send({ type: 'CANCEL_RENAME' });
                  }}
                  autoFocus
                />
              ) : (
                <span data-part="file-name" data-state="displaying">{file.name}</span>
              )}

              <span data-part="file-meta" aria-hidden="true">
                {file.size} - {file.modifiedDate}
              </span>
            </div>
          ))}
        </div>

        {/* Multi-select Bar */}
        {state.selection === 'multiple' && (
          <div
            role="toolbar"
            aria-label="Bulk actions"
            data-part="multi-select-bar"
            data-count={effectiveSelectedIds.length}
          >
            <span>{effectiveSelectedIds.length} selected</span>
            {allowDelete && (
              <button
                type="button"
                onClick={() => onDelete?.(effectiveSelectedIds)}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => send({ type: 'DESELECT_ALL' })}
            >
              Deselect all
            </button>
          </div>
        )}

        {/* Detail Sidebar */}
        {showSidebar && (
          <div
            role="complementary"
            aria-label="File details"
            data-part="detail-sidebar"
            data-state={state.sidebar}
            hidden={state.sidebar === 'hidden' || !showSidebar}
          >
            {selectedFile && (
              <>
                <div data-part="detail-preview" data-type={selectedFile.fileType} aria-label={`Preview of ${selectedFile.name}`} />
                <div data-part="detail-properties">
                  <div>Name: {selectedFile.name}</div>
                  <div>Type: {selectedFile.fileType}</div>
                  <div>Size: {selectedFile.size}</div>
                  <div>Modified: {selectedFile.modifiedDate}</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredFiles.length === 0 && (
          <div data-part="empty-state">No files</div>
        )}

        {/* Loading State */}
        {loading && (
          <div data-part="loading-state" aria-hidden="false">
            Loading...
          </div>
        )}

        {children}
      </div>
    );
  },
);

FileBrowser.displayName = 'FileBrowser';
export default FileBrowser;
