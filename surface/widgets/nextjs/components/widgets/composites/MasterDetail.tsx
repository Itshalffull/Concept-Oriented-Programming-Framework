'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { masterDetailReducer } from './MasterDetail.reducer.js';

/* ---------------------------------------------------------------------------
 * Types derived from master-detail.widget spec props
 * ------------------------------------------------------------------------- */

export interface MasterDetailItem {
  id: string;
  title: string;
  meta?: string;
  [key: string]: unknown;
}

export interface MasterDetailProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  items?: MasterDetailItem[];
  selectedId?: string;
  orientation?: 'horizontal' | 'vertical';
  masterWidth?: string;
  minMasterWidth?: string;
  maxMasterWidth?: string;
  collapsible?: boolean;
  collapseBreakpoint?: number;
  showSearch?: boolean;
  resizable?: boolean;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onSelect?: (id: string) => void;
  onDeselect?: () => void;
  renderDetail?: (item: MasterDetailItem) => ReactNode;
  renderListItem?: (item: MasterDetailItem) => ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const MasterDetail = forwardRef<HTMLDivElement, MasterDetailProps>(
  function MasterDetail(
    {
      items = [],
      selectedId: controlledSelectedId,
      orientation = 'horizontal',
      masterWidth = '320px',
      minMasterWidth = '200px',
      maxMasterWidth = '500px',
      collapsible = true,
      collapseBreakpoint = 768,
      showSearch = false,
      resizable = true,
      loading = false,
      emptyTitle = 'No item selected',
      emptyDescription = 'Select an item from the list to view details',
      onSelect,
      onDeselect,
      renderDetail,
      renderListItem,
      children,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(masterDetailReducer, {
      selection: controlledSelectedId ? 'hasSelection' : 'noSelection',
      layout: 'split',
      stackedView: 'showingList',
      loading: loading ? 'loading' : 'idle',
      selectedId: controlledSelectedId ?? null,
      searchQuery: '',
    });

    const detailRef = useRef<HTMLDivElement>(null);

    // Responsive collapse
    useEffect(() => {
      if (!collapsible) return;
      const checkWidth = () => {
        if (window.innerWidth < collapseBreakpoint) {
          send({ type: 'COLLAPSE' });
        } else {
          send({ type: 'EXPAND' });
        }
      };
      checkWidth();
      window.addEventListener('resize', checkWidth);
      return () => window.removeEventListener('resize', checkWidth);
    }, [collapsible, collapseBreakpoint]);

    const effectiveSelectedId = controlledSelectedId ?? state.selectedId;
    const selectedItem = items.find((item) => item.id === effectiveSelectedId);
    const hasSelection = Boolean(effectiveSelectedId && selectedItem);

    const filteredItems = state.searchQuery
      ? items.filter((item) =>
          item.title.toLowerCase().includes(state.searchQuery.toLowerCase()),
        )
      : items;

    const handleSelect = useCallback(
      (id: string) => {
        send({ type: 'SELECT', id });
        onSelect?.(id);
        // Scroll detail to top
        detailRef.current?.scrollTo(0, 0);
      },
      [onSelect],
    );

    const handleBack = useCallback(() => {
      send({ type: 'BACK' });
      onDeselect?.();
    }, [onDeselect]);

    const masterHidden =
      state.layout === 'stacked' && state.stackedView === 'showingDetail';
    const detailHidden =
      state.layout === 'stacked' && state.stackedView === 'showingList';

    return (
      <div
        ref={ref}
        role="region"
        aria-label="Master detail view"
        data-surface-widget=""
        data-widget-name="master-detail"
        data-part="root"
        data-selection={hasSelection ? 'has-selection' : 'no-selection'}
        data-layout={state.layout}
        data-orientation={orientation}
        {...rest}
      >
        {/* Master Pane */}
        <div
          role="region"
          aria-label="Item list"
          data-part="master-pane"
          data-width={masterWidth}
          hidden={masterHidden}
        >
          <div data-part="master-header">
            {showSearch && (
              <input
                type="search"
                data-part="master-search"
                placeholder="Search..."
                aria-label="Search items"
                value={state.searchQuery}
                onChange={(e) => send({ type: 'SET_SEARCH', value: e.target.value })}
              />
            )}
          </div>

          <div
            role="listbox"
            aria-label="Items"
            aria-activedescendant={effectiveSelectedId ? `item-${effectiveSelectedId}` : undefined}
            data-part="list"
          >
            {filteredItems.map((item) => (
              <div
                key={item.id}
                role="option"
                aria-selected={item.id === effectiveSelectedId ? 'true' : 'false'}
                data-part="list-item"
                data-selected={item.id === effectiveSelectedId ? 'true' : 'false'}
                id={`item-${item.id}`}
                tabIndex={item.id === effectiveSelectedId ? 0 : -1}
                onClick={() => handleSelect(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSelect(item.id);
                }}
              >
                {renderListItem ? (
                  renderListItem(item)
                ) : (
                  <>
                    <span data-part="list-item-title">{item.title}</span>
                    {item.meta && (
                      <span data-part="list-item-meta" aria-hidden="true">
                        {item.meta}
                      </span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Splitter */}
        {resizable && state.layout === 'split' && (
          <div
            role="separator"
            aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
            aria-label="Resize panels"
            aria-valuemin={parseInt(minMasterWidth)}
            aria-valuemax={parseInt(maxMasterWidth)}
            aria-valuenow={parseInt(masterWidth)}
            data-part="splitter"
            data-orientation={orientation}
            tabIndex={0}
          />
        )}

        {/* Detail Pane */}
        <div
          ref={detailRef}
          role="region"
          aria-label="Item details"
          aria-live="polite"
          aria-busy={loading ? 'true' : 'false'}
          data-part="detail-pane"
          data-state={hasSelection ? 'has-selection' : 'no-selection'}
          hidden={detailHidden}
        >
          {/* Back button for stacked mode */}
          {state.layout === 'stacked' && state.stackedView === 'showingDetail' && (
            <button
              type="button"
              data-part="back-button"
              aria-label="Back to list"
              onClick={handleBack}
            >
              Back
            </button>
          )}

          {hasSelection && selectedItem ? (
            <>
              <div data-part="detail-header">
                <span data-part="detail-title">{selectedItem.title}</span>
              </div>
              <div data-part="detail-content">
                {renderDetail ? renderDetail(selectedItem) : children}
              </div>
              <div data-part="detail-actions" />
            </>
          ) : (
            <div data-part="empty-detail" role="status" aria-label="No item selected">
              <h3>{emptyTitle}</h3>
              <p>{emptyDescription}</p>
            </div>
          )}
        </div>
      </div>
    );
  },
);

MasterDetail.displayName = 'MasterDetail';
export default MasterDetail;
