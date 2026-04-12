'use client';

/**
 * WorkspaceSwitcher — Dropdown for switching and managing named workspaces
 * Implements clef-base/widgets/workspace-switcher.widget
 * Section 5.11.3
 */

import React, { useReducer, useCallback, useRef, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// FSM — panel machine (closed | open) x operation machine (idle | editing | confirming-delete)
// ---------------------------------------------------------------------------

type PanelState = 'closed' | 'open';
type OperationState = 'idle' | 'editing' | 'confirming-delete';

interface WorkspaceSwitcherFSM {
  panel: PanelState;
  operation: OperationState;
}

type PanelEvent = 'OPEN' | 'CLOSE' | 'ESCAPE' | 'SELECT';
type OperationEvent =
  | 'BEGIN_RENAME'
  | 'COMMIT_RENAME'
  | 'CANCEL_RENAME'
  | 'BEGIN_DELETE'
  | 'CONFIRM_DELETE'
  | 'CANCEL_DELETE';

type SwitcherEvent = PanelEvent | OperationEvent;

function fsmReducer(state: WorkspaceSwitcherFSM, event: SwitcherEvent): WorkspaceSwitcherFSM {
  switch (event) {
    case 'OPEN':
      if (state.panel === 'closed') return { ...state, panel: 'open' };
      return state;
    case 'CLOSE':
    case 'ESCAPE':
      return { panel: 'closed', operation: 'idle' };
    case 'SELECT':
      return { panel: 'closed', operation: 'idle' };
    case 'BEGIN_RENAME':
      if (state.operation === 'idle') return { ...state, operation: 'editing' };
      return state;
    case 'COMMIT_RENAME':
    case 'CANCEL_RENAME':
      if (state.operation === 'editing') return { ...state, operation: 'idle' };
      return state;
    case 'BEGIN_DELETE':
      if (state.operation === 'idle') return { ...state, operation: 'confirming-delete' };
      return state;
    case 'CONFIRM_DELETE':
    case 'CANCEL_DELETE':
      if (state.operation === 'confirming-delete') return { ...state, operation: 'idle' };
      return state;
    default:
      return state;
  }
}

const initialFSM: WorkspaceSwitcherFSM = { panel: 'closed', operation: 'idle' };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceItem {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WorkspaceSwitcherProps {
  workspaces?: WorkspaceItem[];
  currentWorkspace?: string | null;
  canCreate?: boolean;
  canDelete?: boolean;
  canRename?: boolean;
  disabled?: boolean;
  /** Called when a workspace is selected */
  onSelect?: (id: string) => void;
  /** Called when a new workspace should be created */
  onCreate?: () => void;
  /** Called when rename is committed with the new name */
  onRename?: (id: string, newName: string) => void;
  /** Called when a workspace deletion is confirmed */
  onDelete?: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  workspaces = [],
  currentWorkspace = null,
  canCreate = true,
  canDelete = true,
  canRename = true,
  disabled = false,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  className,
  style,
}) => {
  const [fsm, dispatch] = useReducer(fsmReducer, initialFSM);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const dropdownId = 'workspace-switcher-dropdown';
  const renameInputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Focus first item when panel opens
  useEffect(() => {
    if (fsm.panel === 'open') {
      const activeIndex = workspaces.findIndex((w) => w.active);
      setFocusedIndex(activeIndex >= 0 ? activeIndex : 0);
    }
  }, [fsm.panel, workspaces]);

  // Focus rename input when entering editing state
  useEffect(() => {
    if (fsm.operation === 'editing') {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [fsm.operation]);

  // Focus confirm dialog when entering confirming-delete state
  useEffect(() => {
    if (fsm.operation === 'confirming-delete') {
      confirmRef.current?.focus();
    }
  }, [fsm.operation]);

  // Return focus to trigger on close
  useEffect(() => {
    if (fsm.panel === 'closed') {
      triggerRef.current?.focus();
    }
  }, [fsm.panel]);

  const handleTriggerClick = useCallback(() => {
    if (disabled) return;
    dispatch('OPEN');
  }, [disabled]);

  const handleSelect = useCallback(
    (id: string) => {
      dispatch('SELECT');
      onSelect?.(id);
    },
    [onSelect],
  );

  const handleBeginRename = useCallback(
    (id: string, currentName: string) => {
      setRenamingId(id);
      setRenameValue(currentName);
      dispatch('BEGIN_RENAME');
    },
    [],
  );

  const handleCommitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      onRename?.(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
    dispatch('COMMIT_RENAME');
  }, [renamingId, renameValue, onRename]);

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
    dispatch('CANCEL_RENAME');
  }, []);

  const handleBeginDelete = useCallback((id: string) => {
    setDeletingId(id);
    dispatch('BEGIN_DELETE');
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (deletingId) {
      onDelete?.(deletingId);
    }
    setDeletingId(null);
    dispatch('CONFIRM_DELETE');
  }, [deletingId, onDelete]);

  const handleCancelDelete = useCallback(() => {
    setDeletingId(null);
    dispatch('CANCEL_DELETE');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          if (fsm.operation === 'editing') {
            dispatch('CANCEL_RENAME');
          } else if (fsm.operation === 'confirming-delete') {
            dispatch('CANCEL_DELETE');
          } else {
            dispatch('ESCAPE');
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((i) => Math.min(i + 1, workspaces.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setFocusedIndex(workspaces.length - 1);
          break;
        default:
          break;
      }
    },
    [fsm.operation, workspaces.length],
  );

  const isOpen = fsm.panel === 'open';
  const isEditing = fsm.operation === 'editing';
  const isConfirming = fsm.operation === 'confirming-delete';

  return (
    <div
      data-part="workspace-switcher"
      data-state={fsm.panel}
      data-operation={fsm.operation}
      data-disabled={disabled ? 'true' : 'false'}
      onKeyDown={handleKeyDown}
      className={className}
      style={style}
    >
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-controls={dropdownId}
        aria-label={`Current workspace: ${currentWorkspace ?? 'None'}`}
        data-part="workspace-switcher-trigger"
        data-state={fsm.panel}
        disabled={disabled}
        onClick={handleTriggerClick}
      >
        <span data-part="workspace-switcher-current-name">
          {currentWorkspace ?? 'Select workspace…'}
        </span>
        <span data-part="workspace-switcher-caret" aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown panel */}
      <div
        id={dropdownId}
        role="listbox"
        aria-label="Workspaces"
        aria-orientation="vertical"
        data-part="workspace-switcher-dropdown"
        data-state={fsm.panel}
        hidden={!isOpen}
      >
        {/* Workspace items */}
        {workspaces.map((ws, i) => {
          const isRenaming = isEditing && renamingId === ws.id;
          return (
            <div
              key={ws.id}
              role="option"
              aria-selected={ws.active ? 'true' : 'false'}
              data-part="workspace-switcher-item"
              data-active={ws.active ? 'true' : 'false'}
              data-focused={i === focusedIndex ? 'true' : 'false'}
              tabIndex={i === focusedIndex ? 0 : -1}
              onClick={() => { if (!isRenaming) handleSelect(ws.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(ws.id); }}
            >
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  type="text"
                  role="textbox"
                  aria-label="Rename workspace"
                  aria-autocomplete="none"
                  data-part="workspace-switcher-rename-input"
                  data-state={fsm.operation}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') handleCommitRename();
                    else if (e.key === 'Escape') handleCancelRename();
                  }}
                  onBlur={handleCancelRename}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div data-part="workspace-switcher-item-content">
                  <div
                    data-part="workspace-switcher-name"
                  >
                    {ws.name}
                  </div>
                  {ws.description && (
                    <div
                      data-part="workspace-switcher-description"
                    >
                      {ws.description}
                    </div>
                  )}
                </div>
              )}

              {/* Per-item action buttons */}
              {!isRenaming && (
                <div data-part="workspace-switcher-item-actions" onClick={(e) => e.stopPropagation()}>
                  {canRename && (
                    <button
                      type="button"
                      aria-label={`Rename workspace: ${ws.name}`}
                      data-part="workspace-switcher-action-button"
                      disabled={disabled}
                      onClick={(e) => { e.stopPropagation(); handleBeginRename(ws.id, ws.name); }}
                    >
                      ✎
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      role="button"
                      aria-label={`Delete workspace: ${ws.name}`}
                      data-part="workspace-switcher-action-button"
                      data-variant="destructive"
                      disabled={disabled}
                      onClick={(e) => { e.stopPropagation(); handleBeginDelete(ws.id); }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Confirm delete dialog — inline */}
        {isConfirming && deletingId && (
          <div
            ref={confirmRef}
            role="alertdialog"
            aria-label="Confirm workspace deletion"
            aria-live="assertive"
            aria-modal="true"
            data-part="workspace-switcher-confirm-dialog"
            data-state={fsm.operation}
            tabIndex={-1}
          >
            <p data-part="workspace-switcher-confirm-copy">
              Delete workspace &ldquo;{workspaces.find((w) => w.id === deletingId)?.name}&rdquo;? This cannot be undone.
            </p>
            <div data-part="workspace-switcher-confirm-actions">
              <button
                type="button"
                data-part="workspace-switcher-confirm-button"
                data-variant="filled"
                onClick={handleConfirmDelete}
              >
                Delete
              </button>
              <button
                type="button"
                data-part="workspace-switcher-confirm-button"
                data-variant="outlined"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Rename input shown as overlay row when not in a specific item */}
        <div
          data-part="workspace-switcher-rename-placeholder"
          data-state={fsm.operation}
          hidden={fsm.operation !== 'editing'}
          aria-hidden={fsm.operation !== 'editing' ? 'true' : 'false'}
        />

        {/* Create button */}
        {canCreate && (
          <div data-part="workspace-switcher-create-row">
            <button
              type="button"
              role="button"
              aria-label="Create new workspace"
              data-part="workspace-switcher-create-button"
              data-variant="quiet"
              disabled={disabled}
              onClick={() => { dispatch('CLOSE'); onCreate?.(); }}
            >
              <span aria-hidden="true">＋</span> New workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceSwitcher;
