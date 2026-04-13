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
 * Partial-behavior notes for Phase 1:
 * - InlineMark concept not yet shipped: bold/italic/code toolbar buttons render
 *   but their ActionBinding/invoke will return a non-ok variant; we surface a
 *   console.warn and show a transient "not yet available" label.
 * - ContentNode/clone not shipped: duplicate-block command renders in context
 *   menu but fails gracefully with the same fallback.
 * - MediaAsset context threading for clipboard paste is wired at the
 *   InputRule/match level; actual upload is gated on MediaAsset/createMedia
 *   being accessible from the block-editor context. Passes gracefully if absent.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
import {
  notifyBlockEdit,
  getActiveAnnotations,
} from '../../services/spell-check-dispatcher';
import { SpellCheckSuggestionsPopover } from './SpellCheckSuggestionsPopover';
import { useSlotResolver, SlotMount } from './SlotResolver';

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
}) => {
  const invoke = useKernelInvoke();

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

  // ------- compile surface (page-level, compilable schemas) --------
  const [compileStatus, setCompileStatus] = useState<CompileStatus | null>(null);
  const [compiledPreview, setCompiledPreview] = useState<string | null>(null);
  const [consumers, setConsumers] = useState<string[]>([]);

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
        // 1. Get root node to determine its schema
        const nodeResult = await invoke('ContentNode', 'get', { node: rootNodeId });
        if (cancelled) return;
        if (nodeResult.variant === 'ok') {
          const schemaResult = await invoke('Schema', 'getSchemasFor', { entity_id: rootNodeId });
          if (!cancelled && schemaResult.variant === 'ok') {
            const schemas: string[] = typeof schemaResult.schemas === 'string'
              ? JSON.parse(schemaResult.schemas)
              : (schemaResult.schemas as string[] ?? []);
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
        const ids: string[] = typeof result.children === 'string'
          ? JSON.parse(result.children)
          : (result.children as string[] ?? []);

        // For each child, get its schema to set up the BlockChild record
        const childRecords: BlockChild[] = await Promise.all(
          ids.map(async (childId) => {
            try {
              const schemaResult = await invoke('Schema', 'getSchemasFor', { entity_id: childId });
              const schemas: string[] = schemaResult.variant === 'ok'
                ? (typeof schemaResult.schemas === 'string'
                  ? JSON.parse(schemaResult.schemas)
                  : (schemaResult.schemas as string[] ?? []))
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
          const cs: string[] = typeof consumersResult.backlinks === 'string'
            ? JSON.parse(consumersResult.backlinks)
            : (consumersResult.backlinks as string[] ?? []);
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
        const mappings: Array<Record<string, unknown>> = typeof mappingResult.items === 'string'
          ? JSON.parse(mappingResult.items)
          : (mappingResult.items as Array<Record<string, unknown>> ?? []);
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
        const bindings: Array<Record<string, unknown>> = typeof bindingResult.items === 'string'
          ? JSON.parse(bindingResult.items)
          : (bindingResult.items as Array<Record<string, unknown>> ?? []);
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      openSlashMenu();
    } else if (e.key === 'Escape') {
      if (fsmState === 'slash-open') {
        closeSlashMenu();
      }
    }
  }, [fsmState, openSlashMenu, closeSlashMenu]);

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
          <div
            data-part="blocks-empty"
            style={{
              color: 'var(--palette-on-surface-variant)',
              padding: 'var(--spacing-xl)',
              textAlign: 'center',
              fontSize: '14px',
            }}
          >
            {canEdit
              ? "Type '/' to insert a block or start typing..."
              : 'No blocks yet.'}
          </div>
        ) : (
          <ol
            data-part="block-list"
            aria-label="Document blocks"
            style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}
          >
            {children.map((child) => {
              const resolved = resolvedWidgets.get(child.id);
              return (
                <li
                  key={child.id}
                  data-part="block-list-item"
                  data-block-id={child.id}
                >
                  <BlockSlot
                    nodeId={child.id}
                    schema={child.schema}
                    displayMode={child.displayMode}
                    resolvedWidget={resolved?.widgetId ?? 'block-slot'}
                    canEdit={canEdit}
                    onFocus={() => handleBlockFocus(child.id, child.schema)}
                    onBlur={handleBlockBlur}
                    onMutate={loadChildren}
                    rootNodeId={rootNodeId}
                    editorFlavor={editorFlavor}
                  />
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
        {/* decoration-layer slot — resolver-driven overlay mounts           */}
        {/* Widgets registered via PluginRegistry/register with              */}
        {/* type="decoration-layer" appear here automatically.               */}
        {/* Examples: comment-gutter-marker, presence-decoration,            */}
        {/*           inline-annotation-decoration, block-handle.            */}
        {/* ---------------------------------------------------------------- */}
        {decorationLayerEntries.length > 0 && (
          <div
            data-part="decoration-layer"
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
          >
            {decorationLayerEntries.map((entry) => (
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
// BlockSlot — generic block renderer (block-slot.widget analogue)
// Mounts the resolved widget for a given (schema, displayMode) pair.
// ===========================================================================

interface BlockSlotProps {
  nodeId: string;
  schema: string;
  displayMode: string;
  resolvedWidget: string;
  canEdit: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onMutate: () => void;
  rootNodeId: string;
  editorFlavor: EditorFlavor;
}

const BlockSlot: React.FC<BlockSlotProps> = ({
  nodeId,
  schema,
  displayMode,
  resolvedWidget,
  canEdit,
  onFocus,
  onBlur,
  onMutate,
  rootNodeId,
  editorFlavor,
}) => {
  const invoke = useKernelInvoke();

  const handleContentEdit = useCallback(async (newContent: string) => {
    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'update-block-content',
        context: JSON.stringify({ nodeId, rootNodeId, schema, content: newContent }),
      });
      if (result.variant === 'ok') {
        onMutate();
      } else {
        console.warn('[BlockSlot] update-block-content returned non-ok:', result.variant);
      }
    } catch (err) {
      console.error('[BlockSlot] content update failed:', err);
    }
  }, [nodeId, rootNodeId, schema, invoke, onMutate]);

  const handleDelete = useCallback(async () => {
    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'delete-block',
        context: JSON.stringify({ nodeId, rootNodeId }),
      });
      if (result.variant === 'ok') {
        onMutate();
      } else {
        console.warn('[BlockSlot] delete-block returned non-ok:', result.variant);
      }
    } catch (err) {
      console.error('[BlockSlot] delete failed:', err);
    }
  }, [nodeId, rootNodeId, invoke, onMutate]);

  return (
    <div
      data-part="block-slot"
      data-node-id={nodeId}
      data-schema={schema}
      data-display-mode={displayMode}
      data-resolved-widget={resolvedWidget}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{ position: 'relative' }}
    >
      {/* Block handle (drag + context menu affordance) */}
      {canEdit && (
        <div
          data-part="block-handle"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '-24px',
            top: '50%',
            transform: 'translateY(-50%)',
            opacity: 0,
            cursor: 'grab',
            fontSize: '14px',
          }}
          title="Drag to reorder or click for options"
        >
          ⠿
        </div>
      )}

      {/* The actual block widget rendering surface.
          In Phase 1, this renders a content-editable div as a placeholder.
          The full widget dispatch (heading-block.widget, paragraph-block.widget, etc.)
          requires the widget interpreter to be wired into this host. The
          data-resolved-widget attribute is the hook for that wiring. */}
      <div
        data-part="block-content"
        data-widget={resolvedWidget}
        contentEditable={canEdit}
        suppressContentEditableWarning
        onBlur={(e) => {
          const text = e.currentTarget.textContent ?? '';
          handleContentEdit(text);
          onBlur();
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
    </div>
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

const ToolbarCommandButton: React.FC<ToolbarCommandButtonProps> = ({
  bindingId,
  context,
  selection,
  isActive,
  onMarkVariant,
}) => {
  const invoke = useKernelInvoke();
  const [executing, setExecuting] = useState(false);
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
    setExecuting(true);
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
          const markResult = await invoke('InlineMark', 'toggleMark', {
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
        // context fields populated. The ActionBinding resolver maps parameterMap
        // "context.selection.blockId" etc. from the enriched context object.
        const result = await invoke('ActionBinding', 'invoke', {
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
        // Non-mark binding: plain ActionBinding/invoke with base context
        const result = await invoke('ActionBinding', 'invoke', {
          binding: bindingId,
          context: JSON.stringify(context),
        });
        if (result.variant !== 'ok') {
          console.warn(`[ToolbarCommandButton] ${bindingId} returned non-ok:`, result.variant, '— backing concept may not be shipped yet');
        }
      }
    } catch (err) {
      console.warn('[ToolbarCommandButton] invoke error (possibly missing backing concept):', err);
    } finally {
      setExecuting(false);
    }
  }, [executing, bindingId, context, selection, invoke, onMarkVariant]);

  return (
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
