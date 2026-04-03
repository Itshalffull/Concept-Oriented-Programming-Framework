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
      setFocusedIndex(workspaces.findIndex((w) => w.active) ?? 0);
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
      data-part="root"
      data-state={fsm.panel}
      data-operation={fsm.operation}
      data-disabled={disabled ? 'true' : 'false'}
      onKeyDown={handleKeyDown}
      className={className}
      style={{ position: 'relative', display: 'inline-block', ...style }}
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
        data-part="trigger"
        data-state={fsm.panel}
        disabled={disabled}
        onClick={handleTriggerClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          padding: 'var(--spacing-xs) var(--spacing-sm)',
          background: 'var(--palette-surface-variant)',
          border: '1px solid var(--palette-outline-variant)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--palette-on-surface)',
          fontSize: 'var(--typography-label-md-size)',
          fontWeight: 'var(--typography-label-md-weight)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          minWidth: 160,
        }}
      >
        <span data-part="current-name" style={{ flex: 1, textAlign: 'left' }}>
          {currentWorkspace ?? 'Select workspace…'}
        </span>
        <span aria-hidden="true" style={{ fontSize: '0.7rem' }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown panel */}
      <div
        id={dropdownId}
        role="listbox"
        aria-label="Workspaces"
        aria-orientation="vertical"
        data-part="dropdown"
        data-state={fsm.panel}
        hidden={!isOpen}
        style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          zIndex: 200,
          minWidth: '100%',
          marginTop: 4,
          background: 'var(--palette-surface)',
          border: '1px solid var(--palette-outline-variant)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--elevation-2)',
          padding: 'var(--spacing-xs) 0',
          maxHeight: 320,
          overflowY: 'auto',
        }}
      >
        {/* Workspace items */}
        {workspaces.map((ws, i) => {
          const isRenaming = isEditing && renamingId === ws.id;
          return (
            <div
              key={ws.id}
              role="option"
              aria-selected={ws.active ? 'true' : 'false'}
              data-part="workspace-item"
              data-active={ws.active ? 'true' : 'false'}
              tabIndex={i === focusedIndex ? 0 : -1}
              onClick={() => { if (!isRenaming) handleSelect(ws.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(ws.id); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                cursor: 'pointer',
                background: ws.active
                  ? 'var(--palette-primary-container)'
                  : i === focusedIndex
                  ? 'var(--palette-surface-variant)'
                  : 'transparent',
                borderLeft: ws.active ? '3px solid var(--palette-primary)' : '3px solid transparent',
              }}
            >
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  type="text"
                  role="textbox"
                  aria-label="Rename workspace"
                  aria-autocomplete="none"
                  data-part="rename-input"
                  data-state={fsm.operation}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') handleCommitRename();
                    else if (e.key === 'Escape') handleCancelRename();
                  }}
                  onBlur={handleCancelRename}
                  style={{
                    flex: 1,
                    padding: '2px var(--spacing-xs)',
                    border: '1px solid var(--palette-primary)',
                    borderRadius: 'var(--radius-xs)',
                    background: 'var(--palette-surface)',
                    color: 'var(--palette-on-surface)',
                    fontSize: 'var(--typography-body-md-size)',
                    outline: 'none',
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    data-part="workspace-name"
                    style={{
                      fontSize: 'var(--typography-body-md-size)',
                      fontWeight: ws.active ? 'var(--typography-label-md-weight)' : 'normal',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ws.name}
                  </div>
                  {ws.description && (
                    <div
                      data-part="workspace-description"
                      style={{
                        fontSize: 'var(--typography-body-sm-size)',
                        color: 'var(--palette-on-surface-variant)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ws.description}
                    </div>
                  )}
                </div>
              )}

              {/* Per-item action buttons */}
              {!isRenaming && (
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  {canRename && (
                    <button
                      type="button"
                      aria-label={`Rename workspace: ${ws.name}`}
                      data-part="rename-button"
                      disabled={disabled}
                      onClick={(e) => { e.stopPropagation(); handleBeginRename(ws.id, ws.name); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--palette-on-surface-variant)',
                        padding: '2px 4px',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '0.75rem',
                        opacity: 0.7,
                      }}
                    >
                      ✎
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      role="button"
                      aria-label={`Delete workspace: ${ws.name}`}
                      data-part="delete-button"
                      disabled={disabled}
                      onClick={(e) => { e.stopPropagation(); handleBeginDelete(ws.id); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--palette-error)',
                        padding: '2px 4px',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '0.75rem',
                        opacity: 0.7,
                      }}
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
            data-part="confirm-dialog"
            data-state={fsm.operation}
            tabIndex={-1}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--palette-error-container)',
              color: 'var(--palette-on-error-container)',
              borderTop: '1px solid var(--palette-outline-variant)',
              borderBottom: '1px solid var(--palette-outline-variant)',
            }}
          >
            <p style={{ margin: '0 0 var(--spacing-xs)', fontSize: 'var(--typography-body-sm-size)' }}>
              Delete workspace &ldquo;{workspaces.find((w) => w.id === deletingId)?.name}&rdquo;? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
              <button
                type="button"
                data-part="button"
                data-variant="filled"
                onClick={handleConfirmDelete}
                style={{
                  padding: '4px var(--spacing-sm)',
                  background: 'var(--palette-error)',
                  color: 'var(--palette-on-error)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: 'var(--typography-label-sm-size)',
                }}
              >
                Delete
              </button>
              <button
                type="button"
                data-part="button"
                data-variant="outlined"
                onClick={handleCancelDelete}
                style={{
                  padding: '4px var(--spacing-sm)',
                  background: 'none',
                  color: 'var(--palette-on-error-container)',
                  border: '1px solid var(--palette-on-error-container)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: 'var(--typography-label-sm-size)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Rename input shown as overlay row when not in a specific item */}
        <div
          data-part="rename-input"
          data-state={fsm.operation}
          hidden={fsm.operation !== 'editing'}
          style={{ display: fsm.operation === 'editing' ? undefined : 'none' }}
          aria-hidden={fsm.operation !== 'editing' ? 'true' : 'false'}
        />

        {/* Create button */}
        {canCreate && (
          <div
            style={{
              borderTop: '1px solid var(--palette-outline-variant)',
              marginTop: 4,
              paddingTop: 4,
            }}
          >
            <button
              type="button"
              role="button"
              aria-label="Create new workspace"
              data-part="create-button"
              disabled={disabled}
              onClick={() => { dispatch('CLOSE'); onCreate?.(); }}
              style={{
                width: '100%',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                background: 'none',
                border: 'none',
                color: 'var(--palette-primary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: 'var(--typography-body-md-size)',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                opacity: disabled ? 0.5 : 1,
              }}
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
