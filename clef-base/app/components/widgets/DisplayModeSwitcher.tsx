'use client';

/**
 * DisplayModeSwitcher — layout picker popover for changing the view display type.
 * Per surface/widgets/display-mode-switcher.widget.
 *
 * Shows a grid of display mode options with icons and labels. Exactly one mode
 * is active at all times (radiogroup). Opens from the Layout toolbar button.
 */

import React, { useCallback, useEffect, useRef } from 'react';

export interface DisplayModeOption {
  value: string;
  label: string;
  icon: string;
}

const DEFAULT_MODES: DisplayModeOption[] = [
  { value: 'table', label: 'Table', icon: '▦' },
  { value: 'card-grid', label: 'Card Grid', icon: '▧' },
  { value: 'list', label: 'List', icon: '≡' },
  { value: 'board', label: 'Board', icon: '▥' },
  { value: 'calendar', label: 'Calendar', icon: '▨' },
  { value: 'timeline', label: 'Timeline', icon: '━' },
  { value: 'graph', label: 'Graph', icon: '◎' },
  { value: 'tree', label: 'Tree', icon: '⊞' },
  { value: 'stat-cards', label: 'Stat Cards', icon: '▣' },
  { value: 'detail', label: 'Detail', icon: '▤' },
  { value: 'content-body', label: 'Content Body', icon: '¶' },
];

interface DisplayModeSwitcherProps {
  open: boolean;
  onClose: () => void;
  currentMode: string;
  onModeChange: (mode: string) => void;
  modes?: DisplayModeOption[];
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 1000,
  background: 'var(--palette-surface)',
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  padding: 'var(--spacing-md)',
  minWidth: 280,
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 999,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 'var(--spacing-xs)',
  marginTop: 'var(--spacing-xs)',
};

const modeBtnStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: '8px 4px',
  borderRadius: 'var(--radius-sm)',
  border: `1px solid ${active ? 'var(--palette-primary)' : 'var(--palette-outline-variant)'}`,
  background: active ? 'var(--palette-primary-container)' : 'var(--palette-surface)',
  color: active ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 11,
});

const iconStyle: React.CSSProperties = {
  fontSize: 18,
  fontFamily: 'monospace',
  lineHeight: 1,
};

export const DisplayModeSwitcher: React.FC<DisplayModeSwitcherProps> = ({
  open,
  onClose,
  currentMode,
  onModeChange,
  modes = DEFAULT_MODES,
  anchorRef,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  const getPosition = (): React.CSSProperties => {
    if (!anchorRef?.current) return { top: 80, left: 400 };
    const rect = anchorRef.current.getBoundingClientRect();
    return { top: rect.bottom + 8, left: rect.left };
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSelect = useCallback((mode: string) => {
    onModeChange(mode);
    onClose();
  }, [onModeChange, onClose]);

  if (!open) return null;

  const panelPos = getPosition();

  return (
    <>
      <div style={overlayStyle} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        data-part="root"
        data-state="open"
        role="dialog"
        aria-label="Display mode"
        style={{ ...panelStyle, ...panelPos }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
          <span style={{ fontSize: 'var(--typography-label-md-size)', fontWeight: 'var(--typography-label-md-weight)' as React.CSSProperties['fontWeight'] }}>
            Layout
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--palette-on-surface-variant)', fontSize: 18 }}
          >
            ×
          </button>
        </div>

        <div
          data-part="mode-list"
          role="radiogroup"
          aria-label="Display mode"
          style={gridStyle}
        >
          {modes.map((mode) => {
            const isActive = mode.value === currentMode;
            return (
              <button
                key={mode.value}
                type="button"
                data-part="mode-option"
                role="radio"
                aria-checked={isActive}
                aria-label={`${mode.label} view`}
                onClick={() => handleSelect(mode.value)}
                style={modeBtnStyle(isActive)}
              >
                <span data-part="mode-icon" style={iconStyle}>{mode.icon}</span>
                <span data-part="mode-label">{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default DisplayModeSwitcher;
