'use client';

/**
 * ViewTabBar — tab strip above the toolbar showing saved views.
 * Per surface/widgets/view-tab-bar.widget.
 *
 * Renders a horizontal tab strip where each tab represents a saved view.
 * The active tab is highlighted. A [+] button creates a new view.
 * Each tab has a context menu (right-click or ⋯ button) for rename/duplicate/delete.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

export interface ViewTab {
  id: string;
  label: string;
}

interface ViewTabBarProps {
  tabs: ViewTab[];
  activeViewId: string;
  onTabClick: (viewId: string) => void;
  onCreateNew?: () => void;
  onRename?: (viewId: string, label: string) => void;
  onDuplicate?: (viewId: string) => void;
  onDelete?: (viewId: string) => void;
}

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  borderBottom: '1px solid var(--palette-outline-variant)',
  paddingBottom: 0,
  overflowX: 'auto',
  overflowY: 'visible',
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 12px',
  border: 'none',
  borderBottom: active ? '2px solid var(--palette-primary)' : '2px solid transparent',
  background: 'transparent',
  color: active ? 'var(--palette-primary)' : 'var(--palette-on-surface-variant)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 'var(--typography-body-sm-size)',
  fontWeight: active ? 600 : 400,
  borderRadius: 0,
  whiteSpace: 'nowrap',
  position: 'relative',
  flexShrink: 0,
});

const moreStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--palette-on-surface-variant)',
  fontSize: 14,
  padding: '2px 4px',
  opacity: 0,
  transition: 'opacity 0.15s',
};

const addBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: 'none',
  background: 'none',
  color: 'var(--palette-on-surface-variant)',
  cursor: 'pointer',
  fontSize: 16,
  fontFamily: 'inherit',
  flexShrink: 0,
};

const contextMenuStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 2000,
  background: 'var(--palette-surface)',
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-sm)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  minWidth: 140,
  overflow: 'hidden',
};

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  background: 'none',
  border: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size)',
  fontFamily: 'inherit',
};

const menuItemDangerStyle: React.CSSProperties = {
  ...menuItemStyle,
  color: 'var(--palette-error)',
};

interface ContextMenuState {
  viewId: string;
  x: number;
  y: number;
}

export const ViewTabBar: React.FC<ViewTabBarProps> = ({
  tabs,
  activeViewId,
  onTabClick,
  onCreateNew,
  onRename,
  onDuplicate,
  onDelete,
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      setContextMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  const openContextMenu = useCallback((viewId: string, x: number, y: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ viewId, x, y });
  }, []);

  const startRename = useCallback((viewId: string) => {
    const tab = tabs.find((t) => t.id === viewId);
    setRenamingId(viewId);
    setRenameValue(tab?.label ?? '');
    setContextMenu(null);
    setTimeout(() => renameRef.current?.select(), 0);
  }, [tabs]);

  const commitRename = useCallback(() => {
    if (renamingId && onRename && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue, onRename]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') {
      setRenamingId(null);
      setRenameValue('');
    }
  }, [commitRename]);

  return (
    <div data-part="root" style={{ position: 'relative' }}>
      <div data-part="tab-strip" role="tablist" aria-label="Views" style={barStyle}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeViewId;
          if (renamingId === tab.id) {
            return (
              <input
                key={tab.id}
                ref={renameRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleRenameKeyDown}
                style={{
                  padding: '4px 8px',
                  border: '1px solid var(--palette-primary)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--palette-surface)',
                  color: 'var(--palette-on-surface)',
                  fontSize: 'var(--typography-body-sm-size)',
                  fontFamily: 'inherit',
                  width: Math.max(60, renameValue.length * 8),
                }}
              />
            );
          }

          return (
            <div key={tab.id} style={{ position: 'relative', display: 'flex' }}
              onMouseEnter={(e) => {
                const btn = e.currentTarget.querySelector<HTMLButtonElement>('[data-part="tab-more"]');
                if (btn) btn.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget.querySelector<HTMLButtonElement>('[data-part="tab-more"]');
                if (btn) btn.style.opacity = '0';
              }}
            >
              <button
                type="button"
                data-part="tab"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabClick(tab.id)}
                onContextMenu={(e) => openContextMenu(tab.id, e.clientX, e.clientY, e)}
                style={tabStyle(isActive)}
              >
                {tab.label}
              </button>
              {(onRename || onDuplicate || onDelete) && (
                <button
                  type="button"
                  data-part="tab-more"
                  onClick={(e) => openContextMenu(tab.id, e.clientX, e.clientY, e)}
                  style={moreStyle}
                  aria-label={`Options for ${tab.label}`}
                  title="Tab options"
                >
                  ⋯
                </button>
              )}
            </div>
          );
        })}

        {onCreateNew && (
          <button
            type="button"
            data-part="add-tab-button"
            onClick={onCreateNew}
            style={addBtnStyle}
            aria-label="Create new view"
            title="New view"
          >
            +
          </button>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          data-part="context-menu"
          style={{ ...contextMenuStyle, top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {onRename && (
            <button type="button" style={menuItemStyle} onClick={() => startRename(contextMenu.viewId)}>
              Rename
            </button>
          )}
          {onDuplicate && (
            <button type="button" style={menuItemStyle} onClick={() => {
              onDuplicate(contextMenu.viewId);
              setContextMenu(null);
            }}>
              Duplicate
            </button>
          )}
          {onDelete && tabs.length > 1 && (
            <button type="button" style={menuItemDangerStyle} onClick={() => {
              onDelete(contextMenu.viewId);
              setContextMenu(null);
            }}>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ViewTabBar;
