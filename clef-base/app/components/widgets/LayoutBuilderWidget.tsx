'use client';

/**
 * LayoutBuilderWidget — Administrative canvas for composing SplitLayout trees
 * Implements clef-base/widgets/layout-builder.widget
 * Section 5.11.4
 */

import React, { useReducer, useCallback, useRef, useEffect } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';

// ---------------------------------------------------------------------------
// FSM — editing machine
// (idle | dragging-split | configuring-leaf | configuring-zone | saving)
// ---------------------------------------------------------------------------

type EditingState =
  | 'idle'
  | 'dragging-split'
  | 'configuring-leaf'
  | 'configuring-zone'
  | 'saving';

type EditingEvent =
  | { type: 'BEGIN_DRAG_SPLIT'; direction: 'horizontal' | 'vertical' }
  | { type: 'DROP_SPLIT' }
  | { type: 'CANCEL_DRAG' }
  | { type: 'SELECT_LEAF'; nodeId: string }
  | { type: 'SELECT_ZONE'; nodeId: string }
  | { type: 'DESELECT' }
  | { type: 'SAVE' }
  | { type: 'SAVE_COMPLETE' }
  | { type: 'SAVE_ERROR' }
  | { type: 'ADD_PANE' }
  | { type: 'REMOVE_NODE'; id: string | null }
  | { type: 'ADJUST_RATIO'; value: number }
  | { type: 'CANCEL' };

interface LayoutBuilderFSM {
  editing: EditingState;
}

function fsmReducer(state: LayoutBuilderFSM, event: EditingEvent): LayoutBuilderFSM {
  switch (event.type) {
    case 'BEGIN_DRAG_SPLIT':
      if (state.editing === 'idle') return { editing: 'dragging-split' };
      return state;
    case 'DROP_SPLIT':
    case 'CANCEL_DRAG':
      if (state.editing === 'dragging-split') return { editing: 'idle' };
      return state;
    case 'SELECT_LEAF':
      if (state.editing === 'idle' || state.editing === 'configuring-zone') {
        return { editing: 'configuring-leaf' };
      }
      return state;
    case 'SELECT_ZONE':
      if (state.editing === 'idle' || state.editing === 'configuring-leaf') {
        return { editing: 'configuring-zone' };
      }
      return state;
    case 'DESELECT':
      if (
        state.editing === 'configuring-leaf' ||
        state.editing === 'configuring-zone'
      ) {
        return { editing: 'idle' };
      }
      return state;
    case 'SAVE':
      if (state.editing !== 'saving') return { editing: 'saving' };
      return state;
    case 'SAVE_COMPLETE':
    case 'SAVE_ERROR':
      if (state.editing === 'saving') return { editing: 'idle' };
      return state;
    default:
      return state;
  }
}

const initialFSM: LayoutBuilderFSM = { editing: 'idle' };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewOption {
  id: string;
  label: string;
}

export interface DockZoneRule {
  zoneId: string;
  rule: string;
}

