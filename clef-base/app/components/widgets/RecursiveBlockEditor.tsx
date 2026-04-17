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
import TreeDisplay from './TreeDisplay';
import BoardDisplay from './BoardDisplay';
import TableDisplay from './TableDisplay';
import type { FieldConfig } from './TableDisplay';
import BlockSubtreeView from './BlockSubtreeView';
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
  /** Indent depth from root — 0 for top-level, 1+ for nested. Drives CSS
   *  margin-left so Tab reparent becomes a flat-list reorder (no remount). */
  depth: number;
  /** Outline parent id. Top-level blocks have parent === rootNodeId. */
  parent: string;
  /** Whether this block has at least one Outline child. Computed during
   *  DFS walk even for collapsed blocks (so the ▶ toggle can appear). */
  hasChildren: boolean;
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

  // ------- block-children view settings — ViewShell-driven per parent --------
  // Each parent (root page + every block with children) gets its own
  // filter/sort/view settings. Persisted as a single blob per page in
  // localStorage key `block-children-view-map:<rootNodeId>` so reloads
  // preserve every nested group's chosen view. Applied client-side.
  const [blockChildrenSettingsByParent, setBlockChildrenSettingsByParent] = useState<Record<string, BlockChildrenSettings>>(
    () => loadBlockChildrenSettingsMap(rootNodeId),
  );
  const [blockChildrenMenu, setBlockChildrenMenu] = useState<{ x: number; y: number; parentId: string } | null>(null);
  const settingsFor = useCallback((parentId: string): BlockChildrenSettings => {
    return blockChildrenSettingsByParent[parentId] ?? defaultBlockChildrenSettings();
  }, [blockChildrenSettingsByParent]);
  const onBlockChildrenSettingsChange = useCallback((parentId: string, next: BlockChildrenSettings) => {
    setBlockChildrenSettingsByParent((prev) => {
      const merged = { ...prev, [parentId]: next };
      saveBlockChildrenSettingsMap(rootNodeId, merged);
      return merged;
    });
    void invoke('ViewShell', 'resolve', { name: next.view }).catch(() => ({ variant: 'notfound' }));
  }, [rootNodeId, invoke]);
  // The root's own settings live at `rootNodeId`. For hover-scoped
  // per-block gear rendering we need to know when a block has children.
  const blockChildrenSettings = settingsFor(rootNodeId);

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
  const [slashAnchor, setSlashAnchor] = useState<{ top: number; left: number } | undefined>(undefined);

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

  // ------- Collapsed blocks (local UI state) ------------------------------
  // A Set of block ids whose children are hidden. Not persisted across
  // reloads (would require Outline/getRecord + isCollapsed field; MVP
  // keeps this ephemeral). Toggle via ▶ arrow rendered per-row when a
  // block has children.
  const [collapsedBlockIds, setCollapsedBlockIds] = useState<Set<string>>(new Set());
  const [anchorBlockId, setAnchorBlockId] = useState<string>('');

  // ------- find-replace overlay (PP-find-replace) --------
  // Toggled by Cmd+F (or Ctrl+F); closed by Escape.
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

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

  // Optimistic depth overrides — Tab / Shift+Tab record their intent
  // here so ANY setChildren (including an intermediate loadChildren
  // that fires between optimistic update and server commit) can apply
  // the override and not flash the block back to its old depth. The
  // ref persists across renders; an entry clears when a fresh walk
  // confirms the expected depth (see applyDepthOverrides below).
  const optimisticDepthRef = useRef<Map<string, number>>(new Map());

  // Wrap setChildren so every update merges pending depth overrides.
  // Callers that WANT to reset depth (e.g., loadChildren after server
  // confirmation) just set the fresh depth — if it matches the
  // override, the override clears. Otherwise it keeps winning until
  // the server catches up.
  const setChildrenWithOverrides = useCallback<React.Dispatch<React.SetStateAction<BlockChild[]>>>((update) => {
    setChildren((prev) => {
      const next = typeof update === 'function' ? (update as (p: BlockChild[]) => BlockChild[])(prev) : update;
      const overrides = optimisticDepthRef.current;
      if (overrides.size === 0) return next;
      return next.map((c) => {
        const ov = overrides.get(c.id);
        if (ov === undefined) return c;
        if (c.depth === ov) {
          // Server caught up — drop the override.
          overrides.delete(c.id);
          return c;
        }
        return { ...c, depth: ov };
      });
    });
  }, []);

  // Optimistic depth adjustment — Tab / Shift+Tab call this BEFORE the
  // server reparent round-trip so the visual indent updates instantly.
  // Clamps to [0, Infinity); loadChildren reconciles against the server
  // truth afterwards.
  const handleOptimisticDepthChange = useCallback((nodeId: string, delta: number) => {
    setChildren((prev) => {
      const next = prev.map((c) => {
        if (c.id !== nodeId) return c;
        const newDepth = Math.max(0, c.depth + delta);
        optimisticDepthRef.current.set(nodeId, newDepth);
        return { ...c, depth: newDepth };
      });
      return next;
    });
  }, []);

  // Optimistic block insert — Enter creates a BlockChild entry locally
  // so the DOM appears on the same frame as the keystroke. Server-side
  // create runs in the background; loadChildren reconciles later.
  const handleOptimisticInsert = useCallback((newChild: {
    id: string; schema: string; parent: string; afterNodeId: string;
  }) => {
    setChildren((prev) => {
      const idx = prev.findIndex((c) => c.id === newChild.afterNodeId);
      if (idx < 0) return prev;
      const after = prev[idx];
      const entry: BlockChild = {
        id: newChild.id,
        schema: newChild.schema,
        displayMode: 'block-editor',
        depth: after.depth,       // same depth as sibling we're splitting from
        parent: after.parent,     // same parent — it's a sibling
        hasChildren: false,
      };
      return [...prev.slice(0, idx + 1), entry, ...prev.slice(idx + 1)];
    });
  }, []);

  const loadChildren = useCallback(async () => {
    // NOTE: don't flip childrenLoading on reloads. It's only used for the
    // initial render to show "Loading blocks..." while we first fetch
    // from the kernel. Subsequent loads (after Tab / Enter / delete) keep
    // the old render on screen while we fetch in the background.
    try {
      // DFS walk: collect ALL descendants as a flat list with depth.
      // The flat shape means Tab reparent is a reorder within the SAME
      // React list, so keyed BlockSlots keep their DOM nodes and we
      // don't get the top-to-bottom re-fetch flash on structural change.
      async function resolveSchema(childId: string): Promise<string> {
        // Cache-first: if we already know this block's schema from a
        // prior load (and it hasn't been explicitly invalidated), use
        // it without a round-trip. Schema only changes via changeType
        // which invalidates the cache.
        const cached = contentSchemaCache.get(childId);
        if (cached) return cached;
        try {
          const schemaResult = await invoke('Schema', 'getSchemasFor', { entity_id: childId });
          const schemas: string[] = schemaResult.variant === 'ok'
            ? safeParseJsonArray<string>(schemaResult.schemas)
            : [];
          if (schemas[0]) {
            contentSchemaCache.set(childId, schemas[0]);
            return schemas[0];
          }
          const nodeResult = await invoke('ContentNode', 'get', { node: childId });
          if (nodeResult.variant === 'ok') {
            // Populate the body cache too while we have the record — saves
            // TOC / word count / other consumers from waiting for BEF-01
            // mount effects on every block.
            if (typeof nodeResult.content === 'string') {
              contentBodyCache.set(childId, nodeResult.content);
            }
            if (typeof nodeResult.type === 'string') {
              const t = nodeResult.type || 'paragraph';
              contentSchemaCache.set(childId, t);
              return t;
            }
          }
        } catch { /* ignore, fall through */ }
        return 'paragraph';
      }
      async function walk(parentId: string, depth: number, out: BlockChild[]): Promise<void> {
        const res = await invoke('Outline', 'children', { parent: parentId });
        if (res.variant !== 'ok') return;
        const ids = safeParseJsonArray<string>(res.children);
        for (const id of ids) {
          const schema = await resolveSchema(id);
          // Default hasChildren:false; post-walk pass counts children
          // from the walked list. Only collapsed blocks need a separate
          // probe (they're skipped during DFS so we didn't see their
          // descendants). Fixes an N+1 that slowed Enter perceptibly.
          out.push({ id, schema, displayMode: 'block-editor', depth, parent: parentId, hasChildren: false });
          if (!collapsedBlockIds.has(id)) {
            await walk(id, depth + 1, out);
          }
        }
      }
      const childRecords: BlockChild[] = [];
      await walk(rootNodeId, 0, childRecords);
      // Compute hasChildren for non-collapsed nodes from the walked list;
      // collapsed nodes get an explicit probe so their ▶ toggle still shows.
      const parentSet = new Set(childRecords.map((c) => c.parent));
      for (const rec of childRecords) {
        if (collapsedBlockIds.has(rec.id)) {
          try {
            const r = await invoke('Outline', 'children', { parent: rec.id });
            rec.hasChildren = r.variant === 'ok'
              && safeParseJsonArray<string>(r.children).length > 0;
          } catch { rec.hasChildren = false; }
        } else {
          rec.hasChildren = parentSet.has(rec.id);
        }
      }
      {
        // For the downstream code that expects `ids` (e.g. widget resolver)
        const ids = childRecords.map((c) => c.id);
        setChildrenWithOverrides(childRecords);

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
  }, [rootNodeId, invoke, collapsedBlockIds]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  // =========================================================================
  // Compile surface observation (for compilable schemas like agent-persona)
  // =========================================================================

  useEffect(() => {
    if (!rootSchema) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function pollCompileStatus(): Promise<boolean> {
      let anyOk = false;

      try {
        // Read ContentCompiler state for this page
        const result = await invoke('ContentCompiler', 'getStatus', { page: rootNodeId });
        if (cancelled) return false;
        if (result.variant === 'ok') {
          anyOk = true;
          setCompileStatus({
            status: (result.status as CompileStatus['status']) ?? 'never-compiled',
            lastCompiledAt: typeof result.lastCompiledAt === 'string' ? result.lastCompiledAt : null,
          });
        }
      } catch {
        // Compile status is non-fatal — schema may not be compilable
      }

      // If getStatus didn't succeed, ContentCompiler is unavailable — skip getOutput
      if (!anyOk) return false;

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

      return anyOk;
    }

    async function startPolling() {
      const firstRun = await pollCompileStatus();
      if (cancelled) return;
      // Only set up the interval if ContentCompiler responded successfully on the
      // first call — avoids spamming the console with 500 errors when the concept
      // is not registered in the kernel.
      if (!firstRun) return;
      intervalId = setInterval(pollCompileStatus, 5000);
    }

    startPolling();

    return () => {
      cancelled = true;
      if (intervalId !== null) clearInterval(intervalId);
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

    // Clone via direct ContentNode + Outline dispatch; ActionBinding layer
    // is inert so block-duplicate binding is a no-op. Each duplicate gets
    // a fractional order that places it immediately after the source so it
    // doesn't jump to the end of the parent's children list.
    for (const blockId of blockIds) {
      try {
        const srcNode = await invoke('ContentNode', 'get', { node: blockId });
        const srcParent = await invoke('Outline', 'getParent', { node: blockId });
        if (srcNode.variant !== 'ok') continue;
        const dupId = `${rootNodeId}:block:${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const type = String(srcNode.type ?? 'paragraph');
        const content = String(srcNode.content ?? '');
        await invokeBinding(invoke, 'insert-block', {
          id: dupId,
          schema: type || 'paragraph',
          body: content,
        });
        const parent = srcParent.variant === 'ok'
          ? String(srcParent.parent ?? rootNodeId)
          : rootNodeId;
        // Compute fractional order = midpoint(src, nextSibling)
        let order: number | undefined;
        try {
          const siblingsRes = await invoke('Outline', 'children', { parent });
          const sibIds: string[] = siblingsRes.variant === 'ok'
            ? (() => { try { return JSON.parse(siblingsRes.children as string || '[]'); } catch { return []; } })()
            : [];
          const idx = sibIds.indexOf(blockId);
          const srcRec = await invoke('Outline', 'getRecord', { node: blockId });
          const srcOrder = srcRec.variant === 'ok' && typeof srcRec.order === 'number' ? srcRec.order : Date.now();
          let nextOrder: number | null = null;
          if (idx >= 0 && idx < sibIds.length - 1) {
            const n = await invoke('Outline', 'getRecord', { node: sibIds[idx + 1] });
            if (n.variant === 'ok' && typeof n.order === 'number') nextOrder = n.order;
          }
          order = nextOrder !== null ? (srcOrder + nextOrder) / 2 : srcOrder + 1;
        } catch { /* fall through to default Date.now() */ }
        await invokeBinding(invoke, 'outline-create', {
          node: dupId,
          parent,
          ...(order !== undefined ? { order } : {}),
        });
      } catch (err) {
        console.error('[RecursiveBlockEditor] duplicate failed for block:', blockId, err);
      }
    }

    loadChildren();
  }, [selectedBlockIds, canEdit, rootNodeId, invoke, loadChildren]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedBlockIds.size === 0 || !canEdit) return;
    const ids = Array.from(selectedBlockIds);
    for (const blockId of ids) {
      try {
        // Direct dispatch (ActionBinding layer inert): remove
        // ContentNode + Outline record. loadChildren refreshes view.
        await invokeBinding(invoke, 'content-node-delete', { node: blockId });
        await invokeBinding(invoke, 'outline-delete', { node: blockId });
        invalidateBlockBody(blockId);
      } catch (err) {
        console.error('[RecursiveBlockEditor] delete failed for block:', blockId, err);
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
    // Anchor the menu to the caret position so it appears under the '/'
    // the user just typed, matching Notion/Obsidian behavior.
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.top || rect.left) {
        setSlashAnchor({ top: rect.bottom + 4, left: rect.left });
      }
    }
    setFsmState('slash-open');
    setSlashMenuLoading(true);

    // Query registered Schemas (via Schema/list) so any schema seeded
    // into the kernel auto-appears in the slash menu. This is the
    // Clef architectural property: concepts register, UIs auto-pull.
    const items: SlashMenuItem[] = [];
    try {
      const schemasRes = await invoke('Schema', 'list', {});
      if (schemasRes.variant === 'ok') {
        const rows = safeParseJsonArray<Record<string, unknown>>(schemasRes.items);
        for (const r of rows) {
          const schemaName = String(r.schema ?? r.name ?? '');
          // Only include schemas flagged insertable (defaults true if missing).
          if (r.insertable !== undefined && r.insertable !== 'true' && r.insertable !== true) continue;
          if (!schemaName) continue;
          items.push({
            id: schemaName,
            label: String(r.label ?? schemaName),
            section: String(r.section ?? 'Basic'),
            icon: typeof r.icon === 'string' ? r.icon : undefined,
            kind: 'insertable',
            mappingId: schemaName,
          });
        }
      }
    } catch {
      /* non-fatal — menu will fall back to baseline below */
    }

    // Baseline items — kept for fresh DBs where no Schema seeds have
    // loaded yet. If Schema/list returned results, this loop adds only
    // schemas not already present.
    const baseline: SlashMenuItem[] = [
      { id: 'paragraph', label: 'Text', section: 'Basic', icon: '¶', kind: 'insertable', mappingId: 'paragraph' },
      { id: 'heading', label: 'Heading 1', section: 'Basic', icon: 'H1', kind: 'insertable', mappingId: 'heading' },
      { id: 'heading-2', label: 'Heading 2', section: 'Basic', icon: 'H2', kind: 'insertable', mappingId: 'heading-2' },
      { id: 'heading-3', label: 'Heading 3', section: 'Basic', icon: 'H3', kind: 'insertable', mappingId: 'heading-3' },
      { id: 'bullet-list', label: 'Bullet list', section: 'List', icon: '•', kind: 'insertable', mappingId: 'bullet-list' },
      { id: 'numbered-list', label: 'Numbered list', section: 'List', icon: '1.', kind: 'insertable', mappingId: 'numbered-list' },
      { id: 'task', label: 'To-do', section: 'List', icon: '☐', kind: 'insertable', mappingId: 'task' },
      { id: 'quote', label: 'Quote', section: 'Basic', icon: '"', kind: 'insertable', mappingId: 'quote' },
      { id: 'code', label: 'Code block', section: 'Basic', icon: '{}', kind: 'insertable', mappingId: 'code' },
    ];
    const existingIds = new Set(items.map((i) => i.id));
    for (const b of baseline) if (!existingIds.has(b.id)) items.push(b);

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
      // NOTE: the ActionBinding/invoke + InvokeViaBinding sync layer is
      // currently inert (the sync isn't loaded into this kernel), so
      // dispatch directly to ContentNode + Outline. Long-term this should
      // route through ActionBinding once the sync registry loads
      // syncs/app/invoke-via-binding.sync.
      const created = await invokeBinding(invoke, 'insert-block', {
        id,
        schema: 'paragraph',
        body: '',
      });
      if (created.variant === 'ok') {
        await invokeBinding(invoke, 'outline-create', { node: id, parent: rootNodeId });
        await loadChildren();
        restoreFocusToBlock(id);
      } else {
        console.warn('[RecursiveBlockEditor] createWithSchema non-ok:', created);
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
        const focusedId = focusedBlockIdRef.current;
        if (focusedId) {
          // Convert the focused block's schema in place (the block the
          // user typed '/' into). Matches Notion: selecting an item
          // changes THIS block, not adds a sibling.
          contentSchemaCache.set(focusedId, item.mappingId);
          await invokeBinding(invoke, 'content-node-change-type', {
            node: focusedId, type: item.mappingId,
          });
          await loadChildren();
          restoreFocusToBlock(focusedId);
        } else {
          // No focused block — insert as new top-level child.
          const newId = `${rootNodeId}:block:${Date.now()}`;
          await invokeBinding(invoke, 'insert-block', {
            id: newId, schema: item.mappingId, body: '',
          });
          await invokeBinding(invoke, 'outline-create', { node: newId, parent: rootNodeId });
          await loadChildren();
          restoreFocusToBlock(newId);
        }
      } else if (item.kind === 'command' && item.bindingId) {
        // Commands still route through ActionBinding for now; most of
        // these haven't been wired to direct handlers yet.
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

    // Cmd+. / Ctrl+. — toggle focus mode (hide chrome outside block list)
    if (e.key === '.' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setFocusMode((v) => !v);
      return;
    }

    // Cmd+Shift+Up/Down — move focused block among siblings.
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const focused = focusedBlockIdRef.current;
      if (!focused) return;
      e.preventDefault();
      const dir = e.key === 'ArrowUp' ? -1 : +1;
      void (async () => {
        try {
          const myRec = await invoke('Outline', 'getRecord', { node: focused });
          if (myRec.variant !== 'ok') return;
          const myParent = String(myRec.parent ?? rootNodeId);
          const sibsRes = await invoke('Outline', 'children', { parent: myParent });
          const sibs: string[] = sibsRes.variant === 'ok'
            ? (() => { try { return JSON.parse(sibsRes.children as string || '[]'); } catch { return []; } })()
            : [];
          const idx = sibs.indexOf(focused);
          if (idx < 0) return;
          // Compute the new order: between target's prev/next neighbor.
          const targetIdx = idx + dir;
          if (targetIdx < 0 || targetIdx >= sibs.length) return;
          // For move-up: new order = midpoint(targetPrev?.order, target.order)
          // For move-down: new order = midpoint(target.order, targetNext?.order)
          const target = await invoke('Outline', 'getRecord', { node: sibs[targetIdx] });
          const targetOrder = target.variant === 'ok' && typeof target.order === 'number' ? target.order : 0;
          const adjIdx = dir < 0 ? targetIdx - 1 : targetIdx + 1;
          let adjOrder: number | null = null;
          if (adjIdx >= 0 && adjIdx < sibs.length) {
            const adj = await invoke('Outline', 'getRecord', { node: sibs[adjIdx] });
            if (adj.variant === 'ok' && typeof adj.order === 'number') adjOrder = adj.order;
          }
          const newOrder = adjOrder !== null ? (targetOrder + adjOrder) / 2 : (dir < 0 ? targetOrder - 1 : targetOrder + 1);
          await invokeBinding(invoke, 'outline-set-order', { node: focused, order: newOrder });
          loadChildren();
          restoreFocusToBlock(focused);
        } catch (err) { console.warn('[RecursiveBlockEditor] move-block failed:', err); }
      })();
      return;
    }

    // Cmd+Shift+1..9 / 0 — convert focused block's schema in place.
    // Mirrors Notion's quick-turn-into shortcuts.
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey) {
      const schemaByKey: Record<string, string> = {
        '1': 'heading', '2': 'heading-2', '3': 'heading-3',
        '7': 'bullet-list', '8': 'numbered-list', '9': 'task',
        '0': 'paragraph',
      };
      const target = schemaByKey[e.key];
      const focused = focusedBlockIdRef.current;
      if (target && focused) {
        e.preventDefault();
        void (async () => {
          try {
            contentSchemaCache.set(focused, target);
            await invokeBinding(invoke, 'content-node-change-type', { node: focused, type: target });
            loadChildren();
            restoreFocusToBlock(focused);
          } catch (err) { console.warn('[RecursiveBlockEditor] schema-shortcut failed:', err); }
        })();
        return;
      }
    }

    // Cmd+A / Ctrl+A — block-level select-all with Notion two-tap semantics:
    // 1st press: select the currently-focused block (escape from text select).
    // 2nd press: select all top-level blocks.
    // 3rd press: clear selection.
    if (e.key === 'a' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      const target = e.target as HTMLElement;
      const focusedId = focusedBlockIdRef.current;
      // Only intercept when inside a block's contenteditable; otherwise
      // let the browser handle the default.
      if (!target.isContentEditable || !focusedId) return;
      const allIds = children.map((c) => c.id);
      if (selectedBlockIds.size === allIds.length && allIds.length > 0) {
        // third tap — clear
        e.preventDefault();
        clearSelection();
        return;
      }
      if (selectedBlockIds.size <= 1) {
        // first tap — select current block
        e.preventDefault();
        setSelectedBlockIds(new Set([focusedId]));
        setAnchorBlockId(focusedId);
        // blur the contentEditable so further arrow keys act at block level
        (target as HTMLElement).blur();
        return;
      }
      // 2nd tap — select all
      e.preventDefault();
      setSelectedBlockIds(new Set(allIds));
      setAnchorBlockId(focusedId);
      return;
    }

    // Cmd+C with multi-selection — serialize selected blocks as markdown
    // and copy to clipboard. Inverse of smart-paste. Matches Notion's
    // "select blocks → copy → paste as markdown" round-trip.
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'c' && selectedBlockIds.size > 0) {
      const ids = Array.from(selectedBlockIds);
      // Preserve document order
      const ordered = children.filter((c) => ids.includes(c.id)).map((c) => c);
      const mdLines = ordered.map((c) => {
        const prefix = c.depth > 0 ? '  '.repeat(c.depth) : '';
        const body = contentBodyCache.get(c.id) ?? '';
        switch (c.schema) {
          case 'heading': return `${prefix}# ${body}`;
          case 'heading-2': return `${prefix}## ${body}`;
          case 'heading-3': return `${prefix}### ${body}`;
          case 'bullet-list': return `${prefix}- ${body}`;
          case 'numbered-list': return `${prefix}1. ${body}`;
          case 'quote': return `${prefix}> ${body}`;
          case 'task': return `${prefix}[ ] ${body}`;
          case 'task-done': return `${prefix}[x] ${body}`;
          case 'code': return `\n\`\`\`\n${body}\n\`\`\`\n`;
          default: return `${prefix}${body}`;
        }
      });
      const md = mdLines.join('\n');
      e.preventDefault();
      void navigator.clipboard.writeText(md).catch((err) => {
        console.warn('[RecursiveBlockEditor] copy-as-markdown failed:', err);
      });
      return;
    }

    // Cmd+Z / Ctrl+Z — undo; Cmd+Shift+Z / Ctrl+Shift+Z — redo.
    // Only intercepts when there's an entry on our block-level stack;
    // otherwise defer to the browser's native contentEditable undo
    // (which handles per-character text history).
    if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
      const redo = e.shiftKey;
      const stack = redo ? redoStack : undoStack;
      const mirror = redo ? undoStack : redoStack;
      const entry = stack.pop();
      if (!entry) return; // fall back to browser default
      e.preventDefault();
      e.stopPropagation();
      void (async () => {
        try {
          if (entry.kind === 'text') {
            const target = redo ? entry.after : entry.before;
            contentBodyCache.set(entry.nodeId, target);
            await invokeBinding(invoke, 'update-block-content', { nodeId: entry.nodeId, content: target });
            const el = document.querySelector<HTMLDivElement>(
              `[data-part="block-slot"][data-node-id="${entry.nodeId}"] [data-part="block-content"]`,
            );
            if (el) el.textContent = target;
            mirror.push(entry);
            loadChildren();
          } else if (entry.kind === 'reparent') {
            const target = redo ? entry.newParent : entry.oldParent;
            await invokeBinding(invoke, 'outline-reparent', { node: entry.nodeId, newParent: target });
            mirror.push(entry);
            loadChildren();
            restoreFocusToBlock(entry.nodeId);
          }
          // insert / delete / changeType: extend as those paths push entries
        } catch (err) {
          console.warn('[RecursiveBlockEditor] undo/redo failed:', err);
        }
      })();
      return;
    }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      // Notion/Roam: `/` opens the block-type picker. Allow this inside
      // contentEditables when the caret is at the start of an empty block
      // (so typing `/` mid-sentence doesn't hijack). When the menu is open
      // the user can type to filter; Escape cancels.
      const target = e.target as HTMLElement;
      if (target.isContentEditable) {
        const text = target.textContent ?? '';
        if (text.length === 0) {
          e.preventDefault();
          openSlashMenu();
          return;
        }
        // otherwise let '/' type naturally
        return;
      }
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

    // Paste URL on non-empty text selection → wrap selection in <a href=URL>.
    // Matches Notion/Slack: if you have text selected and paste a URL, the
    // URL becomes the link's href rather than replacing the selected text.
    const clipText = e.clipboardData?.getData('text/plain') ?? '';
    const urlOnly = clipText.trim();
    if (/^https?:\/\/\S+$/.test(urlOnly)) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const target = e.target as HTMLElement;
        if (target.isContentEditable) {
          e.preventDefault();
          const range = sel.getRangeAt(0);
          const a = document.createElement('a');
          a.href = urlOnly;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.appendChild(range.extractContents());
          range.insertNode(a);
          range.setStartAfter(a); range.collapse(true);
          sel.removeAllRanges(); sel.addRange(range);
          return;
        }
      }
    }

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

    // Plain-text multi-line paste: split into blocks. Detects markdown
    // prefixes (# / ## / ### / - / 1. / > / ``` / [] / [x]) on each
    // line and maps to the matching schema. Matches Notion behavior
    // when pasting e.g. a markdown README into an empty page.
    const plainText = e.clipboardData?.getData('text/plain') ?? '';
    if (plainText.includes('\n')) {
      e.preventDefault();
      const lines = plainText.split(/\r?\n/).filter((l) => l.length > 0 || true);
      const mdPrefix = (line: string): { schema: string; body: string } => {
        const m = line.match(/^(#{1,3})\s+(.*)$/);
        if (m) return { schema: m[1].length === 1 ? 'heading' : m[1].length === 2 ? 'heading-2' : 'heading-3', body: m[2] };
        if (/^[-*]\s+/.test(line)) return { schema: 'bullet-list', body: line.replace(/^[-*]\s+/, '') };
        if (/^\d+\.\s+/.test(line)) return { schema: 'numbered-list', body: line.replace(/^\d+\.\s+/, '') };
        if (/^>\s+/.test(line)) return { schema: 'quote', body: line.replace(/^>\s+/, '') };
        if (/^\[\s\]\s+/.test(line)) return { schema: 'task', body: line.replace(/^\[\s\]\s+/, '') };
        if (/^\[x\]\s+/i.test(line)) return { schema: 'task-done', body: line.replace(/^\[x\]\s+/i, '') };
        return { schema: 'paragraph', body: line };
      };
      const parsed = lines.map(mdPrefix).filter((p) => p.body !== '' || p.schema !== 'paragraph');
      try {
        // Compute a base order range: if focus is on an existing block,
        // slot the pasted lines between it and its next sibling. Otherwise
        // append at the end (Date.now()).
        const anchorId = focusedBlockIdRef.current;
        let baseOrder = Date.now();
        let endOrder = baseOrder + parsed.length;
        if (anchorId) {
          try {
            const anchorRec = await invoke('Outline', 'getRecord', { node: anchorId });
            if (anchorRec.variant === 'ok' && typeof anchorRec.order === 'number') {
              baseOrder = anchorRec.order;
              const myParent = String(anchorRec.parent ?? rootNodeId);
              const sibRes = await invoke('Outline', 'children', { parent: myParent });
              const sibIds: string[] = sibRes.variant === 'ok'
                ? (() => { try { return JSON.parse(sibRes.children as string || '[]'); } catch { return []; } })()
                : [];
              const idx = sibIds.indexOf(anchorId);
              if (idx >= 0 && idx < sibIds.length - 1) {
                const nextRec = await invoke('Outline', 'getRecord', { node: sibIds[idx + 1] });
                if (nextRec.variant === 'ok' && typeof nextRec.order === 'number') {
                  endOrder = nextRec.order;
                }
              } else {
                endOrder = baseOrder + parsed.length; // append at end of siblings
              }
            }
          } catch { /* ignore — fall through to append */ }
        }
        const step = (endOrder - baseOrder) / (parsed.length + 1);
        for (let i = 0; i < parsed.length; i++) {
          const p = parsed[i];
          const id = `${rootNodeId}:block:${Date.now()}-${i}`;
          await invokeBinding(invoke, 'insert-block', {
            id, schema: p.schema, body: p.body,
          });
          await invokeBinding(invoke, 'outline-create', {
            node: id,
            parent: rootNodeId,
            order: baseOrder + step * (i + 1),
          });
        }
        loadChildren();
        return;
      } catch (err) {
        console.error('[RecursiveBlockEditor] plain-text paste failed:', err);
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

    // Direct path: read the pasted image as a data URL, create an
    // image-schema block whose content is the data URL. The ActionBinding
    // dispatch is still attempted for future server-side upload wiring,
    // but the block-with-data-url approach makes the image appear
    // immediately without any external storage.
    const file = imageItem.getAsFile();
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = String(reader.result ?? '');
          const id = `${rootNodeId}:block:${Date.now()}`;
          await invokeBinding(invoke, 'insert-block', {
            id, schema: 'image', body: dataUrl,
          });
          const anchorId = focusedBlockIdRef.current;
          let order: number | undefined;
          if (anchorId) {
            try {
              const rec = await invoke('Outline', 'getRecord', { node: anchorId });
              if (rec.variant === 'ok' && typeof rec.order === 'number') {
                order = rec.order + 0.5;
              }
            } catch { /* ignore */ }
          }
          await invokeBinding(invoke, 'outline-create', {
            node: id, parent: rootNodeId,
            ...(order !== undefined ? { order } : {}),
          });
          loadChildren();
        } catch (err) {
          console.warn('[RecursiveBlockEditor] image paste failed:', err);
        }
      };
      reader.readAsDataURL(file);
    }
    return;
    // eslint-disable-next-line no-unreachable
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

  const rightRailVisible = editorPanelEntries.length > 0 || versionHistoryOpen || (hasCompileSurface && !!compiledPreview);

  return (
    <div
      data-part="root"
      data-state={fsmState}
      data-flavor={editorFlavor}
      data-can-edit={canEdit ? 'true' : 'false'}
      data-focus-mode={focusMode ? 'true' : 'false'}
      data-keybinding-scope="app.editor"
      role="region"
      aria-label={`Block editor — ${editorFlavor}`}
      onKeyDown={handleKeyDown}
      style={{
        display: 'grid',
        gridTemplateColumns: rightRailVisible ? '160px minmax(0, 1fr) 280px' : '160px minmax(0, 1fr)',
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
          padding: 'var(--spacing-xs)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
        }}
      >
        {/* Palette is a secondary insertion surface — slash menu is primary.
            Both controls are intentionally subdued: one high-emphasis "create"
            affordance per zone maximum (UX anatomy invariant). */}
        {canEdit && (
          <button
            data-part="open-slash-menu"
            aria-label="Insert block"
            title="Insert block"
            onClick={openSlashMenu}
          >
            +
          </button>
        )}
        <button
          data-part="block-children-gear"
          title="View settings — filter, sort, view type"
          aria-label="Block children view settings"
          onClick={(e) => setBlockChildrenMenu({ x: e.clientX, y: e.clientY, parentId: rootNodeId })}
        >
          ⚙
        </button>
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

        {/* Simple selection toolbar — always-available fallback when
            EditSurface/resolve can't deliver a toolbar_widget. Shows B/I/U/<>
            buttons whenever there's a non-empty text selection inside a block. */}
        <SelectionToolbar selection={currentSelection} />

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
        ) : (() => {
          // ViewShell-driven filter/sort. applyBlockChildrenFilterSort
          // works on ChildRow so adapt each BlockChild to {id, schema,
          // content, order}. Non-blocks views render as read-only
          // summaries that bypass the editable block map entirely.
          // --- Per-parent filter + sort ---
          // Group the flat DFS list by parent, apply each parent's
          // BlockChildrenSettings to its direct children, then re-emit
          // the DFS. Each nested group can be filtered / sorted / viewed
          // independently — the root's settings only govern its own
          // direct children. See the per-block gear below.
          const byParent = new Map<string, BlockChild[]>();
          for (const c of children) {
            const g = byParent.get(c.parent) ?? [];
            g.push(c); byParent.set(c.parent, g);
          }
          for (const [pid, group] of byParent) {
            const s = settingsFor(pid);
            const rows: ChildRow[] = group.map((c, i) => ({
              id: c.id, schema: c.schema,
              content: (contentBodyCache.get(c.id) ?? '').replace(/<[^>]+>/g, '').trim(),
              createdAt: '', updatedAt: '', order: i,
            }));
            const fs = applyBlockChildrenFilterSort(rows, s);
            const idx = new Map<string, number>();
            fs.forEach((r, i) => idx.set(r.id, i));
            const newGroup = group
              .filter((c) => idx.has(c.id))
              .sort((a, b) => (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0));
            byParent.set(pid, newGroup);
          }
          // A subtree is "suppressed" from the flat list when its
          // parent's view is anything other than 'blocks'. We render a
          // nested inline mini-view for it instead, right after the
          // parent block in the flat order.
          const subtreeRenderMode = new Map<string, BlockChildrenView>();
          for (const pid of byParent.keys()) {
            subtreeRenderMode.set(pid, settingsFor(pid).view);
          }
          const orderedChildren: BlockChild[] = [];
          const walk = (parentId: string) => {
            for (const c of byParent.get(parentId) ?? []) {
              orderedChildren.push(c);
              // If this parent has children AND its view is non-blocks,
              // don't descend — the alt-view will render its direct kids.
              if (c.hasChildren) {
                const mode = subtreeRenderMode.get(c.id) ?? 'block-children-blocks';
                if (mode === 'block-children-blocks') walk(c.id);
              }
            }
          };
          walk(rootNodeId);
          const viewMode = blockChildrenSettings.view;

          // Toolbar + menu rendered regardless of view mode so the
          // gear is reachable from every variant (not just blocks).
          const viewSettingsToolbar = (
            <div data-part="block-children-toolbar" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, gap: 6 }}>
              <button
                data-part="block-children-gear-inline"
                data-parent-id={rootNodeId}
                title="Root view settings — filter, sort, view type (right-click the list also opens). Each nested block with children has its own gear too."
                aria-label="Block children view settings"
                onClick={(e) => setBlockChildrenMenu({ x: e.clientX, y: e.clientY, parentId: rootNodeId })}
                style={{
                  fontSize: 12, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
                  background: 'var(--palette-surface, #fff)',
                  border: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.12))',
                  color: 'var(--palette-on-surface, #333)', opacity: 0.8,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
              >
                ⚙ Root view: {blockChildrenSettings.view.replace('block-children-', '')}
                {blockChildrenSettings.sort !== 'block-children-order' && ' · sort: ' + blockChildrenSettings.sort.replace('block-children-', '')}
                {blockChildrenSettings.filter !== 'block-children-all' && ' · filter: ' + blockChildrenSettings.filter.replace('block-children-', '')}
              </button>
            </div>
          );
          const viewSettingsMenu = blockChildrenMenu ? (
            <BlockChildrenSettingsMenu
              settings={settingsFor(blockChildrenMenu.parentId)}
              parentLabel={blockChildrenMenu.parentId === rootNodeId ? '(root page)' : blockChildrenMenu.parentId}
              onChange={(next) => onBlockChildrenSettingsChange(blockChildrenMenu.parentId, next)}
              onClose={() => setBlockChildrenMenu(null)}
              x={blockChildrenMenu.x} y={blockChildrenMenu.y}
            />
          ) : null;

          if (viewMode !== 'block-children-blocks') {
            const titleLine = (c: string) => {
              const s = c.replace(/<[^>]+>/g, '').trim();
              return s.length > 140 ? s.slice(0, 140) + '…' : (s || '(empty)');
            };
            const rowText = (id: string) => titleLine(contentBodyCache.get(id) ?? '');
            if (viewMode === 'block-children-outline' || viewMode === 'block-children-list') {
              return (<>{viewSettingsToolbar}{viewSettingsMenu}<ol
                  data-part="block-list"
                  data-view={viewMode}
                  aria-label="Document blocks outline"
                  style={{ listStyle: viewMode === 'block-children-list' ? 'decimal' : 'none', margin: 0, padding: viewMode === 'block-children-list' ? '0 0 0 24px' : 0 }}
                >
                  {orderedChildren.map((child) => (
                    <li
                      key={child.id}
                      data-block-id={child.id}
                      data-schema={child.schema}
                      style={{
                        padding: '2px 0',
                        fontSize: child.schema.startsWith('heading') ? 15 : 13,
                        fontWeight: child.schema === 'heading' ? 700 : child.schema === 'heading-2' ? 600 : 400,
                        marginLeft: viewMode === 'block-children-outline' ? `${Math.min(child.depth, 6) * 16}px` : 0,
                      }}
                    >
                      <span style={{ color: 'var(--palette-outline, #999)', marginRight: 8, fontSize: 10, textTransform: 'uppercase' }}>{child.schema}</span>
                      {rowText(child.id)}
                    </li>
                  ))}
                </ol></>);
            }
            if (viewMode === 'block-children-gallery') {
              return (<>{viewSettingsToolbar}{viewSettingsMenu}<div data-part="block-list" data-view={viewMode} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
                  {orderedChildren.map((child) => (
                    <div key={child.id} data-block-id={child.id} data-schema={child.schema} style={{ border: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.1))', borderRadius: 6, padding: 12, minHeight: 80, fontSize: 12 }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--palette-outline, #888)', marginBottom: 6 }}>{child.schema}</div>
                      <div>{rowText(child.id)}</div>
                    </div>
                  ))}
                </div></>);
            }
            if (viewMode === 'block-children-board') {
              const cols: Record<string, typeof orderedChildren> = {};
              for (const c of orderedChildren) (cols[c.schema] ||= []).push(c);
              return (<>{viewSettingsToolbar}{viewSettingsMenu}<div data-part="block-list" data-view={viewMode} style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
                  {Object.entries(cols).map(([schema, col]) => (
                    <div key={schema} style={{ minWidth: 200, flex: '0 0 200px', background: 'var(--palette-surface-variant, rgba(0,0,0,0.02))', borderRadius: 6, padding: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--palette-outline, #666)', marginBottom: 8 }}>{schema} ({col.length})</div>
                      {col.map((child) => (
                        <div key={child.id} data-block-id={child.id} style={{ background: 'var(--palette-surface, #fff)', border: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.08))', borderRadius: 4, padding: 8, marginBottom: 6, fontSize: 12 }}>
                          {rowText(child.id)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div></>);
            }
            if (viewMode === 'block-children-table') {
              return (<>{viewSettingsToolbar}{viewSettingsMenu}<table data-part="block-list" data-view={viewMode} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--palette-outline, #888)', fontSize: 11, textTransform: 'uppercase' }}>
                      <th style={{ padding: 6, borderBottom: '1px solid var(--palette-outline-variant)' }}>Schema</th>
                      <th style={{ padding: 6, borderBottom: '1px solid var(--palette-outline-variant)' }}>Content</th>
                      <th style={{ padding: 6, borderBottom: '1px solid var(--palette-outline-variant)' }}>Depth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedChildren.map((child) => (
                      <tr key={child.id} data-block-id={child.id}>
                        <td style={{ padding: 6, borderBottom: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.04))' }}>{child.schema}</td>
                        <td style={{ padding: 6, borderBottom: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.04))' }}>{rowText(child.id)}</td>
                        <td style={{ padding: 6, borderBottom: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.04))', color: 'var(--palette-outline, #888)' }}>{child.depth}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></>);
            }
          }

          const shownChildren = orderedChildren;
          return (<>
          {viewSettingsToolbar}
          {viewSettingsMenu}
          <ol
            data-part="block-list"
            data-view={viewMode}
            aria-label="Document blocks"
            onContextMenu={(e) => {
              const t = e.target as HTMLElement;
              if (t.closest?.('[contenteditable="true"]')) return;
              // Walk up to the nearest block-list-item to determine the
              // clicked-block's parent id. If the user right-clicked an
              // empty area, fall back to the root.
              const li = t.closest?.('[data-block-id]') as HTMLElement | null;
              let scopedParent = rootNodeId;
              if (li) {
                const clickedId = li.getAttribute('data-block-id') ?? '';
                const rec = children.find((c) => c.id === clickedId);
                // If the clicked block has children, the menu configures
                // that block's sub-view. Otherwise configure the parent
                // the clicked block lives under.
                if (rec?.hasChildren) scopedParent = clickedId;
                else if (rec?.parent) scopedParent = rec.parent;
              }
              e.preventDefault();
              setBlockChildrenMenu({ x: e.clientX, y: e.clientY, parentId: scopedParent });
            }}
            style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}
          >
            {shownChildren.map((child, childIndex) => {
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
                      // Direct Outline/reparent — the ActionBinding
                      // dispatch layer is inert. Reparent the dragged
                      // block to the drop target's parent so it lands
                      // at the same depth as the drop target.
                      const destParentRes = await invoke('Outline', 'getParent', {
                        node: child.id,
                      });
                      const destParent = destParentRes.variant === 'ok'
                        ? String(destParentRes.parent ?? rootNodeId)
                        : rootNodeId;
                      const result = await invokeBinding(invoke, 'outline-reparent', {
                        node: srcBlockId, newParent: destParent,
                      });
                      if (result.variant === 'ok') {
                        loadChildren();
                      } else {
                        console.warn('[RecursiveBlockEditor] drop reparent non-ok:', result.variant);
                      }
                    } catch (err) {
                      console.error('[RecursiveBlockEditor] drop failed:', err);
                    }
                  }}
                  style={{
                    position: 'relative',
                    // Indent via depth — flat-list layout where nested blocks
                    // sit directly under the top-level <ol>, reparent becomes
                    // a margin-change not a React subtree swap.
                    marginLeft: child.depth > 0 ? `${child.depth * 24}px` : 0,
                    borderLeft: child.depth > 0
                      ? '1px solid var(--palette-outline-variant, rgba(0,0,0,0.08))'
                      : 'none',
                    paddingLeft: child.depth > 0 ? '8px' : 0,
                  }}
                >
                  {/* Drop zone indicator — above block during active drag-over */}
                  <BlockDropZoneIndicator active={isDragOver && dropPosition === 'before'} position="before" />

                  {/* Per-parent view gear — only for blocks that have
                      nested children. Lets the user pick filter/sort/
                      view-type for THIS block's children independently
                      of the root or any other parent. Hidden by default,
                      fades in on hover over the row. */}
                  {child.hasChildren && (
                    <button
                      data-part="nested-children-gear"
                      data-parent-id={child.id}
                      title="View settings for this block's children"
                      aria-label="Nested children view settings"
                      onClick={(e) => { e.stopPropagation(); setBlockChildrenMenu({ x: e.clientX, y: e.clientY, parentId: child.id }); }}
                      style={{
                        position: 'absolute',
                        right: 4, top: 4, zIndex: 7,
                        fontSize: 11, padding: '1px 6px', borderRadius: 4,
                        cursor: 'pointer',
                        background: 'var(--palette-surface, #fff)',
                        border: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.12))',
                        color: 'var(--palette-on-surface-variant, #666)',
                        opacity: isHovered ? 0.9 : 0,
                        transition: 'opacity 120ms ease',
                      }}
                    >⚙ {settingsFor(child.id).view.replace('block-children-', '')}</button>
                  )}

                  {/* Block handle — left gutter, visible on hover.
                      Opacity is driven by the row's isHovered state (from
                      pointer-enter/leave on the <li>) so the handle is
                      actually discoverable — BlockHandle's internal FSM
                      would otherwise only flip to visible on hover OF the
                      handle, which is invisible. */}
                  {canEdit && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '-28px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: isHovered ? 'auto' : 'none',
                        opacity: isHovered ? 1 : 0,
                        transition: 'opacity 120ms ease',
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
                    {/* Collapse toggle — ▶ or ▼ when this block has children.
                        Toggling re-runs loadChildren which skips descendants
                        of collapsed blocks during the DFS walk. */}
                    {(() => {
                      if (!child.hasChildren) return <span style={{ width: '16px', flexShrink: 0 }} />;
                      const collapsed = collapsedBlockIds.has(child.id);
                      return (
                        <button
                          data-part="collapse-toggle"
                          aria-label={collapsed ? 'Expand' : 'Collapse'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCollapsedBlockIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(child.id)) next.delete(child.id);
                              else next.add(child.id);
                              return next;
                            });
                          }}
                          style={{
                            width: '16px',
                            flexShrink: 0,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--palette-on-surface-variant, rgba(0,0,0,0.5))',
                            cursor: 'pointer',
                            padding: 0,
                            fontSize: '10px',
                            lineHeight: '1.6',
                          }}
                        >
                          {collapsed ? '▶' : '▼'}
                        </button>
                      );
                    })()}
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
                        onOptimisticDepthChange={handleOptimisticDepthChange}
                        onOptimisticInsert={handleOptimisticInsert}
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

                  {/* Nested alt-view — delegates to the existing
                      hierarchy-aware display widgets: TreeDisplay for
                      outline/list (parent-aware), BoardDisplay for
                      board (grouped by first parent by default — can
                      be switched to group by schema), TableDisplay for
                      table. Each is keyboard-navigable and wired to
                      the ActionBinding pipeline via the display-nav
                      CustomEvent they emit. */}
                  {child.hasChildren && (subtreeRenderMode.get(child.id) ?? 'block-children-blocks') !== 'block-children-blocks' && (() => {
                    const mode = subtreeRenderMode.get(child.id)!;
                    // Gather the descendant rows for this subtree. For
                    // tree / table we want the WHOLE subtree so the
                    // hierarchy column is meaningful; for board /
                    // gallery we want the direct children only (cards
                    // at this level). Rows carry { id, parent, schema,
                    // content } which TreeDisplay recognises as the
                    // adjacency-list hierarchy shape.
                    const titleLine = (c: string) => {
                      const s = c.replace(/<[^>]+>/g, '').trim();
                      return s.length > 140 ? s.slice(0, 140) + '…' : (s || '(empty)');
                    };
                    const collectSubtree = (parentId: string, acc: BlockChild[] = []): BlockChild[] => {
                      for (const c of byParent.get(parentId) ?? []) {
                        acc.push(c);
                        if (c.hasChildren) collectSubtree(c.id, acc);
                      }
                      return acc;
                    };
                    const subtreeRows = collectSubtree(child.id).map((c) => ({
                      id: c.id,
                      // Always carry the real parent id — TreeDisplay
                      // won't render the clicked block itself (it's
                      // not in the row set), and BoardDisplay uses the
                      // parent id to resolve the column label.
                      parent: c.parent,
                      schema: c.schema,
                      content: titleLine(contentBodyCache.get(c.id) ?? ''),
                    }));
                    const directRows = (byParent.get(child.id) ?? []).map((c) => ({
                      id: c.id,
                      parent: c.parent,
                      schema: c.schema,
                      content: titleLine(contentBodyCache.get(c.id) ?? ''),
                    }));
                    const wrap: React.CSSProperties = {
                      marginLeft: (child.depth + 1) * 24,
                      borderLeft: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.08))',
                      paddingLeft: 10,
                      marginTop: 4,
                    };
                    const fields: FieldConfig[] = [
                      { key: 'id', label: 'ID', visible: false },
                      { key: 'schema', label: 'Schema', formatter: 'badge' },
                      { key: 'content', label: 'Content' },
                    ];
                    // ─── Reusable "block-subtree" display mode ───
                    // Every alt-view below renders its items with the
                    // BlockSubtreeView component (seeded as DisplayMode
                    // "block-subtree" in DisplayMode.block-subtree.seeds.yaml
                    // + ComponentMapping.block-subtree.seeds.yaml). Views
                    // just place the display-mode; the subtree renderer
                    // keeps the block editable, recursive, and gears-
                    // per-parent — regardless of the outer shell.
                    const byId = new Map<string, BlockChild>();
                    for (const c of children) byId.set(c.id, c);
                    const renderBlockSlotForSubtree = ({ nodeId, schema, displayMode, key }: { nodeId: string; schema: string; displayMode: string; key: string }) => {
                      const rec = byId.get(nodeId);
                      if (!rec) return null;
                      const resolved = resolvedWidgets.get(nodeId);
                      return (
                        <BlockSlot
                          key={key}
                          nodeId={rec.id}
                          schema={schema}
                          displayMode={displayMode}
                          resolvedWidget={resolved?.widgetId ?? `${schema}-block`}
                          canEdit={canEdit}
                          isSelected={false}
                          onFocus={() => handleBlockFocus(rec.id, rec.schema)}
                          onBlur={handleBlockBlur}
                          onBlockContentChange={undefined}
                          onStructureChange={loadChildren}
                          onOptimisticDepthChange={handleOptimisticDepthChange}
                          onOptimisticInsert={handleOptimisticInsert}
                          onBlockClick={(e) => handleBlockClick(rec.id, e)}
                          onSectionSelect={handleSectionSelect}
                          rootNodeId={rootNodeId}
                          editorFlavor={editorFlavor}
                          decorationLayerEntries={decorationLayerEntries}
                        />
                      );
                    };
                    // Shared base props for every BlockSubtreeView in
                    // this alt-view. renderAltChildren is defined after
                    // this and added separately so it can reference
                    // subtreePropsBase without a circular initializer.
                    const subtreePropsBase = {
                      byParent, byId, renderBlockSlot: renderBlockSlotForSubtree,
                      settingsFor, subtreeRenderMode,
                      openSettingsMenu: (x: number, y: number, parentId: string) => setBlockChildrenMenu({ x, y, parentId }),
                    };
                    // renderAltChildren handles the case where a nested
                    // block's children have a non-blocks view mode.
                    // Without this, BlockSubtreeView silently drops all
                    // children when shouldRecurse is false — the root
                    // cause of the nested-view-embed content disappearing.
                    const renderAltChildren = (nodeId: string): React.ReactNode => {
                      const nestedMode = subtreeRenderMode.get(nodeId) ?? 'block-children-blocks';
                      if (nestedMode === 'block-children-blocks') return null;
                      const nestedDirectKids = byParent.get(nodeId) ?? [];
                      const nestedWrap: React.CSSProperties = {
                        borderLeft: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.08))',
                        paddingLeft: 10, marginTop: 4,
                      };
                      // sp spreads subtreePropsBase plus this very function
                      // so nesting is unbounded: board inside board inside board.
                      const sp = { ...subtreePropsBase, renderAltChildren };
                      if (nestedMode === 'block-children-outline' || nestedMode === 'block-children-list') {
                        return (
                          <div data-part="nested-alt-view" data-view={nestedMode} data-parent-id={nodeId} style={nestedWrap}>
                            {nestedDirectKids.map((k) => (
                              <div key={k.id} data-block-id={k.id} style={{ marginBottom: 4 }}>
                                <BlockSubtreeView {...sp} rootId={k.id} keyNamespace={nestedMode} />
                              </div>
                            ))}
                          </div>
                        );
                      }
                      if (nestedMode === 'block-children-gallery') {
                        return (
                          <div data-part="nested-alt-view" data-view={nestedMode} data-parent-id={nodeId} style={{ ...nestedWrap, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
                            {nestedDirectKids.map((k) => (
                              <div key={k.id} data-block-id={k.id} style={{ border: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.1))', borderRadius: 6, padding: 8, minHeight: 50, fontSize: 13 }}>
                                <BlockSubtreeView {...sp} rootId={k.id} keyNamespace={nestedMode} />
                              </div>
                            ))}
                          </div>
                        );
                      }
                      if (nestedMode === 'block-children-board') {
                        // Nested kanban: columns = direct children of nodeId,
                        // cards = grandchildren of nodeId.
                        const nestedParentLabel: Record<string, string> = {};
                        const nestedLabelToId: Record<string, string> = {};
                        for (const c of nestedDirectKids) {
                          const lbl = (contentBodyCache.get(c.id) ?? '').replace(/<[^>]+>/g, '').trim() || c.id;
                          nestedParentLabel[c.id] = lbl;
                        }
                        for (const [id, lbl] of Object.entries(nestedParentLabel)) {
                          if (nestedLabelToId[lbl] === undefined) nestedLabelToId[lbl] = id;
                        }
                        const nestedGrandchildren: BlockChild[] = [];
                        for (const col of nestedDirectKids) {
                          for (const card of byParent.get(col.id) ?? []) {
                            nestedGrandchildren.push(card);
                          }
                        }
                        const nestedBoardRows = nestedGrandchildren.map((g) => ({
                          id: g.id,
                          parent: nestedParentLabel[g.parent] ?? g.parent,
                          schema: g.schema,
                          content: titleLine(contentBodyCache.get(g.id) ?? ''),
                        }));
                        for (const col of nestedDirectKids) {
                          if (!(byParent.get(col.id) ?? []).length) {
                            nestedBoardRows.push({
                              id: `__empty__:${col.id}`,
                              parent: nestedParentLabel[col.id],
                              schema: '',
                              content: '',
                            });
                          }
                        }
                        const renderNestedCard = (row: Record<string, unknown>) => {
                          const id = String(row.id);
                          if (id.startsWith('__empty__:')) {
                            return <div style={{ fontSize: 11, color: 'var(--palette-outline, #888)', fontStyle: 'italic', padding: 4 }}>(no items)</div>;
                          }
                          const cardRec = byId.get(id);
                          if (!cardRec) return <span style={{ fontSize: 12 }}>{String(row.content)}</span>;
                          return (
                            <div data-part="kanban-card-tree" data-root-id={id}>
                              <BlockSubtreeView {...sp} rootId={id} keyNamespace="nested-kanban-card" />
                            </div>
                          );
                        };
                        return (
                          <div data-part="nested-alt-view" data-view={nestedMode} data-parent-id={nodeId} style={nestedWrap}>
                            <BoardDisplay
                              data={nestedBoardRows}
                              fields={[...fields, { key: 'parent', label: 'Parent' }]}
                              groupBy="parent"
                              renderItem={renderNestedCard}
                              onCardMove={async (rowId, newColumnLabel) => {
                                const newParentId = nestedLabelToId[newColumnLabel];
                                if (!newParentId || newParentId === rowId) return;
                                try {
                                  await invokeBinding(invoke, 'outline-reparent', { node: rowId, newParent: newParentId });
                                  const siblings = byParent.get(newParentId) ?? [];
                                  const recs = await Promise.all(siblings
                                    .filter((s) => s.id !== rowId)
                                    .map((s) => invoke('Outline', 'getRecord', { node: s.id })));
                                  const maxOrder = recs.reduce((m, r) => {
                                    if (r.variant === 'ok' && typeof r.order === 'number') return Math.max(m, r.order as number);
                                    return m;
                                  }, 0);
                                  await invokeBinding(invoke, 'outline-set-order', { node: rowId, order: maxOrder + 1 });
                                } catch (err) {
                                  console.warn('[nested-block-children-board] reparent failed:', err);
                                } finally {
                                  void loadChildren();
                                }
                              }}
                            />
                          </div>
                        );
                      }
                      if (nestedMode === 'block-children-table') {
                        const nestedRows = nestedDirectKids;
                        const nestedColCount = nestedRows.reduce((m, r) => Math.max(m, (byParent.get(r.id) ?? []).length), 0);
                        return (
                          <div data-part="nested-alt-view" data-view={nestedMode} data-parent-id={nodeId} style={{ ...nestedWrap, overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                              <thead>
                                <tr style={{ textAlign: 'left', color: 'var(--palette-outline, #888)', fontSize: 11, textTransform: 'uppercase' }}>
                                  <th style={{ padding: 6, borderBottom: '1px solid var(--palette-outline-variant)', minWidth: 180 }}>Row</th>
                                  {Array.from({ length: nestedColCount }).map((_, i) => (
                                    <th key={i} style={{ padding: 6, borderBottom: '1px solid var(--palette-outline-variant)', minWidth: 140 }}>Col {i + 1}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {nestedRows.map((row) => {
                                  const cells = byParent.get(row.id) ?? [];
                                  return (
                                    <tr key={row.id} data-block-id={row.id} style={{ verticalAlign: 'top' }}>
                                      <td style={{ padding: 6, borderBottom: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.04))' }}>
                                        <BlockSubtreeView {...sp} rootId={row.id} keyNamespace="nested-roam-row" />
                                      </td>
                                      {Array.from({ length: nestedColCount }).map((_, i) => {
                                        const cell = cells[i];
                                        return (
                                          <td key={i} style={{ padding: 6, borderBottom: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.04))' }}>
                                            {cell
                                              ? <BlockSubtreeView {...sp} rootId={cell.id} keyNamespace={`nested-roam-cell-${i}`} />
                                              : <span style={{ color: 'var(--palette-outline, #ccc)', fontStyle: 'italic', fontSize: 11 }}>—</span>}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      }
                      return null;
                    };
                    // Full props including renderAltChildren for propagation
                    // through the entire subtree.
                    const subtreeProps = { ...subtreePropsBase, renderAltChildren };
                    const directKids = byParent.get(child.id) ?? [];
                    if (mode === 'block-children-outline' || mode === 'block-children-list') {
                      // Outline / list: vertical stack of the direct
                      // children, each rendered as a full recursive
                      // subtree via renderBlockSubtree. Every nested
                      // BlockSlot keeps its original schema, display
                      // mode, and carries its own gear if it has kids.
                      return (
                        <div data-part="nested-alt-view" data-view={mode} data-parent-id={child.id} style={wrap}>
                          {directKids.map((k) => (
                            <div key={k.id} data-block-id={k.id} style={{ marginBottom: 4 }}>
                              <BlockSubtreeView {...subtreeProps} rootId={k.id} keyNamespace={mode} />
                            </div>
                          ))}
                        </div>
                      );
                    }
                    if (mode === 'block-children-gallery') {
                      // Gallery: each direct child is a card; the
                      // card's contents are the subtree rendered via
                      // renderBlockSubtree. Per-block gears + nested
                      // editing work inside each card.
                      return (
                        <div data-part="nested-alt-view" data-view={mode} data-parent-id={child.id} style={{ ...wrap, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
                          {directKids.map((k) => (
                            <div key={k.id} data-block-id={k.id} style={{ border: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.1))', borderRadius: 6, padding: 10, minHeight: 60, fontSize: 13 }}>
                              <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--palette-outline, #888)', marginBottom: 6 }}>{k.schema}</div>
                              <BlockSubtreeView {...subtreeProps} rootId={k.id} keyNamespace={mode} />
                            </div>
                          ))}
                        </div>
                      );
                    }
                    if (mode === 'block-children-board') {
                      // Kanban where each column IS a parent block —
                      // "first parent as the group". We pass the whole
                      // subtree so every descendant shows up in the
                      // column for its immediate parent. Column labels
                      // are the parent block's title (resolved via a
                      // lookup map), and onCardMove reparents via the
                      // seeded outline-reparent ActionBinding so drag
                      // is a first-class hierarchy edit.
                      // Classic kanban shape:
                      //   columns = direct children of the clicked block
                      //   cards   = GRANDCHILDREN of the clicked block
                      //             (= direct children of each column)
                      //   each card recursively renders its full subtree
                      // If a direct child has no children of its own,
                      // it appears as an empty column. If a grandchild
                      // has descendants, they render nested inside the
                      // card (renderSubtreeInCard walks byParent).
                      const parentLabel: Record<string, string> = {};
                      const labelToId: Record<string, string> = {};
                      for (const c of byParent.get(child.id) ?? []) {
                        const lbl = (contentBodyCache.get(c.id) ?? '').replace(/<[^>]+>/g, '').trim() || c.id;
                        parentLabel[c.id] = lbl;
                      }
                      for (const [id, lbl] of Object.entries(parentLabel)) {
                        if (labelToId[lbl] === undefined) labelToId[lbl] = id;
                      }
                      // Gather grandchildren as the card set. Each row's
                      // `parent` is a direct child id, which maps to a
                      // column label above.
                      const grandchildren: BlockChild[] = [];
                      for (const directKid of byParent.get(child.id) ?? []) {
                        for (const grand of byParent.get(directKid.id) ?? []) {
                          grandchildren.push(grand);
                        }
                      }
                      const boardRows = grandchildren.map((g) => ({
                        id: g.id,
                        parent: parentLabel[g.parent] ?? g.parent,
                        schema: g.schema,
                        content: titleLine(contentBodyCache.get(g.id) ?? ''),
                      }));
                      // Seed empty columns for direct children that
                      // currently have no grandchildren (otherwise
                      // BoardDisplay omits them entirely).
                      for (const directKid of byParent.get(child.id) ?? []) {
                        if (!(byParent.get(directKid.id) ?? []).length) {
                          boardRows.push({
                            id: `__empty__:${directKid.id}`,
                            parent: parentLabel[directKid.id],
                            schema: '',
                            content: '',
                          });
                        }
                      }
                      // Render each Kanban card as a real BlockSlot so
                      // the card's internal content honors the original
                      // block display (paragraph stays a paragraph,
                      // heading stays a heading, etc.) including live
                      // editing and resolved widget. The kanban shell
                      // only wraps the block; the display-mode doesn't
                      // Kanban cards reuse the same DisplayMode-driven
                      // BlockSubtreeView as every other alt-view, so
                      // the card shell never has to know about block
                      // structure — it just asks for the subtree view.
                      const renderBlockCard = (row: Record<string, unknown>) => {
                        const id = String(row.id);
                        if (id.startsWith('__empty__:')) {
                          return <div style={{ fontSize: 11, color: 'var(--palette-outline, #888)', fontStyle: 'italic', padding: 4 }}>(no items)</div>;
                        }
                        const rec = byId.get(id);
                        if (!rec) return <span style={{ fontSize: 12 }}>{String(row.content)}</span>;
                        return (
                          <div data-part="kanban-card-tree" data-root-id={id}>
                            <BlockSubtreeView {...subtreeProps} rootId={id} keyNamespace="kanban-card" />
                          </div>
                        );
                      };
                      return (
                        <div data-part="nested-alt-view" data-view={mode} data-parent-id={child.id} style={wrap}>
                          <BoardDisplay
                            data={boardRows}
                            fields={[...fields, { key: 'parent', label: 'Parent' }]}
                            groupBy="parent"
                            renderItem={renderBlockCard}
                            onCardMove={async (rowId, newColumnLabel) => {
                              const newParentId = labelToId[newColumnLabel];
                              if (!newParentId || newParentId === rowId) return;
                              try {
                                // Reparent first.
                                await invokeBinding(invoke, 'outline-reparent', {
                                  node: rowId,
                                  newParent: newParentId,
                                });
                                // Then pin the moved card at the END of
                                // the new column so drag behavior is
                                // predictable: cards land where the
                                // user dropped them, never shuffling.
                                // Use max(existing orders) + 1 so the
                                // new position is guaranteed unique.
                                const siblings = byParent.get(newParentId) ?? [];
                                const recs = await Promise.all(siblings
                                  .filter((s) => s.id !== rowId)
                                  .map((s) => invoke('Outline', 'getRecord', { node: s.id })));
                                const maxOrder = recs.reduce((m, r) => {
                                  if (r.variant === 'ok' && typeof r.order === 'number') {
                                    return Math.max(m, r.order as number);
                                  }
                                  return m;
                                }, 0);
                                await invokeBinding(invoke, 'outline-set-order', {
                                  node: rowId,
                                  order: maxOrder + 1,
                                });
                              } catch (err) {
                                console.warn('[block-children-board] reparent failed:', err);
                              } finally {
                                void loadChildren();
                              }
                            }}
                          />
                        </div>
                      );
                    }
                    if (mode === 'block-children-table') {
                      // Roam-style table:
                      //   row  = direct child of the clicked block
                      //   col  = Nth-position grandchild per row
                      //   cell = that grandchild rendered as a full
                      //          block subtree (recursive, editable)
                      // Column count = max grandchild count across
                      // rows so every row fills the table width.
                      // First column is always the row's "header"
                      // (the direct child itself) so the row is
                      // self-labeling.
                      const rows = directKids;
                      const colCount = rows.reduce((m, r) => Math.max(m, (byParent.get(r.id) ?? []).length), 0);
                      return (
                        <div data-part="nested-alt-view" data-view={mode} data-parent-id={child.id} style={{ ...wrap, overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                            <thead>
                              <tr style={{ textAlign: 'left', color: 'var(--palette-outline, #888)', fontSize: 11, textTransform: 'uppercase' }}>
                                <th style={{ padding: 6, borderBottom: '1px solid var(--palette-outline-variant)', minWidth: 200 }}>Row</th>
                                {Array.from({ length: colCount }).map((_, i) => (
                                  <th key={i} style={{ padding: 6, borderBottom: '1px solid var(--palette-outline-variant)', minWidth: 160 }}>
                                    Col {i + 1}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row) => {
                                const cells = byParent.get(row.id) ?? [];
                                return (
                                  <tr key={row.id} data-block-id={row.id} style={{ verticalAlign: 'top' }}>
                                    <td style={{ padding: 6, borderBottom: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.04))' }}>
                                      <BlockSubtreeView {...subtreeProps} rootId={row.id} keyNamespace="roam-row" />
                                    </td>
                                    {Array.from({ length: colCount }).map((_, i) => {
                                      const cell = cells[i];
                                      return (
                                        <td key={i} style={{ padding: 6, borderBottom: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.04))' }}>
                                          {cell
                                            ? <BlockSubtreeView {...subtreeProps} rootId={cell.id} keyNamespace={`roam-cell-${i}`} />
                                            : <span style={{ color: 'var(--palette-outline, #ccc)', fontStyle: 'italic', fontSize: 11 }}>—</span>}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </li>
              );
            })}
          </ol>
          </>);
        })()}

        {/* Auto-built TOC — floating right-side index of headings */}
        {!childrenLoading && (() => {
          const headings = children.filter((c) =>
            c.schema === 'heading' || c.schema === 'heading-2' || c.schema === 'heading-3'
          );
          if (headings.length < 2) return null;
          return (
            <nav
              data-part="toc"
              aria-label="Table of contents"
              style={{
                position: 'fixed',
                top: '120px',
                right: '24px',
                maxWidth: '180px',
                fontSize: '12px',
                lineHeight: '1.4',
                padding: '8px',
                background: 'transparent',
                borderLeft: '2px solid var(--palette-outline-variant, #e5e7eb)',
                paddingLeft: '12px',
                zIndex: 5,
              }}
            >
              {headings.map((h) => {
                const level = h.schema === 'heading' ? 0 : h.schema === 'heading-2' ? 1 : 2;
                const text = (contentBodyCache.get(h.id) ?? '').replace(/<[^>]+>/g, ' ').trim() || '(untitled)';
                return (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.querySelector<HTMLElement>(
                        `[data-part="block-slot"][data-node-id="${h.id}"]`,
                      );
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    style={{
                      display: 'block',
                      paddingLeft: `${level * 12}px`,
                      color: 'var(--palette-on-surface-variant, #6b7280)',
                      textDecoration: 'none',
                      padding: '2px 0',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {text}
                  </a>
                );
              })}
            </nav>
          );
        })()}

        {/* Word count + reading time footer */}
        {!childrenLoading && children.length > 0 && (() => {
          let words = 0;
          for (const c of children) {
            const body = contentBodyCache.get(c.id);
            if (!body) continue;
            const text = body.replace(/<[^>]+>/g, ' ').trim();
            if (text) words += text.split(/\s+/).filter(Boolean).length;
          }
          const minutes = Math.max(1, Math.round(words / 200));
          return (
            <div
              data-part="doc-stats"
              style={{
                maxWidth: '740px',
                margin: '2em auto 4em',
                padding: '0 var(--spacing-md)',
                fontSize: '12px',
                color: 'var(--palette-on-surface-variant, #6b7280)',
                display: 'flex',
                gap: '1.5em',
              }}
            >
              <span>{words} word{words !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{minutes} min read</span>
              <span>·</span>
              <span>{children.length} block{children.length !== 1 ? 's' : ''}</span>
            </div>
          );
        })()}

        {/* Slash menu overlay */}
        {fsmState === 'slash-open' && (
          <SlashMenuOverlay
            items={slashItemsBySection}
            loading={slashMenuLoading}
            onActivate={handleSlashItemActivate}
            onClose={closeSlashMenu}
            anchor={slashAnchor}
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
          display: rightRailVisible ? 'flex' : 'none',
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

/** Minimal emoji shortcode map. :name: → emoji. */
const EMOJI_MAP: Record<string, string> = {
  fire: '🔥', rocket: '🚀', tada: '🎉', check: '✅', x: '❌',
  warning: '⚠️', star: '⭐', heart: '❤️', thumbsup: '👍', thumbsdown: '👎',
  eyes: '👀', bug: '🐛', pencil: '✏️', bulb: '💡', zap: '⚡',
  sparkles: '✨', package: '📦', wrench: '🔧', hammer: '🔨', gear: '⚙️',
  book: '📖', bookmark: '🔖', link: '🔗', mag: '🔍', lock: '🔒',
  unlock: '🔓', key: '🔑', hourglass: '⌛', clock: '🕐', calendar: '📅',
  phone: '📞', envelope: '✉️', inbox: '📥', outbox: '📤', memo: '📝',
  clipboard: '📋', chart: '📊', trophy: '🏆', crown: '👑', rainbow: '🌈',
  sun: '☀️', moon: '🌙', cloud: '☁️', snowflake: '❄️', umbrella: '☂️',
  coffee: '☕', pizza: '🍕', cake: '🎂', beer: '🍺', wine: '🍷',
  smile: '😀', wink: '😉', cry: '😢', laugh: '😂', thinking: '🤔',
  cool: '😎', party: '🥳', hundred: '💯', plus_one: '➕', shrug: '🤷',
};

/**
 * SelectionToolbar — floating popover with B/I/U/<> buttons, anchored to
 * the active text selection. Always renders when a non-empty selection
 * exists inside a [data-part="block-content"]; no EditSurface lookup
 * required. document.execCommand dispatches keep the implementation
 * portable and match the behavior of Cmd+B / Cmd+I / Cmd+U / Cmd+E.
 */
/**
 * WikilinkPicker — floating list of pages filtered by query. Shown when
 * the user types `[[` in a block. Selecting a page inserts an anchor
 * `<a data-wikilink="pageId">title</a>` replacing the `[[query` range.
 */
interface WikilinkPickerProps {
  query: string;
  anchor: { top: number; left: number };
  invoke: (concept: string, action: string, input: Record<string, unknown>) => Promise<{ variant: string; [k: string]: unknown }>;
  onSelect: (pageId: string, title: string) => void;
  onClose: () => void;
}

const WikilinkPicker: React.FC<WikilinkPickerProps> = ({ query, anchor, invoke, onSelect, onClose }) => {
  const [items, setItems] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Read the picker's ViewShell config (discovers which ActionBinding
        // backs this picker's data source). Falls back to 'list-pages' if
        // ViewShell isn't registered yet.
        let dataSourceBinding = 'list-pages';
        try {
          const vs = await invoke('ViewShell', 'resolve', { name: 'wikilink-picker' });
          if (vs.variant === 'ok') {
            const cfg = JSON.parse(String(vs.config ?? '{}'));
            if (typeof cfg.dataSource === 'string' && cfg.dataSource) dataSourceBinding = cfg.dataSource;
          }
        } catch { /* fall back to default binding */ }
        const res = await invokeBinding(invoke, dataSourceBinding, { limit: 200 });
        if (cancelled || res.variant !== 'ok') return;
        const rows: Array<Record<string, unknown>> = (() => {
          try { return JSON.parse(res.items as string || '[]'); }
          catch { return []; }
        })();
        const pages = rows
          .map((r) => ({
            id: String(r.node ?? ''),
            title: String(r.content ?? r.node ?? '').slice(0, 60) || String(r.node ?? ''),
          }))
          .filter((p) => p.id)
          .filter((p) => !query || p.title.toLowerCase().includes(query.toLowerCase()) || p.id.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 8);
        setItems(pages);
        setSelectedIdx(0);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [query, invoke]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, items.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') {
        if (items.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        const sel = items[selectedIdx] ?? items[0];
        onSelect(sel.id, sel.title);
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [items, selectedIdx, onSelect, onClose]);

  if (items.length === 0) return null;
  return (
    <div
      data-part="wikilink-picker"
      role="listbox"
      aria-label="Page picker"
      style={{
        position: 'fixed',
        top: `${anchor.top}px`,
        left: `${anchor.left}px`,
        zIndex: 1000,
        background: '#ffffff',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        minWidth: '240px',
        maxHeight: '280px',
        overflowY: 'auto',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}
    >
      {items.map((it, i) => (
        <button
          key={it.id}
          role="option"
          aria-selected={i === selectedIdx}
          onMouseEnter={() => setSelectedIdx(i)}
          onMouseDown={(e) => { e.preventDefault(); onSelect(it.id, it.title); }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '6px 10px',
            border: 'none',
            background: i === selectedIdx ? '#f3f4f6' : 'transparent',
            color: '#111827',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          {it.title || it.id}
        </button>
      ))}
    </div>
  );
};

/**
 * MentionPicker — sibling to WikilinkPicker but sources users from
 * Authentication/list. Selecting a user inserts a
 * <span data-mention="userId">@username</span>.
 */
const MentionPicker: React.FC<{
  query: string;
  anchor: { top: number; left: number };
  invoke: (concept: string, action: string, input: Record<string, unknown>) => Promise<{ variant: string; [k: string]: unknown }>;
  onSelect: (userId: string) => void;
  onClose: () => void;
}> = ({ query, anchor, invoke, onSelect, onClose }) => {
  const [items, setItems] = useState<Array<{ user: string; provider: string }>>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Same pattern as wikilink picker: resolve the ViewShell for the
        // user-mention picker to discover the backing binding. Falls
        // back if ViewShell isn't registered yet.
        let dataSourceBinding = 'list-users';
        try {
          const vs = await invoke('ViewShell', 'resolve', { name: 'user-mention-picker' });
          if (vs.variant === 'ok') {
            const cfg = JSON.parse(String(vs.config ?? '{}'));
            if (typeof cfg.dataSource === 'string' && cfg.dataSource) dataSourceBinding = cfg.dataSource;
          }
        } catch { /* fall back to default binding */ }
        const res = await invokeBinding(invoke, dataSourceBinding, {});
        if (cancelled || res.variant !== 'ok') return;
        const rows: Array<{ user: string; provider: string }> = (() => {
          try { return JSON.parse(res.items as string || '[]'); }
          catch { return []; }
        })();
        const filtered = rows
          .filter((r) => !query || r.user.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 8);
        setItems(filtered);
        setSelectedIdx(0);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [query, invoke]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, items.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') {
        if (items.length === 0) return;
        e.preventDefault(); e.stopPropagation();
        onSelect((items[selectedIdx] ?? items[0]).user);
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [items, selectedIdx, onSelect, onClose]);
  if (items.length === 0) return null;
  return (
    <div
      data-part="mention-picker"
      role="listbox"
      aria-label="User picker"
      style={{
        position: 'fixed',
        top: `${anchor.top}px`,
        left: `${anchor.left}px`,
        zIndex: 1000,
        background: '#ffffff',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        minWidth: '200px',
        maxHeight: '280px',
        overflowY: 'auto',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}
    >
      {items.map((it, i) => (
        <button
          key={it.user}
          role="option"
          aria-selected={i === selectedIdx}
          onMouseEnter={() => setSelectedIdx(i)}
          onMouseDown={(e) => { e.preventDefault(); onSelect(it.user); }}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '6px 10px', border: 'none',
            background: i === selectedIdx ? '#f3f4f6' : 'transparent',
            color: '#111827', cursor: 'pointer', fontSize: '13px',
          }}
        >
          @{it.user}
          <span style={{ color: '#6b7280', marginLeft: '8px', fontSize: '11px' }}>{it.provider}</span>
        </button>
      ))}
    </div>
  );
};

const SelectionToolbar: React.FC<{ selection: EditorSelection | null }> = ({ selection }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!selection || selection.rangeEnd <= selection.rangeStart) {
      setPos(null);
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { setPos(null); return; }
    const range = sel.getRangeAt(0);
    if (range.collapsed) { setPos(null); return; }
    const rect = range.getBoundingClientRect();
    setPos({ top: rect.top + window.scrollY - 44, left: rect.left + rect.width / 2 + window.scrollX });
  }, [selection]);
  if (!pos) return null;
  const cmd = (op: 'bold' | 'italic' | 'underline') => (e: React.MouseEvent) => {
    e.preventDefault();
    document.execCommand(op);
  };
  const code = (e: React.MouseEvent) => {
    e.preventDefault();
    const s = window.getSelection();
    if (!s || s.isCollapsed) return;
    const r = s.getRangeAt(0);
    const el = document.createElement('code');
    el.appendChild(r.extractContents());
    r.insertNode(el);
    r.setStartAfter(el); r.collapse(true);
    s.removeAllRanges(); s.addRange(r);
  };
  const btn: React.CSSProperties = {
    background: 'transparent', border: 'none', color: '#f3f4f6',
    padding: '4px 8px', cursor: 'pointer', fontSize: '13px',
    borderRadius: '4px',
  };
  return (
    <div
      data-part="selection-toolbar"
      role="toolbar"
      aria-label="Inline formatting"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: '#1f2937',
        color: '#f3f4f6',
        borderRadius: '6px',
        padding: '2px',
        display: 'flex',
        gap: '2px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <button onMouseDown={cmd('bold')} style={{...btn, fontWeight: 700}}>B</button>
      <button onMouseDown={cmd('italic')} style={{...btn, fontStyle: 'italic'}}>I</button>
      <button onMouseDown={cmd('underline')} style={{...btn, textDecoration: 'underline'}}>U</button>
      <button onMouseDown={code} style={{...btn, fontFamily: 'monospace'}}>{'<>'}</button>
    </div>
  );
};

/**
 * Re-focus a block's contentEditable after a structural change remounts it.
 * Used by Tab / Shift+Tab / other handlers so the caret doesn't jump to the
 * body when loadChildren → setChildren → React re-keys the BlockSlot subtree.
 * Sets a module-level pendingFocusNodeId that new BlockSlot mounts claim,
 * AND polls the DOM in case the block mounted before Tab's async path.
 */
let pendingFocusNodeId: string | null = null;
let pendingFocusAt: 'start' | 'end' = 'end';

/**
 * invokeBinding — client-side ActionBinding resolver.
 *
 * The kernel's InvokeViaBinding sync (which would do target + parameterMap
 * resolution server-side) isn't loaded, so ActionBinding/invoke today is a
 * no-op that just stamps a trace id. This helper does the resolution on
 * the client: fetch the binding, evaluate the parameterMap against the
 * supplied context, and dispatch to the target concept/action. All
 * editor actions go through this path so adding a new action means
 * writing a Clef seed, not a bespoke React invoke() call.
 *
 * parameterMap format (stored in ActionBinding row):
 *   '{"paramName":"context.path.to.value", ...}'
 *   Values starting with "context." resolve against the provided context
 *   object; other values are passed through as string literals.
 */
async function invokeBinding(
  invoke: (concept: string, action: string, input: Record<string, unknown>) => Promise<{ variant: string; [k: string]: unknown }>,
  bindingId: string,
  context: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): Promise<{ variant: string; [k: string]: unknown }> {
  const rec = await invoke('ActionBinding', 'get', { binding: bindingId });
  if (rec.variant !== 'ok' || typeof rec.target !== 'string') {
    return { variant: 'notfound', message: `binding '${bindingId}' not found` };
  }
  const [concept, action] = String(rec.target).split('/');
  if (!concept || !action) {
    return { variant: 'error', message: `invalid target '${rec.target}'` };
  }
  let pmapRaw = typeof rec.parameterMap === 'string' ? rec.parameterMap : '{}';
  let pmap: Record<string, string>;
  try { pmap = JSON.parse(pmapRaw) as Record<string, string>; }
  catch { pmap = {}; }
  const input: Record<string, unknown> = {};
  for (const [param, path] of Object.entries(pmap)) {
    if (typeof path !== 'string') continue;
    if (path.startsWith('context.')) {
      const key = path.slice('context.'.length);
      if (key in context) input[param] = context[key];
    } else {
      input[param] = path;
    }
  }
  for (const [k, v] of Object.entries(overrides)) input[k] = v;
  return invoke(concept, action, input);
}

/**
 * Module-level cache of ContentNode body by nodeId. Survives React
 * re-mounts, so Tab / Shift+Tab / Backspace-merge don't force every
 * visible block to re-fetch its body from the server on structural
 * change. Invalidate on: delete, or when we write new content via
 * update-block-content / changeType.
 */
const contentBodyCache = new Map<string, string>();
const contentSchemaCache = new Map<string, string>();
export function invalidateBlockBody(nodeId: string) {
  contentBodyCache.delete(nodeId);
  contentSchemaCache.delete(nodeId);
}

/**
 * Undo/redo stacks — module-level because one block editor lives per
 * page view at a time. Each entry is an inverse action captured at
 * dispatch time; undo pops and applies, redo re-pushes onto undo.
 * Text-edit bursts within BURST_MS coalesce into one entry.
 */
type UndoEntry =
  | { kind: 'text'; nodeId: string; before: string; after: string; ts: number }
  | { kind: 'insert'; nodeId: string; parent: string }
  | { kind: 'delete'; nodeId: string; parent: string; schema: string; content: string }
  | { kind: 'reparent'; nodeId: string; oldParent: string; newParent: string }
  | { kind: 'changeType'; nodeId: string; oldType: string; newType: string };

const undoStack: UndoEntry[] = [];
const redoStack: UndoEntry[] = [];
const BURST_MS = 800;
const UNDO_CAP = 200;

export function pushUndo(entry: UndoEntry) {
  // Coalesce consecutive same-nodeId text edits within BURST_MS
  if (entry.kind === 'text' && undoStack.length > 0) {
    const top = undoStack[undoStack.length - 1];
    if (top.kind === 'text' && top.nodeId === entry.nodeId && entry.ts - top.ts < BURST_MS) {
      top.after = entry.after;
      top.ts = entry.ts;
      redoStack.length = 0;
      return;
    }
  }
  undoStack.push(entry);
  if (undoStack.length > UNDO_CAP) undoStack.shift();
  redoStack.length = 0;
}

function restoreFocusToBlock(nodeId: string, at: 'start' | 'end' = 'end') {
  pendingFocusNodeId = nodeId;
  pendingFocusAt = at;
  const attempt = (n = 0) => {
    if (pendingFocusNodeId !== nodeId) return; // superseded
    const el = document.querySelector<HTMLDivElement>(
      `[data-part="block-slot"][data-node-id="${nodeId}"] [data-part="block-content"]`,
    );
    if (el) {
      el.focus();
      const sel = window.getSelection();
      if (sel) {
        const r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(at === 'start');
        sel.removeAllRanges();
        sel.addRange(r);
      }
      pendingFocusNodeId = null;
    } else if (n < 16) {
      setTimeout(() => attempt(n + 1), 30);
    }
  };
  attempt();
}

// ===========================================================================
// BlockSlotChildren — renders nested children of a block.
// This is where the "recursive view" contract materializes: every BlockSlot
// can own a subtree, so Tab-indented blocks reappear under their new parent
// rather than disappearing from the top-level list. Each nested child is
// itself a BlockSlot, so the recursion is unbounded (cycles prevented by
// the outline DAG invariant).
// ===========================================================================

interface BlockSlotChildrenProps {
  parentId: string;
  rootNodeId: string;
  canEdit: boolean;
  invoke: (concept: string, action: string, input: Record<string, unknown>) => Promise<{ variant: string; [k: string]: unknown }>;
  onBlockContentChange?: (nodeId: string, content: string) => void;
  onStructureChange: () => void;
}

/**
 * ViewShell-driven block-children settings. Each parent's children
 * list is rendered through a named ViewShell row (seeded in
 * ViewShell.block-children.seeds.yaml). Users flip variants via the
 * gear button or right-click on the children container; selection
 * persists in localStorage keyed by parent nodeId so reloads are sticky.
 *
 * Filter and sort operate client-side on the already-fetched child set
 * — we do NOT re-query on every toggle. The ViewShell resolution only
 * picks WHICH FilterSpec / SortSpec names apply; the child-side
 * interpreter of those names is in applyBlockChildrenFilterSort below.
 */
const BLOCK_CHILDREN_VIEWS = [
  'block-children-blocks',
  'block-children-outline',
  'block-children-list',
  'block-children-gallery',
  'block-children-board',
  'block-children-table',
] as const;
type BlockChildrenView = typeof BLOCK_CHILDREN_VIEWS[number];

const BLOCK_CHILDREN_SORTS = [
  'block-children-order',
  'block-children-created-asc',
  'block-children-created-desc',
  'block-children-updated-desc',
  'block-children-schema',
  'block-children-title',
] as const;
type BlockChildrenSort = typeof BLOCK_CHILDREN_SORTS[number];

const BLOCK_CHILDREN_FILTERS = [
  'block-children-all',
  'block-children-unchecked-tasks',
  'block-children-headings-only',
] as const;
type BlockChildrenFilter = typeof BLOCK_CHILDREN_FILTERS[number];

const VIEW_LABELS: Record<string, string> = {
  'block-children-blocks': 'Blocks (editable)',
  'block-children-outline': 'Outline',
  'block-children-list': 'List',
  'block-children-gallery': 'Gallery',
  'block-children-board': 'Board (kanban by parent)',
  'block-children-table': 'Table',
};
const SORT_LABELS: Record<string, string> = {
  'block-children-order': 'Block order (Outline)',
  'block-children-created-asc': 'Created (oldest first)',
  'block-children-created-desc': 'Created (newest first)',
  'block-children-updated-desc': 'Recently edited',
  'block-children-schema': 'Schema',
  'block-children-title': 'Title',
};
const FILTER_LABELS: Record<string, string> = {
  'block-children-all': 'All blocks',
  'block-children-unchecked-tasks': 'Unchecked tasks only',
  'block-children-headings-only': 'Headings only',
};

interface BlockChildrenSettings {
  view: BlockChildrenView;
  sort: BlockChildrenSort;
  filter: BlockChildrenFilter;
}

function defaultBlockChildrenSettings(): BlockChildrenSettings {
  return { view: 'block-children-blocks', sort: 'block-children-order', filter: 'block-children-all' };
}

function loadBlockChildrenSettingsMap(rootNodeId: string): Record<string, BlockChildrenSettings> {
  try {
    const raw = typeof window !== 'undefined'
      ? window.localStorage.getItem(`block-children-view-map:${rootNodeId}`)
      : null;
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, Partial<BlockChildrenSettings>>;
      const clean: Record<string, BlockChildrenSettings> = {};
      for (const [k, v] of Object.entries(obj)) {
        clean[k] = {
          view: (BLOCK_CHILDREN_VIEWS as readonly string[]).includes(v.view as string) ? (v.view as BlockChildrenView) : 'block-children-blocks',
          sort: (BLOCK_CHILDREN_SORTS as readonly string[]).includes(v.sort as string) ? (v.sort as BlockChildrenSort) : 'block-children-order',
          filter: (BLOCK_CHILDREN_FILTERS as readonly string[]).includes(v.filter as string) ? (v.filter as BlockChildrenFilter) : 'block-children-all',
        };
      }
      return clean;
    }
  } catch { /* ignore */ }
  return {};
}

function saveBlockChildrenSettingsMap(rootNodeId: string, map: Record<string, BlockChildrenSettings>) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`block-children-view-map:${rootNodeId}`, JSON.stringify(map));
    }
  } catch { /* ignore */ }
}

function loadBlockChildrenSettings(parentId: string): BlockChildrenSettings {
  try {
    const raw = typeof window !== 'undefined'
      ? window.localStorage.getItem(`block-children-view:${parentId}`)
      : null;
    if (raw) {
      const s = JSON.parse(raw) as Partial<BlockChildrenSettings>;
      return {
        view: (BLOCK_CHILDREN_VIEWS as readonly string[]).includes(s.view as string) ? (s.view as BlockChildrenView) : 'block-children-blocks',
        sort: (BLOCK_CHILDREN_SORTS as readonly string[]).includes(s.sort as string) ? (s.sort as BlockChildrenSort) : 'block-children-order',
        filter: (BLOCK_CHILDREN_FILTERS as readonly string[]).includes(s.filter as string) ? (s.filter as BlockChildrenFilter) : 'block-children-all',
      };
    }
  } catch { /* fall through to defaults */ }
  return { view: 'block-children-blocks', sort: 'block-children-order', filter: 'block-children-all' };
}

function saveBlockChildrenSettings(parentId: string, s: BlockChildrenSettings) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`block-children-view:${parentId}`, JSON.stringify(s));
    }
  } catch { /* quota / incognito — silently ignore */ }
}

interface ChildRow {
  id: string;
  schema: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  order: number;
}

function applyBlockChildrenFilterSort(rows: ChildRow[], s: BlockChildrenSettings): ChildRow[] {
  let out = rows.slice();
  // Filter
  if (s.filter === 'block-children-unchecked-tasks') out = out.filter(r => r.schema === 'task');
  else if (s.filter === 'block-children-headings-only') out = out.filter(r => r.schema === 'heading' || r.schema === 'heading-2' || r.schema === 'heading-3');
  // Sort
  const by = (cmp: (a: ChildRow, b: ChildRow) => number) => { out.sort(cmp); };
  switch (s.sort) {
    case 'block-children-created-asc':  by((a, b) => a.createdAt.localeCompare(b.createdAt)); break;
    case 'block-children-created-desc': by((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
    case 'block-children-updated-desc': by((a, b) => b.updatedAt.localeCompare(a.updatedAt)); break;
    case 'block-children-schema':       by((a, b) => a.schema.localeCompare(b.schema) || a.order - b.order); break;
    case 'block-children-title':        by((a, b) => (a.content || '').localeCompare(b.content || '')); break;
    default:                            by((a, b) => a.order - b.order); break;
  }
  return out;
}

const BlockChildrenSettingsMenu: React.FC<{
  settings: BlockChildrenSettings;
  parentLabel?: string;
  onChange: (next: BlockChildrenSettings) => void;
  onClose: () => void;
  x: number; y: number;
}> = ({ settings, parentLabel, onChange, onClose, x, y }) => {
  // Close on click outside
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.('[data-part="block-children-menu"]')) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
    return () => document.removeEventListener('mousedown', close);
  }, [onClose]);
  const cellStyle: React.CSSProperties = { padding: '4px 10px', cursor: 'pointer', fontSize: 13, borderRadius: 4 };
  const activeStyle: React.CSSProperties = { background: 'var(--palette-surface-variant, #eef)', fontWeight: 600 };
  const sectionLabel: React.CSSProperties = { padding: '6px 10px 2px', fontSize: 11, color: 'var(--palette-outline, #888)', textTransform: 'uppercase', letterSpacing: '0.04em' };
  return (
    <div
      data-part="block-children-menu"
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed', top: y, left: x, zIndex: 9999,
        background: 'var(--palette-surface, #fff)', border: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.12))',
        borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: 4, minWidth: 220,
      }}
    >
      {parentLabel && (
        <div style={{ ...sectionLabel, color: 'var(--palette-on-surface, #333)', fontSize: 10 }}>
          children of: {parentLabel}
        </div>
      )}
      <div style={sectionLabel}>View</div>
      {BLOCK_CHILDREN_VIEWS.map((v) => (
        <div
          key={v} style={{ ...cellStyle, ...(settings.view === v ? activeStyle : {}) }}
          onClick={() => { onChange({ ...settings, view: v }); onClose(); }}
        >{VIEW_LABELS[v] ?? v.replace('block-children-', '')}</div>
      ))}
      <div style={sectionLabel}>Sort</div>
      {BLOCK_CHILDREN_SORTS.map((s) => (
        <div
          key={s} style={{ ...cellStyle, ...(settings.sort === s ? activeStyle : {}) }}
          onClick={() => { onChange({ ...settings, sort: s }); onClose(); }}
        >{SORT_LABELS[s] ?? s.replace('block-children-', '')}</div>
      ))}
      <div style={sectionLabel}>Filter</div>
      {BLOCK_CHILDREN_FILTERS.map((f) => (
        <div
          key={f} style={{ ...cellStyle, ...(settings.filter === f ? activeStyle : {}) }}
          onClick={() => { onChange({ ...settings, filter: f }); onClose(); }}
        >{FILTER_LABELS[f] ?? f.replace('block-children-', '')}</div>
      ))}
    </div>
  );
};

const BlockSlotChildren: React.FC<BlockSlotChildrenProps> = ({
  parentId, rootNodeId, canEdit, invoke, onBlockContentChange, onStructureChange,
}) => {
  const [rows, setRows] = useState<ChildRow[]>([]);
  const [settings, setSettings] = useState<BlockChildrenSettings>(() => loadBlockChildrenSettings(parentId));
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const loadChildren = useCallback(async () => {
    try {
      // Resolve the ViewShell for this parent so the config shape is
      // traceable through Score / Pilot — we don't strictly need the
      // returned tokens at the moment because filter/sort/view types
      // are interpreted client-side, but resolving logs the dependency.
      void invoke('ViewShell', 'resolve', { name: settings.view }).catch(() => ({ variant: 'notfound' }));
      const result = await invoke('Outline', 'children', { parent: parentId });
      if (result.variant !== 'ok') return;
      const ids: string[] = (() => {
        try { return JSON.parse((result.children as string) || '[]'); }
        catch { return []; }
      })();
      const next: ChildRow[] = [];
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const r = await invoke('ContentNode', 'get', { node: id });
        if (r.variant !== 'ok') continue;
        let orderVal = i;
        try {
          const rec = await invoke('Outline', 'getRecord', { node: id });
          if (rec.variant === 'ok' && typeof rec.order === 'number') orderVal = rec.order;
        } catch { /* fall through with index order */ }
        next.push({
          id,
          schema: (r.type as string) || 'paragraph',
          content: (r.content as string) || '',
          createdAt: (r.createdAt as string) || '',
          updatedAt: (r.updatedAt as string) || '',
          order: orderVal,
        });
      }
      setRows(next);
    } catch (err) {
      console.warn('[BlockSlotChildren] load failed:', err);
    }
  }, [parentId, invoke, settings.view]);

  useEffect(() => { void loadChildren(); }, [loadChildren]);

  const applied = applyBlockChildrenFilterSort(rows, settings);

  const onSettingsChange = (next: BlockChildrenSettings) => {
    setSettings(next);
    saveBlockChildrenSettings(parentId, next);
  };

  if (rows.length === 0) return null;

  const isBlocks = settings.view === 'block-children-blocks';
  const titleLine = (c: string) => {
    const stripped = c.replace(/<[^>]+>/g, '').trim();
    return stripped.length > 140 ? stripped.slice(0, 140) + '…' : (stripped || '(empty)');
  };

  return (
    <div
      data-part="block-children"
      data-view={settings.view}
      data-sort={settings.sort}
      data-filter={settings.filter}
      onContextMenu={(e) => {
        // Right-click anywhere in the children container (except inside
        // a nested contenteditable) opens the settings menu.
        const t = e.target as HTMLElement;
        if (t.closest?.('[contenteditable="true"]')) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      style={{
        position: 'relative',
        marginLeft: 'var(--spacing-lg, 24px)',
        borderLeft: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.08))',
        paddingLeft: 'var(--spacing-sm, 8px)',
        marginTop: 'var(--spacing-xs, 4px)',
      }}
    >
      <button
        type="button"
        title="View settings (right-click also opens)"
        data-part="block-children-gear"
        onClick={(e) => setMenu({ x: e.clientX, y: e.clientY })}
        style={{
          position: 'absolute', top: -2, right: 4, fontSize: 12, lineHeight: 1,
          padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
          background: 'transparent', border: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.08))',
          color: 'var(--palette-outline, #888)', opacity: 0.6,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
      >⚙</button>
      {menu && (
        <BlockChildrenSettingsMenu
          settings={settings}
          onChange={onSettingsChange}
          onClose={() => setMenu(null)}
          x={menu.x} y={menu.y}
        />
      )}

      {isBlocks && applied.map((row) => (
        <BlockSlot
          key={row.id}
          nodeId={row.id}
          rootNodeId={rootNodeId}
          schema={row.schema}
          displayMode="block-editor"
          resolvedWidget={`${row.schema}-block`}
          canEdit={canEdit}
          isSelected={false}
          editorFlavor="markdown"
          decorationLayerEntries={[]}
          onFocus={() => {}}
          onBlur={() => {}}
          onBlockContentChange={onBlockContentChange}
          onStructureChange={() => {
            void loadChildren();
            onStructureChange();
          }}
        />
      ))}

      {!isBlocks && settings.view === 'block-children-outline' && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {applied.map((row) => (
            <li key={row.id} style={{ padding: '2px 0', fontSize: row.schema.startsWith('heading') ? 15 : 13, fontWeight: row.schema === 'heading' ? 700 : row.schema === 'heading-2' ? 600 : 400 }}>
              <span style={{ color: 'var(--palette-outline, #999)', marginRight: 8, fontSize: 11 }}>{row.schema}</span>
              {titleLine(row.content)}
            </li>
          ))}
        </ul>
      )}

      {!isBlocks && settings.view === 'block-children-list' && (
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {applied.map((row) => (<li key={row.id}>{titleLine(row.content)}</li>))}
        </ol>
      )}

      {!isBlocks && settings.view === 'block-children-gallery' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8, marginTop: 8 }}>
          {applied.map((row) => (
            <div key={row.id} style={{ border: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.1))', borderRadius: 6, padding: 10, minHeight: 80, fontSize: 12 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--palette-outline, #888)', marginBottom: 4 }}>{row.schema}</div>
              <div>{titleLine(row.content)}</div>
            </div>
          ))}
        </div>
      )}

      {!isBlocks && settings.view === 'block-children-board' && (() => {
        const cols: Record<string, ChildRow[]> = {};
        for (const r of applied) { (cols[r.schema] ||= []).push(r); }
        const colNames = Object.keys(cols);
        return (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 8, paddingBottom: 8 }}>
            {colNames.map((name) => (
              <div key={name} style={{ minWidth: 180, flex: '0 0 180px', background: 'var(--palette-surface-variant, rgba(0,0,0,0.02))', borderRadius: 6, padding: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--palette-outline, #666)', marginBottom: 6 }}>{name} ({cols[name].length})</div>
                {cols[name].map((row) => (
                  <div key={row.id} style={{ background: 'var(--palette-surface, #fff)', border: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.08))', borderRadius: 4, padding: 6, marginBottom: 6, fontSize: 12 }}>
                    {titleLine(row.content)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })()}

      {!isBlocks && settings.view === 'block-children-table' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 4 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--palette-outline, #888)', fontSize: 11, textTransform: 'uppercase' }}>
              <th style={{ padding: 4, borderBottom: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.08))' }}>Schema</th>
              <th style={{ padding: 4, borderBottom: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.08))' }}>Content</th>
              <th style={{ padding: 4, borderBottom: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.08))' }}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {applied.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: 4, borderBottom: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.04))' }}>{row.schema}</td>
                <td style={{ padding: 4, borderBottom: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.04))' }}>{titleLine(row.content)}</td>
                <td style={{ padding: 4, borderBottom: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.04))', color: 'var(--palette-outline, #888)', fontSize: 11 }}>{(row.updatedAt || '').slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

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
  /** Optimistic depth adjustment — parent patches local children state
   *  (no server round-trip) so Tab / Shift+Tab feel instant. */
  onOptimisticDepthChange?: (nodeId: string, delta: number) => void;
  /** Optimistic block insert — parent adds a new BlockChild into local
   *  children state so the DOM appears synchronously with Enter. */
  onOptimisticInsert?: (newChild: {
    id: string; schema: string; parent: string; afterNodeId: string;
  }) => void;
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
  onOptimisticDepthChange,
  onOptimisticInsert,
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

  // Wikilink picker: tracks the character offset of `[[` in the block's
  // textContent. When non-null, the popover renders; key nav intercepts
  // ArrowUp/Down/Enter/Escape.
  const [wikilinkState, setWikilinkState] = useState<{
    triggerOffset: number;
    query: string;
    anchor: { top: number; left: number };
  } | null>(null);

  // Mention picker — same shape as wikilink but triggered by `@` and
  // sourced from Authentication/list.
  const [mentionState, setMentionState] = useState<{
    triggerOffset: number;
    query: string;
    anchor: { top: number; left: number };
  } | null>(null);
  const hasInitializedRef = useRef(false);

  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);

  const handleSmartClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Cmd/Ctrl-click on a link inside the block → open the URL.
    // Notion/Obsidian convention: plain click places caret, Cmd-click
    // navigates. window.open uses a new tab so the editor stays open.
    if (e.metaKey || e.ctrlKey) {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor && anchor.href) {
        e.preventDefault();
        e.stopPropagation();
        window.open(anchor.href, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, [role="button"]')) {
      return;
    }
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
      const editable = blockContentRef.current;
      const clickedInsideEditable = editable?.contains(target) ?? false;
      if (
        editable &&
        canEdit &&
        !clickedInsideEditable &&
        document.activeElement !== editable
      ) {
        editable.focus();
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(editable);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
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
  }, [canEdit, schema, nodeId, onBlockClick, onSectionSelect]);

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
  // Uses module-level cache so Tab/Shift+Tab/Backspace-merge remounts don't force
  // a network round-trip on every visible block — that's what caused the flash.
  useEffect(() => {
    if (hasInitializedRef.current) return;
    // Cache hit path: seed DOM synchronously, skip the network.
    if (contentBodyCache.has(nodeId)) {
      const body = contentBodyCache.get(nodeId) ?? '';
      if (blockContentRef.current) {
        if (schema === 'image' && body.startsWith('data:')) {
          blockContentRef.current.style.backgroundImage = `url("${body}")`;
          blockContentRef.current.setAttribute('data-src', body.slice(0, 40) + '...');
        } else {
          blockContentRef.current.innerHTML = body;
        }
        hasInitializedRef.current = true;
        blockEmptyRef.current = (blockContentRef.current.textContent ?? '').trim() === '';
        if (pendingFocusNodeId === nodeId) {
          restoreFocusToBlock(nodeId, pendingFocusAt);
        }
      }
      return;
    }
    let cancelled = false;
    async function loadBody() {
      try {
        const result = await invoke('ContentNode', 'get', { node: nodeId });
        if (cancelled || result.variant !== 'ok') return;
        const body = typeof result.content === 'string' ? result.content : '';
        contentBodyCache.set(nodeId, body);
        if (blockContentRef.current && !hasInitializedRef.current) {
          if (schema === 'image' && body.startsWith('data:')) {
            blockContentRef.current.style.backgroundImage = `url("${body}")`;
            blockContentRef.current.setAttribute('data-src', body.slice(0, 40) + '...');
          } else {
            blockContentRef.current.innerHTML = body;
          }
          hasInitializedRef.current = true;
          blockEmptyRef.current = (blockContentRef.current.textContent ?? '').trim() === '';
          if (pendingFocusNodeId === nodeId) {
            restoreFocusToBlock(nodeId, pendingFocusAt);
          }
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
      // Direct ContentNode/update — ActionBinding layer is inert; see
      // RecursiveBlockEditor.handleCreateFirstBlock comment.
      // Update cache eagerly so a sibling re-mount sees fresh content.
      const before = contentBodyCache.get(nodeId) ?? '';
      contentBodyCache.set(nodeId, newContent);
      pushUndo({ kind: 'text', nodeId, before, after: newContent, ts: Date.now() });
      const result = await invokeBinding(invoke, 'update-block-content', {
        nodeId: nodeId, content: newContent,
      });
      if (result.variant === 'ok') {
        onBlockContentChange?.(nodeId, newContent);
      } else {
        console.warn('[BlockSlot] ContentNode/update returned non-ok:', result.variant);
      }
    } catch (err) {
      console.error('[BlockSlot] content update failed:', err);
    }
  }, [nodeId, invoke, onBlockContentChange]);

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
      onMouseDown={(e) => {
        // Task-list checkbox toggle: if this is a task/task-done block
        // and the click is in the leftmost ~28px of the block-content,
        // toggle checked state instead of placing the caret.
        if (schema === 'task' || schema === 'task-done') {
          const bc = blockContentRef.current;
          if (bc && e.target instanceof Element) {
            const rect = bc.getBoundingClientRect();
            const localX = e.clientX - rect.left;
            if (localX >= 0 && localX < 28) {
              e.preventDefault();
              e.stopPropagation();
              const newSchema = schema === 'task' ? 'task-done' : 'task';
              contentSchemaCache.set(nodeId, newSchema);
              void invokeBinding(invoke, 'content-node-change-type', { node: nodeId, type: newSchema })
                .then(() => onStructureChange());
              return;
            }
          }
        }
      }}
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
        data-placeholder={
          schema === 'heading' ? 'Heading 1' :
          schema === 'heading-2' ? 'Heading 2' :
          schema === 'heading-3' ? 'Heading 3' :
          schema === 'code' ? '// code' :
          schema === 'quote' ? 'Quote' :
          schema === 'callout' ? 'Callout' :
          schema === 'bullet-list' || schema === 'numbered-list' ? 'List item' :
          "Type '/' for commands"
        }
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

          // Wikilink `[[…` and mention `@…` pickers — detect trigger
          // prefix before the caret and open / update / close the popover.
          if (canEdit && blockContentRef.current) {
            const el = blockContentRef.current;
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
              const range = sel.getRangeAt(0);
              const preRange = range.cloneRange();
              preRange.selectNodeContents(el);
              preRange.setEnd(range.endContainer, range.endOffset);
              const caretOffset = preRange.toString().length;
              const full = el.textContent ?? '';

              // Wikilink
              const bracketIdx = full.lastIndexOf('[[', caretOffset - 1);
              if (bracketIdx >= 0) {
                const between = full.slice(bracketIdx + 2, caretOffset);
                if (!between.includes(']') && between.length <= 40) {
                  const rect = range.getBoundingClientRect();
                  setWikilinkState({
                    triggerOffset: bracketIdx,
                    query: between,
                    anchor: { top: rect.bottom + 4, left: rect.left },
                  });
                } else setWikilinkState(null);
              } else setWikilinkState(null);

              // Mention: find the most recent `@` before caret; require
              // it to be at start-of-text or preceded by whitespace.
              const atIdx = full.lastIndexOf('@', caretOffset - 1);
              const precededByWord = atIdx > 0 && /\S/.test(full[atIdx - 1] || '');
              if (atIdx >= 0 && !precededByWord) {
                const between = full.slice(atIdx + 1, caretOffset);
                if (!/\s/.test(between) && between.length <= 24) {
                  const rect = range.getBoundingClientRect();
                  setMentionState({
                    triggerOffset: atIdx,
                    query: between,
                    anchor: { top: rect.bottom + 4, left: rect.left },
                  });
                } else setMentionState(null);
              } else setMentionState(null);
            }
          }

          // Emoji shortcode: :name: → unicode emoji. Fires when the
          // closing colon is typed and :name: is a known shortcode.
          if (canEdit && blockContentRef.current) {
            const el = blockContentRef.current;
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
              const range = sel.getRangeAt(0);
              const preRange = range.cloneRange();
              preRange.selectNodeContents(el);
              preRange.setEnd(range.endContainer, range.endOffset);
              const caretOffset = preRange.toString().length;
              const full = el.textContent ?? '';
              const tail = full.slice(Math.max(0, caretOffset - 32), caretOffset);
              const m = tail.match(/:([a-z_]+):$/);
              if (m) {
                const emoji = EMOJI_MAP[m[1]];
                if (emoji) {
                  const matchStart = caretOffset - m[0].length;
                  // Walk to find the range to replace
                  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                  let seen = 0; let startNode: Text | null = null; let startOff = 0;
                  let endNode: Text | null = null; let endOff = 0;
                  let n: Node | null;
                  while ((n = walker.nextNode())) {
                    const t = n as Text; const len = t.data.length;
                    if (!startNode && matchStart <= seen + len) {
                      startNode = t; startOff = matchStart - seen;
                    }
                    if (caretOffset <= seen + len) {
                      endNode = t; endOff = caretOffset - seen; break;
                    }
                    seen += len;
                  }
                  if (startNode && endNode) {
                    const r = document.createRange();
                    r.setStart(startNode, startOff);
                    r.setEnd(endNode, endOff);
                    r.deleteContents();
                    const txt = document.createTextNode(emoji);
                    r.insertNode(txt);
                    const after = document.createRange();
                    after.setStartAfter(txt); after.collapse(true);
                    sel.removeAllRanges(); sel.addRange(after);
                  }
                }
              }
            }
          }

          // Inline markdown: detect **bold**, _italic_, `code` patterns
          // just BEFORE the caret and convert to HTML marks. Triggered
          // on each keystroke; cheap regex test on the tail of text.
          // Runs in any block (not just paragraph) so headings / lists
          // can also carry inline marks.
          if (canEdit && blockContentRef.current) {
            const el = blockContentRef.current;
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
              const range = sel.getRangeAt(0);
              const preRange = range.cloneRange();
              preRange.selectNodeContents(el);
              preRange.setEnd(range.endContainer, range.endOffset);
              const caretOffset = preRange.toString().length;
              const full = el.textContent ?? '';
              const tail = full.slice(Math.max(0, caretOffset - 50), caretOffset);
              // Matches **bold**, _italic_, `code`. Requires at least one
              // non-space inside the markers. Asterisks/underscores must
              // immediately surround the word.
              const inlinePatterns: Array<{ re: RegExp; tag: string }> = [
                { re: /\*\*([^*\n]+)\*\*$/, tag: 'b' },
                { re: /__([^_\n]+)__$/, tag: 'b' },
                { re: /(?<!\*)\*([^*\n]+)\*(?!\*)$/, tag: 'i' },
                { re: /(?<!_)_([^_\n]+)_(?!_)$/, tag: 'i' },
                { re: /`([^`\n]+)`$/, tag: 'code' },
                { re: /~~([^~\n]+)~~$/, tag: 's' },
                { re: /==([^=\n]+)==$/, tag: 'mark' },
              ];
              // Typographic autoreplace: -- → —, ... → …, "word" → curly.
              // Runs as simple string substitutions on the last 4 chars
              // near the caret; re-writes block text if a replacement applies.
              {
                let replaced = false;
                const raw = full;
                let patched = raw;
                // em-dash: "-- " or "--" before a word-like tail
                patched = patched.replace(/(\w)--(?=\w)/g, '$1—');
                patched = patched.replace(/--(?= )/g, '—');
                // ellipsis
                patched = patched.replace(/\.{3}/g, '…');
                // smart double quotes: " after whitespace/start → open ",
                // " after a word → close "
                patched = patched.replace(/(^|[\s\(\[])"/g, '$1\u201C');
                patched = patched.replace(/"/g, '\u201D');
                // smart single quotes / apostrophe
                patched = patched.replace(/(^|[\s\(\[])'/g, '$1\u2018');
                patched = patched.replace(/'/g, '\u2019');
                // arrows and symbols
                patched = patched.replace(/(?:^|\s)->(?=\s|$)/g, (m) => m.replace('->', '→'));
                patched = patched.replace(/(?:^|\s)<-(?=\s|$)/g, (m) => m.replace('<-', '←'));
                patched = patched.replace(/(?:^|\s)=>(?=\s|$)/g, (m) => m.replace('=>', '⇒'));
                patched = patched.replace(/(?:^|\s)<=(?=\s|$)/g, (m) => m.replace('<=', '≤'));
                patched = patched.replace(/(?:^|\s)>=(?=\s|$)/g, (m) => m.replace('>=', '≥'));
                patched = patched.replace(/\(c\)/gi, '©');
                patched = patched.replace(/\(r\)/gi, '®');
                patched = patched.replace(/\(tm\)/gi, '™');
                patched = patched.replace(/(?<!\w)\+\/-(?!\w)/g, '±');
                if (patched !== raw) {
                  // Replace the whole textContent. Caret offset adjusts by
                  // the length delta. Simple approximation: move caret to
                  // the diff point + length of replacement minus original.
                  const delta = patched.length - raw.length;
                  const newCaret = Math.max(0, caretOffset + delta);
                  blockContentRef.current!.textContent = patched;
                  const walkerP = document.createTreeWalker(blockContentRef.current!, NodeFilter.SHOW_TEXT);
                  let seenP = 0; let tn: Text | null = null; let to = 0;
                  let np: Node | null;
                  while ((np = walkerP.nextNode())) {
                    const t = np as Text; const len = t.data.length;
                    if (newCaret <= seenP + len) { tn = t; to = newCaret - seenP; break; }
                    seenP += len;
                  }
                  if (tn) {
                    const r = document.createRange();
                    r.setStart(tn, to); r.collapse(true);
                    const s = window.getSelection();
                    s?.removeAllRanges(); s?.addRange(r);
                  }
                  replaced = true;
                }
                if (replaced) return;
              }

              // URL autolink: detect URL followed by a just-typed space.
              // Fires when tail ends with "https://foo.com " or similar.
              const urlMatch = tail.match(/(https?:\/\/[^\s<>"]+) $/);
              if (urlMatch) {
                const urlStr = urlMatch[1];
                const matchStart = caretOffset - urlStr.length - 1;
                const walker2 = document.createTreeWalker(blockContentRef.current!, NodeFilter.SHOW_TEXT);
                let seen2 = 0;
                let sn: Text | null = null, so = 0, en: Text | null = null, eo = 0;
                let nn: Node | null;
                while ((nn = walker2.nextNode())) {
                  const t = nn as Text; const len = t.data.length;
                  if (!sn && matchStart <= seen2 + len) { sn = t; so = matchStart - seen2; }
                  if (caretOffset - 1 <= seen2 + len) { en = t; eo = caretOffset - 1 - seen2; break; }
                  seen2 += len;
                }
                if (sn && en) {
                  const r = document.createRange();
                  r.setStart(sn, so); r.setEnd(en, eo);
                  r.deleteContents();
                  const a = document.createElement('a');
                  a.href = urlStr;
                  a.target = '_blank';
                  a.rel = 'noopener noreferrer';
                  a.textContent = urlStr;
                  r.insertNode(a);
                  // Caret after the anchor (space still follows)
                  const after = document.createRange();
                  after.setStartAfter(a); after.collapse(true);
                  const s = window.getSelection();
                  s?.removeAllRanges(); s?.addRange(after);
                }
              }
              for (const { re, tag } of inlinePatterns) {
                const m = tail.match(re);
                if (!m) continue;
                const matchedStr = m[0];
                const inner = m[1];
                const matchStart = caretOffset - matchedStr.length;
                // Build a range over the matched chars
                function offsetToRange(el: Element, start: number, end: number): Range | null {
                  const r = document.createRange();
                  let seen = 0; let startSet = false;
                  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                  let n: Node | null;
                  while ((n = walker.nextNode())) {
                    const txt = (n as Text).data;
                    const nStart = seen; const nEnd = seen + txt.length;
                    if (!startSet && start >= nStart && start <= nEnd) {
                      r.setStart(n, start - nStart); startSet = true;
                    }
                    if (end >= nStart && end <= nEnd) { r.setEnd(n, end - nStart); return r; }
                    seen = nEnd;
                  }
                  return null;
                }
                const replaceRange = offsetToRange(el, matchStart, caretOffset);
                if (replaceRange) {
                  replaceRange.deleteContents();
                  const wrap = document.createElement(tag);
                  wrap.textContent = inner;
                  replaceRange.insertNode(wrap);
                  // Move caret after the inserted element
                  const after = document.createRange();
                  after.setStartAfter(wrap); after.collapse(true);
                  sel.removeAllRanges(); sel.addRange(after);
                  break;
                }
              }
            }
          }

          // Markdown shortcuts (InputRules): when the user types the space
          // that completes a prefix like "# ", "## ", "- ", "> ", "1. ",
          // convert the block's schema. Only runs on a paragraph and only
          // when the matched prefix is the entire text of the block.
          if (schema === 'paragraph') {
            // ContentEditable inserts NBSP (\u00A0, 160) instead of regular
            // space (32) at certain caret positions. Normalize before match.
            const normalizedText = text.replace(/\u00A0/g, ' ');
            // Clef-native path: ask InputRule/match for a matching rule.
            // Seeds (InputRule.block-markdown.seeds.yaml) define the
            // patterns; the editor just dispatches whatever comes back.
            // Hardcoded fallback kept for when InputRule isn't yet
            // registered (fresh DB boot).
            const hardcodedFallback: Record<string, string> = {
              '# ': 'heading', '## ': 'heading-2', '### ': 'heading-3',
              '- ': 'bullet-list', '* ': 'bullet-list', '1. ': 'numbered-list',
              '> ': 'quote', '``` ': 'code',
              '[] ': 'task', '[ ] ': 'task', '[x] ': 'task-done', '[X] ': 'task-done',
              '--- ': 'divider', '___ ': 'divider',
            };
            const el = e.currentTarget as HTMLDivElement;
            void (async () => {
              try {
                let newSchema: string | null = null;
                try {
                  // Seed shape: kind: pattern, scope: null | paragraph.
                  // The handler returns { variant: 'ok', action_ref: string }
                  // where action_ref names a markdown-transform-to-<schema>
                  // ActionBinding. We map that binding's name to the target
                  // schema by convention so the editor can dispatch
                  // content-node-change-type without a second round trip.
                  const match = await invoke('InputRule', 'match', {
                    kind: 'pattern',
                    input: normalizedText,
                    scope: 'paragraph',
                  });
                  if (match.variant === 'ok' && typeof match.action_ref === 'string') {
                    const prefix = 'markdown-transform-to-';
                    if (match.action_ref.startsWith(prefix)) {
                      newSchema = match.action_ref.slice(prefix.length);
                      // Normalize heading-1 → heading (block-editor schema name).
                      if (newSchema === 'heading-1') newSchema = 'heading';
                    }
                  }
                } catch { /* InputRule not registered — fall back below */ }
                if (!newSchema) {
                  newSchema = hardcodedFallback[normalizedText] ?? null;
                }
                if (!newSchema) return;
                contentSchemaCache.set(nodeId, newSchema);
                await invokeBinding(invoke, 'content-node-change-type', { node: nodeId, type: newSchema });
                await invokeBinding(invoke, 'update-block-content', { nodeId: nodeId, content: '' });
                el.textContent = '';
                onStructureChange();
              } catch (err) {
                console.warn('[RecursiveBlockEditor] markdown shortcut failed:', err);
              }
            })();
            return;
          }

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
          // Persist the full HTML so inline marks (<b>/<i>/<mark>/<a>),
          // wikilinks, and mentions survive reload. Plain-text callers
          // that only want the visible text read from .textContent.
          const html = e.currentTarget.innerHTML ?? '';
          blockEmptyRef.current = text.trim() === '';
          handleContentEdit(html);
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

            // List behavior: Enter in an EMPTY list item exits the list
            // (converts the block back to paragraph instead of creating a
            // new list item). Matches Notion / Roam / BlockNote.
            const isListSchemaForSplit = schema === 'bullet-list'
              || schema === 'numbered-list'
              || schema === 'task'
              || schema === 'task-done';
            if (isListSchemaForSplit && (el.textContent ?? '').trim() === '') {
              void (async () => {
                try {
                  contentSchemaCache.set(nodeId, "paragraph"); await invoke("ContentNode", "changeType", { node: nodeId, type: "paragraph" });
                  onStructureChange();
                  restoreFocusToBlock(nodeId);
                } catch (err) {
                  console.warn('[RecursiveBlockEditor] list-exit failed:', err);
                }
              })();
              return;
            }

            // Truncate current block's DOM to `before` AND keep caret at
            // the truncation point so the cursor doesn't visibly jump to
            // the start of the block while the async chain below runs.
            el.textContent = before;
            {
              const s = window.getSelection();
              if (s) {
                const r = document.createRange();
                // Walk to find the end-of-before position (last text node)
                const last = el.lastChild;
                if (last && last.nodeType === Node.TEXT_NODE) {
                  r.setStart(last, (last as Text).data.length);
                } else {
                  r.selectNodeContents(el); r.collapse(false);
                }
                r.collapse(true);
                s.removeAllRanges(); s.addRange(r);
              }
            }

            // Serialize: persist truncation FIRST, then create new block + outline,
            // THEN refresh children. (Direct concept invokes — see
            // handleCreateFirstBlock for why ActionBinding is bypassed.)
            // New block inherits list-family schema so pressing Enter in
            // a list item produces another list item (continuation).
            const newSchemaForSplit = isListSchemaForSplit
              ? (schema === 'task-done' ? 'task' : schema)  // new task starts unchecked
              : 'paragraph';
            const newBlockId = `${rootNodeId}:block:${Date.now()}`;
            // Claim focus for the new block synchronously so that when
            // its BlockSlot mounts (triggered by the async onStructureChange
            // further down), the BEF-01 effect immediately focuses it.
            pendingFocusNodeId = newBlockId;
            pendingFocusAt = 'start';
            // Seed the cache with the `after` text so the new block's
            // mount effect can seed DOM content synchronously without
            // a ContentNode/get round-trip — no flash.
            contentBodyCache.set(newBlockId, after);
            // Optimistically insert the block into local state so the
            // DOM appears on this frame. Server-side create runs in
            // background; loadChildren reconciles later.
            onOptimisticInsert?.({
              id: newBlockId,
              schema: newSchemaForSplit,
              parent: rootNodeId,  // adjusted by the Outline/create below
              afterNodeId: nodeId,
            });
            void (async () => {
              try {
                await invokeBinding(invoke, 'update-block-content', { nodeId: nodeId, content: before });
                const insertResult = await invokeBinding(invoke, 'insert-block', {
                  id: newBlockId,
                  schema: newSchemaForSplit,
                  body: after,
                });
                if (insertResult.variant === 'ok') {
                  // Create the new block as a SIBLING at the same depth as
                  // the current block (so Enter in a nested block stays
                  // nested, not jumps to root).
                  const myParentRes = await invoke('Outline', 'getParent', { node: nodeId });
                  const myParent = myParentRes.variant === 'ok'
                    ? String(myParentRes.parent ?? rootNodeId)
                    : rootNodeId;
                  // Compute a fractional order that sits between the
                  // current block and the next sibling, so the new block
                  // renders immediately after the current one instead of
                  // being appended to the end of parent.children.
                  let order: number | undefined = undefined;
                  try {
                    const siblingsRes = await invoke('Outline', 'children', { parent: myParent });
                    const siblingIds = siblingsRes.variant === 'ok'
                      ? (() => { try { return JSON.parse(siblingsRes.children as string || '[]') as string[]; } catch { return [] as string[]; } })()
                      : [] as string[];
                    const idx = siblingIds.indexOf(nodeId);
                    const curRecRes = await invoke('Outline', 'getRecord', { node: nodeId });
                    const curOrder = curRecRes.variant === 'ok' && typeof curRecRes.order === 'number'
                      ? curRecRes.order
                      : Date.now();
                    let nextOrder: number | null = null;
                    if (idx >= 0 && idx < siblingIds.length - 1) {
                      const nextRec = await invoke('Outline', 'getRecord', { node: siblingIds[idx + 1] });
                      if (nextRec.variant === 'ok' && typeof nextRec.order === 'number') {
                        nextOrder = nextRec.order;
                      }
                    }
                    order = nextOrder !== null ? (curOrder + nextOrder) / 2 : curOrder + 1;
                  } catch { /* fall through — Outline.create will use Date.now() */ }
                  await invokeBinding(invoke, 'outline-create', {
                    node: newBlockId,
                    parent: myParent,
                    ...(order !== undefined ? { order } : {}),
                  });
                  onStructureChange();
                  // Notion-style: move caret into the newly-created block.
                  // BlockSlot mounts then asynchronously fetches ContentNode/get
                  // (BEF-01), so focus must wait for both the DOM commit and the
                  // content load. Retry every 30ms up to 500ms until the element
                  // appears and is reachable.
                  const focusNewBlock = (attempt = 0) => {
                    const newEl = document.querySelector<HTMLDivElement>(
                      `[data-part="block-slot"][data-node-id="${newBlockId}"] [data-part="block-content"]`,
                    );
                    if (newEl) {
                      newEl.focus();
                      const sel = window.getSelection();
                      if (sel) {
                        const r = document.createRange();
                        r.setStart(newEl, 0);
                        r.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(r);
                      }
                    } else if (attempt < 16) {
                      setTimeout(() => focusNewBlock(attempt + 1), 30);
                    }
                  };
                  focusNewBlock();
                }
              } catch (err) {
                console.warn('[RecursiveBlockEditor] Enter-split failed:', err);
              }
            })();
            return;
          }
          // Bold / Italic / Underline / Code / Link shortcuts. Use
          // browser execCommand for bold/italic/underline; Range API
          // for code / link (no native execCommand for those).
          if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
            const cmd: Record<string, string> = { b: 'bold', i: 'italic', u: 'underline' };
            const op = cmd[e.key.toLowerCase()];
            if (op) {
              e.preventDefault();
              document.execCommand(op);
              return;
            }
            if (e.key.toLowerCase() === 'e') {
              e.preventDefault();
              // Code-span: wrap selection in <code>. No execCommand for code
              // so insert HTML directly. No-op if selection is empty.
              const sel = window.getSelection();
              if (sel && !sel.isCollapsed) {
                const range = sel.getRangeAt(0);
                const code = document.createElement('code');
                code.appendChild(range.extractContents());
                range.insertNode(code);
                range.setStartAfter(code);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
              }
              return;
            }
            if (e.key.toLowerCase() === 'h' && e.shiftKey) {
              e.preventDefault();
              // Highlight: wrap selection in <mark>. Second press on a
              // selection that's entirely inside an existing <mark>
              // unwraps it.
              const sel = window.getSelection();
              if (!sel || sel.isCollapsed) return;
              const range = sel.getRangeAt(0);
              const ancestor = range.commonAncestorContainer;
              const enclosingMark = (ancestor instanceof Element ? ancestor : ancestor.parentElement)?.closest('mark');
              if (enclosingMark) {
                // Unwrap
                const parent = enclosingMark.parentNode;
                while (enclosingMark.firstChild) parent?.insertBefore(enclosingMark.firstChild, enclosingMark);
                parent?.removeChild(enclosingMark);
              } else {
                const mark = document.createElement('mark');
                mark.appendChild(range.extractContents());
                range.insertNode(mark);
                range.setStartAfter(mark); range.collapse(true);
                sel.removeAllRanges(); sel.addRange(range);
              }
              return;
            }
            if (e.key.toLowerCase() === 'k') {
              e.preventDefault();
              // Link: prompt for URL, wrap selection in <a href>. If no
              // selection, insert a link placeholder at caret using the
              // URL as both href and visible text.
              const url = window.prompt('Link URL:');
              if (!url) return;
              const sel = window.getSelection();
              if (!sel || sel.rangeCount === 0) return;
              const range = sel.getRangeAt(0);
              const a = document.createElement('a');
              a.href = url;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              if (sel.isCollapsed) {
                a.textContent = url;
                range.insertNode(a);
                range.setStartAfter(a);
              } else {
                a.appendChild(range.extractContents());
                range.insertNode(a);
                range.setStartAfter(a);
              }
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
              return;
            }
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            // Notion/Roam-style vertical caret nav. When the caret is on the
            // first visual line of the block and user presses ArrowUp, move
            // to the end of the previous sibling block. Symmetric for
            // ArrowDown on the last visual line. We approximate "first line"
            // by rect comparison between the caret and the block element.
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            if (!range.collapsed) return;
            const caretRect = range.getBoundingClientRect();
            const blockRect = blockContentRef.current!.getBoundingClientRect();
            const lineHeight = parseFloat(
              getComputedStyle(blockContentRef.current!).lineHeight || '20',
            ) || 20;
            const onFirstLine = caretRect.top - blockRect.top < lineHeight * 0.9;
            const onLastLine = blockRect.bottom - caretRect.bottom < lineHeight * 0.9;
            if (e.key === 'ArrowUp' && !onFirstLine) return;
            if (e.key === 'ArrowDown' && !onLastLine) return;
            e.preventDefault();
            try {
              // Walk the rendered DOM for every visible block body in
              // document order — this respects the flat-list render
              // AND collapsed state (collapsed descendants aren't in
              // the DOM). Matches Notion/Roam: ArrowUp/ArrowDown jumps
              // to ANY visible block, not just direct siblings.
              const all = Array.from(document.querySelectorAll<HTMLDivElement>(
                '[data-part="block-slot"] [data-part="block-content"]',
              ));
              const me = blockContentRef.current;
              if (!me) return;
              const myIdx = all.indexOf(me);
              if (myIdx < 0) return;
              const targetIdx = e.key === 'ArrowUp' ? myIdx - 1 : myIdx + 1;
              if (targetIdx < 0 || targetIdx >= all.length) return;
              const targetEl = all[targetIdx];
              targetEl.focus();
              const s = window.getSelection();
              if (!s) return;
              const r = document.createRange();
              if (e.key === 'ArrowUp') {
                r.selectNodeContents(targetEl);
                r.collapse(false); // end of previous block
              } else {
                r.setStart(targetEl, 0);
                r.collapse(true); // start of next block
              }
              s.removeAllRanges();
              s.addRange(r);
              // Ensure the target block is visible after focus move.
              targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } catch (err) {
              console.warn('[RecursiveBlockEditor] Arrow nav failed:', err);
            }
            return;
          }
          if (e.key === 'Backspace') {
            // Notion-style: Backspace at offset 0 of a non-first block merges
            // this block's content into the end of the previous sibling, then
            // deletes this block. Cursor lands at the join point.
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            // Only trigger merge when caret is at the very start AND there
            // is no selection (range is collapsed).
            if (!range.collapsed) return;
            // Compute caret offset within the block-content div.
            const pre = range.cloneRange();
            pre.selectNodeContents(blockContentRef.current!);
            pre.setEnd(range.endContainer, range.endOffset);
            if (pre.toString().length !== 0) return; // caret not at start
            e.preventDefault();
            e.stopPropagation();
            void (async () => {
              try {
                // Resolve siblings under my actual parent (not rootNodeId)
                // so Backspace-merge works for nested blocks.
                const myParentRes = await invoke('Outline', 'getParent', { node: nodeId });
                const myParent = myParentRes.variant === 'ok'
                  ? String(myParentRes.parent ?? rootNodeId)
                  : rootNodeId;
                const siblingsRes = await invoke('Outline', 'children', { parent: myParent });
                if (siblingsRes.variant !== 'ok') return;
                const siblings: string[] = (() => {
                  try { return JSON.parse((siblingsRes.children as string) || '[]'); }
                  catch { return []; }
                })();
                const myIndex = siblings.indexOf(nodeId);
                if (myIndex <= 0) return; // first block — nothing to merge into
                const prev = siblings[myIndex - 1];
                // Read both blocks' current content.
                const [myRes, prevRes] = await Promise.all([
                  invoke('ContentNode', 'get', { node: nodeId }),
                  invoke('ContentNode', 'get', { node: prev }),
                ]);
                const myText = myRes.variant === 'ok' ? String(myRes.content ?? '') : '';
                const prevText = prevRes.variant === 'ok' ? String(prevRes.content ?? '') : '';
                const joinOffset = prevText.length;
                const merged = prevText + myText;
                await invokeBinding(invoke, 'update-block-content', { nodeId: prev, content: merged });
                await invokeBinding(invoke, 'content-node-delete', { node: nodeId });
                await invokeBinding(invoke, 'outline-delete', { node: nodeId });
                onStructureChange();
                // Restore caret at the join point in the previous block.
                const focusAt = (attempt = 0) => {
                  const prevEl = document.querySelector<HTMLDivElement>(
                    `[data-part="block-slot"][data-node-id="${prev}"] [data-part="block-content"]`,
                  );
                  if (prevEl) {
                    prevEl.focus();
                    const s = window.getSelection();
                    if (!s) return;
                    // Walk text nodes to find the one containing joinOffset.
                    let remaining = joinOffset;
                    const walker = document.createTreeWalker(prevEl, NodeFilter.SHOW_TEXT);
                    let node: Node | null;
                    let target: Text | null = null; let targetOffset = 0;
                    while ((node = walker.nextNode())) {
                      const len = (node as Text).data.length;
                      if (remaining <= len) { target = node as Text; targetOffset = remaining; break; }
                      remaining -= len;
                    }
                    const r = document.createRange();
                    if (target) { r.setStart(target, targetOffset); }
                    else { r.setStart(prevEl, 0); }
                    r.collapse(true);
                    s.removeAllRanges(); s.addRange(r);
                  } else if (attempt < 16) {
                    setTimeout(() => focusAt(attempt + 1), 30);
                  }
                };
                focusAt();
              } catch (err) {
                console.warn('[RecursiveBlockEditor] Backspace-merge failed:', err);
              }
            })();
            return;
          }
          if (e.key === 'Tab') {
            // Notion-style indent/outdent. Shift+Tab = outdent; Tab = indent.
            e.preventDefault();
            e.stopPropagation();
            const currentText = blockContentRef.current?.textContent ?? '';
            // Apply depth change SYNCHRONOUSLY — no awaits first. The server
            // round-trip happens in the background; if it rejects, the
            // eventual loadChildren reconciles. User sees instant indent.
            onOptimisticDepthChange?.(nodeId, e.shiftKey ? -1 : +1);
            void (async () => {
              try {
                await invokeBinding(invoke, 'update-block-content', { nodeId: nodeId, content: currentText });
                // Learn who my real parent is so siblings are resolved at the
                // correct level (not blindly rootNodeId, which breaks nested
                // blocks from being tab-indented or tab-outdented).
                const myParentRes = await invoke('Outline', 'getParent', { node: nodeId });
                const myParent = myParentRes.variant === 'ok'
                  ? String(myParentRes.parent ?? rootNodeId)
                  : rootNodeId;
                const childrenResult = await invoke('Outline', 'children', {
                  parent: myParent,
                });
                // children returns only direct children of root. For nested
                // blocks we need the immediate parent, which BlockSlot knows
                // via its props chain — here rootNodeId IS the parent for
                // top-level blocks. Siblings = children of rootNodeId.
                const siblings: string[] = (() => {
                  try {
                    return JSON.parse((childrenResult.children as string) || '[]');
                  } catch { return []; }
                })();
                const myIndex = siblings.indexOf(nodeId);
                if (e.shiftKey) {
                  const myParent2 = await invoke('Outline', 'getParent', { node: nodeId });
                  if (myParent2.variant !== 'ok') { onOptimisticDepthChange?.(nodeId, +1); return; }
                  const parentId = String(myParent2.parent ?? '');
                  if (!parentId || parentId === rootNodeId) {
                    // Already at root, nothing to outdent to — roll back
                    // the optimistic -1 we applied synchronously.
                    onOptimisticDepthChange?.(nodeId, +1);
                    return;
                  }
                  const gp = await invoke('Outline', 'getParent', { node: parentId });
                  if (gp.variant !== 'ok') { onOptimisticDepthChange?.(nodeId, +1); return; }
                  const grandparentId = String(gp.parent ?? '') || rootNodeId;
                  pushUndo({ kind: 'reparent', nodeId, oldParent: parentId, newParent: grandparentId });
                  const result = await invokeBinding(invoke, 'outline-reparent', {
                    node: nodeId, newParent: grandparentId,
                  });
                  if (result.variant === 'ok') {
                    try {
                      const gpKidsRes = await invoke('Outline', 'children', { parent: grandparentId });
                      const gpKids: string[] = gpKidsRes.variant === 'ok'
                        ? (() => { try { return JSON.parse((gpKidsRes.children as string) || '[]'); } catch { return []; } })()
                        : [];
                      const parentIdx = gpKids.indexOf(parentId);
                      const parentRec = await invoke('Outline', 'getRecord', { node: parentId });
                      const parentOrder = parentRec.variant === 'ok' && typeof parentRec.order === 'number'
                        ? parentRec.order
                        : Date.now();
                      let nextOrder: number | null = null;
                      for (let i = parentIdx + 1; i < gpKids.length; i++) {
                        if (gpKids[i] === nodeId) continue;
                        const r = await invoke('Outline', 'getRecord', { node: gpKids[i] });
                        if (r.variant === 'ok' && typeof r.order === 'number') {
                          nextOrder = r.order;
                          break;
                        }
                      }
                      const newOrder = nextOrder !== null ? (parentOrder + nextOrder) / 2 : parentOrder + 1;
                      await invokeBinding(invoke, 'outline-set-order', { node: nodeId, order: newOrder });
                    } catch (err) {
                      console.warn('[RecursiveBlockEditor] post-outdent order fix failed:', err);
                    }
                    setChildren((prev) => {
                      const idx = prev.findIndex((c) => c.id === nodeId);
                      if (idx < 0) return prev;
                      return prev.map((c) => c.id === nodeId ? { ...c, parent: grandparentId } : c);
                    });
                    restoreFocusToBlock(nodeId);
                  } else {
                    onOptimisticDepthChange?.(nodeId, +1);  // rollback
                  }
                  return;
                }
                // Indent under previous sibling.
                if (myIndex <= 0) { onOptimisticDepthChange?.(nodeId, -1); return; }
                const prevSibling = siblings[myIndex - 1];
                pushUndo({ kind: 'reparent', nodeId, oldParent: myParent, newParent: prevSibling });
                const result = await invokeBinding(invoke, 'outline-reparent', {
                  node: nodeId, newParent: prevSibling,
                });
                if (result.variant === 'ok') {
                  setChildren((prev) => {
                    const idx = prev.findIndex((c) => c.id === nodeId);
                    if (idx < 0) return prev;
                    return prev.map((c) => c.id === nodeId ? { ...c, parent: prevSibling } : c);
                  });
                  restoreFocusToBlock(nodeId);
                }
              } catch (err) {
                console.warn('[RecursiveBlockEditor] Tab indent failed:', err);
              }
            })();
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
          // lineHeight / fontSize / fontWeight / fontFamily / background /
          // borderLeft for schema-specific visuals now live in globals.css
          // keyed on [data-schema="..."]. CSS wins over removed inline
          // overrides, so heading-2 / heading-3 can be styled without
          // touching this file.
          background:
            schema === 'callout' ? 'var(--palette-surface-container)' :
            schema === 'code'    ? 'var(--palette-surface-container-high)' :
            'transparent',
          fontFamily:
            schema === 'code' ? 'var(--typography-family-mono, monospace)' : 'inherit',
        }}
      />

      {/* Code block Copy button */}
      {schema === 'code' && (
        <button
          data-part="block-copy"
          aria-label="Copy code"
          onClick={(e) => {
            e.stopPropagation();
            const text = blockContentRef.current?.textContent ?? '';
            void navigator.clipboard.writeText(text).then(() => {
              const btn = e.currentTarget as HTMLButtonElement;
              const prev = btn.textContent;
              btn.textContent = '✓';
              setTimeout(() => { btn.textContent = prev; }, 900);
            });
          }}
          title="Copy code"
          style={{
            position: 'absolute',
            right: '4px',
            top: '4px',
            fontSize: '11px',
            cursor: 'pointer',
            background: 'var(--palette-surface-container-high, #e5e7eb)',
            border: '1px solid var(--palette-outline-variant, #d1d5db)',
            borderRadius: '3px',
            color: 'var(--palette-on-surface-variant, #4b5563)',
            padding: '1px 6px',
            lineHeight: '18px',
            opacity: 0.85,
            zIndex: 5,
          }}
        >
          Copy
        </button>
      )}

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

      {/* Nested children now render in the top-level flat list (keyed by
          node id + indented via `depth` prop). The block-children region
          that used to live here has moved up to RecursiveBlockEditor's
          main map so Tab reparent is a pure reorder (no remount flash). */}
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

    {/* Mention picker — floating listbox triggered by `@` */}
    {mentionState && (
      <MentionPicker
        query={mentionState.query}
        anchor={mentionState.anchor}
        invoke={invoke}
        onClose={() => setMentionState(null)}
        onSelect={(userId) => {
          const el = blockContentRef.current;
          if (!el) { setMentionState(null); return; }
          const replaceStart = mentionState.triggerOffset;
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) { setMentionState(null); return; }
          const range = sel.getRangeAt(0);
          const preRange = range.cloneRange();
          preRange.selectNodeContents(el);
          preRange.setEnd(range.endContainer, range.endOffset);
          const caretOffset = preRange.toString().length;
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let seen = 0;
          let startNode: Text | null = null, startOff = 0;
          let endNode: Text | null = null, endOff = 0;
          let n: Node | null;
          while ((n = walker.nextNode())) {
            const t = n as Text; const len = t.data.length;
            if (!startNode && replaceStart <= seen + len) {
              startNode = t; startOff = replaceStart - seen;
            }
            if (caretOffset <= seen + len) {
              endNode = t; endOff = caretOffset - seen; break;
            }
            seen += len;
          }
          if (startNode && endNode) {
            const r = document.createRange();
            r.setStart(startNode, startOff);
            r.setEnd(endNode, endOff);
            r.deleteContents();
            const span = document.createElement('span');
            span.setAttribute('data-mention', userId);
            span.style.color = 'var(--palette-primary, #6366f1)';
            span.style.fontWeight = '500';
            span.textContent = '@' + userId;
            r.insertNode(span);
            // Insert a trailing space so typing continues naturally after.
            const space = document.createTextNode(' ');
            r.setStartAfter(span); r.insertNode(space);
            const after = document.createRange();
            after.setStartAfter(space); after.collapse(true);
            sel.removeAllRanges(); sel.addRange(after);
          }
          setMentionState(null);
          blockContentRef.current?.focus();
        }}
      />
    )}

    {/* Wikilink picker — floating listbox triggered by `[[` */}
    {wikilinkState && (
      <WikilinkPicker
        query={wikilinkState.query}
        anchor={wikilinkState.anchor}
        invoke={invoke}
        onClose={() => setWikilinkState(null)}
        onSelect={(pageId, title) => {
          const el = blockContentRef.current;
          if (!el) { setWikilinkState(null); return; }
          // Replace the `[[query` substring (from triggerOffset through
          // caret) with a <a data-wikilink> anchor.
          const replaceStart = wikilinkState.triggerOffset;
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) { setWikilinkState(null); return; }
          const range = sel.getRangeAt(0);
          const preRange = range.cloneRange();
          preRange.selectNodeContents(el);
          preRange.setEnd(range.endContainer, range.endOffset);
          const caretOffset = preRange.toString().length;
          // Walk text nodes to build a range from replaceStart to caretOffset.
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let seen = 0;
          let startNode: Text | null = null, startOff = 0;
          let endNode: Text | null = null, endOff = 0;
          let n: Node | null;
          while ((n = walker.nextNode())) {
            const t = n as Text; const len = t.data.length;
            if (!startNode && replaceStart <= seen + len) {
              startNode = t; startOff = replaceStart - seen;
            }
            if (caretOffset <= seen + len) {
              endNode = t; endOff = caretOffset - seen; break;
            }
            seen += len;
          }
          if (startNode && endNode) {
            const r = document.createRange();
            r.setStart(startNode, startOff);
            r.setEnd(endNode, endOff);
            r.deleteContents();
            const a = document.createElement('a');
            a.setAttribute('data-wikilink', pageId);
            a.href = `/admin/content/${encodeURIComponent(pageId)}`;
            a.textContent = title;
            r.insertNode(a);
            const after = document.createRange();
            after.setStartAfter(a); after.collapse(true);
            sel.removeAllRanges(); sel.addRange(after);
          }
          setWikilinkState(null);
          blockContentRef.current?.focus();
        }}
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
  anchor?: { top: number; left: number };
}

const SlashMenuOverlay: React.FC<SlashMenuOverlayProps> = ({
  items,
  loading,
  onActivate,
  onClose,
  anchor,
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
        position: 'fixed',
        top: anchor?.top ?? 120,
        left: anchor?.left ?? 120,
        zIndex: 100,
        // Hard-coded light-mode colors — theme tokens sometimes resolve
        // the same variable to the same value (e.g. both on-surface and
        // surface-container end up white) leaving the menu unreadable.
        background: '#ffffff',
        color: '#111827',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        minWidth: '280px',
        maxHeight: '360px',
        overflowY: 'auto',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}
    >
      <div style={{ padding: 'var(--spacing-xs, 4px) var(--spacing-sm, 8px)' }}>
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
            color: '#111827',
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
                color: '#6b7280',
                padding: '8px 8px 4px',
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
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f3f4f6'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 8px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#111827',
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
