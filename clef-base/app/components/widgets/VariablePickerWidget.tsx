'use client';

/**
 * VariablePickerWidget — author-facing picker for building VariableProgram expressions.
 * Per surface/VariablePickerWidget.widget.
 *
 * Three-panel layout:
 *   Left:   Source selector — the 8 built-in variable sources
 *   Middle: Property/relation tree — fields available on the selected source
 *   Right:  Preview pane — current expression, resolved type, and live value
 *
 * A bottom bar holds the raw expression text input plus Cancel / Confirm buttons.
 *
 * Used in step config fields, form defaults, filter bindings, and slot source configs.
 *
 * FSM states:
 *   idle      — no source selected
 *   browsing  — source selected, showing properties
 *   selected  — leaf property chosen, confirm enabled
 *   editing   — user typing in expression input
 *   resolving — live preview fetch in progress
 *   confirmed — calls onSelect and closes
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  type KeyboardEvent,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FsmState = 'idle' | 'browsing' | 'selected' | 'editing' | 'resolving' | 'confirmed';

interface SourceDef {
  kind: string;
  label: string;
  prefix: string;
}

interface PropertyDef {
  name: string;
  type: string;
  isRelation: boolean;
}

export interface VariablePickerWidgetProps {
  /** Source kinds to show. Default: all 8. */
  availableSources?: string[];
  /** Pre-populate for editing an existing expression. */
  currentExpression?: string;
  onSelect: (expression: string) => void;
  onCancel: () => void;
  /** Provided for live preview resolution. */
  runtimeContext?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_SOURCES: SourceDef[] = [
  { kind: 'page',    label: 'Page',         prefix: '$page' },
  { kind: 'url',     label: 'URL params',   prefix: '$url' },
  { kind: 'content', label: 'Content',      prefix: '$content' },
  { kind: 'query',   label: 'View query',   prefix: '$query' },
  { kind: 'step',    label: 'Process step', prefix: '$step' },
  { kind: 'session', label: 'Session',      prefix: '$session' },
  { kind: 'literal', label: 'Literal',      prefix: "'" },
  { kind: 'context', label: 'Context',      prefix: '$ctx' },
];

// ---------------------------------------------------------------------------
// Property loading
// ---------------------------------------------------------------------------

async function loadProperties(sourceKind: string): Promise<PropertyDef[]> {
  if (sourceKind === 'session') {
    return [
      { name: 'userId',      type: 'string',   isRelation: false },
      { name: 'displayName', type: 'string',   isRelation: false },
      { name: 'email',       type: 'string',   isRelation: false },
      { name: 'roles',       type: 'string[]', isRelation: false },
    ];
  }
  if (sourceKind === 'page' || sourceKind === 'content') {
    return [
      { name: 'title',     type: 'string', isRelation: false },
      { name: 'status',    type: 'string', isRelation: false },
      { name: 'createdAt', type: 'Date',   isRelation: false },
      { name: 'updatedAt', type: 'Date',   isRelation: false },
      { name: 'author',    type: 'User',   isRelation: true  },
      { name: 'tags',      type: 'Tag[]',  isRelation: true  },
    ];
  }
  // For sources with dynamic fields, attempt API call and fall back to empty.
  try {
    const res = await fetch('/api/invoke/VariableProgram/listProperties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKind }),
    });
    if (!res.ok) return [];
    const data = await res.json() as { properties?: PropertyDef[] };
    return Array.isArray(data.properties) ? data.properties : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  zIndex: 1200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const dialogStyle: React.CSSProperties = {
  background: 'var(--palette-surface)',
  borderRadius: 'var(--radius-md, 8px)',
  boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
  width: '100%',
  maxWidth: 720,
  minHeight: 400,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: 'var(--spacing-sm, 8px) var(--spacing-md, 16px)',
  borderBottom: '1px solid var(--palette-outline)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: 'var(--typography-title-md-size)',
  fontWeight: 600,
  color: 'var(--palette-on-surface)',
  margin: 0,
};

const panelsWrapStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
};

const panelStyle = (border?: boolean): React.CSSProperties => ({
  flex: 1,
  overflowY: 'auto',
  borderRight: border ? '1px solid var(--palette-outline-variant)' : undefined,
  padding: 'var(--spacing-xs, 4px) 0',
});

const panelLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--palette-on-surface-variant)',
  padding: '4px var(--spacing-sm, 8px) 2px',
  userSelect: 'none',
};

const sourceItemStyle = (selected: boolean): React.CSSProperties => ({
  padding: '6px var(--spacing-sm, 8px)',
  cursor: 'pointer',
  fontSize: 'var(--typography-body-sm-size)',
  color: selected ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface)',
  background: selected ? 'var(--palette-primary-container)' : 'transparent',
  userSelect: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'background 0.1s',
  outline: 'none',
});