/** Minimal recursive layout tree node */
export interface LayoutNode {
  id: string;
  type: 'split' | 'leaf' | 'tabGroup';
  direction?: 'horizontal' | 'vertical';
  ratio?: number;
  viewId?: string;
  children?: LayoutNode[];
  label?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LayoutBuilderWidgetProps {
  /** JSON-serialised layout tree (opaque string from spec) */
  layoutTree?: string | null;
  /** Currently selected node id */
  selectedNodeId?: string | null;
  /** Current split ratio value (0-100) */
  splitRatio?: number;
  /** Views available to assign to leaf panes */
  availableViews?: ViewOption[];
  /** Dock zone rules */
  dockZoneRules?: DockZoneRule[];
  /** Whether a save operation is in progress (controlled) */
  saving?: boolean;
  /** Globally disable all controls */
  disabled?: boolean;
  /** Slot: content rendered inside the leaf config panel */
  viewSelector?: React.ReactNode;
  /** Callbacks */
  onSplitH?: (nodeId: string) => void;
  onSplitV?: (nodeId: string) => void;
  onAddPane?: (nodeId: string) => void;
  onRemoveNode?: (nodeId: string) => void;
  onAdjustRatio?: (nodeId: string, value: number) => void;
  onSelectLeaf?: (nodeId: string) => void;
  onSelectZone?: (nodeId: string) => void;
  onDeselect?: () => void;
  onSave?: (layoutTree: string) => Promise<void>;
  onCancel?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Recursive tree preview renderer */
function TreeNode({ node, depth = 0 }: { node: LayoutNode; depth?: number }) {
  const indent = depth * 16;
  const label =
    node.type === 'split'
      ? `Split (${node.direction ?? '?'})`
      : node.type === 'tabGroup'
      ? 'Tab Group'
      : `Leaf: ${node.viewId ?? 'empty'}`;

  return (
    <div style={{ paddingLeft: indent, fontSize: 'var(--typography-body-sm-size)', lineHeight: 1.6 }}>
      <span style={{ color: 'var(--palette-on-surface-variant)', marginRight: 4 }}>
        {node.type === 'leaf' ? '◉' : '⊞'}
      </span>
      <span>{label}</span>
      {node.children?.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LayoutBuilderWidget: React.FC<LayoutBuilderWidgetProps> = ({
  layoutTree = null,
  selectedNodeId = null,
  splitRatio = 50,
  availableViews = [],
  dockZoneRules = [],
  saving: controlledSaving = false,
  disabled = false,
  viewSelector,
  onSplitH,
  onSplitV,
  onAddPane,
  onRemoveNode,
  onAdjustRatio,
  onSelectLeaf,
  onSelectZone,
  onDeselect,
  onSave,
  onCancel,
  className,
  style,
}) => {
  const invoke = useKernelInvoke();
  const [fsm, dispatch] = useReducer(fsmReducer, initialFSM);
  const leafConfigRef = useRef<HTMLDivElement>(null);
  const zoneConfigRef = useRef<HTMLDivElement>(null);
  const splitHRef = useRef<HTMLButtonElement>(null);

  // Sync controlled saving state into FSM
  useEffect(() => {
    if (controlledSaving && fsm.editing !== 'saving') {
      dispatch({ type: 'SAVE' });
    } else if (!controlledSaving && fsm.editing === 'saving') {
      dispatch({ type: 'SAVE_COMPLETE' });
    }
  }, [controlledSaving]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus management on state entry
  useEffect(() => {
    if (fsm.editing === 'configuring-leaf') leafConfigRef.current?.focus();
    if (fsm.editing === 'configuring-zone') zoneConfigRef.current?.focus();
    if (fsm.editing === 'idle') splitHRef.current?.focus();
  }, [fsm.editing]);

  const isSaving = fsm.editing === 'saving';
  const noNodeSelected = !selectedNodeId;
  const nodeControlsDisabled = noNodeSelected || disabled || isSaving;

  // Parse layout tree for tree preview
  let parsedTree: LayoutNode | null = null;
  if (layoutTree) {
    try {
      parsedTree = JSON.parse(layoutTree) as LayoutNode;
    } catch {
      parsedTree = null;
    }
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          dispatch({ type: 'DESELECT' });
          onDeselect?.();
          break;
        case 'Delete':
          if (!nodeControlsDisabled && selectedNodeId) {
            e.preventDefault();
            dispatch({ type: 'REMOVE_NODE', id: selectedNodeId });
            onRemoveNode?.(selectedNodeId);
          }
          break;
        case 'ArrowLeft':
          if (!nodeControlsDisabled && selectedNodeId) {
            e.preventDefault();
            const newVal = Math.max(0, splitRatio - 5);
            dispatch({ type: 'ADJUST_RATIO', value: newVal });
            onAdjustRatio?.(selectedNodeId, newVal);
          }
          break;
        case 'ArrowRight':
          if (!nodeControlsDisabled && selectedNodeId) {
            e.preventDefault();
            const newVal = Math.min(100, splitRatio + 5);
            dispatch({ type: 'ADJUST_RATIO', value: newVal });
            onAdjustRatio?.(selectedNodeId, newVal);
          }
          break;
        case 's':
        case 'S':
          if ((e.ctrlKey || e.metaKey) || e.key === 'S') {
            e.preventDefault();
            if (!isSaving && !disabled) {
              dispatch({ type: 'SAVE' });
              onSave?.(layoutTree ?? '{}').then(
                () => dispatch({ type: 'SAVE_COMPLETE' }),
                () => dispatch({ type: 'SAVE_ERROR' }),
              );
            }
          }
          break;
        default:
          break;
      }
    },
    [nodeControlsDisabled, selectedNodeId, splitRatio, isSaving, disabled, layoutTree, onDeselect, onRemoveNode, onAdjustRatio, onSave],
  );

  const buttonStyle = (extraDisabled = false): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    background: 'var(--palette-surface-variant)',
    border: '1px solid var(--palette-outline-variant)',
    borderRadius: 'var(--radius-sm)',
    color: disabled || extraDisabled ? 'var(--palette-on-surface-variant)' : 'var(--palette-on-surface)',
    cursor: disabled || extraDisabled ? 'not-allowed' : 'pointer',
    fontSize: 'var(--typography-label-sm-size)',
    fontWeight: 'var(--typography-label-sm-weight)',
    opacity: disabled || extraDisabled ? 0.4 : 1,
  });

  return (
    <div
      role="application"
      aria-label="Layout builder"
      data-part="root"
      data-state={fsm.editing}
      data-disabled={disabled ? 'true' : 'false'}
      onKeyDown={handleKeyDown}
      className={className}
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        gridTemplateColumns: '1fr 280px',
        gap: 0,
        height: '100%',
        minHeight: 480,
        background: 'var(--palette-surface)',
        border: '1px solid var(--palette-outline-variant)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* ---- Toolbar ---- */}
      <div
        role="toolbar"
        aria-label="Layout editing tools"
        aria-orientation="horizontal"
        data-part="toolbar"
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          padding: 'var(--spacing-xs) var(--spacing-sm)',
          borderBottom: '1px solid var(--palette-outline-variant)',
          background: 'var(--palette-surface-variant)',
        }}
      >
        <button
          ref={splitHRef}
          type="button"
          role="button"
          aria-label="Add horizontal split"
          aria-disabled={noNodeSelected ? 'true' : 'false'}
          data-part="split-h-button"
          disabled={nodeControlsDisabled}
          onClick={() => {
            if (!nodeControlsDisabled && selectedNodeId) {
              dispatch({ type: 'BEGIN_DRAG_SPLIT', direction: 'horizontal' });
              onSplitH?.(selectedNodeId);
            }
          }}
          style={buttonStyle(noNodeSelected)}
        >
          ⊟ H-Split
        </button>

        <button
          type="button"
          role="button"
          aria-label="Add vertical split"
          aria-disabled={noNodeSelected ? 'true' : 'false'}
          data-part="split-v-button"
          disabled={nodeControlsDisabled}
          onClick={() => {
            if (!nodeControlsDisabled && selectedNodeId) {
              dispatch({ type: 'BEGIN_DRAG_SPLIT', direction: 'vertical' });
              onSplitV?.(selectedNodeId);
            }
          }}
          style={buttonStyle(noNodeSelected)}
        >
          ⊞ V-Split
        </button>

        <button
          type="button"
          role="button"
          aria-label="Add pane"
          aria-disabled={noNodeSelected ? 'true' : 'false'}
          data-part="add-pane-button"
          disabled={nodeControlsDisabled}
          onClick={() => {
            if (!nodeControlsDisabled && selectedNodeId) {
              dispatch({ type: 'ADD_PANE' });
              onAddPane?.(selectedNodeId);
            }
          }}
          style={buttonStyle(noNodeSelected)}
        >
          ＋ Add pane
        </button>

        <button
          type="button"
          role="button"
          aria-label="Remove selected node"
          aria-disabled={noNodeSelected ? 'true' : 'false'}
          data-part="remove-pane-button"
          disabled={nodeControlsDisabled}
          onClick={() => {
            if (!nodeControlsDisabled && selectedNodeId) {
              dispatch({ type: 'REMOVE_NODE', id: selectedNodeId });
              onRemoveNode?.(selectedNodeId);
            }
          }}
          style={buttonStyle(noNodeSelected)}
        >
          ✕ Remove
        </button>

        <div style={{ flex: 1 }} />

        {/* Ratio slider */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--typography-label-sm-size)' }}>
          <span aria-hidden="true">Ratio</span>
          <input
            type="range"
            role="slider"
            aria-label="Split ratio"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={splitRatio}
            aria-disabled={noNodeSelected ? 'true' : 'false'}
            data-part="ratio-slider"
            min={0}
            max={100}
            value={splitRatio}
            disabled={nodeControlsDisabled}
            onChange={(e) => {
              if (!nodeControlsDisabled && selectedNodeId) {
                const val = Number(e.target.value);
                dispatch({ type: 'ADJUST_RATIO', value: val });
                onAdjustRatio?.(selectedNodeId, val);
              }
            }}
            onKeyDown={(e) => {
              // Let ArrowLeft/Right be handled by the container key handler
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopPropagation();
            }}
            style={{ width: 100 }}
          />
          <span style={{ minWidth: 28, textAlign: 'right', fontSize: 'var(--typography-body-sm-size)' }}>
            {splitRatio}%
          </span>
        </label>

        {/* Save / Cancel */}
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginLeft: 'var(--spacing-sm)' }}>
          <button
            type="button"
            role="button"
            aria-label="Cancel and discard changes"
            aria-disabled={isSaving ? 'true' : 'false'}
            data-part="cancel-button"
            data-state={fsm.editing}
            disabled={isSaving || disabled}
            onClick={() => {
              if (!isSaving && !disabled) onCancel?.();
            }}
            style={buttonStyle(isSaving)}
          >
            Cancel
          </button>

          <button
            type="button"
            role="button"
            aria-label="Save layout"
            aria-disabled={isSaving ? 'true' : 'false'}
            data-part="save-button"
            data-state={fsm.editing}
            disabled={isSaving || disabled}
            onClick={() => {
              if (!isSaving && !disabled) {
                dispatch({ type: 'SAVE' });
                onSave?.(layoutTree ?? '{}').then(
                  () => dispatch({ type: 'SAVE_COMPLETE' }),
                  () => dispatch({ type: 'SAVE_ERROR' }),
                );
              }
            }}
            style={{
              ...buttonStyle(isSaving),
              background: isSaving ? 'var(--palette-surface-variant)' : 'var(--palette-primary)',
              color: isSaving ? 'var(--palette-on-surface-variant)' : 'var(--palette-on-primary)',
              borderColor: 'transparent',
            }}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ---- Canvas ---- */}
      <div
        role="region"
        aria-label="Layout canvas"
        aria-live="polite"
        data-part="canvas"
        data-state={fsm.editing}
        style={{
          position: 'relative',
          overflow: 'auto',
          padding: 'var(--spacing-md)',
          cursor: fsm.editing === 'dragging-split' ? 'crosshair' : 'default',
          background: 'var(--palette-background)',
        }}
        onClick={() => {
          if (fsm.editing === 'dragging-split') {
            dispatch({ type: 'DROP_SPLIT' });
          } else if (fsm.editing === 'configuring-leaf' || fsm.editing === 'configuring-zone') {
            dispatch({ type: 'DESELECT' });
            onDeselect?.();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && fsm.editing === 'dragging-split') {
            dispatch({ type: 'CANCEL_DRAG' });
          }
        }}
      >
        {/* Tree preview */}
        <div
          role="img"
          aria-label="Layout tree preview"
          data-part="tree-preview"
          aria-live="polite"
          style={{
            padding: 'var(--spacing-sm)',
            background: 'var(--palette-surface-variant)',
            borderRadius: 'var(--radius-sm)',
            minHeight: 120,
            fontFamily: 'var(--typography-mono-family, monospace)',
          }}
        >
          {parsedTree ? (
            <TreeNode node={parsedTree} />
          ) : (
            <span style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)' }}>
              No layout tree — add splits to get started.
            </span>
          )}
        </div>

        {/* Dragging-split indicator */}
        {fsm.editing === 'dragging-split' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--palette-primary-container)',
              opacity: 0.15,
              pointerEvents: 'none',
              border: '2px dashed var(--palette-primary)',
              borderRadius: 'var(--radius-sm)',
            }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* ---- Property Panel ---- */}
      <div
        role="region"
        aria-label="Node properties"
        data-part="property-panel"
        data-selected-node={selectedNodeId ?? undefined}
        style={{
          borderLeft: '1px solid var(--palette-outline-variant)',
          padding: 'var(--spacing-md)',
          overflowY: 'auto',
          background: 'var(--palette-surface)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--typography-label-md-size)',
            fontWeight: 'var(--typography-label-md-weight)',
            marginBottom: 'var(--spacing-sm)',
            color: 'var(--palette-on-surface-variant)',
          }}
        >
          {selectedNodeId ? `Node: ${selectedNodeId}` : 'No node selected'}
        </div>

        {/* Leaf config panel */}
        <div
          ref={leafConfigRef}
          role="region"
          aria-label="Leaf pane configuration"
          aria-hidden={fsm.editing === 'configuring-leaf' ? 'false' : 'true'}
          data-part="leaf-config"
          data-state={fsm.editing}
          tabIndex={-1}
          hidden={fsm.editing !== 'configuring-leaf'}
          style={{ outline: 'none' }}
        >
          <div
            style={{
              fontSize: 'var(--typography-label-sm-size)',
              fontWeight: 'var(--typography-label-sm-weight)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Assign view
          </div>

          {/* viewSelector slot */}
          {viewSelector ?? (
            <select
              style={{
                width: '100%',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--palette-outline)',
                background: 'var(--palette-surface-variant)',
                color: 'var(--palette-on-surface)',
                fontSize: 'var(--typography-body-md-size)',
              }}
            >
              <option value="">Select view…</option>
              {availableViews.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* Zone config panel */}
        <div
          ref={zoneConfigRef}
          role="region"
          aria-label="Zone configuration"
          aria-hidden={fsm.editing === 'configuring-zone' ? 'false' : 'true'}
          data-part="zone-config"
          data-state={fsm.editing}
          tabIndex={-1}
          hidden={fsm.editing !== 'configuring-zone'}
          style={{ outline: 'none' }}
        >
          <div
            style={{
              fontSize: 'var(--typography-label-sm-size)',
              fontWeight: 'var(--typography-label-sm-weight)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Dock zone rules
          </div>
          {dockZoneRules.length === 0 ? (
            <p style={{ fontSize: 'var(--typography-body-sm-size)', color: 'var(--palette-on-surface-variant)' }}>
              No rules configured.
            </p>
          ) : (
            dockZoneRules.map((r) => (
              <div
                key={r.zoneId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 'var(--typography-body-sm-size)',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                <span>{r.zoneId}</span>
                <span style={{ color: 'var(--palette-on-surface-variant)' }}>{r.rule}</span>
              </div>
            ))
          )}
        </div>

        {/* Idle state — show hint */}
        {fsm.editing === 'idle' && (
          <p style={{ fontSize: 'var(--typography-body-sm-size)', color: 'var(--palette-on-surface-variant)' }}>
            Select a node in the canvas to configure it.
          </p>
        )}
      </div>
    </div>
  );
};

export default LayoutBuilderWidget;
