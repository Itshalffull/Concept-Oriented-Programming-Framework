'use client';

/**
 * RecursiveBlockEditor — thin React host for the block-editor.widget spec.
 *
 * Reads the EditSurface + ComponentMapping registries exclusively via
 * useKernelInvoke. All mutations route through ActionBinding/invoke — no
 * direct state mutations beyond React-local FSM mirroring. Pattern mirrors
 * ActionButton.tsx in this folder.
 *
 * Widget spec: surface/widgets/block-editor.widget
 * Anatomy: leftPalette (slash-menu alternative), centerPane (block list),
 *   rightRail (sidePanelDock), decorationLayer (overlays)
 *
 * PRD: docs/plans/block-editor-recursive-views-prd.md §5.7
 * Card: MAG-724
 *
 * Integration status (as of 2026-04-13):
 * - InlineMark (dc7da671) + toggle wiring (85d89558): bold / italic / code /
 *   strikethrough / subscript / superscript / link / wikilink marks operate
 *   via InlineMark/toggleMark with selection context threaded through
 *   ActionBinding parameterMap.
 * - ContentNode/clone (a6d18662): duplicate-block (Cmd+D, block-handle menu),
 *   persona-duplicate, meeting-notes-duplicate all wired end-to-end.
 * - MediaAsset/context (a6feeac7) + paste/drop handlers (85d89558, ecc13254):
 *   clipboard image + dropped files thread { focusedDocId, cursorBlockId,
 *   cursorPosition } to MediaAsset/createMedia → paste-image-to-block /
 *   drop-file-to-block syncs attach new asset to the focused doc.
 *
 * Parity pass (MAG-767, 26 cards) shipped all remaining production features:
 * drag-reorder, multi-select, keystroke undo (Patch + UndoStack),
 * placeholders, page title, smart paste, Cmd+D, smart selection, find-replace,
 * Cmd+K palette, breadcrumbs, keyboard help, slot resolver, modal stack,
 * built-but-unwired widget mounting, default panels, link hover preview,
 * media resize, focus mode, word count, offline indicator, export dialog,
 * version history, spell-check, legacy BlockEditor.tsx removed.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
import { useInvokeWithFeedback } from '../../../lib/useInvocation';
import { InvocationStatusIndicator } from './InvocationStatusIndicator';
import { safeParseJsonArray } from '../../../lib/safe-json';
import {
  notifyBlockEdit,
  getActiveAnnotations,
} from '../../services/spell-check-dispatcher';
import { SpellCheckSuggestionsPopover } from './SpellCheckSuggestionsPopover';
import { useSlotResolver, SlotMount, type SlotEntry } from './SlotResolver';
import { PageTitle } from './PageTitle';
import { convertAndInsert, hasStructuredContent } from './smart-paste-converter';
import { FindReplaceOverlay } from './FindReplaceOverlay';
import { useModalStack } from './ModalStackProvider';
import { CommandPalette } from './CommandPalette';
import { BlockHandle, BlockDropZoneIndicator } from './BlockHandle';
import { LinkHoverPreview } from './LinkHoverPreview';
import { ExportDialog } from './ExportDialog';
import { VersionHistoryBrowser } from './VersionHistoryBrowser';
import { KeyboardHelpModal } from './KeyboardHelpModal';
import { SpanGutter } from './SpanGutter';
import { useEntitySpans } from '../../../lib/use-entity-spans';

// ---------------------------------------------------------------------------
// Selection tracking — populated from document selectionchange events
// ---------------------------------------------------------------------------

export interface EditorSelection {
  blockId: string;
  rangeStart: number;
  rangeEnd: number;
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export type EditorFlavor =
  | 'markdown'
  | 'wiki'
  | 'notebook'
  | 'persona'
  | 'workflow';

export interface RecursiveBlockEditorProps {
  rootNodeId: string;
  editorFlavor: EditorFlavor;
  canEdit: boolean;
  /** Called when the user clicks a span gutter indicator. Receives the span ID. */
  onSpanClick?: (spanId: string) => void;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface BlockChild {
  id: string;
  schema: string;
  displayMode: string;
}

interface ResolvedWidget {
  widgetId: string;
  schema: string;
  displayMode: string;
}

interface EditSurfaceBundle {
  id: string;
  schema_ref: string;
  context: string;
  toolbar_widget: string | null;
  command_bindings: string[];
  panel_widgets: string[];
  input_rule_refs: string[];
  compile_action_ref: string | null;
  compile_bundle_ref: string | null;
  compile_status_field: string | null;
}

interface SlashMenuItem {
  id: string;
  label: string;
  section: string;
  icon?: string;
  kind: 'insertable' | 'command';
  bindingId?: string;
  mappingId?: string;
}

interface CompileStatus {
  status: 'compiled' | 'stale' | 'invalid' | 'never-compiled';
  lastCompiledAt: string | null;
}

// ---------------------------------------------------------------------------
// FSM state — mirrors block-editor.widget states block
// ---------------------------------------------------------------------------