const propertyItemStyle = (selected: boolean): React.CSSProperties => ({
  padding: '5px var(--spacing-sm, 8px)',
  cursor: 'pointer',
  fontSize: 'var(--typography-body-sm-size)',
  color: selected ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface)',
  background: selected ? 'var(--palette-primary-container)' : 'transparent',
  userSelect: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  outline: 'none',
});

const typeLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--palette-on-surface-variant)',
  marginLeft: 'auto',
  fontFamily: 'var(--font-mono, monospace)',
  flexShrink: 0,
};

const expandBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--palette-on-surface-variant)',
  fontSize: 10,
  lineHeight: 1,
  padding: '2px 4px',
  borderRadius: 'var(--radius-sm)',
  flexShrink: 0,
};

const previewPaneStyle: React.CSSProperties = {
  flex: 1,
  padding: 'var(--spacing-sm, 8px) var(--spacing-md, 16px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-xs, 4px)',
  overflowY: 'auto',
  background: 'var(--palette-surface-variant)',
};

const expressionDisplayStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 13,
  color: 'var(--palette-on-surface)',
  background: 'var(--palette-surface)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 10px',
  wordBreak: 'break-all',
  minHeight: 32,
};

const typeBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  padding: '2px 7px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--palette-primary-container)',
  color: 'var(--palette-on-primary-container)',
  fontFamily: 'var(--font-mono, monospace)',
};

const liveValueStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--palette-on-surface-variant)',
  fontStyle: 'italic',
  marginTop: 'var(--spacing-xs, 4px)',
};

const emptyPreviewStyle: React.CSSProperties = {
  color: 'var(--palette-on-surface-variant)',
  fontSize: 'var(--typography-body-sm-size)',
  opacity: 0.6,
  marginTop: 'var(--spacing-sm, 8px)',
};

const bottomBarStyle: React.CSSProperties = {
  borderTop: '1px solid var(--palette-outline-variant)',
  padding: 'var(--spacing-sm, 8px) var(--spacing-md, 16px)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-sm, 8px)',
  flexShrink: 0,
  background: 'var(--palette-surface)',
};

const expressionInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '5px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--palette-outline)',
  background: 'var(--palette-surface)',
  color: 'var(--palette-on-surface)',
  fontSize: 13,
  fontFamily: 'var(--font-mono, monospace)',
  outline: 'none',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '5px 14px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--palette-outline)',
  background: 'transparent',
  color: 'var(--palette-on-surface)',
  cursor: 'pointer',
  fontSize: 'var(--typography-body-sm-size)',
  fontFamily: 'inherit',
};

const confirmBtnStyle = (enabled: boolean): React.CSSProperties => ({
  padding: '5px 14px',
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  background: enabled ? 'var(--palette-primary)' : 'var(--palette-outline-variant)',
  color: enabled ? 'var(--palette-on-primary)' : 'var(--palette-on-surface-variant)',
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontSize: 'var(--typography-body-sm-size)',
  fontFamily: 'inherit',
  opacity: enabled ? 1 : 0.6,
  transition: 'background 0.1s, opacity 0.1s',
});

const resolveSpinnerStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--palette-on-surface-variant)',
  fontStyle: 'italic',
};

// ---------------------------------------------------------------------------
// VariablePickerWidget
// ---------------------------------------------------------------------------

