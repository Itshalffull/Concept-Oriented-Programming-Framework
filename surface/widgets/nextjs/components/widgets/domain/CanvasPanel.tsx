'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';

import {
  canvasPanelReducer,
  initialCanvasPanelState,
  type CanvasPanelState,
} from './CanvasPanel.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface CanvasPanelTab {
  id: string;
  label: string;
  icon?: string;
}

export interface CanvasPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> {
  /** Canvas this panel belongs to. */
  canvasId: string;
  /** Accessible label for the panel. */
  ariaLabel?: string;
  /** Panel title displayed in the header. */
  title?: string;
  /** Which side the panel docks to. */
  dock?: 'left' | 'right';
  /** Default panel width in pixels. */
  defaultWidth?: number;
  /** Minimum resize width in pixels. */
  minWidth?: number;
  /** Maximum resize width in pixels. */
  maxWidth?: number;
  /** Whether the panel can be collapsed. */
  collapsible?: boolean;
  /** Initial visibility state. */
  initialState?: 'expanded' | 'collapsed' | 'minimized';
  /** Tab definitions for the tab bar. */
  tabs?: CanvasPanelTab[];
  /** Currently active tab ID (controlled). */
  activeTab?: string;
  /** Panel body content. */
  children: ReactNode;
  /** Called when the panel collapses. */
  onCollapse?: () => void;
  /** Called when the panel expands. */
  onExpand?: () => void;
  /** Called when the active tab changes. */
  onTabChange?: (tabId: string) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const CanvasPanel = forwardRef<HTMLDivElement, CanvasPanelProps>(function CanvasPanel(
  {
    canvasId,
    ariaLabel = 'Canvas panel',
    title = 'Panel',
    dock = 'right',
    defaultWidth = 320,
    minWidth = 200,
    maxWidth = 600,
    collapsible = true,
    initialState = 'expanded',
    tabs = [],
    activeTab,
    children,
    onCollapse,
    onExpand,
    onTabChange,
    style,
    ...rest
  },
  ref,
) {
  const initial: CanvasPanelState = useMemo(
    () => ({
      ...initialCanvasPanelState,
      visibility: initialState,
      tabs: tabs.length > 0 && activeTab ? 'active' : 'inactive',
    }),
    // Only used for initial render — intentionally static
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [state, send] = useReducer(canvasPanelReducer, initial);
  const widthRef = useRef(defaultWidth);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);

  /* --- Sync controlled activeTab prop to state --- */
  useEffect(() => {
    if (tabs.length > 0 && activeTab) {
      send({ type: 'ACTIVATE_TAB' });
    } else if (tabs.length === 0) {
      send({ type: 'DEACTIVATE_TAB' });
    }
  }, [activeTab, tabs.length]);

  /* --- Sync controlled initialState prop to visibility --- */
  useEffect(() => {
    switch (initialState) {
      case 'collapsed':
        send({ type: 'COLLAPSE' });
        break;
      case 'minimized':
        send({ type: 'MINIMIZE' });
        break;
      case 'expanded':
        send({ type: 'EXPAND' });
        break;
    }
  }, [initialState]);

  /* --- Collapse / Expand toggle --- */
  const handleCollapseToggle = useCallback(() => {
    if (state.visibility === 'expanded') {
      send({ type: 'COLLAPSE' });
      onCollapse?.();
    } else {
      send({ type: 'EXPAND' });
      onExpand?.();
    }
  }, [state.visibility, onCollapse, onExpand]);

  /* --- Tab selection --- */
  const handleTabClick = useCallback(
    (tabId: string) => {
      send({ type: 'ACTIVATE_TAB' });
      onTabChange?.(tabId);
    },
    [onTabChange],
  );

  const handleTabKeyDown = useCallback(
    (tabId: string, e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        send({ type: 'ACTIVATE_TAB' });
        onTabChange?.(tabId);
      }
    },
    [onTabChange],
  );

  /* --- Resize via pointer events --- */
  const handleResizePointerDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      send({ type: 'RESIZE_START' });
      dragStartXRef.current = e.clientX;
      dragStartWidthRef.current = widthRef.current;

      const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
        const delta = dock === 'right'
          ? dragStartXRef.current - moveEvent.clientX
          : moveEvent.clientX - dragStartXRef.current;
        const newWidth = Math.min(maxWidth, Math.max(minWidth, dragStartWidthRef.current + delta));
        widthRef.current = newWidth;
        const el = (e.target as HTMLElement).closest('[data-widget-name="canvas-panel"]') as HTMLElement | null;
        if (el) {
          el.style.width = `${newWidth}px`;
        }
      };