type EditorState =
  | 'idle'       // no focus, no active surface
  | 'focused'    // a block is focused, surface bundle active
  | 'slash-open' // slash menu open
  | 'error';     // unrecoverable load error

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const RecursiveBlockEditor: React.FC<RecursiveBlockEditorProps> = ({
  rootNodeId,
  editorFlavor,
  canEdit,
  onSpanClick,
}) => {
  const invoke = useKernelInvoke();
  const modalStack = useModalStack();

  // ------- FSM state --------
  const [fsmState, setFsmState] = useState<EditorState>('idle');
  const [errorText, setErrorText] = useState<string>('');

  // ------- block children — from Outline/children --------
  const [children, setChildren] = useState<BlockChild[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(true);

  // ------- resolved widgets — ComponentMapping cache per child --------
  const [resolvedWidgets, setResolvedWidgets] = useState<Map<string, ResolvedWidget>>(new Map());

  // ------- root schema — for page-level EditSurface --------
  const [rootSchema, setRootSchema] = useState<string>('');

  // ------- active EditSurface bundles --------
  const [focusedBlockId, setFocusedBlockId] = useState<string>('');
  const [focusedSchema, setFocusedSchema] = useState<string>('');
  const [activeSurfaces, setActiveSurfaces] = useState<EditSurfaceBundle[]>([]);

  // ------- inline mark selection tracking --------
  // Populated by document selectionchange listener whenever a block is focused.
  // Threaded into ToolbarCommandButton context so mark-toggle bindings can
  // resolve context.selection.blockId / rangeStart / rangeEnd at invoke time.
  const [currentSelection, setCurrentSelection] = useState<EditorSelection | null>(null);
  const focusedBlockIdRef = useRef(focusedBlockId);
  useEffect(() => { focusedBlockIdRef.current = focusedBlockId; }, [focusedBlockId]);

  // ------- mark active state — tracks pressed/unpressed per binding --------
  const [activeMarks, setActiveMarks] = useState<Record<string, boolean>>({});

  // ------- slash menu --------
  const [slashItems, setSlashItems] = useState<SlashMenuItem[]>([]);
  const [slashMenuLoading, setSlashMenuLoading] = useState(false);

  // ------- page title — loaded from ContentNode/get on mount --------
  const [pageTitle, setPageTitle] = useState<string>('');

  // ------- compile surface (page-level, compilable schemas) --------
  const [compileStatus, setCompileStatus] = useState<CompileStatus | null>(null);
  const [compiledPreview, setCompiledPreview] = useState<string | null>(null);
  const [consumers, setConsumers] = useState<string[]>([]);

  // ------- version history panel state (PP-version-history) --------
  // versionHistoryOpen: true when the version-history-browser side-panel is pinned open.
  // Toggled by Cmd/Ctrl+Shift+H. The panel also appears automatically via the
  // PluginRegistry editor-panel slot resolver when the user manually enables it.
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  // ------- multi-select state (PP-multi-select) --------
  // selectedBlockIds: the Set of currently selected block IDs.
  // anchorBlockId: the block that initiated the current range (Shift+click anchor).
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
  const [anchorBlockId, setAnchorBlockId] = useState<string>('');

  // ------- find-replace overlay (PP-find-replace) --------
  // Toggled by Cmd+F (or Ctrl+F); closed by Escape.
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);

  // ------- block hover state (PP-block-handle) --------
  // Tracks which block the pointer is currently over so BlockHandle appears
  // only on the hovered row and so link-hover-preview / comment markers can
  // access the hovered block id without querying the DOM.
  const [currentHoveredBlockId, setCurrentHoveredBlockId] = useState<string>('');

  // ------- drag state (PP-block-handle) --------
  // dragOverBlockId: the block id over which the dragged block is hovering.
  // dropPosition: 'before' | 'after' — where the drop zone line is shown.
  const [dragOverBlockId, setDragOverBlockId] = useState<string>('');
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('after');

  // ------- span fragments — useEntitySpans (§4.5) --------
  // Fetches all TextSpans for the root entity and resolves them to per-block
  // fragment maps. Serialising children gives TextSpan/resolve the block IDs
  // it needs to map span anchors to specific blocks.
  const spanFragmentsByBlock = useEntitySpans(rootNodeId, JSON.stringify(children));

  // ------- stable refs --------
  const rootNodeIdRef = useRef(rootNodeId);
  useEffect(() => { rootNodeIdRef.current = rootNodeId; }, [rootNodeId]);

  // =========================================================================
  // Selection tracking — captures caret/range on every selectionchange event
  // so that InlineMark/toggleMark receives blockId + rangeStart + rangeEnd.
  // =========================================================================

  useEffect(() => {
    function onSelectionChange() {
      const blockId = focusedBlockIdRef.current;
      if (!blockId) {
        setCurrentSelection(null);
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setCurrentSelection((prev) =>
          prev && prev.blockId === blockId
            ? { blockId, rangeStart: 0, rangeEnd: 0 }
            : null,
        );
        return;
      }
      const range = sel.getRangeAt(0);
      // Walk the DOM to compute character offsets within the focused block's
      // content-editable node (data-part="block-content", data-node-id=blockId).
      const blockEl = document.querySelector(
        `[data-part="block-slot"][data-node-id="${blockId}"] [data-part="block-content"]`,
      );
      if (!blockEl || !blockEl.contains(range.commonAncestorContainer)) {
        // Selection left the focused block; keep last known selection
        return;
      }
      const preRange = document.createRange();
      preRange.selectNodeContents(blockEl);
      preRange.setEnd(range.startContainer, range.startOffset);
      const rangeStart = preRange.toString().length;
      const rangeEnd = rangeStart + range.toString().length;
      setCurrentSelection({ blockId, rangeStart, rangeEnd });
    }

    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, []); // stable — reads focusedBlockIdRef via ref

  // =========================================================================
  // Mount: load root schema + children
  // =========================================================================

  useEffect(() => {
    let cancelled = false;

    async function loadRoot() {
      try {
        // 1. Get root node to determine its schema and load the page title
        const nodeResult = await invoke('ContentNode', 'get', { node: rootNodeId });
        if (cancelled) return;
        if (nodeResult.variant === 'ok') {
          // Load title from node record (stored by ContentNode/setTitle)
          const titleField = (nodeResult as Record<string, unknown>).title;
          if (!cancelled && typeof titleField === 'string') {
            setPageTitle(titleField);
          }
          const schemaResult = await invoke('Schema', 'getSchemasFor', { entity_id: rootNodeId });
          if (!cancelled && schemaResult.variant === 'ok') {
            const schemas = safeParseJsonArray<string>(schemaResult.schemas);
            setRootSchema(schemas[0] ?? '');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setErrorText(err instanceof Error ? err.message : 'Failed to load root node');
          setFsmState('error');
        }
      }
    }

    loadRoot();
    return () => { cancelled = true; };
  }, [rootNodeId, invoke]);

  // =========================================================================
  // Load block children from Outline
  // =========================================================================

  const loadChildren = useCallback(async () => {
    setChildrenLoading(true);
    try {
      // Outline/children returns ordered child ContentNode ids
      const result = await invoke('Outline', 'children', { parent: rootNodeId });
      if (result.variant === 'ok') {
        const ids = safeParseJsonArray<string>(result.children);

        // For each child, get its schema to set up the BlockChild record
        const childRecords: BlockChild[] = await Promise.all(
          ids.map(async (childId) => {
            try {
              const schemaResult = await invoke('Schema', 'getSchemasFor', { entity_id: childId });
              const schemas: string[] = schemaResult.variant === 'ok'
                ? safeParseJsonArray<string>(schemaResult.schemas)
                : [];
              return {
                id: childId,
                schema: schemas[0] ?? 'paragraph',
                displayMode: 'block-editor',
              };
            } catch {
              return { id: childId, schema: 'paragraph', displayMode: 'block-editor' };
            }
          }),
        );

        setChildren(childRecords);

        // Resolve ComponentMapping for each child
        const widgetMap = new Map<string, ResolvedWidget>();
        await Promise.all(
          childRecords.map(async (child) => {
            try {
              const mapResult = await invoke('ComponentMapping', 'resolve', {
                schema: child.schema,
                display_mode: child.displayMode,
              });
              if (mapResult.variant === 'ok') {
                widgetMap.set(child.id, {
                  widgetId: String(mapResult.widget_id ?? 'block-slot'),
                  schema: child.schema,
                  displayMode: child.displayMode,
                });
              } else {
                widgetMap.set(child.id, {
                  widgetId: 'block-slot',
                  schema: child.schema,
                  displayMode: child.displayMode,
                });
              }
            } catch {
              widgetMap.set(child.id, {
                widgetId: 'block-slot',
                schema: child.schema,
                displayMode: child.displayMode,
              });
            }
          }),
        );
        setResolvedWidgets(widgetMap);
      }
    } catch (err) {
      console.error('[RecursiveBlockEditor] Failed to load children:', err);
    } finally {
      setChildrenLoading(false);
    }
  }, [rootNodeId, invoke]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  // =========================================================================
  // Compile surface observation (for compilable schemas like agent-persona)
  // =========================================================================

  useEffect(() => {
    if (!rootSchema) return;

    let cancelled = false;

    async function pollCompileStatus() {
      try {
        // Read ContentCompiler state for this page
        const result = await invoke('ContentCompiler', 'getStatus', { page: rootNodeId });
        if (cancelled) return;
        if (result.variant === 'ok') {
          setCompileStatus({
            status: (result.status as CompileStatus['status']) ?? 'never-compiled',
            lastCompiledAt: typeof result.lastCompiledAt === 'string' ? result.lastCompiledAt : null,
          });
        }
      } catch {
        // Compile status is non-fatal — schema may not be compilable
      }

      try {
        // Load compiled output preview
        const previewResult = await invoke('ContentCompiler', 'getOutput', { page: rootNodeId });
        if (!cancelled && previewResult.variant === 'ok') {
          setCompiledPreview(
            typeof previewResult.output === 'string' ? previewResult.output : null,
          );
        }
      } catch {
        /* non-fatal */
      }

      try {
        // Load consumers (AgentSessions using this persona, etc.)
        const consumersResult = await invoke('Backlink', 'list', {
          target: rootNodeId,
          relation: 'consumes',
        });
        if (!cancelled && consumersResult.variant === 'ok') {
          const cs = safeParseJsonArray<string>(consumersResult.backlinks);
          setConsumers(cs);
        }
      } catch {
        /* non-fatal */
      }
    }

    pollCompileStatus();

    // Observe ContentCompiler changes via kernel observation pattern
    // Using a polling interval as a fallback for Phase 1 (full kernel observation
    // subscription requires the observe API; this is the same pattern used by
    // other data-driven widgets).
    const interval = setInterval(pollCompileStatus, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [rootNodeId, rootSchema, invoke]);

  // =========================================================================
  // Focus change handler — resolves EditSurface bundles (PRD §9.1 #2)
  // =========================================================================

  const handleBlockFocus = useCallback(async (blockId: string, schema: string) => {
    setFocusedBlockId(blockId);
    setFocusedSchema(schema);
    setFsmState('focused');

    const bundles: EditSurfaceBundle[] = [];

    // 1. Page-level surface (always mounts — outermost, keyed by rootSchema)
    if (rootSchema) {
      try {
        const pageLevelResult = await invoke('EditSurface', 'resolve', {
          schema: rootSchema,
          context: 'page-level',
        });
        if (pageLevelResult.variant === 'ok' && pageLevelResult.bundle) {
          bundles.push(pageLevelResult.bundle as EditSurfaceBundle);
        }
      } catch {
        /* non-fatal — schema may not have a page-level surface */
      }
    }

    // 2. Block-level surface for focused block (innermost-wins for toolbar/context-menu)
    try {
      const blockLevelResult = await invoke('EditSurface', 'resolve', {
        schema,
        context: 'block-editor',
      });
      if (blockLevelResult.variant === 'ok' && blockLevelResult.bundle) {
        bundles.push(blockLevelResult.bundle as EditSurfaceBundle);
      }
    } catch {
      /* non-fatal — schema may not have a block-editor surface */
    }

    setActiveSurfaces(bundles);
  }, [rootSchema, invoke]);

  const handleBlockBlur = useCallback(() => {
    if (fsmState === 'focused') {
      setFsmState('idle');
      setActiveSurfaces([]);
      setFocusedBlockId('');
      setFocusedSchema('');
      setCurrentSelection(null);
      setActiveMarks({});
    }
  }, [fsmState]);

  // =========================================================================
  // Multi-select handlers (PP-multi-select)
  //
  // Three selection gestures:
  //   • Click alone       — single select (replace selection, set anchor)
  //   • Cmd/Ctrl+click    — toggle the clicked block in/out of selection
  //   • Shift+click       — range-extend from anchorBlockId to clicked block
  //
  // Keyboard:
  //   • Shift+ArrowUp/Down — range-extend upward/downward by one block
  //   • Escape             — clear all selected blocks
  //
  // All batch mutations route through ActionBinding/invoke.
  // =========================================================================

  /**
   * Compute the contiguous slice of block IDs between two block IDs
   * (inclusive on both ends). Returns an empty array when either ID is absent.
   */
  const computeRange = useCallback((fromId: string, toId: string): string[] => {
    const ids = children.map((c) => c.id);
    const fromIdx = ids.indexOf(fromId);
    const toIdx = ids.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return [];
    const lo = Math.min(fromIdx, toIdx);
    const hi = Math.max(fromIdx, toIdx);
    return ids.slice(lo, hi + 1);
  }, [children]);

  const handleBlockClick = useCallback((
    blockId: string,
    e: React.MouseEvent,
  ) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (isShift && anchorBlockId) {
      // Range extend from anchor to this block
      const range = computeRange(anchorBlockId, blockId);
      setSelectedBlockIds(new Set(range));
      // Anchor stays fixed during shift-extend
    } else if (isCtrl) {
      // Toggle individual block
      setSelectedBlockIds((prev) => {
        const next = new Set(prev);
        if (next.has(blockId)) {
          next.delete(blockId);
        } else {
          next.add(blockId);
        }
        return next;
      });
      setAnchorBlockId(blockId);
    } else {
      // Plain click: single-select
      setSelectedBlockIds(new Set([blockId]));
      setAnchorBlockId(blockId);
    }
  }, [anchorBlockId, computeRange]);

  const clearSelection = useCallback(() => {
    setSelectedBlockIds(new Set());
    setAnchorBlockId('');
  }, []);

  // =========================================================================
  // Section select — quad-click on a heading (PP-smart-selection)
  //
  // Walks forward through the children array starting from the clicked heading,
  // collecting blocks until a heading of equal or higher rank (lower level
  // number) is encountered. The clicked heading itself is always included.
  // If the clicked block is NOT a heading, this is a no-op (count-4 falls
  // back to count-3 / single-block select in BlockSlot).
  // =========================================================================

  const handleSectionSelect = useCallback((blockId: string, headingLevel: number) => {
    const ids = children.map((c) => c.id);
    const startIdx = ids.indexOf(blockId);
    if (startIdx === -1) return;

    const sectionIds: string[] = [blockId];
    for (let i = startIdx + 1; i < children.length; i++) {
      const sibling = children[i];
      const siblingLevel = resolveHeadingLevel(sibling.schema);
      // A heading with level <= current level ends the section.
      if (siblingLevel !== null && siblingLevel <= headingLevel) break;
      sectionIds.push(sibling.id);
    }

    setSelectedBlockIds(new Set(sectionIds));
    setAnchorBlockId(blockId);
  }, [children]);

  const handleMultiSelectKeyDown = useCallback((e: React.KeyboardEvent) => {
    const ids = children.map((c) => c.id);

    if (e.key === 'Escape' && selectedBlockIds.size > 0) {
      e.preventDefault();
      clearSelection();
      return;
    }

    if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      if (selectedBlockIds.size === 0) return;
      e.preventDefault();
      const currentAnchor = anchorBlockId || ids[0] || '';
      const anchorIdx = ids.indexOf(currentAnchor);
      if (anchorIdx === -1) return;

      // The "live end" of the selection is the farthest selected block
      // in the direction of movement.
      const selectedArr = Array.from(selectedBlockIds)
        .map((id) => ids.indexOf(id))
        .filter((i) => i !== -1);
      const liveIdx =
        e.key === 'ArrowUp'
          ? Math.min(...selectedArr)
          : Math.max(...selectedArr);
      const nextIdx = e.key === 'ArrowUp' ? liveIdx - 1 : liveIdx + 1;
      if (nextIdx < 0 || nextIdx >= ids.length) return;

      const nextId = ids[nextIdx];
      const range = computeRange(currentAnchor, nextId);
      setSelectedBlockIds(new Set(range));
      return;
    }

    // Batch delete via keyboard Delete/Backspace (guard: no focused text input)
    if (
      (e.key === 'Delete' || e.key === 'Backspace') &&
      selectedBlockIds.size > 0 &&
      canEdit
    ) {
      const activeEl = document.activeElement;
      const isInText =
        activeEl instanceof HTMLElement &&
        (activeEl.isContentEditable ||
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA');
      if (!isInText) {
        e.preventDefault();
        handleBatchDelete();
      }
    }
  }, [selectedBlockIds, anchorBlockId, children, canEdit, computeRange, clearSelection]); // eslint-disable-line react-hooks/exhaustive-deps

  // =========================================================================
  // Block duplicate — Cmd+D / Ctrl+D (PP-duplicate-block)
  // =========================================================================
  //
  // Single-block path:  clone focusedBlockId via ActionBinding "block-duplicate".
  // Multi-select path:  clone each selected block in order via the same binding.
  //
  // The binding target is ContentNode/clone + Outline/addChild wired through
  // the sync that reads context.blockId / context.parentId / context.insertAfter.
  // Each clone is appended immediately below its original (insertAfter = blockId).
  //
  // Undo: each clone+addChild pair is pushed onto UndoStack by the sync; the
  // multi-select path results in N individual undo steps (one per block).
  // =========================================================================

  const handleBlockDuplicate = useCallback(async () => {
    if (!canEdit) return;

    const blockIds =
      selectedBlockIds.size > 0
        ? Array.from(selectedBlockIds)
        : focusedBlockIdRef.current
          ? [focusedBlockIdRef.current]
          : [];

    if (blockIds.length === 0) return;

    // Determine the parent of each block from the children list.
    // RecursiveBlockEditor manages top-level children whose parent is rootNodeId.
    for (const blockId of blockIds) {
      try {
        await invoke('ActionBinding', 'invoke', {
          binding: 'block-duplicate',
          context: JSON.stringify({
            blockId,
            parentId: rootNodeId,
          }),
        });
      } catch (err) {
        console.error('[RecursiveBlockEditor] block-duplicate failed for block:', blockId, err);
      }
    }

    loadChildren();
  }, [selectedBlockIds, canEdit, rootNodeId, invoke, loadChildren]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedBlockIds.size === 0 || !canEdit) return;
    const ids = Array.from(selectedBlockIds);
    for (const blockId of ids) {
      try {
        await invoke('ActionBinding', 'invoke', {
          binding: 'multi-select-delete',
          context: JSON.stringify({ nodeId: blockId, rootNodeId }),
        });
      } catch (err) {
        console.error('[RecursiveBlockEditor] multi-select-delete failed for block:', blockId, err);
      }
    }
    clearSelection();
    loadChildren();
  }, [selectedBlockIds, canEdit, rootNodeId, invoke, clearSelection, loadChildren]);

  // Focus the first child block — called from PageTitle on Enter/Tab.
  // Looks for the first [data-part="block-slot"] inside the center pane.
  const handleFirstBlockFocus = useCallback(() => {
    const firstBlock = document.querySelector<HTMLElement>(
      '[data-part="block-list"] [data-part="block-slot"]',
    );
    if (firstBlock) {
      // Try to focus the inner contenteditable within the block
      const inner = firstBlock.querySelector<HTMLElement>('[contenteditable="true"]');
      (inner ?? firstBlock).focus();
    }
  }, []);

  // =========================================================================
  // Slash menu — populated from ComponentMapping (insertable) + ActionBinding
  // =========================================================================

  const openSlashMenu = useCallback(async () => {
    setFsmState('slash-open');
    setSlashMenuLoading(true);

    const items: SlashMenuItem[] = [];

    try {
      // Insertable block types from ComponentMapping
      const mappingResult = await invoke('ComponentMapping', 'listInsertable', {
        context: editorFlavor,
      });
      if (mappingResult.variant === 'ok') {
        const mappings = safeParseJsonArray<Record<string, unknown>>(mappingResult.items);
        for (const m of mappings) {
          items.push({
            id: String(m.id ?? m.name),
            label: String(m.label ?? m.name),
            section: String(m.section ?? 'Basic'),
            icon: typeof m.icon === 'string' ? m.icon : undefined,
            kind: 'insertable',
            mappingId: String(m.id ?? m.name),
          });
        }
      }
    } catch {
      /* non-fatal — fall back to empty mapping list */
    }

    try {
      // Slash commands from ActionBinding
      const bindingResult = await invoke('ActionBinding', 'listByTag', {
        tag: 'slash_command',
        context: editorFlavor,
      });
      if (bindingResult.variant === 'ok') {
        const bindings = safeParseJsonArray<Record<string, unknown>>(bindingResult.items);
        for (const b of bindings) {
          items.push({
            id: String(b.id ?? b.binding),
            label: String(b.label ?? b.binding),
            section: String(b.section ?? 'Commands'),
            icon: typeof b.icon === 'string' ? b.icon : undefined,
            kind: 'command',
            bindingId: String(b.id ?? b.binding),
          });
        }
      }
    } catch {
      /* non-fatal */
    }

    setSlashItems(items);
    setSlashMenuLoading(false);
  }, [editorFlavor, invoke]);

  const closeSlashMenu = useCallback(() => {
    if (fsmState === 'slash-open') {
      setFsmState(focusedSchema ? 'focused' : 'idle');
    }
  }, [fsmState, focusedSchema]);

  // =========================================================================
  // Empty-state: create first paragraph block on click or keypress so user
  // has somewhere to start typing. Reuses the insert-block ActionBinding
  // (same path the slash menu uses).
  // =========================================================================

  const handleCreateFirstBlock = useCallback(async () => {
    if (!canEdit) return;
    try {
      const id = `${rootNodeId}:block:${Date.now()}`;
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'insert-block',
        context: JSON.stringify({
          id,
          rootNodeId,
          schema: 'paragraph',
          displayMode: 'block-editor',
          content: '',
        }),
      });
      if (result.variant === 'ok' || (result.variant as string)?.startsWith('pending')) {
        await loadChildren();
      }
    } catch (err) {
      console.warn('[RecursiveBlockEditor] handleCreateFirstBlock failed:', err);
    }
  }, [canEdit, rootNodeId, invoke, loadChildren]);

  // =========================================================================
  // Slash menu item activation
  // =========================================================================

  const handleSlashItemActivate = useCallback(async (item: SlashMenuItem) => {
    closeSlashMenu();
    try {
      if (item.kind === 'insertable' && item.mappingId) {
        // Insert a new block of this type as a child of the root node
        const result = await invoke('ActionBinding', 'invoke', {
          binding: 'insert-block',
          context: JSON.stringify({
            rootNodeId,
            schema: item.mappingId,
            displayMode: 'block-editor',
          }),
        });
        if (result.variant === 'ok') {
          await loadChildren();
        } else {
          console.warn('[RecursiveBlockEditor] insert-block returned non-ok:', result.variant);
        }
      } else if (item.kind === 'command' && item.bindingId) {
        const result = await invoke('ActionBinding', 'invoke', {
          binding: item.bindingId,
          context: JSON.stringify({ rootNodeId, editorFlavor }),
        });
        if (result.variant !== 'ok') {
          console.warn('[RecursiveBlockEditor] slash command returned non-ok:', result.variant, item.bindingId);
        }
      }
    } catch (err) {
      console.error('[RecursiveBlockEditor] slash item activation failed:', err);
    }
  }, [rootNodeId, editorFlavor, invoke, closeSlashMenu, loadChildren]);

  // =========================================================================
  // Keyboard handler — '/' triggers slash menu
  // =========================================================================

  // =========================================================================
  // Command palette — Cmd+K (Meta+K) opens via ModalStackProvider.
  // Distinct from slash menu: palette = global navigation/commands;
  // slash menu = inline block insertion at the cursor.
  // Widget spec: surface/widgets/command-palette.widget
  // Card: PP-command-palette (df2a224d-e059-4ab4-b4b1-7c07124bfec2)
  // =========================================================================

  const openCommandPalette = useCallback(() => {
    const modalId = `command-palette-${Date.now()}`;
    modalStack.pushModal({
      id: modalId,
      widgetId: 'command-palette',
      dismissOnBackdrop: true,
      focusTrapped: true,
      onClose: () => {},
      props: {
        children: (
          <CommandPalette
            onNavigate={(nodeId) => {
              modalStack.popModal(modalId);
              // Broadcast navigation intent — page host handles routing.
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('clef:navigate', { detail: { nodeId } }),
                );
              }
            }}
            onCommand={() => {
              modalStack.popModal(modalId);
            }}
            commandContext={{ rootNodeId, editorFlavor }}
          />
        ),
      },
    });
  }, [modalStack, rootNodeId, editorFlavor]);

  // =========================================================================
  // Export dialog — Cmd+Shift+E / Ctrl+Shift+E (PP-export-dialog)
  // =========================================================================

  const openExportDialog = useCallback(() => {
    const modalId = `export-dialog-${rootNodeId}`;
    modalStack.pushModal({
      id: modalId,
      widgetId: 'export-dialog',
      dismissOnBackdrop: true,
      focusTrapped: true,
      onClose: () => {},
      props: {
        children: (
          <ExportDialog
            nodeId={rootNodeId}
            title={pageTitle || 'document'}
            onClose={() => modalStack.popModal(modalId)}
          />
        ),
      },
    });
  }, [modalStack, rootNodeId, pageTitle]);

  // =========================================================================
  // Keyboard help modal — Cmd+/ or ? (PP-keyboard-help)
  // Opens the keyboard-help-modal widget showing all registered shortcuts
  // grouped by category. Pushed via ModalStackProvider; Escape closes.
  // =========================================================================

  const openKeyboardHelp = useCallback(() => {
    const modalId = `keyboard-help-${Date.now()}`;
    modalStack.pushModal({
      id: modalId,
      widgetId: 'keyboard-help-modal',
      dismissOnBackdrop: true,
      focusTrapped: true,
      onClose: () => {},
      props: {
        children: (
          <KeyboardHelpModal
            onClose={() => modalStack.popModal(modalId)}
          />
        ),
      },
    });
  }, [modalStack]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Cmd+Shift+E / Ctrl+Shift+E — open export dialog (PP-export-dialog)
    if (e.key === 'e' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      openExportDialog();
      return;
    }
    // Cmd+/ or Ctrl+/ — open keyboard shortcuts help (PP-keyboard-help)
    if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      openKeyboardHelp();
      return;
    }
    // ? (Shift+/) without meta — also opens keyboard help when not in an input
    if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (!isInput) {
        e.preventDefault();
        e.stopPropagation();
        openKeyboardHelp();
        return;
      }
    }
    // Cmd+K / Ctrl+K — open command palette (PP-command-palette)
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      openCommandPalette();
      return;
    }
    // Cmd+Shift+H / Ctrl+Shift+H — toggle version history panel (PP-version-history)
    if (e.key === 'h' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      setVersionHistoryOpen((prev) => !prev);
      return;
    }
    // Cmd+D / Ctrl+D — duplicate focused block or all selected blocks (PP-duplicate-block)
    if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      handleBlockDuplicate();
      return;
    }
    // Cmd+F / Ctrl+F — open find-replace overlay (PP-find-replace)
    if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setFindReplaceOpen(true);
      return;
    }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      // Don't hijack slash when the user is typing inside a contentEditable block.
      // Slash-menu-from-block can still be triggered via the BlockHandle "+" button
      // or via a block-level detector that watches for '/' as the first character
      // of an empty block's body.
      const target = e.target as HTMLElement;
      if (target.isContentEditable) return;
      e.preventDefault();
      openSlashMenu();
    } else if (e.key === 'Escape') {
      if (findReplaceOpen) {
        setFindReplaceOpen(false);
        return;
      }
      if (fsmState === 'slash-open') {
        closeSlashMenu();
      }
    }
    // Multi-select keyboard handler runs unconditionally (handles Escape/arrows/delete)
    handleMultiSelectKeyDown(e);
  }, [fsmState, findReplaceOpen, openExportDialog, openKeyboardHelp, openSlashMenu, closeSlashMenu, handleMultiSelectKeyDown, openCommandPalette, handleBlockDuplicate]);

  // =========================================================================
  // Paste handler — clipboard image → MediaAsset/createMedia via ActionBinding
  // =========================================================================
  //
  // When the user pastes and the clipboard contains an image/* item, we:
  //   1. Build uploadContext JSON carrying focusedDocId (rootNodeId), the
  //      focused block id, and the current selection offset so the
  //      paste-image-to-block.sync can place the new Outline child correctly.
  //   2. Invoke the ActionBinding "media-upload-from-clipboard" with that
  //      context threaded in — the binding's parameterMap maps
  //      context.uploadContext → MediaAsset/createMedia context parameter.
  //   3. After upload completes the sync fires Outline/create(parent: focusedDocId).
  //
  // The handler only matches image/* items; other clipboard types fall through
  // to the browser default. canEdit guard prevents read-only editor uploads.
  // =========================================================================

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!canEdit) return;

    // -------------------------------------------------------------------------
    // Smart-paste path (PP-smart-paste): runs BEFORE the image-paste path.
    // Intercepts clipboard content containing structured HTML or Markdown and
    // converts it into block-tree nodes. When at least one block is inserted,
    // the event is consumed and the image-paste path is skipped entirely.
    // -------------------------------------------------------------------------
    if (e.clipboardData && hasStructuredContent(e.clipboardData)) {
      e.preventDefault();
      const ctx = {
        rootNodeId,
        cursorBlockId: focusedBlockIdRef.current || null,
        cursorPosition: currentSelection?.rangeStart ?? 0,
      };
      try {
        const count = await convertAndInsert(e.clipboardData, ctx, invoke);
        if (count > 0) {
          setTimeout(() => { loadChildren(); }, 300);
          return;
        }
      } catch (err) {
        console.error('[RecursiveBlockEditor] smart-paste failed:', err);
        // Fall through to image-paste / native paste on error.
      }
    }

    // -------------------------------------------------------------------------
    // Original image-paste path (PP-2 / MAG-717): only runs when smart-paste
    // did not consume the event (no structured text content detected).
    // -------------------------------------------------------------------------
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;

    e.preventDefault();

    const uploadContext = JSON.stringify({
      focusedDocId: rootNodeId,
      cursorBlockId: focusedBlockIdRef.current || null,
      cursorPosition: currentSelection?.rangeStart ?? 0,
    });

    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'media-upload-from-clipboard',
        context: JSON.stringify({
          clipboardFile: imageItem.type,
          uploadContext,
        }),
      });
      if (result.variant !== 'ok') {
        console.warn('[RecursiveBlockEditor] media-upload-from-clipboard returned non-ok:', result.variant);
      } else {
        // The paste-image-to-block.sync will insert the block; reload children
        // after a short tick to let the sync complete.
        setTimeout(() => { loadChildren(); }, 300);
      }
    } catch (err) {
      console.error('[RecursiveBlockEditor] paste image upload failed:', err);
    }
  }, [canEdit, rootNodeId, currentSelection, invoke, loadChildren]);

  // =========================================================================
  // Drop handler — file drop → MediaAsset/createMedia via ActionBinding
  // =========================================================================
  //
  // Same pattern as paste but for drag-and-drop file events. All MIME types
  // are accepted (matching the drop-file-generic InputRule pattern "*/*").
  // uploadContext carries the same focusedDocId/cursorBlockId fields so the
  // drop-file-to-block.sync can resolve the insertion parent.
  // =========================================================================

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    if (!canEdit) return;

    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length === 0) return;

    e.preventDefault();

    const uploadContext = JSON.stringify({
      focusedDocId: rootNodeId,
      cursorBlockId: focusedBlockIdRef.current || null,
      cursorPosition: currentSelection?.rangeStart ?? 0,
    });

    // Process each dropped file sequentially through the same binding.
    for (const file of files) {
      try {
        const result = await invoke('ActionBinding', 'invoke', {
          binding: 'media-upload-from-drop',
          context: JSON.stringify({
            droppedFile: file.type || 'application/octet-stream',
            uploadContext,
          }),
        });
        if (result.variant !== 'ok') {
          console.warn('[RecursiveBlockEditor] media-upload-from-drop returned non-ok:', result.variant, file.name);
        }
      } catch (err) {
        console.error('[RecursiveBlockEditor] drop file upload failed:', err);
      }
    }

    // Reload children after all uploads are dispatched.
    setTimeout(() => { loadChildren(); }, 300);
  }, [canEdit, rootNodeId, currentSelection, invoke, loadChildren]);

  // =========================================================================
  // Compile actions (page-level surface: agent-persona, etc.)
  // =========================================================================

  const handleRecompile = useCallback(async () => {
    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'recompile-page',
        context: JSON.stringify({ page: rootNodeId }),
      });
      if (result.variant === 'ok') {
        // Optimistically mark as compiled; the observer will sync
        setCompileStatus((prev) => prev ? { ...prev, status: 'compiled', lastCompiledAt: new Date().toISOString() } : null);
      } else {
        console.warn('[RecursiveBlockEditor] recompile returned non-ok:', result.variant);
      }
    } catch (err) {
      console.error('[RecursiveBlockEditor] recompile failed:', err);
    }
  }, [rootNodeId, invoke]);

  // =========================================================================
  // Derived booleans from active surfaces (innermost-wins for block toolbar)
  // =========================================================================

  // The innermost surface is the last in the array (block-level; page-level is first)
  const innermostSurface = activeSurfaces[activeSurfaces.length - 1] ?? null;
  const pageLevalSurface = activeSurfaces[0] ?? null;

  const hasCompileSurface = !!(
    pageLevalSurface?.compile_action_ref || pageLevalSurface?.compile_bundle_ref
  );


  // =========================================================================
  // PluginRegistry slot resolvers — PP-slot-resolver (02c08cb0)
  //
  // Each hook queries PluginRegistry/getDefinitions for registered plugins of
  // that type and returns a sorted SlotEntry[]. Registering a new widget via
  // PluginRegistry/register with the matching type makes it auto-appear in
  // the corresponding editor slot with zero additional React code.
  //
  // All hooks are called unconditionally (Rules of Hooks) before any
  // conditional early returns.
  // =========================================================================

  const slotContext = { editorFlavor, rootNodeId };

  // decoration-layer — overlays rendered inside the center pane
  const decorationLayerEntries = useSlotResolver('decoration-layer', slotContext);

  // editor-panel — right-rail side panels
  // When an EditSurface is active, only show panels listed in panel_widgets;
  // otherwise show all panels where defaultEnabled=true.
  const allEditorPanelEntries = useSlotResolver('editor-panel', slotContext);
  const editorPanelEntries =
    innermostSurface?.panel_widgets && innermostSurface.panel_widgets.length > 0
      ? allEditorPanelEntries.filter((e) =>
          (innermostSurface.panel_widgets as string[]).includes(e.widgetId),
        )
      : allEditorPanelEntries.filter((e) => e.metadata.defaultEnabled === true);

  // header-slot — widgets rendered above the block tree
  const headerSlotEntries = useSlotResolver('header-slot', slotContext);

  // footer-slot — widgets rendered below the block tree
  const footerSlotEntries = useSlotResolver('footer-slot', slotContext);

  // status-bar — narrow bar at the very bottom
  const statusBarEntries = useSlotResolver('status-bar', slotContext);

  // Group slash items by section
  const slashItemsBySection = slashItems.reduce<Record<string, SlashMenuItem[]>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  // =========================================================================
  // Render
  // =========================================================================

  if (fsmState === 'error') {
    return (
      <div
        data-part="root"
        data-state="error"
        data-flavor={editorFlavor}
        role="region"
        aria-label="Block editor — error"
        style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-error)' }}
      >
        <p data-part="error-message">{errorText || 'Failed to load editor.'}</p>
      </div>
    );
  }

  return (
    <div
      data-part="root"
      data-state={fsmState}
      data-flavor={editorFlavor}
      data-can-edit={canEdit ? 'true' : 'false'}
      data-keybinding-scope="app.editor"
      role="region"
      aria-label={`Block editor — ${editorFlavor}`}
      onKeyDown={handleKeyDown}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr minmax(0, 3fr) 280px',
        gridTemplateRows: 'auto auto 1fr auto auto',
        height: '100%',
        gap: 0,
        position: 'relative',
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* header-slot — resolver-driven top-bar widgets (breadcrumbs, etc.)  */}
      {/* Widgets registered via PluginRegistry/register with                */}
      {/* type="header-slot" appear here automatically.                      */}
      {/* ------------------------------------------------------------------ */}
      {headerSlotEntries.length > 0 && (
        <div
          data-part="header-slot"
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            padding: 'var(--spacing-xs) var(--spacing-md)',
            borderBottom: '1px solid var(--palette-outline-variant)',
            background: 'var(--palette-surface-container)',
          }}
        >
          {headerSlotEntries.map((entry) => (
            <SlotMount
              key={entry.name}
              entry={entry}
              hostAttrs={{
                'data-part': 'header-mount',
                'data-node-id': rootNodeId,
                'data-editor-flavor': editorFlavor,
              }}
            />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Header — compile status badge + recompile button                    */}
      {/* ------------------------------------------------------------------ */}
      {hasCompileSurface && compileStatus && (
        <div
          data-part="compile-header"
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-xs) var(--spacing-md)',
            borderBottom: '1px solid var(--palette-outline-variant)',
            background: 'var(--palette-surface-container)',
          }}
        >
          <span
            data-part="compile-status-badge"
            data-status={compileStatus.status}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              fontSize: '12px',
              padding: '2px 8px',
              borderRadius: '12px',
              background:
                compileStatus.status === 'compiled'   ? 'var(--palette-success-container)' :
                compileStatus.status === 'stale'      ? 'var(--palette-warning-container)' :
                compileStatus.status === 'invalid'    ? 'var(--palette-error-container)'   :
                'var(--palette-surface-container-high)',
              color:
                compileStatus.status === 'compiled'   ? 'var(--palette-on-success-container)' :
                compileStatus.status === 'stale'      ? 'var(--palette-on-warning-container)' :
                compileStatus.status === 'invalid'    ? 'var(--palette-on-error-container)'   :
                'var(--palette-on-surface-variant)',
            }}
          >
            {compileStatus.status === 'compiled' && 'Compiled'}
            {compileStatus.status === 'stale'    && 'Stale'}
            {compileStatus.status === 'invalid'  && 'Invalid'}
            {compileStatus.status === 'never-compiled' && 'Never compiled'}
            {compileStatus.lastCompiledAt && (
              <span style={{ opacity: 0.7 }}>
                {' — '}
                {new Date(compileStatus.lastCompiledAt).toLocaleTimeString()}
              </span>
            )}
          </span>

          {canEdit && (compileStatus.status === 'stale' || compileStatus.status === 'never-compiled') && (
            <button
              data-part="recompile-button"
              onClick={handleRecompile}
              style={{
                fontSize: '12px',
                padding: '2px 10px',
                cursor: 'pointer',
              }}
            >
              Recompile
            </button>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Left palette — block inserter (when slash menu not used)            */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-part="left-palette"
        aria-hidden="true"
        style={{
          gridRow: hasCompileSurface && compileStatus ? 2 : '1 / -1',
          borderRight: '1px solid var(--palette-outline-variant)',
          padding: 'var(--spacing-sm)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-xs)',
        }}
      >
        {/* Palette is a secondary insertion surface — slash menu is primary */}
        <span
          style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--palette-on-surface-variant)',
            padding: '0 4px',
          }}
        >
          Blocks
        </span>
        {canEdit && (
          <button
            data-part="open-slash-menu"
            aria-label="Open block inserter"
            onClick={openSlashMenu}
            style={{ textAlign: 'left', fontSize: '12px', cursor: 'pointer' }}
          >
            + Insert block
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Center pane — block list (recursive block-slot per child)           */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-part="center-pane"
        role="main"
        aria-label="Content blocks"
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); }}
        style={{
          gridRow: hasCompileSurface && compileStatus ? 2 : '1 / -1',
          overflowY: 'auto',
          padding: 'var(--spacing-md) var(--spacing-lg)',
          position: 'relative',
        }}
      >
        {/* Page title — rendered above the block tree, bound to rootNodeId title */}
        <PageTitle
          pageId={rootNodeId}
          title={pageTitle}
          readOnly={!canEdit}
          onRequestFirstBlockFocus={handleFirstBlockFocus}
          onTitleSaved={(saved) => setPageTitle(saved)}
        />

        {/* Inline toolbar — from innermost EditSurface toolbar_widget */}
        {fsmState === 'focused' && innermostSurface?.toolbar_widget && (
          <div
            data-part="inline-toolbar"
            data-widget={innermostSurface.toolbar_widget}
            aria-label="Inline formatting toolbar"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'var(--palette-surface-container)',
              border: '1px solid var(--palette-outline)',
              borderRadius: '8px',
              padding: '4px 8px',
              marginBottom: 'var(--spacing-sm)',
              display: 'flex',
              gap: 'var(--spacing-xs)',
            }}
          >
            {/* Toolbar command buttons from innermost surface command_bindings */}
            {innermostSurface.command_bindings.map((bindingId) => (
              <ToolbarCommandButton
                key={bindingId}
                bindingId={bindingId}
                context={{ rootNodeId, editorFlavor, focusedSchema }}
                selection={currentSelection}
                isActive={activeMarks[bindingId] ?? false}
                onMarkVariant={(binding, variant) => {
                  setActiveMarks((prev) => ({
                    ...prev,
                    [binding]: variant === 'ok',
                  }));
                }}
              />
            ))}
          </div>
        )}

        {/* Block list */}
        {childrenLoading ? (
          <div
            data-part="blocks-loading"
            style={{ color: 'var(--palette-on-surface-variant)', padding: 'var(--spacing-md)' }}
            aria-live="polite"
          >
            Loading blocks...
          </div>
        ) : children.length === 0 ? (
          canEdit ? (
            <button
              type="button"
              data-part="blocks-empty"
              onClick={handleCreateFirstBlock}
              onKeyDown={(e) => {
                // Any printable key or Enter → create the first block.
                // The user's keystroke is lost (the new block starts empty)
                // but the focus follows automatically after loadChildren.
                if (e.key === 'Enter' || e.key.length === 1) {
                  e.preventDefault();
                  void handleCreateFirstBlock();
                }
              }}
              style={{
                display: 'block',
                width: '100%',
                color: 'var(--palette-on-surface-variant)',
                padding: 'var(--spacing-xl)',
                textAlign: 'left',
                fontSize: '14px',
                background: 'transparent',
                border: 'none',
                cursor: 'text',
                fontFamily: 'inherit',
              }}
            >
              Click or press a key to start writing…
            </button>
          ) : (
            <div
              data-part="blocks-empty"
              style={{
                color: 'var(--palette-on-surface-variant)',
                padding: 'var(--spacing-xl)',
                textAlign: 'center',
                fontSize: '14px',
              }}
            >
              No blocks yet.
            </div>
          )
        ) : (
          <ol
            data-part="block-list"
            aria-label="Document blocks"
            style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}
          >
            {children.map((child, childIndex) => {
              const resolved = resolvedWidgets.get(child.id);
              const isSelected = selectedBlockIds.has(child.id);
              const isHovered = currentHoveredBlockId === child.id;
              const isDragOver = dragOverBlockId === child.id;
              return (
                <li
                  key={child.id}
                  data-part="block-list-item"
                  data-block-id={child.id}
                  data-selected={isSelected ? 'true' : 'false'}
                  data-hovered={isHovered ? 'true' : 'false'}
                  onPointerEnter={() => setCurrentHoveredBlockId(child.id)}
                  onPointerLeave={() => setCurrentHoveredBlockId((prev) => prev === child.id ? '' : prev)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    setDragOverBlockId(child.id);
                    setDropPosition(e.clientY < midY ? 'before' : 'after');
                  }}
                  onDragLeave={(e) => {
                    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                      setDragOverBlockId((prev) => prev === child.id ? '' : prev);
                    }
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setDragOverBlockId('');
                    const srcBlockId = e.dataTransfer.getData('text/clef-block-id');
                    const srcParentId = e.dataTransfer.getData('text/clef-parent-id');
                    const srcIdxStr = e.dataTransfer.getData('text/clef-block-index');
                    const srcIndex = parseInt(srcIdxStr, 10);
                    if (!srcBlockId || srcBlockId === child.id) return;
                    const newIndex = dropPosition === 'before' ? childIndex : childIndex + 1;
                    try {
                      const result = await invoke('ActionBinding', 'invoke', {
                        binding: 'block-drop',
                        context: JSON.stringify({
                          blockId: srcBlockId,
                          fromParentId: srcParentId,
                          fromIndex: srcIndex,
                          toParentId: rootNodeId,
                          toIndex: newIndex,
                        }),
                      });
                      if (result.variant === 'ok') {
                        loadChildren();
                      } else {
                        console.warn('[RecursiveBlockEditor] block-drop non-ok:', result.variant);
                      }
                    } catch (err) {
                      console.error('[RecursiveBlockEditor] block-drop failed:', err);
                    }
                  }}
                  style={{ position: 'relative' }}
                >
                  {/* Drop zone indicator — above block during active drag-over */}
                  <BlockDropZoneIndicator active={isDragOver && dropPosition === 'before'} position="before" />

                  {/* Block handle — left gutter, visible on hover */}
                  {canEdit && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '-28px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'auto',
                        zIndex: 6,
                      }}
                    >
                      <BlockHandle
                        blockId={child.id}
                        parentId={rootNodeId}
                        blockIndex={childIndex}
                        canEdit={canEdit}
                        onReorder={loadChildren}
                      />
                    </div>
                  )}

                  {/* Block row — span gutter + block content */}
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    {/* Span gutter indicators (§4.5) — 16px left margin strip */}
                    <SpanGutter
                      fragments={spanFragmentsByBlock.get(child.id) ?? []}
                      onSpanClick={onSpanClick}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <BlockSlot
                        nodeId={child.id}
                        schema={child.schema}
                        displayMode={child.displayMode}
                        resolvedWidget={resolved?.widgetId ?? 'block-slot'}
                        canEdit={canEdit}
                        isSelected={isSelected}
                        onFocus={() => handleBlockFocus(child.id, child.schema)}
                        onBlur={handleBlockBlur}
                        onBlockContentChange={undefined}
                        onStructureChange={loadChildren}
                        onBlockClick={(e) => handleBlockClick(child.id, e)}
                        onSectionSelect={handleSectionSelect}
                        rootNodeId={rootNodeId}
                        editorFlavor={editorFlavor}
                        decorationLayerEntries={decorationLayerEntries}
                      />
                    </div>
                  </div>

                  {/* Drop zone indicator — below block during active drag-over */}
                  <BlockDropZoneIndicator active={isDragOver && dropPosition === 'after'} position="after" />
                </li>
              );
            })}
          </ol>
        )}

        {/* Slash menu overlay */}
        {fsmState === 'slash-open' && (
          <SlashMenuOverlay
            items={slashItemsBySection}
            loading={slashMenuLoading}
            onActivate={handleSlashItemActivate}
            onClose={closeSlashMenu}
          />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Find-replace overlay — PP-find-replace                           */}
        {/* Opens on Cmd+F; close button and Escape dismiss it.              */}
        {/* Walks block tree text, highlights matches, dispatches Patch via  */}
        {/* burst-tracker → UndoStack so Cmd+Z reverses each replacement.   */}
        {/* ---------------------------------------------------------------- */}
        {findReplaceOpen && (
          <FindReplaceOverlay
            rootNodeId={rootNodeId}
            canEdit={canEdit}
            onClose={() => setFindReplaceOpen(false)}
          />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* decoration-layer slot — root-level overlay mounts (PP-mount-built) */}
        {/* Widgets registered with perBlock=false mount here once (e.g.     */}
        {/* presence-decoration, which spans the whole editor viewport).     */}
        {/* Per-block widgets (perBlock=true or unset, e.g. comment-gutter-  */}
        {/* marker, track-changes-decoration, placeholder-decoration) mount  */}
        {/* inside each BlockSlot's block-decoration-layer instead.          */}
        {/* Examples: presence-decoration.                                   */}
        {/* ---------------------------------------------------------------- */}
        {decorationLayerEntries.filter((e) => e.metadata.perBlock === false).length > 0 && (
          <div
            data-part="decoration-layer"
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
          >
            {decorationLayerEntries
              .filter((entry) => entry.metadata.perBlock === false)
              .map((entry) => (
                <SlotMount
                  key={entry.name}
                  entry={entry}
                  hostAttrs={{
                    'data-part': 'decoration-mount',
                    'data-node-id': rootNodeId,
                    'data-editor-flavor': editorFlavor,
                  }}
                  style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                />
              ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right rail — side panel dock + compile preview + consumers          */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-part="right-rail"
        aria-label="Side panels"
        style={{
          gridRow: hasCompileSurface && compileStatus ? 2 : '1 / -1',
          borderLeft: '1px solid var(--palette-outline-variant)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        {/* editor-panel slot — resolver-driven side panels                 */}
        {/* Panels registered via PluginRegistry/register with              */}
        {/* type="editor-panel" appear here automatically. When an          */}
        {/* EditSurface is active, only panels listed in panel_widgets are  */}
        {/* shown; otherwise panels with defaultEnabled=true are shown.    */}
        {/* Examples: outline-panel, comments-panel, ai-chat-panel,        */}
        {/*           backlinks-panel, changes-panel.                       */}
        {editorPanelEntries.length > 0 && (
          <div data-part="surface-panels">
            {editorPanelEntries.map((entry) => (
              <SidePanelSlot
                key={entry.name}
                panelWidgetId={entry.widgetId}
                nodeId={rootNodeId}
                schema={focusedSchema}
              />
            ))}
          </div>
        )}

        {/* version-history-browser — pinned open via Cmd/Ctrl+Shift+H     */}
        {/* (PP-version-history). When versionHistoryOpen is true the panel */}
        {/* mounts directly here regardless of the slot resolver; when the  */}
        {/* PluginRegistry entry is also enabled both will coexist.         */}
        {versionHistoryOpen && (
          <div
            data-part="version-history-panel-mount"
            style={{ borderBottom: '1px solid var(--palette-outline-variant)' }}
          >
            <VersionHistoryBrowser
              currentNodeId={rootNodeId}
              onRestore={(restoredContent) => {
                // Re-snapshot the restored content as a new version entry so
                // the current state is preserved before overwrite.
                invoke('Version', 'snapshot', {
                  version: `restore-${Date.now()}`,
                  entity: rootNodeId,
                  data: restoredContent,
                  author: 'restore',
                }).catch((err) => {
                  console.warn('[RecursiveBlockEditor] version re-snapshot after restore failed:', err);
                });
                // Reload children so the editor reflects the restored body.
                loadChildren();
              }}
            />
          </div>
        )}

        {/* Compiled output preview (agent-persona → PromptAssembly preview, etc.) */}
        {hasCompileSurface && compiledPreview && (
          <div
            data-part="compile-preview"
            style={{
              padding: 'var(--spacing-md)',
              borderTop: '1px solid var(--palette-outline-variant)',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--palette-on-surface-variant)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              Compiled output
            </div>
            <pre
              style={{
                fontSize: '11px',
                whiteSpace: 'pre-wrap',
                background: 'var(--palette-surface-container)',
                padding: 'var(--spacing-sm)',
                borderRadius: '6px',
                maxHeight: '240px',
                overflowY: 'auto',
              }}
            >
              {compiledPreview}
            </pre>
          </div>
        )}

        {/* Consumers panel (AgentSessions using this persona, etc.) */}
        {hasCompileSurface && consumers.length > 0 && (
          <div
            data-part="consumers-panel"
            style={{
              padding: 'var(--spacing-md)',
              borderTop: '1px solid var(--palette-outline-variant)',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--palette-on-surface-variant)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              Used by {consumers.length} consumer{consumers.length !== 1 ? 's' : ''}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: '12px' }}>
              {consumers.map((c) => (
                <li
                  key={c}
                  style={{ padding: '2px 0', color: 'var(--palette-primary)' }}
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* footer-slot — resolver-driven bottom-bar widgets (word-count, etc.) */}
      {/* Widgets registered via PluginRegistry/register with                */}
      {/* type="footer-slot" appear here automatically.                      */}
      {/* ------------------------------------------------------------------ */}
      {footerSlotEntries.length > 0 && (
        <div
          data-part="footer-slot"
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-xs) var(--spacing-md)',
            borderTop: '1px solid var(--palette-outline-variant)',
            background: 'var(--palette-surface-container)',
          }}
        >
          {footerSlotEntries.map((entry) => (
            <SlotMount
              key={entry.name}
              entry={entry}
              hostAttrs={{
                'data-part': 'footer-mount',
                'data-node-id': rootNodeId,
                'data-editor-flavor': editorFlavor,
              }}
            />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* status-bar — resolver-driven narrow bar (offline-indicator, etc.)  */}
      {/* Widgets registered via PluginRegistry/register with                */}
      {/* type="status-bar" appear here automatically.                       */}
      {/* ------------------------------------------------------------------ */}
      {statusBarEntries.length > 0 && (
        <div
          data-part="status-bar"
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            padding: '2px var(--spacing-md)',
            borderTop: '1px solid var(--palette-outline-variant)',
            background: 'var(--palette-surface-container-high)',
            fontSize: '11px',
          }}
        >
          {statusBarEntries.map((entry) => (
            <SlotMount
              key={entry.name}
              entry={entry}
              hostAttrs={{
                'data-part': 'status-bar-mount',
                'data-node-id': rootNodeId,
                'data-editor-flavor': editorFlavor,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// resolveHeadingLevel — extract numeric heading level from a schema name.
//
// Supported schema patterns (PP-smart-selection):
//   'heading'   → 1  (bare heading treated as h1)
//   'heading-1' → 1
//   'heading-2' → 2
//   'heading-3' → 3  (and so on up to 6)
//   'h1'/'h2'   → 1/2  (shorthand aliases)
// Returns null for non-heading schemas.
// ===========================================================================

function resolveHeadingLevel(schema: string): number | null {
  if (!schema) return null;
  // 'heading-N' or 'h-N'
  const dashMatch = schema.match(/^(?:heading|h)-(\d)$/i);
  if (dashMatch) {
    const lvl = parseInt(dashMatch[1], 10);
    return lvl >= 1 && lvl <= 6 ? lvl : null;
  }
  // 'hN' (e.g. 'h1', 'h2')
  const hMatch = schema.match(/^h(\d)$/i);
  if (hMatch) {
    const lvl = parseInt(hMatch[1], 10);
    return lvl >= 1 && lvl <= 6 ? lvl : null;
  }
  // bare 'heading' → treat as h1
  if (schema === 'heading') return 1;
  return null;
}

// ===========================================================================
// CLICK_RESET_MS — maximum gap between successive clicks that counts as
// part of the same multi-click sequence (double/triple/quad).
// 400 ms matches most OS defaults; browser dblclick is typically 200-500 ms.
// ===========================================================================

const CLICK_RESET_MS = 400;

// ===========================================================================
// BlockSlot — generic block renderer (block-slot.widget analogue)
// Mounts the resolved widget for a given (schema, displayMode) pair.
// ===========================================================================

interface BlockSlotProps {
  nodeId: string;
  schema: string;
  displayMode: string;
  resolvedWidget: string;
  canEdit: boolean;
  /** True when this block is part of the current multi-select set. */
  isSelected?: boolean;
  onFocus: () => void;
  onBlur: () => void;
  /** Called after a successful update-block-content (or equivalent Patch). Does NOT trigger a
   * full Outline reload — use for lightweight tracking such as dirty-state indicators. */
  onBlockContentChange?: (nodeId: string, content: string) => void;
  /** Called on structural changes: block insert, delete, or reorder. Parent passes loadChildren here. */
  onStructureChange: () => void;
  /** Called on click events to propagate multi-select modifier logic upward. */
  onBlockClick?: (e: React.MouseEvent) => void;
  /**
   * Called on quadruple-click when this block is a heading.
   * The parent uses this to set selectedBlockIds to the section
   * (heading + all blocks under it until the next same-or-higher-level heading).
   * PP-smart-selection
   */
  onSectionSelect?: (blockId: string, headingLevel: number) => void;
  rootNodeId: string;
  editorFlavor: EditorFlavor;
  /** Decoration-layer slot entries resolved by the parent editor (shared across all blocks). */
  decorationLayerEntries: SlotEntry[];
}

const BlockSlot: React.FC<BlockSlotProps> = ({
  nodeId,
  schema,
  displayMode,
  resolvedWidget,
  canEdit,
  isSelected = false,
  onFocus,
  onBlur,
  onBlockContentChange,
  onStructureChange,
  onBlockClick,
  onSectionSelect,
  rootNodeId,
  editorFlavor,
  decorationLayerEntries,
}) => {
  const invoke = useKernelInvoke();

  // -------------------------------------------------------------------------
  // Multi-click tracking — double/triple/quad-click selection semantics
  // (PP-smart-selection)
  //
  // We track click count + last-click timestamp in refs (not state) so the
  // handler never causes a re-render and the count is always current at call
  // time without stale-closure issues.
  //
  //   count 1 → plain click (handed to onBlockClick for multi-select logic)
  //   count 2 → word select (native contentEditable behaviour; no action)
  //   count 3 → select entire block body text via Selection API
  //   count 4 → if heading: section-select via onSectionSelect; else: count-3
  //
  // Reset: if > CLICK_RESET_MS has elapsed since the last click, the sequence
  // restarts at 1.
  // -------------------------------------------------------------------------

  const blockContentRef = useRef<HTMLDivElement>(null);
  const hasInitializedRef = useRef(false);

  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);

  const handleSmartClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastClickTimeRef.current > CLICK_RESET_MS) {
      clickCountRef.current = 0;
    }
    lastClickTimeRef.current = now;
    clickCountRef.current += 1;
    const count = clickCountRef.current;

    if (count === 1) {
      // Plain click — propagate to parent for multi-select modifier logic.
      onBlockClick?.(e);
      return;
    }

    if (count === 2) {
      // Double-click: native contentEditable word-selection is sufficient.
      // We only need to stop the event from bubbling into the block-level
      // multi-select handler (which would overwrite the word selection with
      // a single-block selection).
      e.stopPropagation();
      return;
    }

    if (count >= 3) {
      // Triple-click (and beyond as fallback): select entire block body text.
      e.preventDefault();
      e.stopPropagation();

      const blockEl = (e.currentTarget as HTMLDivElement).querySelector<HTMLElement>(
        '[data-part="block-content"]',
      );
      if (blockEl) {
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(blockEl);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }

      if (count === 4) {
        // Quad-click: section select when block is a heading; fall back to
        // the triple-click full-body selection already applied above.
        const headingLevel = resolveHeadingLevel(schema);
        if (headingLevel !== null && onSectionSelect) {
          onSectionSelect(nodeId, headingLevel);
        }
      }
    }
  }, [schema, nodeId, onBlockClick, onSectionSelect]);

  // -------------------------------------------------------------------------
  // Per-block focus + empty state — drives placeholder-decoration overlay
  // (PP-placeholder-integration 9dbd7a7b)
  //
  // blockEmptyRef stores the empty flag in a ref rather than state so that
  // typing a character does NOT trigger a re-render (which was causing the
  // browser to reset cursor position to start on every keystroke — BEF-02).
  // The ref is updated on every input event without causing reconciliation.
  // Re-renders that already occur on focus/blur transitions (driven by
  // blockFocused state) will read the current ref value, so data-block-empty
  // stays accurate at the moments decoration consumers need it.
  // -------------------------------------------------------------------------

  const [blockFocused, setBlockFocused] = useState(false);
  const blockEmptyRef = useRef(true);

  // -------------------------------------------------------------------------
  // Spell-check popover state (PP-spell-check)
  // -------------------------------------------------------------------------

  interface SpellPopoverState {
    annotationId: string;
    suggestions: string[];
    kind: 'spelling' | 'grammar';
    anchorX: number;
    anchorY: number;
    currentText: string;
    matchStart: number;
    matchEnd: number;
  }

  const [spellPopover, setSpellPopover] = useState<SpellPopoverState | null>(null);

  // -------------------------------------------------------------------------
  // Syntax highlight decorations (LE-16)
  // Dispatches Syntax/highlight on code/latex block body changes and renders
  // the returned InlineAnnotation-shaped annotations as inline decorations.
  // -------------------------------------------------------------------------

  interface HighlightAnnotation {
    range: { start: number; end: number };
    kind: string;
    meta: string;
  }

  const [highlightAnnotations, setHighlightAnnotations] = useState<HighlightAnnotation[]>([]);
  const highlightDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHighlightableSchema = schema === 'code' || schema === 'latex' || schema === 'math';

  const dispatchHighlight = useCallback(async (text: string, language: string) => {
    if (!text.trim()) {
      setHighlightAnnotations([]);
      return;
    }
    try {
      const result = await invoke('Syntax', 'highlight', { language, text });
      if (result.variant === 'ok') {
        const raw = result.annotations;
        if (typeof raw === 'string' && raw) {
          try {
            const parsed = JSON.parse(raw) as HighlightAnnotation[];
            setHighlightAnnotations(Array.isArray(parsed) ? parsed : []);
          } catch {
            setHighlightAnnotations([]);
          }
        } else {
          setHighlightAnnotations([]);
        }
      } else if (result.variant !== 'no_provider') {
        console.warn('[BlockSlot] Syntax/highlight returned non-ok:', result.variant);
      }
    } catch (err) {
      console.warn('[BlockSlot] Syntax/highlight dispatch failed:', err);
    }
  }, [invoke]);

  // -------------------------------------------------------------------------
  // Code-block format handler (LE-16)
  // Dispatches Syntax/format and applies the returned Patch via Patch/apply,
  // which produces a single UndoStack entry through PushUndoOnReversible.
  // -------------------------------------------------------------------------

  const [isFormatting, setIsFormatting] = useState(false);

  const handleCodeFormat = useCallback(async () => {
    if (!canEdit || isFormatting) return;
    const blockEl = document.querySelector<HTMLElement>(
      `[data-node-id="${nodeId}"] [data-part="block-content"]`
    );
    const text = blockEl?.textContent ?? '';
    if (!text.trim()) return;

    // Derive language from block meta stored as data attribute or fall back to 'text'.
    const language = blockEl?.getAttribute('data-lang') ?? (schema === 'latex' || schema === 'math' ? 'latex' : 'text');

    setIsFormatting(true);
    try {
      const fmtResult = await invoke('Syntax', 'format', { language, text });
      if (fmtResult.variant === 'ok' && fmtResult.patch) {
        // Apply the Patch via kernel — the PushUndoOnReversible sync turns this
        // into a single UndoStack entry so Cmd+Z reverses the format in one step.
        await invoke('Patch', 'apply', {
          nodeId,
          patch: fmtResult.patch,
        });
        // Patch/apply is a content-level change — no structural reload needed.
        onBlockContentChange?.(nodeId, text);
      } else if (fmtResult.variant === 'no_provider') {
        console.info('[BlockSlot] Syntax/format: no provider for language:', language);
      } else if (fmtResult.variant !== 'ok') {
        console.warn('[BlockSlot] Syntax/format returned non-ok:', fmtResult.variant);
      }
    } catch (err) {
      console.error('[BlockSlot] Syntax/format dispatch failed:', err);
    } finally {
      setIsFormatting(false);
    }
  }, [canEdit, isFormatting, invoke, nodeId, schema, onBlockContentChange]);

  // -------------------------------------------------------------------------
  // Link hover preview state (PP-link-hover)
  // -------------------------------------------------------------------------

  interface LinkHoverState { targetNodeId: string; anchorRect: DOMRect; }
  const [linkHoverState, setLinkHoverState] = useState<LinkHoverState | null>(null);
  const [linkPreviewOpen, setLinkPreviewOpen] = useState(false);
  const linkEnterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linkLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolveLinkId = useCallback((el: Element): string | null => {
    const mark = el.getAttribute('data-mark');
    if (mark === 'wikilink' || mark === 'link' || mark === 'mention') {
      return el.getAttribute('data-target-node-id') || el.getAttribute('data-node-id') || el.getAttribute('data-href') || null;
    }
    if (el.getAttribute('data-resolved-widget') && el.hasAttribute('data-target-node-id')) {
      return el.getAttribute('data-target-node-id');
    }
    return null;
  }, []);

  const handleLinkMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    let t = e.target as Element | null;
    while (t && t !== e.currentTarget) {
      const id = resolveLinkId(t);
      if (id) {
        const rect = t.getBoundingClientRect();
        if (linkLeaveTimer.current !== null) { clearTimeout(linkLeaveTimer.current); linkLeaveTimer.current = null; }
        if (linkEnterTimer.current !== null) clearTimeout(linkEnterTimer.current);
        linkEnterTimer.current = setTimeout(() => {
          linkEnterTimer.current = null;
          setLinkHoverState({ targetNodeId: id, anchorRect: rect });
          setLinkPreviewOpen(true);
        }, 300);
        return;
      }
      t = t.parentElement;
    }
  }, [resolveLinkId]);

  const handleLinkMouseLeave = useCallback(() => {
    if (linkEnterTimer.current !== null) { clearTimeout(linkEnterTimer.current); linkEnterTimer.current = null; }
    linkLeaveTimer.current = setTimeout(() => { linkLeaveTimer.current = null; setLinkPreviewOpen(false); }, 100);
  }, []);

  useEffect(() => () => {
    if (linkEnterTimer.current !== null) clearTimeout(linkEnterTimer.current);
    if (linkLeaveTimer.current !== null) clearTimeout(linkLeaveTimer.current);
    // LE-16: clean up pending highlight debounce on unmount
    if (highlightDebounceRef.current !== null) clearTimeout(highlightDebounceRef.current);
  }, []);

  // BEF-01: Load initial body from storage on mount so content survives page reload.
  useEffect(() => {
    if (hasInitializedRef.current) return;
    let cancelled = false;
    async function loadBody() {
      try {
        const result = await invoke('ContentNode', 'get', { node: nodeId });
        if (cancelled || result.variant !== 'ok') return;
        const body = typeof result.content === 'string' ? result.content : '';
        if (blockContentRef.current && !hasInitializedRef.current) {
          blockContentRef.current.textContent = body;
          hasInitializedRef.current = true;
          blockEmptyRef.current = body.trim() === '';
        }
      } catch (err) {
        console.warn('[BlockSlot] initial body load failed:', err);
      }
    }
    void loadBody();
    return () => { cancelled = true; };
  }, [nodeId, invoke]);

  const closeLinkPreview = useCallback(() => {
    if (linkLeaveTimer.current !== null) { clearTimeout(linkLeaveTimer.current); linkLeaveTimer.current = null; }
    setLinkPreviewOpen(false);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const annotations = getActiveAnnotations(nodeId);
    if (annotations.length === 0) return;

    const blockEl = e.currentTarget;
    const blockText = blockEl.textContent ?? '';
    let caretOffset = 0;
    try {
      const point =
        typeof document !== 'undefined' && document.caretRangeFromPoint
          ? document.caretRangeFromPoint(e.clientX, e.clientY)
          : null;
      if (point) {
        const preRange = document.createRange();
        preRange.selectNodeContents(blockEl);
        preRange.setEnd(point.startContainer, point.startOffset);
        caretOffset = preRange.toString().length;
      }
    } catch { /* fallback: first annotation */ }

    const hit =
      annotations.find((a) => a.scope.start <= caretOffset && caretOffset <= a.scope.end)
      ?? annotations[0];
    if (!hit) return;

    e.preventDefault();
    setSpellPopover({
      annotationId: hit.annotationId,
      suggestions: hit.scope.suggestions,
      kind: hit.scope.kind,
      anchorX: e.clientX,
      anchorY: e.clientY,
      currentText: blockText,
      matchStart: hit.scope.start,
      matchEnd: hit.scope.end,
    });
  }, [nodeId]);

  const closeSpellPopover = useCallback(() => setSpellPopover(null), []);

  const handleContentEdit = useCallback(async (newContent: string) => {
    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'update-block-content',
        context: JSON.stringify({ nodeId, rootNodeId, schema, content: newContent }),
      });
      if (result.variant === 'ok') {
        // Content update — does NOT trigger a structural reload.
        onBlockContentChange?.(nodeId, newContent);
      } else {
        console.warn('[BlockSlot] update-block-content returned non-ok:', result.variant);
      }
    } catch (err) {
      console.error('[BlockSlot] content update failed:', err);
    }
  }, [nodeId, rootNodeId, schema, invoke, onBlockContentChange]);

  const handleDelete = useCallback(async () => {
    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'delete-block',
        context: JSON.stringify({ nodeId, rootNodeId }),
      });
      if (result.variant === 'ok') {
        // Block deleted — structural change, reload Outline.
        onStructureChange();
      } else {
        console.warn('[BlockSlot] delete-block returned non-ok:', result.variant);
      }
    } catch (err) {
      console.error('[BlockSlot] delete failed:', err);
    }
  }, [nodeId, rootNodeId, invoke, onStructureChange]);

  // List schemas receive the narrower "app.editor.list" scope so that Tab /
  // Shift+Tab KeyBinding entries (kb-block-list-indent, kb-block-list-outdent)
  // only fire inside list-block containers and fall through to browser focus
  // traversal everywhere else.
  const isListSchema = schema === 'bullet-list' || schema === 'numbered-list';

  return (
    <>
    <div
      data-part="block-slot"
      data-node-id={nodeId}
      data-schema={schema}
      data-display-mode={displayMode}
      data-resolved-widget={resolvedWidget}
      data-selected={isSelected ? 'true' : 'false'}
      data-block-empty={blockEmptyRef.current ? 'true' : 'false'}
      data-block-focused={blockFocused ? 'true' : 'false'}
      {...(isListSchema ? { 'data-keybinding-scope': 'app.editor.list' } : {})}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={handleSmartClick}
      style={{
        position: 'relative',
        outline: isSelected ? '2px solid var(--palette-primary)' : 'none',
        outlineOffset: '2px',
        borderRadius: '4px',
        background: isSelected ? 'var(--palette-primary-container, rgba(99,102,241,0.08))' : 'transparent',
      }}
    >
      {/* Block handle (drag + context menu affordance) — now mounted in the
          parent block-list-item by RecursiveBlockEditor. BlockSlot no longer
          owns this placeholder; removing it avoids duplicate handles. */}

      {/* The actual block widget rendering surface.
          In Phase 1, this renders a content-editable div as a placeholder.
          The full widget dispatch (heading-block.widget, paragraph-block.widget, etc.)
          requires the widget interpreter to be wired into this host. The
          data-resolved-widget attribute is the hook for that wiring. */}
      <div
        ref={blockContentRef}
        data-part="block-content"
        data-widget={resolvedWidget}
        contentEditable={canEdit}
        suppressContentEditableWarning
        spellCheck={canEdit}
        onContextMenu={handleContextMenu}
        onMouseOver={handleLinkMouseEnter}
        onMouseLeave={handleLinkMouseLeave}
        onFocus={(e) => {
          blockEmptyRef.current = (e.currentTarget.textContent ?? '').trim() === '';
          setBlockFocused(true);
        }}
        onInput={(e) => {
          if (!canEdit) return;
          const text = (e.currentTarget as HTMLDivElement).textContent ?? '';
          blockEmptyRef.current = text.trim() === '';
          notifyBlockEdit(nodeId, text, invoke);
          // LE-16: debounced syntax highlight dispatch for code/latex blocks
          if (isHighlightableSchema && text.trim()) {
            if (highlightDebounceRef.current !== null) clearTimeout(highlightDebounceRef.current);
            const lang = (e.currentTarget as HTMLDivElement).getAttribute('data-lang')
              ?? (schema === 'latex' || schema === 'math' ? 'latex' : 'text');
            highlightDebounceRef.current = setTimeout(() => {
              highlightDebounceRef.current = null;
              void dispatchHighlight(text, lang);
            }, 400);
          }
        }}
        onBlur={(e) => {
          setBlockFocused(false);
          const text = e.currentTarget.textContent ?? '';
          blockEmptyRef.current = text.trim() === '';
          handleContentEdit(text);
          onBlur();
          // LE-16: trigger highlight on blur so decorations are current when block loses focus
          if (isHighlightableSchema && text.trim()) {
            if (highlightDebounceRef.current !== null) {
              clearTimeout(highlightDebounceRef.current);
              highlightDebounceRef.current = null;
            }
            const lang = e.currentTarget.getAttribute('data-lang')
              ?? (schema === 'latex' || schema === 'math' ? 'latex' : 'text');
            void dispatchHighlight(text, lang);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();

            // Capture current text + cursor offset in the contentEditable
            const sel = window.getSelection();
            const el = blockContentRef.current;
            if (!el || !sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);

            // Compute text-offset within the contentEditable
            const preRange = range.cloneRange();
            preRange.selectNodeContents(el);
            preRange.setEnd(range.endContainer, range.endOffset);
            const before = preRange.toString();
            const full = el.textContent ?? '';
            const after = full.slice(before.length);

            // Truncate current block's DOM to `before`
            el.textContent = before;

            // Persist the truncation via update-block-content binding
            void invoke('ActionBinding', 'invoke', {
              binding: 'update-block-content',
              context: JSON.stringify({ nodeId, rootNodeId, schema, content: before }),
            });

            // Insert new block after current with `after` as body.
            // afterBlockId is the convention used by smart-paste-converter
            // for positional insertion; content carries the split remainder.
            void invoke('ActionBinding', 'invoke', {
              binding: 'insert-block',
              context: JSON.stringify({
                rootNodeId,
                schema: 'paragraph',
                displayMode: 'block-editor',
                afterBlockId: nodeId,
                content: after,
              }),
            }).then((result) => {
              if (result.variant === 'ok') {
                // Block inserted — structural change, reload Outline.
                onStructureChange();
                // TODO: focus the new block — requires a second useEffect watching
                // children and focusing the last-inserted block by position.
              }
            });
            return;
          }
          if (e.key === 'Enter' && e.shiftKey) {
            // Soft line break within block
            e.preventDefault();
            document.execCommand('insertLineBreak');
            return;
          }
        }}
        style={{
          padding: 'var(--spacing-xs) var(--spacing-sm)',
          borderRadius: '4px',
          outline: 'none',
          minHeight: '1.5em',
          lineHeight: 1.6,
          fontSize:
            schema === 'heading' ? '1.5em' :
            schema === 'code'    ? '0.875em' :
            '1em',
          fontFamily:
            schema === 'code' ? 'var(--typography-family-mono, monospace)' : 'inherit',
          fontWeight:
            schema === 'heading' ? 'var(--typography-weight-bold, 700)' : 'inherit',
          background:
            schema === 'callout' ? 'var(--palette-surface-container)' :
            schema === 'code'    ? 'var(--palette-surface-container-high)' :
            'transparent',
          borderLeft:
            schema === 'callout' ? '4px solid var(--palette-primary)' :
            schema === 'quote'   ? '4px solid var(--palette-outline)' :
            'none',
        }}
      />

      {/* LE-16: Code-block format button — Syntax/format dispatch */}
      {canEdit && isHighlightableSchema && (
        <button
          data-part="block-format"
          aria-label={`Format ${schema} block`}
          aria-disabled={isFormatting}
          disabled={isFormatting}
          onClick={(e) => { e.stopPropagation(); void handleCodeFormat(); }}
          title="Format code (Syntax/format)"
          style={{
            position: 'absolute',
            right: '28px',
            top: '4px',
            opacity: 0,
            fontSize: '11px',
            cursor: isFormatting ? 'not-allowed' : 'pointer',
            background: 'var(--palette-surface-container-high)',
            border: '1px solid var(--palette-outline-variant)',
            borderRadius: '3px',
            color: 'var(--palette-on-surface-variant)',
            padding: '1px 6px',
            lineHeight: '18px',
          }}
        >
          {isFormatting ? '…' : '{ }'}
        </button>
      )}

      {/* LE-16: Syntax highlight decoration overlay for code/latex blocks */}
      {isHighlightableSchema && highlightAnnotations.length > 0 && (
        <div
          data-part="block-highlight-layer"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
        >
          {highlightAnnotations.map((ann, i) => (
            <mark
              key={i}
              data-highlight-kind={ann.kind}
              data-highlight-meta={ann.meta}
              style={{
                position: 'absolute',
                background: 'transparent',
                // Error annotations (katex syntax errors) get a red underline;
                // other kinds get a faint background tint keyed by kind.
                borderBottom: ann.kind === 'error' ? '2px solid var(--palette-error, #b00020)' : 'none',
                opacity: 0.75,
              }}
            />
          ))}
        </div>
      )}

      {/* Delete affordance */}
      {canEdit && (
        <button
          data-part="block-delete"
          aria-label={`Delete ${schema} block`}
          onClick={handleDelete}
          style={{
            position: 'absolute',
            right: '4px',
            top: '50%',
            transform: 'translateY(-50%)',
            opacity: 0,
            fontSize: '12px',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            color: 'var(--palette-error)',
          }}
        >
          ×
        </button>
      )}
      {/* ------------------------------------------------------------------ */}
      {/* Per-block decoration-layer slot (PP-mount-built)                   */}
      {/* Iterates decoration-layer entries where perBlock !== false.        */}
      {/* Entries with perBlock=false (e.g. presence-decoration) are        */}
      {/* mounted once at editor-root level, not per block.                 */}
      {/* Each SlotMount receives blockId, schema, isEmpty, focused, and    */}
      {/* decoration-scope so block-scoped widgets can resolve per-block    */}
      {/* data (comment count, InlineAnnotation ranges, etc.).              */}
      {/* PP-placeholder-integration (9dbd7a7b), PP-mount-built            */}
      {/* ------------------------------------------------------------------ */}
      {decorationLayerEntries.filter((e) => e.metadata.perBlock !== false).length > 0 && (
        <div
          data-part="block-decoration-layer"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
        >
          {decorationLayerEntries
            .filter((entry) => entry.metadata.perBlock !== false)
            .map((entry) => (
              <SlotMount
                key={entry.name}
                entry={entry}
                hostAttrs={{
                  'data-part': 'block-decoration-mount',
                  'data-block-id': nodeId,
                  'data-node-id': nodeId,
                  'data-schema': schema,
                  'data-editor-flavor': editorFlavor,
                  'data-block-empty': blockEmptyRef.current ? 'true' : 'false',
                  'data-block-focused': blockFocused ? 'true' : 'false',
                  'data-decoration-scope': typeof entry.metadata.scope === 'string'
                    ? entry.metadata.scope
                    : '',
                }}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              />
            ))}
        </div>
      )}
    </div>

    {/* Spell-check suggestions popover — rendered via portal when active */}
    {spellPopover && (
      <SpellCheckSuggestionsPopover
        blockId={nodeId}
        annotationId={spellPopover.annotationId}
        suggestions={spellPopover.suggestions}
        kind={spellPopover.kind}
        anchorX={spellPopover.anchorX}
        anchorY={spellPopover.anchorY}
        currentText={spellPopover.currentText}
        matchStart={spellPopover.matchStart}
        matchEnd={spellPopover.matchEnd}
        onClose={closeSpellPopover}
      />
    )}

    {/* Link hover preview — rendered via portal; not focus-trapped (tooltip) */}
    {linkHoverState && (
      <LinkHoverPreview
        targetNodeId={linkHoverState.targetNodeId}
        anchorRect={linkHoverState.anchorRect}
        open={linkPreviewOpen}
        onDismiss={closeLinkPreview}
      />
    )}
    </>
  );
};

// ===========================================================================
// ToolbarCommandButton — invokes an ActionBinding from the toolbar
// ===========================================================================

// Mark-toggle binding IDs that require InlineMark/toggleMark dispatch with
// selection context. link-toggle is handled specially (href collection step).
const MARK_TOGGLE_BINDINGS = new Set([
  'bold-toggle',
  'italic-toggle',
  'code-toggle',
  'strikethrough-toggle',
  'subscript-toggle',
  'superscript-toggle',
  'link-toggle',
  'link-remove',
  'link-wrap-selection-with-url',
]);

interface ToolbarCommandButtonProps {
  bindingId: string;
  context: Record<string, unknown>;
  /** Current text selection in the focused block, or null if nothing is selected. */
  selection: EditorSelection | null;
  /** Whether this mark is currently active on the selection (pressed state). */
  isActive: boolean;
  /** Called after InlineMark/toggleMark completes with 'ok' (wrapped) or 'removed' (unwrapped). */
  onMarkVariant: (bindingId: string, variant: 'ok' | 'removed') => void;
}

/**
 * ToolbarCommandButton — INV-05 migration.
 *
 * Replaces the ad-hoc `useState(false)` executing flag with
 * `useInvokeWithFeedback`, which generates a client-side invocation id
 * immediately on click and registers it with the Invocation concept so
 * <InvocationStatusIndicator> can surface pending/ok/error state.
 *
 * The `status === 'pending'` guard replaces the old `executing` boolean
 * so the button is disabled while an invocation is in flight.
 */
const ToolbarCommandButton: React.FC<ToolbarCommandButtonProps> = ({
  bindingId,
  context,
  selection,
  isActive,
  onMarkVariant,
}) => {
  const invoke = useKernelInvoke();
  // INV-05: feedback slot replaces useState(false) executing flag.
  // isPending is synchronous (no poll lag); status is the async version.
  const { invocationId, invoke: invokeWithFeedback, isPending: executing } = useInvokeWithFeedback();
  const [label, setLabel] = useState(bindingId);

  // Load label from ActionBinding on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchLabel() {
      try {
        const result = await invoke('ActionBinding', 'get', { binding: bindingId });
        if (!cancelled && result.variant === 'ok' && typeof result.label === 'string') {
          setLabel(result.label);
        }
      } catch { /* non-fatal */ }
    }
    fetchLabel();
    return () => { cancelled = true; };
  }, [bindingId, invoke]);

  const handleClick = useCallback(async () => {
    if (executing) return;
    try {
      if (MARK_TOGGLE_BINDINGS.has(bindingId)) {
        // Build the context enriched with selection fields so the ActionBinding
        // resolver can populate parameterMap entries referencing context.selection.*
        // (e.g. blockId, rangeStart, rangeEnd, markKind).
        const selectionCtx = selection
          ? {
              blockId: selection.blockId,
              rangeStart: selection.rangeStart,
              rangeEnd: selection.rangeEnd,
            }
          : { blockId: '', rangeStart: 0, rangeEnd: 0 };

        if (!selection || selection.rangeStart === selection.rangeEnd) {
          // No range selected — mark toggles require a non-collapsed selection.
          // Silently skip rather than sending a zero-length range to the concept.
          console.info(`[ToolbarCommandButton] ${bindingId} skipped — no text selection`);
          return;
        }

        // link-toggle: collect href via link-editor widget before invoking toggleMark.
        // We invoke the link-open-editor binding first; if it returns an href in its
        // result payload we proceed with toggleMark. If not (user dismissed), bail.
        if (bindingId === 'link-toggle') {
          // link-open-editor is a UI step (not tracked as an invocation)
          const editorResult = await invoke('ActionBinding', 'invoke', {
            binding: 'link-open-editor',
            context: JSON.stringify({ ...context, selection: selectionCtx }),
          });
          if (editorResult.variant !== 'ok') {
            // User dismissed the link editor or it isn't available yet
            console.info('[ToolbarCommandButton] link-open-editor dismissed or unavailable:', editorResult.variant);
            return;
          }
          // link-open-editor is expected to return href in result.href when the user
          // confirms. Pass it along as an attribute in the toggleMark context.
          const href = typeof editorResult.href === 'string' ? editorResult.href : '';
          // INV-05: toggleMark tracked via invokeWithFeedback
          const markResult = await invokeWithFeedback('InlineMark', 'toggleMark', {
            blockId: selectionCtx.blockId,
            rangeStart: selectionCtx.rangeStart,
            rangeEnd: selectionCtx.rangeEnd,
            markKind: 'link',
            attributes: JSON.stringify({ href }),
          });
          if (markResult.variant === 'ok' || markResult.variant === 'removed') {
            onMarkVariant(bindingId, markResult.variant as 'ok' | 'removed');
          } else {
            console.warn(`[ToolbarCommandButton] InlineMark/toggleMark(link) returned:`, markResult.variant);
          }
          return;
        }

        // All other mark-toggle bindings: invoke ActionBinding/invoke with selection
        // context fields populated. INV-05: tracked via invokeWithFeedback.
        const result = await invokeWithFeedback('ActionBinding', 'invoke', {
          binding: bindingId,
          context: JSON.stringify({ ...context, selection: selectionCtx }),
        });

        if (result.variant === 'ok' || result.variant === 'removed') {
          // 'ok' = mark was applied (pressed); 'removed' = mark was unwrapped (unpressed)
          onMarkVariant(bindingId, result.variant as 'ok' | 'removed');
        } else {
          console.warn(`[ToolbarCommandButton] ${bindingId} returned non-ok:`, result.variant);
        }
      } else {
        // Non-mark binding: plain ActionBinding/invoke tracked via invokeWithFeedback.
        const result = await invokeWithFeedback('ActionBinding', 'invoke', {
          binding: bindingId,
          context: JSON.stringify(context),
        });
        if (result.variant !== 'ok') {
          console.warn(`[ToolbarCommandButton] ${bindingId} returned non-ok:`, result.variant, '— backing concept may not be shipped yet');
        }
      }
    } catch (err) {
      console.warn('[ToolbarCommandButton] invoke error (possibly missing backing concept):', err);
    }
  }, [executing, bindingId, context, selection, invoke, invokeWithFeedback, onMarkVariant]);

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <button
        data-part="toolbar-command"
        data-binding={bindingId}
        data-loading={executing ? 'true' : 'false'}
        data-active={isActive ? 'true' : 'false'}
        aria-pressed={MARK_TOGGLE_BINDINGS.has(bindingId) ? isActive : undefined}
        disabled={executing}
        aria-label={label}
        onClick={handleClick}
        style={{
          fontSize: '13px',
          padding: '2px 8px',
          cursor: executing ? 'not-allowed' : 'pointer',
          fontWeight: bindingId.includes('bold') ? 'bold' : 'normal',
          fontStyle: bindingId.includes('italic') ? 'italic' : 'normal',
          fontFamily: bindingId.includes('code') ? 'monospace' : 'inherit',
          // Pressed state: invert surface/outline so the button looks depressed
          background: isActive ? 'var(--palette-primary-container)' : undefined,
          color: isActive ? 'var(--palette-on-primary-container)' : undefined,
          outline: isActive ? '2px solid var(--palette-primary)' : undefined,
          outlineOffset: isActive ? '-2px' : undefined,
          borderRadius: '4px',
        }}
      >
        {executing ? '…' : label}
      </button>
      {/* INV-05: show invocation status indicator on error; auto-dismiss success */}
      <InvocationStatusIndicator
        invocationId={invocationId}
        autoDismissMs={2000}
      />
    </div>
  );
};

// ===========================================================================
// SidePanelSlot — renders a registered editor-panel widget in the right rail
// ===========================================================================

interface SidePanelSlotProps {
  panelWidgetId: string;
  nodeId: string;
  schema: string;
}

const SidePanelSlot: React.FC<SidePanelSlotProps> = ({
  panelWidgetId,
  nodeId,
  schema,
}) => {
  return (
    <div
      data-part="side-panel"
      data-widget={panelWidgetId}
      data-node-id={nodeId}
      data-schema={schema}
      style={{
        padding: 'var(--spacing-md)',
        borderBottom: '1px solid var(--palette-outline-variant)',
      }}
    >
      {/* Panel widget dispatch placeholder.
          The full panel widget interpreter wires into data-widget in Phase 2.
          Panels registered via PluginRegistry populate here. */}
      <div
        style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--palette-on-surface-variant)',
          marginBottom: 'var(--spacing-xs)',
        }}
      >
        {panelWidgetId.replace(/-panel$/, '').replace(/-/g, ' ')}
      </div>
    </div>
  );
};

