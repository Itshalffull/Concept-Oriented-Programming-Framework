'use client';

/**
 * DisplayAsPicker — Dropdown picker for switching between DisplayMode configurations.
 * Implements the display-as-picker.widget spec from the Presentation suite.
 * Shows available modes grouped by Schema, with the current mode highlighted.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useConceptQuery } from '../../../lib/use-concept-query';

interface DisplayMode {
  mode: string;
  name: string;
  mode_id: string;
  schema: string;
  layout: string | null;
  component_mapping: string | null;
}

interface DisplayAsPickerProps {
  entityId?: string;
  currentSchema: string;
  currentMode: string;
  onChange: (modeId: string) => void;
  variant?: 'compact' | 'inline' | 'admin';
}

export const DisplayAsPicker: React.FC<DisplayAsPickerProps> = ({
  currentSchema,
  currentMode,
  onChange,
  variant = 'compact',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data, loading } = useConceptQuery<Record<string, unknown>>(
    'DisplayMode',
    'list_for_schema',
    { schema: currentSchema },
  );

  const modes: DisplayMode[] = React.useMemo(() => {
    if (!data?.modes) return [];
    try {
      const parsed = typeof data.modes === 'string' ? JSON.parse(data.modes) : data.modes;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [data]);

  const currentModeName = modes.find(m => m.mode_id === currentMode)?.name ?? currentMode;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = useCallback((modeId: string) => {
    onChange(modeId);
    setOpen(false);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    }
  }, []);

  // Group modes by schema
  const grouped = React.useMemo(() => {
    const groups: Record<string, DisplayMode[]> = {};
    for (const mode of modes) {
      const key = mode.schema || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(mode);
    }
    return groups;
  }, [modes]);

  const schemaKeys = Object.keys(grouped);

  const sizeClass = variant === 'inline' ? 'xs' : variant === 'admin' ? 'md' : 'sm';

  const triggerLabel = variant === 'admin'
    ? `${currentSchema} / ${currentModeName}`
    : currentModeName;

  return (
    <div ref={ref} data-part="root" data-variant={variant} style={{ position: 'relative', display: 'inline-block' }} onKeyDown={handleKeyDown}>
      <button
        data-part="trigger"
        data-size={sizeClass}
        data-variant="outlined"
        role="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Display as: ${currentModeName}`}
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs, 4px)',
          fontSize: variant === 'inline' ? '0.75rem' : undefined,
        }}
      >
        {triggerLabel}
        <span style={{ fontSize: '0.6em' }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div
          data-part="dropdown"
          role="listbox"
          aria-label="Display mode options"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 100,
            minWidth: '180px',
            background: 'var(--palette-surface, #fff)',
            border: '1px solid var(--palette-outline-variant, #ccc)',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: 'var(--elevation-2, 0 2px 8px rgba(0,0,0,0.15))',
            padding: 'var(--spacing-xs, 4px) 0',
            marginTop: '4px',
          }}
        >
          {loading && (
            <div style={{ padding: 'var(--spacing-sm, 8px)', color: 'var(--palette-on-surface-variant, #666)' }}>
              Loading...
            </div>
          )}

          {!loading && modes.length === 0 && (
            <div style={{ padding: 'var(--spacing-sm, 8px)', color: 'var(--palette-on-surface-variant, #666)' }}>
              No display modes configured
            </div>
          )}

          {!loading && schemaKeys.map(schema => (
            <div key={schema} data-part="schema-group">
              {schemaKeys.length > 1 && (
                <div
                  data-part="schema-label"
                  style={{
                    padding: 'var(--spacing-xs, 4px) var(--spacing-sm, 8px)',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'var(--palette-on-surface-variant, #888)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {schema}
                </div>
              )}
              {grouped[schema].map(mode => (
                <div
                  key={mode.mode_id}
                  data-part="mode-item"
                  role="option"
                  aria-selected={mode.mode_id === currentMode}
                  tabIndex={0}
                  onClick={() => handleSelect(mode.mode_id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelect(mode.mode_id);
                    }
                  }}
                  style={{
                    padding: 'var(--spacing-xs, 4px) var(--spacing-sm, 8px)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs, 4px)',
                    background: mode.mode_id === currentMode ? 'var(--palette-secondary-container, #e8eaf6)' : 'transparent',
                    fontWeight: mode.mode_id === currentMode ? 600 : 400,
                  }}
                >
                  <span>{mode.name}</span>
                  {mode.layout && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--palette-on-surface-variant, #888)', marginLeft: 'auto' }}>
                      layout
                    </span>
                  )}
                  {mode.component_mapping && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--palette-on-surface-variant, #888)', marginLeft: 'auto' }}>
                      mapping
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DisplayAsPicker;