      const handlePointerUp = () => {
        send({ type: 'RESIZE_END' });
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    },
    [dock, minWidth, maxWidth],
  );

  /* --- Keyboard: Escape to collapse --- */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape' && collapsible && state.visibility === 'expanded') {
        e.preventDefault();
        send({ type: 'COLLAPSE' });
        onCollapse?.();
      }
    },
    [collapsible, state.visibility, onCollapse],
  );

  const isExpanded = state.visibility === 'expanded';
  const isCollapsed = state.visibility === 'collapsed';
  const isMinimized = state.visibility === 'minimized';

  const panelWidth = isExpanded ? widthRef.current : isCollapsed ? 40 : 0;

  return (
    <div
      ref={ref}
      role="complementary"
      aria-label={ariaLabel}
      aria-expanded={isExpanded}
      data-surface-widget=""
      data-widget-name="canvas-panel"
      data-part="root"
      data-canvas={canvasId}
      data-state={state.visibility}
      data-resize={state.resize}
      data-tabs={state.tabs}
      data-dock={dock}
      data-visible={isMinimized ? 'false' : 'true'}
      onKeyDown={handleKeyDown}
      style={{
        width: isMinimized ? 0 : panelWidth,
        minWidth: isExpanded ? minWidth : undefined,
        maxWidth: isExpanded ? maxWidth : undefined,
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      {/* --- Header --- */}
      <div
        data-part="header"
        data-visible={isMinimized ? 'false' : 'true'}
        role="banner"
      >
        <span data-part="title" aria-label={`${title} panel title`}>
          {title}
        </span>

        {collapsible && (
          <button
            data-part="collapse-trigger"
            type="button"
            aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
            aria-pressed={isCollapsed}
            onClick={handleCollapseToggle}
          >
            {isExpanded ? '\u25C0' : '\u25B6'}
          </button>
        )}
      </div>

      {/* --- Tab bar --- */}
      {tabs.length > 0 && (
        <div
          data-part="tab-bar"
          data-visible={isExpanded ? 'true' : 'false'}
          role="tablist"
          aria-label={`${title} tabs`}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              data-part="tab"
              data-tab-id={tab.id}
              data-state={activeTab === tab.id ? 'active' : 'inactive'}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-label={tab.label}
              onClick={() => handleTabClick(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(tab.id, e)}
            >
              {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* --- Resize handle --- */}
      {isExpanded && (
        <div
          data-part="resize-handle"
          data-state={state.resize}
          data-dock={dock}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panel"
          aria-valuenow={widthRef.current}
          aria-valuemin={minWidth}
          aria-valuemax={maxWidth}
          onMouseDown={handleResizePointerDown}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            [dock === 'right' ? 'left' : 'right']: 0,
            width: 4,
            cursor: 'col-resize',
          }}
        />
      )}

      {/* --- Body --- */}
      <div
        data-part="body"
        data-visible={isExpanded ? 'true' : 'false'}
        role="region"
        aria-label={`${title} content`}
        aria-hidden={!isExpanded}
      >
        {isExpanded && children}
      </div>
    </div>
  );
});

CanvasPanel.displayName = 'CanvasPanel';
export { CanvasPanel };
export default CanvasPanel;