// ===========================================================================
// SlashMenuOverlay — grouped slash menu (blocks + commands)
// ===========================================================================

interface SlashMenuOverlayProps {
  items: Record<string, SlashMenuItem[]>;
  loading: boolean;
  onActivate: (item: SlashMenuItem) => void;
  onClose: () => void;
}

const SlashMenuOverlay: React.FC<SlashMenuOverlayProps> = ({
  items,
  loading,
  onActivate,
  onClose,
}) => {
  const [query, setQuery] = useState('');

  const allItems = Object.values(items).flat();
  const filtered = query
    ? allItems.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : null;

  const sections = filtered
    ? { Results: filtered }
    : items;

  return (
    <div
      data-part="slash-menu"
      role="dialog"
      aria-modal="false"
      aria-label="Block inserter"
      style={{
        position: 'absolute',
        top: '40px',
        left: 'var(--spacing-md)',
        zIndex: 100,
        background: 'var(--palette-surface-container)',
        border: '1px solid var(--palette-outline)',
        borderRadius: '8px',
        minWidth: '280px',
        maxHeight: '360px',
        overflowY: 'auto',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}
    >
      <div style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}>
        <input
          data-part="slash-search"
          type="text"
          placeholder="Search blocks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
          }}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '13px',
            padding: '4px 0',
          }}
        />
      </div>

      {loading ? (
        <div style={{ padding: 'var(--spacing-sm)', color: 'var(--palette-on-surface-variant)', fontSize: '13px' }}>
          Loading...
        </div>
      ) : Object.keys(sections).length === 0 ? (
        <div style={{ padding: 'var(--spacing-sm)', color: 'var(--palette-on-surface-variant)', fontSize: '13px' }}>
          No blocks found
        </div>
      ) : (
        Object.entries(sections).map(([section, sectionItems]) => (
          <div key={section} data-part="slash-section">
            <div
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--palette-on-surface-variant)',
                padding: '8px var(--spacing-sm) 4px',
              }}
            >
              {section}
            </div>
            {sectionItems.map((item) => (
              <button
                key={item.id}
                data-part="slash-item"
                data-item-id={item.id}
                data-kind={item.kind}
                onClick={() => onActivate(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px var(--spacing-sm)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                {item.icon && (
                  <span data-part="slash-item-icon" aria-hidden="true" style={{ width: '16px' }}>
                    {item.icon}
                  </span>
                )}
                <span data-part="slash-item-label">{item.label}</span>
              </button>
            ))}
          </div>
        ))
      )}

      <div style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', borderTop: '1px solid var(--palette-outline-variant)' }}>
        <button
          data-part="slash-close"
          onClick={onClose}
          style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', cursor: 'pointer', background: 'none', border: 'none' }}
        >
          Esc to close
        </button>
      </div>
    </div>
  );
};

export default RecursiveBlockEditor;
