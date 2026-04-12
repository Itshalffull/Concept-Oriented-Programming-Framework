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
    <div ref={ref} data-surface="floating-anchor" data-part="root" data-variant={variant} onKeyDown={handleKeyDown}>
      <button
        data-surface="floating-trigger"
        data-layout={variant === 'inline' ? 'inline' : 'block'}
        data-part="trigger"
        data-size={sizeClass}
        data-variant="outlined"
        role="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Display as: ${currentModeName}`}
        onClick={() => setOpen(!open)}
      >
        {triggerLabel}
        <span data-part="trigger-caret">{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div
          data-surface="floating-menu"
          data-part="dropdown"
          role="listbox"
          aria-label="Display mode options"
        >
          {loading && (
            <div data-part="empty">
              Loading...
            </div>
          )}

          {!loading && modes.length === 0 && (
            <div data-part="empty">
              No display modes configured
            </div>
          )}

          {!loading && schemaKeys.map(schema => (
            <div key={schema} data-part="schema-group">
              {schemaKeys.length > 1 && (
                <div
                  data-part="menu-label"
                >
                  {schema}
                </div>
              )}
              {grouped[schema].map(mode => (
                <div
                  key={mode.mode_id}
                  data-part="menu-item"
                  data-selected={mode.mode_id === currentMode ? 'true' : 'false'}
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
                >
                  <span>{mode.name}</span>
                  {(mode.layout || mode.component_mapping) && (
                    <span data-part="menu-item-meta">
                      {[
                        mode.layout ? 'layout' : null,
                        mode.component_mapping ? 'mapping' : null,
                      ].filter(Boolean).join(' · ')}
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