export const VariablePickerWidget: React.FC<VariablePickerWidgetProps> = ({
  availableSources,
  currentExpression = '',
  onSelect,
  onCancel,
  runtimeContext,
}) => {
  // ------------------------------------------------------------------
  // Filtered source list
  // ------------------------------------------------------------------
  const sources = availableSources
    ? ALL_SOURCES.filter((s) => availableSources.includes(s.kind))
    : ALL_SOURCES;

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  const [fsmState, setFsmState]             = useState<FsmState>('idle');
  const [selectedSource, setSelectedSource] = useState<SourceDef | null>(null);
  const [properties, setProperties]         = useState<PropertyDef[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [expandedRelations, setExpandedRelations] = useState<Set<string>>(new Set());
  const [selectedProperty, setSelectedProperty]   = useState<PropertyDef | null>(null);
  const [expression, setExpression]         = useState(currentExpression);
  const [resolvedType, setResolvedType]     = useState<string>('');
  const [liveValue, setLiveValue]           = useState<unknown>(null);

  // Source list roving-tabindex support
  const sourceRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [sourceFocusIdx, setSourceFocusIdx] = useState(0);

  // ------------------------------------------------------------------
  // Initialise from currentExpression
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!currentExpression) return;
    setExpression(currentExpression);
    // Attempt to identify the source from prefix
    const matched = ALL_SOURCES.find((s) => currentExpression.startsWith(s.prefix));
    if (matched) {
      setSelectedSource(matched);
      setFsmState('browsing');
    } else {
      setFsmState('editing');
    }
  }, [currentExpression]);

  // ------------------------------------------------------------------
  // Load properties when source changes
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!selectedSource) {
      setProperties([]);
      return;
    }
    let cancelled = false;
    setPropertiesLoading(true);
    setProperties([]);
    loadProperties(selectedSource.kind).then((props) => {
      if (!cancelled) {
        setProperties(props);
        setPropertiesLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [selectedSource]);

  // ------------------------------------------------------------------
  // Live preview — fires when state is 'selected' and runtimeContext given
  // ------------------------------------------------------------------
  useEffect(() => {
    if (fsmState !== 'selected' || !runtimeContext || !expression) return;

    let cancelled = false;
    setFsmState('resolving');
    setLiveValue(null);

    (async () => {
      try {
        const res = await fetch('/api/invoke/VariableProgram/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expression,
            context: JSON.stringify(runtimeContext),
          }),
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json() as { value?: unknown; type?: string };
          setLiveValue(data.value ?? null);
          if (data.type) setResolvedType(data.type);
        }
      } catch {
        // Silent — preview is optional
      } finally {
        if (!cancelled) setFsmState('selected');
      }
    })();

    return () => { cancelled = true; };
    // We intentionally only run on fsmState/expression transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expression, fsmState === 'selected' ? runtimeContext : null]);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const handleSelectSource = useCallback((source: SourceDef) => {
    setSelectedSource(source);
    setSelectedProperty(null);
    setExpandedRelations(new Set());
    setExpression(source.prefix);
    setResolvedType('');
    setLiveValue(null);
    setFsmState('browsing');
  }, []);

  const handleSelectProperty = useCallback((prop: PropertyDef) => {
    if (prop.isRelation) {
      // Toggle expansion and stay in browsing — append the path segment
      setExpandedRelations((prev) => {
        const next = new Set(prev);
        if (next.has(prop.name)) {
          next.delete(prop.name);
        } else {
          next.add(prop.name);
        }
        return next;
      });
      setExpression((prev) => {
        // If not already appended, append
        const segment = `.${prop.name}`;
        if (prev.endsWith(segment)) return prev;
        // Remove any trailing scalar so we don't nest further than the relation
        const lastDot = prev.lastIndexOf('.');
        const base = lastDot > 0 ? prev.slice(0, lastDot) : prev;
        return base + segment;
      });
      setFsmState('browsing');
    } else {
      // Scalar leaf — confirm enabled
      setSelectedProperty(prop);
      setExpression((prev) => {
        const segment = `.${prop.name}`;
        if (prev.endsWith(segment)) return prev;
        const lastDot = prev.lastIndexOf('.');
        const base = lastDot > 0 ? prev.slice(0, lastDot) : prev;
        return base + segment;
      });
      setResolvedType(prop.type);
      setFsmState('selected');
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setExpression(e.target.value);
    setFsmState('editing');
    setSelectedProperty(null);
    setResolvedType('');
    setLiveValue(null);
  }, []);

  const handleInputBlur = useCallback(() => {
    // If the user has typed an expression that ends in a known type suffix,
    // try to transition to 'selected' so they can confirm.
    if (fsmState === 'editing' && expression.trim()) {
      setFsmState('selected');
    }
  }, [fsmState, expression]);

  const handleConfirm = useCallback(() => {
    if (fsmState !== 'selected' && fsmState !== 'resolving') return;
    setFsmState('confirmed');
    onSelect(expression);
  }, [fsmState, expression, onSelect]);

  // Keyboard: Escape → cancel; Enter → confirm if selected
  const handleRootKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Enter' && fsmState === 'selected') {
      e.preventDefault();
      handleConfirm();
    }
  }, [fsmState, onCancel, handleConfirm]);

  // Roving tabindex — ArrowUp/ArrowDown in source list
  const handleSourceKeyDown = useCallback((
    e: KeyboardEvent<HTMLDivElement>,
    idx: number,
  ) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(idx + 1, sources.length - 1);
      setSourceFocusIdx(next);
      sourceRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(idx - 1, 0);
      setSourceFocusIdx(prev);
      sourceRefs.current[prev]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelectSource(sources[idx]);
    }
  }, [sources, handleSelectSource]);

  // ------------------------------------------------------------------
  // Derived values
  // ------------------------------------------------------------------
  const confirmEnabled = fsmState === 'selected';

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div
      data-part="overlay"
      style={overlayStyle}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        data-part="root"
        data-state={fsmState}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a variable"
        style={dialogStyle}
        onKeyDown={handleRootKeyDown}
        tabIndex={-1}
      >
        {/* Header */}
        <div data-part="header" style={headerStyle}>
          <h2 style={headerTitleStyle}>Choose a variable</h2>
          <button
            type="button"
            data-part="closeTrigger"
            aria-label="Close variable picker"
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--palette-on-surface-variant)',
              fontSize: 20,
              lineHeight: 1,
              padding: '2px 4px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            &times;
          </button>
        </div>

        {/* Three-panel body */}
        <div style={panelsWrapStyle}>
          {/* Left: source list */}
          <div data-part="sourceList" role="listbox" aria-label="Variable sources" style={panelStyle(true)}>
            <div style={panelLabelStyle}>Source</div>
            {sources.map((source, idx) => {
              const isSelected = selectedSource?.kind === source.kind;
              return (
                <div
                  key={source.kind}
                  ref={(el) => { sourceRefs.current[idx] = el; }}
                  data-part="sourceItem"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={idx === sourceFocusIdx ? 0 : -1}
                  style={sourceItemStyle(isSelected)}
                  onClick={() => { setSourceFocusIdx(idx); handleSelectSource(source); }}
                  onKeyDown={(e) => handleSourceKeyDown(e, idx)}
                >
                  <span style={{ fontSize: 12, opacity: 0.7, fontFamily: 'monospace' }}>
                    {source.prefix}
                  </span>
                  <span>{source.label}</span>
                </div>
              );
            })}
          </div>

          {/* Middle: property tree */}
          <div data-part="propertyPanel" role="tree" aria-label="Available properties" style={panelStyle(true)}>
            <div style={panelLabelStyle}>Property</div>
            {fsmState === 'idle' && (
              <div style={{ ...emptyPreviewStyle, padding: 'var(--spacing-sm, 8px)' }}>
                Select a source to browse properties.
              </div>
            )}
            {propertiesLoading && (
              <div style={{ padding: 'var(--spacing-sm, 8px)', color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)' }}>
                Loading...
              </div>
            )}
            {!propertiesLoading && selectedSource && properties.length === 0 && (
              <div style={{ ...emptyPreviewStyle, padding: 'var(--spacing-sm, 8px)' }}>
                No properties available. Type an expression directly.
              </div>
            )}
            {!propertiesLoading && properties.map((prop) => {
              const isSelected = selectedProperty?.name === prop.name;
              const isExpanded = expandedRelations.has(prop.name);
              return (
                <div
                  key={prop.name}
                  data-part="propertyItem"
                  role="treeitem"
                  aria-expanded={prop.isRelation ? isExpanded : undefined}
                  aria-selected={isSelected}
                  tabIndex={0}
                  style={propertyItemStyle(isSelected)}
                  onClick={() => handleSelectProperty(prop)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectProperty(prop);
                    }
                  }}
                >
                  <span style={{ flex: 1 }}>{prop.name}</span>
                  <span data-part="propertyTypeLabel" style={typeLabelStyle}>{prop.type}</span>
                  {prop.isRelation && (
                    <button
                      type="button"
                      data-part="expandButton"
                      aria-label={isExpanded ? `Collapse ${prop.name}` : `Expand ${prop.name}`}
                      style={expandBtnStyle}
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectProperty(prop);
                      }}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: preview pane */}
          <div
            data-part="previewPane"
            aria-busy={fsmState === 'resolving'}
            style={previewPaneStyle}
          >
            <div style={panelLabelStyle}>Preview</div>

            <div data-part="expressionDisplay" style={expressionDisplayStyle}>
              {expression || <span style={{ opacity: 0.4 }}>No expression yet</span>}
            </div>

            {resolvedType && (
              <div>
                <span data-part="typeIndicatorBadge" style={typeBadgeStyle}>{resolvedType}</span>
              </div>
            )}

            {fsmState === 'resolving' && (
              <div data-part="resolveSpinner" style={resolveSpinnerStyle}>Resolving...</div>
            )}

            {liveValue !== null && (
              <div data-part="livePreviewValue" style={liveValueStyle}>
                Live value: {String(liveValue)}
              </div>
            )}

            {!expression && (
              <div style={emptyPreviewStyle}>
                Select a source and property to build an expression.
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={bottomBarStyle}>
          <input
            data-part="expressionInput"
            type="text"
            value={expression}
            placeholder="e.g. $page.title or $session.userId"
            aria-label="Variable expression"
            style={expressionInputStyle}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleInputBlur();
            }}
          />
          <button
            type="button"
            data-part="cancelButton"
            onClick={onCancel}
            style={cancelBtnStyle}
          >
            Cancel
          </button>
          <button
            type="button"
            data-part="confirmButton"
            disabled={!confirmEnabled}
            aria-disabled={!confirmEnabled}
            onClick={handleConfirm}
            style={confirmBtnStyle(confirmEnabled)}
          >
            Use this variable
          </button>
        </div>
      </div>
    </div>
  );
};

export default VariablePickerWidget;
