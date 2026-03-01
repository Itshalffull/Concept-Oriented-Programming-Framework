'use client';

import {
  forwardRef,
  useCallback,
  useId,
  useReducer,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { viewSwitcherReducer } from './ViewSwitcher.reducer.js';

/* ---------------------------------------------------------------------------
 * Types derived from view-switcher.widget spec props
 * ------------------------------------------------------------------------- */

export type ViewType = 'table' | 'board' | 'calendar' | 'timeline' | 'gallery';

export interface ViewDef {
  id: string;
  name: string;
  type: ViewType;
  config?: Record<string, unknown>;
}

export interface ViewSwitcherProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  views: ViewDef[];
  activeView: string;
  availableTypes?: ViewType[];
  allowAdd?: boolean;
  allowDelete?: boolean;
  allowRename?: boolean;
  allowDuplicate?: boolean;
  disabled?: boolean;
  onChange?: (views: ViewDef[], activeView: string) => void;
  renderContent?: (view: ViewDef) => ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const ViewSwitcher = forwardRef<HTMLDivElement, ViewSwitcherProps>(
  function ViewSwitcher(
    {
      views,
      activeView,
      availableTypes = ['table', 'board', 'calendar', 'timeline', 'gallery'],
      allowAdd = true,
      allowDelete = true,
      allowRename = true,
      allowDuplicate = true,
      disabled = false,
      onChange,
      renderContent,
      children,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(viewSwitcherReducer, {
      menuOpen: false,
      configExpanded: false,
      renamingViewId: null,
      renameValue: '',
    });

    const menuId = useId();
    const activeTabId = useId();
    const activeViewDef = views.find((v) => v.id === activeView);

    const handleSwitchView = useCallback(
      (viewId: string) => {
        if (disabled) return;
        send({ type: 'SWITCH_VIEW' });
        onChange?.(views, viewId);
      },
      [disabled, views, onChange],
    );

    const handleAddView = useCallback(
      (type: ViewType) => {
        if (disabled) return;
        const newView: ViewDef = {
          id: `view-${Date.now()}`,
          name: `New ${type} view`,
          type,
        };
        send({ type: 'CLOSE_MENU' });
        onChange?.([...views, newView], newView.id);
      },
      [disabled, views, onChange],
    );

    const handleDeleteView = useCallback(
      (viewId: string) => {
        if (disabled || views.length <= 1) return;
        const next = views.filter((v) => v.id !== viewId);
        const nextActive = viewId === activeView ? next[0]?.id ?? '' : activeView;
        onChange?.(next, nextActive);
      },
      [disabled, views, activeView, onChange],
    );

    const handleDuplicate = useCallback(
      (viewId: string) => {
        if (disabled) return;
        const source = views.find((v) => v.id === viewId);
        if (!source) return;
        const dup: ViewDef = {
          ...source,
          id: `view-${Date.now()}`,
          name: `${source.name} (copy)`,
        };
        onChange?.([...views, dup], dup.id);
      },
      [disabled, views, onChange],
    );

    const handleCommitRename = useCallback(() => {
      if (!state.renamingViewId) return;
      const next = views.map((v) =>
        v.id === state.renamingViewId ? { ...v, name: state.renameValue } : v,
      );
      send({ type: 'COMMIT_RENAME' });
      onChange?.(next, activeView);
    }, [state.renamingViewId, state.renameValue, views, activeView, onChange]);

    return (
      <div
        ref={ref}
        role="region"
        aria-label="View switcher"
        data-surface-widget=""
        data-widget-name="view-switcher"
        data-part="root"
        data-active-view={activeView}
        data-disabled={disabled ? 'true' : 'false'}
        {...rest}
      >
        <div
          role="tablist"
          aria-label="View modes"
          aria-orientation="horizontal"
          data-part="tab-bar"
          data-active={activeView}
        >
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              role="tab"
              id={view.id === activeView ? activeTabId : undefined}
              aria-selected={view.id === activeView ? 'true' : 'false'}
              data-part="tab"
              data-view={view.id}
              data-type={view.type}
              tabIndex={view.id === activeView ? 0 : -1}
              disabled={disabled}
              onClick={() => handleSwitchView(view.id)}
              onDoubleClick={() =>
                allowRename && send({ type: 'START_RENAME', viewId: view.id, name: view.name })
              }
            >
              {state.renamingViewId === view.id ? (
                <input
                  type="text"
                  data-part="view-label"
                  data-editable="true"
                  data-state="editing"
                  value={state.renameValue}
                  onChange={(e) => send({ type: 'UPDATE_RENAME_VALUE', value: e.target.value })}
                  onBlur={handleCommitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitRename();
                    if (e.key === 'Escape') send({ type: 'CANCEL_RENAME' });
                  }}
                  autoFocus
                />
              ) : (
                <span
                  data-part="view-label"
                  data-editable={allowRename ? 'true' : 'false'}
                  data-state="idle"
                >
                  {view.name}
                </span>
              )}
            </button>
          ))}

          {allowAdd && (
            <div data-part="add-view-wrapper">
              <button
                type="button"
                data-part="add-view-button"
                aria-label="Add view"
                aria-haspopup="menu"
                aria-expanded={state.menuOpen ? 'true' : 'false'}
                aria-controls={menuId}
                disabled={disabled || !allowAdd}
                onClick={() => send({ type: state.menuOpen ? 'CLOSE_MENU' : 'OPEN_MENU' })}
              >
                +
              </button>

              <div
                id={menuId}
                role="menu"
                aria-label="View types"
                data-part="view-menu"
                data-state={state.menuOpen ? 'open' : 'closed'}
                hidden={!state.menuOpen}
              >
                {availableTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="menuitem"
                    data-part="view-menu-item"
                    data-type={type}
                    onClick={() => handleAddView(type)}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {activeViewDef && (
          <div data-part="view-actions">
            {allowDelete && (
              <button
                type="button"
                data-part="delete-view-button"
                aria-label={`Delete view ${activeViewDef.name}`}
                disabled={disabled || !allowDelete || views.length <= 1}
                onClick={() => handleDeleteView(activeView)}
              >
                Delete
              </button>
            )}
            {allowDuplicate && (
              <button
                type="button"
                data-part="duplicate-button"
                aria-label={`Duplicate view ${activeViewDef.name}`}
                disabled={disabled || !allowDuplicate}
                onClick={() => handleDuplicate(activeView)}
              >
                Duplicate
              </button>
            )}
          </div>
        )}

        <div
          role="tabpanel"
          aria-labelledby={activeTabId}
          data-part="content"
          data-view-type={activeViewDef?.type}
          data-state="active"
        >
          {renderContent && activeViewDef ? renderContent(activeViewDef) : children}
        </div>
      </div>
    );
  },
);

ViewSwitcher.displayName = 'ViewSwitcher';
export default ViewSwitcher;
