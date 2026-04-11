'use client';

/**
 * SlotSourceEditor — Admin UI for configuring slot and prop bindings
 * on a ComponentMapping. Lets users wire entity fields, static values,
 * embedded widgets/views/blocks, menus, formulas, and entity reference
 * displays into widget slots and props.
 */

import React, { useState, useCallback } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
import { useConceptQuery } from '../../../lib/use-concept-query';
import { Badge } from './Badge';
import { Card } from './Card';

// ---------------------------------------------------------------------------
// Source type definitions
// ---------------------------------------------------------------------------

const SOURCE_TYPES = [
  'entity_field',
  'static_value',
  'widget_embed',
  'view_embed',
  'block_embed',
  'menu',
  'formula',
  'entity_reference_display',
] as const;

type SourceType = (typeof SOURCE_TYPES)[number];

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  entity_field: 'Entity Field',
  static_value: 'Static Value',
  widget_embed: 'Widget Embed',
  view_embed: 'View Embed',
  block_embed: 'Block Embed',
  menu: 'Menu',
  formula: 'Formula',
  entity_reference_display: 'Entity Ref Display',
};

const SOURCE_TYPE_BADGE_VARIANT: Record<SourceType, 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error'> = {
  entity_field: 'primary',
  static_value: 'secondary',
  widget_embed: 'info',
  view_embed: 'info',
  block_embed: 'info',
  menu: 'warning',
  formula: 'success',
  entity_reference_display: 'primary',
};

// ---------------------------------------------------------------------------
// Local state types
// ---------------------------------------------------------------------------

interface SlotBinding {
  slot_name: string;
  sources: string[];
}

interface PropBinding {
  prop_name: string;
  source: string;
}

interface ActionBinding {
  action_part: string;
  binding: string;
}

interface MappingData {
  variant: string;
  mapping: string;
  name: string;
  widget_id: string;
  widget_variant: string | null;
  schema: string | null;
  display_mode: string | null;
  slot_bindings: string;
  prop_bindings: string;
  action_bindings: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSource(raw: string): { type: SourceType; value: string } {
  const idx = raw.indexOf(':');
  if (idx === -1) return { type: 'static_value', value: raw };
  const prefix = raw.slice(0, idx);
  const value = raw.slice(idx + 1);
  if ((SOURCE_TYPES as readonly string[]).includes(prefix)) {
    return { type: prefix as SourceType, value };
  }
  return { type: 'static_value', value: raw };
}

function formatSource(type: SourceType, value: string): string {
  return `${type}:${value}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 'var(--typography-title-md-size)',
  fontWeight: 'var(--typography-title-md-weight)',
  color: 'var(--palette-on-surface)',
  margin: '0 0 var(--spacing-sm) 0',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  border: '1px solid var(--palette-outline-variant)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--palette-surface)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size)',
  minWidth: 0,
};

const selectStyle: React.CSSProperties = {
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  border: '1px solid var(--palette-outline-variant)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--palette-surface)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size)',
};

const removeButtonStyle: React.CSSProperties = {
  padding: 'var(--spacing-xs)',
  border: 'none',
  background: 'transparent',
  color: 'var(--palette-error)',
  cursor: 'pointer',
  fontSize: 'var(--typography-body-sm-size)',
  lineHeight: 1,
};

/** Single source row: [type dropdown] [value input] [remove] */
const SourceRow: React.FC<{
  source: string;
  onChange: (newSource: string) => void;
  onRemove: () => void;
}> = ({ source, onChange, onRemove }) => {
  const parsed = parseSource(source);
  return (
    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
      <select
        style={selectStyle}
        value={parsed.type}
        onChange={(e) => onChange(formatSource(e.target.value as SourceType, parsed.value))}
      >
        {SOURCE_TYPES.map((t) => (
          <option key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</option>
        ))}
      </select>
      <input
        style={inputStyle}
        type="text"
        value={parsed.value}
        placeholder="Value (e.g. title, Hello World)"
        onChange={(e) => onChange(formatSource(parsed.type, e.target.value))}
      />
      <Badge variant={SOURCE_TYPE_BADGE_VARIANT[parsed.type]}>{parsed.type}</Badge>
      <button style={removeButtonStyle} onClick={onRemove} title="Remove source">&times;</button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface SlotSourceEditorProps {
  mappingId: string;
  onClose?: () => void;
  onSaved?: () => void;
}

export const SlotSourceEditor: React.FC<SlotSourceEditorProps> = ({
  mappingId,
  onClose,
  onSaved,
}) => {
  const invoke = useKernelInvoke();
  const { data, loading, error } = useConceptQuery<MappingData>(
    'ComponentMapping',
    'get',
    { mapping: mappingId },
  );

  // ---------------------------------------------------------------------------
  // Local editable state — initialized from loaded data
  // ---------------------------------------------------------------------------

  const [slots, setSlots] = useState<SlotBinding[] | null>(null);
  const [props, setProps] = useState<PropBinding[] | null>(null);
  const [actionBindings, setActionBindings] = useState<ActionBinding[] | null>(null);
  const [showAddActionBinding, setShowAddActionBinding] = useState(false);
  const [newActionPart, setNewActionPart] = useState('');
  const [newActionBindingRef, setNewActionBindingRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Hydrate local state once data arrives
  React.useEffect(() => {
    if (data && slots === null) {
      try {
        const rawSlots = typeof data.slot_bindings === 'string'
          ? JSON.parse(data.slot_bindings || '[]')
          : data.slot_bindings ?? [];
        const rawProps = typeof data.prop_bindings === 'string'
          ? JSON.parse(data.prop_bindings || '[]')
          : data.prop_bindings ?? [];
        const rawActionBindings = typeof data.action_bindings === 'string'
          ? JSON.parse(data.action_bindings || '[]')
          : data.action_bindings ?? [];
        // Normalize sources — handler may return them as JSON string or array
        const parsedSlots: SlotBinding[] = (rawSlots as SlotBinding[]).map(s => ({
          slot_name: s.slot_name,
          sources: Array.isArray(s.sources)
            ? s.sources
            : typeof s.sources === 'string'
              ? (() => { try { return JSON.parse(s.sources); } catch { return [s.sources]; } })()
              : [],
        }));
        const parsedProps: PropBinding[] = (rawProps as PropBinding[]).map(p => ({
          prop_name: p.prop_name,
          source: typeof p.source === 'string' ? p.source : String(p.source ?? ''),
        }));
        const parsedActionBindings: ActionBinding[] = (rawActionBindings as ActionBinding[]).map(a => ({
          action_part: typeof a.action_part === 'string' ? a.action_part : String(a.action_part ?? ''),
          binding: typeof a.binding === 'string' ? a.binding : String(a.binding ?? ''),
        }));
        setSlots(parsedSlots);
        setProps(parsedProps);
        setActionBindings(parsedActionBindings);
      } catch {
        setSlots([]);
        setProps([]);
        setActionBindings([]);
      }
    }
  }, [data, slots]);

  // ---------------------------------------------------------------------------
  // Slot mutations
  // ---------------------------------------------------------------------------

  const updateSlotName = useCallback((index: number, name: string) => {
    setSlots((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], slot_name: name };
      return next;
    });
  }, []);

  const updateSlotSource = useCallback((slotIndex: number, srcIndex: number, value: string) => {
    setSlots((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const sources = [...next[slotIndex].sources];
      sources[srcIndex] = value;
      next[slotIndex] = { ...next[slotIndex], sources };
      return next;
    });
  }, []);

  const addSlotSource = useCallback((slotIndex: number) => {
    setSlots((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[slotIndex] = {
        ...next[slotIndex],
        sources: [...next[slotIndex].sources, 'entity_field:'],
      };
      return next;
    });
  }, []);

  const removeSlotSource = useCallback((slotIndex: number, srcIndex: number) => {
    setSlots((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const sources = next[slotIndex].sources.filter((_, i) => i !== srcIndex);
      next[slotIndex] = { ...next[slotIndex], sources };
      return next;
    });
  }, []);

  const addSlot = useCallback(() => {
    setSlots((prev) => [...(prev ?? []), { slot_name: '', sources: ['entity_field:'] }]);
  }, []);

  const removeSlot = useCallback((index: number) => {
    setSlots((prev) => prev ? prev.filter((_, i) => i !== index) : prev);
  }, []);

  // ---------------------------------------------------------------------------
  // Prop mutations
  // ---------------------------------------------------------------------------

  const updatePropName = useCallback((index: number, name: string) => {
    setProps((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], prop_name: name };
      return next;
    });
  }, []);

  const updatePropSource = useCallback((index: number, source: string) => {
    setProps((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], source };
      return next;
    });
  }, []);

  const addProp = useCallback(() => {
    setProps((prev) => [...(prev ?? []), { prop_name: '', source: 'entity_field:' }]);
  }, []);

  const removeProp = useCallback((index: number) => {
    setProps((prev) => prev ? prev.filter((_, i) => i !== index) : prev);
  }, []);

  // ---------------------------------------------------------------------------
  // Action binding mutations
  // ---------------------------------------------------------------------------

  const updateActionPart = useCallback((index: number, action_part: string) => {
    setActionBindings((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], action_part };
      return next;
    });
  }, []);

  const updateActionBindingRef = useCallback((index: number, binding: string) => {
    setActionBindings((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], binding };
      return next;
    });
  }, []);

  const removeActionBinding = useCallback((index: number) => {
    setActionBindings((prev) => prev ? prev.filter((_, i) => i !== index) : prev);
  }, []);

  const commitAddActionBinding = useCallback(() => {
    if (!newActionPart.trim()) return;
    setActionBindings((prev) => [
      ...(prev ?? []),
      { action_part: newActionPart.trim(), binding: newActionBindingRef.trim() },
    ]);
    setNewActionPart('');
    setNewActionBindingRef('');
    setShowAddActionBinding(false);
  }, [newActionPart, newActionBindingRef]);

  // ---------------------------------------------------------------------------
  // Save — calls bindSlot / bindProp / bindAction for each binding
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!slots || !props) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Save all slot bindings
      for (const slot of slots) {
        if (!slot.slot_name.trim()) continue;
        const result = await invoke('ComponentMapping', 'bindSlot', {
          mapping: mappingId,
          slot_name: slot.slot_name,
          sources: slot.sources.filter((s) => s.includes(':')),
        });
        if (result.variant !== 'ok') {
          throw new Error(`Failed to bind slot "${slot.slot_name}": ${result.message ?? result.variant}`);
        }
      }

      // Save all prop bindings
      for (const prop of props) {
        if (!prop.prop_name.trim()) continue;
        const result = await invoke('ComponentMapping', 'bindProp', {
          mapping: mappingId,
          prop_name: prop.prop_name,
          source: prop.source,
        });
        if (result.variant !== 'ok') {
          throw new Error(`Failed to bind prop "${prop.prop_name}": ${result.message ?? result.variant}`);
        }
      }

      // Save all action bindings
      for (const ab of (actionBindings ?? [])) {
        if (!ab.action_part.trim()) continue;
        const result = await invoke('ComponentMapping', 'bindAction', {
          mapping: mappingId,
          actionPart: ab.action_part,
          binding: ab.binding,
        });
        if (result.variant !== 'ok') {
          throw new Error(`Failed to bind action "${ab.action_part}": ${result.message ?? result.variant}`);
        }
      }

      setSaveSuccess(true);
      onSaved?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [slots, props, actionBindings, mappingId, invoke, onSaved]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>
        Loading mapping...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        padding: 'var(--spacing-md)',
        background: 'var(--palette-error-container)',
        color: 'var(--palette-on-error-container)',
        borderRadius: 'var(--radius-sm)',
      }}>
        {error ?? 'Mapping not found'}
        {onClose && (
          <button data-part="button" data-variant="outlined" onClick={onClose}
            style={{ marginLeft: 'var(--spacing-md)' }}>
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* Header — mapping metadata */}
      <Card variant="outlined">
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexWrap: 'wrap', gap: 'var(--spacing-sm)',
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: 'var(--typography-title-lg-size)',
              fontWeight: 'var(--typography-title-lg-weight)',
              color: 'var(--palette-on-surface)',
            }}>
              {data.name}
            </h2>
            <div style={{
              display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-xs)',
              flexWrap: 'wrap',
            }}>
              <Badge variant="info">{data.widget_id}</Badge>
              {data.schema && <Badge variant="primary">{data.schema}</Badge>}
              {data.display_mode && <Badge variant="secondary">{data.display_mode}</Badge>}
              {data.widget_variant && <Badge variant="warning">{data.widget_variant}</Badge>}
            </div>
          </div>
          {onClose && (
            <button data-part="button" data-variant="outlined" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </Card>

      {/* Status messages */}
      {saveError && (
        <div style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: 'var(--palette-error-container)',
          color: 'var(--palette-on-error-container)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--typography-body-sm-size)',
        }}>
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: 'var(--palette-success-container, #d4edda)',
          color: 'var(--palette-on-success-container, #155724)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--typography-body-sm-size)',
        }}>
          Bindings saved successfully.
        </div>
      )}

      {/* Slot Bindings */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={sectionHeadingStyle}>Slot Bindings</h3>
          <button data-part="button" data-variant="outlined" onClick={addSlot}>
            + Add Slot
          </button>
        </div>

        {slots && slots.length === 0 && (
          <div style={{
            padding: 'var(--spacing-md)',
            color: 'var(--palette-on-surface-variant)',
            fontSize: 'var(--typography-body-sm-size)',
            fontStyle: 'italic',
          }}>
            No slot bindings configured. Click &quot;Add Slot&quot; to add one.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {slots?.map((slot, slotIdx) => (
            <Card key={slotIdx} variant="outlined">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {/* Slot name row */}
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                  <label style={{
                    fontSize: 'var(--typography-label-md-size)',
                    fontWeight: 'var(--typography-label-md-weight)',
                    color: 'var(--palette-on-surface)',
                    minWidth: '70px',
                  }}>
                    Slot:
                  </label>
                  <input
                    style={inputStyle}
                    type="text"
                    value={slot.slot_name}
                    placeholder="Slot name (e.g. header, body, footer)"
                    onChange={(e) => updateSlotName(slotIdx, e.target.value)}
                  />
                  <button
                    style={{ ...removeButtonStyle, fontWeight: 'bold' }}
                    onClick={() => removeSlot(slotIdx)}
                    title="Remove this slot"
                  >
                    &times;
                  </button>
                </div>

                {/* Sources list */}
                <div style={{
                  paddingLeft: 'var(--spacing-md)',
                  display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)',
                }}>
                  <div style={{
                    fontSize: 'var(--typography-label-sm-size)',
                    color: 'var(--palette-on-surface-variant)',
                    marginBottom: 'var(--spacing-xs)',
                  }}>
                    Sources (rendered in order):
                  </div>
                  {slot.sources.map((src, srcIdx) => (
                    <SourceRow
                      key={srcIdx}
                      source={src}
                      onChange={(v) => updateSlotSource(slotIdx, srcIdx, v)}
                      onRemove={() => removeSlotSource(slotIdx, srcIdx)}
                    />
                  ))}
                  <button
                    data-part="button"
                    data-variant="outlined"
                    onClick={() => addSlotSource(slotIdx)}
                    style={{ alignSelf: 'flex-start', fontSize: 'var(--typography-body-sm-size)' }}
                  >
                    + Add Source
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Prop Bindings */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={sectionHeadingStyle}>Prop Bindings</h3>
          <button data-part="button" data-variant="outlined" onClick={addProp}>
            + Add Prop
          </button>
        </div>

        {props && props.length === 0 && (
          <div style={{
            padding: 'var(--spacing-md)',
            color: 'var(--palette-on-surface-variant)',
            fontSize: 'var(--typography-body-sm-size)',
            fontStyle: 'italic',
          }}>
            No prop bindings configured. Click &quot;Add Prop&quot; to add one.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {props?.map((prop, propIdx) => {
            const parsed = parseSource(prop.source);
            return (
              <div key={propIdx} style={{
                display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center',
                padding: 'var(--spacing-sm)',
                border: '1px solid var(--palette-outline-variant)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <input
                  style={{ ...inputStyle, maxWidth: '160px' }}
                  type="text"
                  value={prop.prop_name}
                  placeholder="Prop name"
                  onChange={(e) => updatePropName(propIdx, e.target.value)}
                />
                <span style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)' }}>
                  =
                </span>
                <select
                  style={selectStyle}
                  value={parsed.type}
                  onChange={(e) =>
                    updatePropSource(propIdx, formatSource(e.target.value as SourceType, parsed.value))
                  }
                >
                  {SOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <input
                  style={inputStyle}
                  type="text"
                  value={parsed.value}
                  placeholder="Value"
                  onChange={(e) =>
                    updatePropSource(propIdx, formatSource(parsed.type, e.target.value))
                  }
                />
                <Badge variant={SOURCE_TYPE_BADGE_VARIANT[parsed.type]}>{parsed.type}</Badge>
                <button style={removeButtonStyle} onClick={() => removeProp(propIdx)} title="Remove prop">
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Action Bindings */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={sectionHeadingStyle}>Action Bindings</h3>
          <button data-part="button" data-variant="outlined" onClick={() => setShowAddActionBinding(true)}>
            + Add Action Binding
          </button>
        </div>

        {actionBindings && actionBindings.length === 0 && !showAddActionBinding && (
          <div style={{
            padding: 'var(--spacing-md)',
            color: 'var(--palette-on-surface-variant)',
            fontSize: 'var(--typography-body-sm-size)',
            fontStyle: 'italic',
          }}>
            No action bindings configured. Click &quot;Add Action Binding&quot; to wire a widget action part to an ActionBinding reference.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {actionBindings?.map((ab, abIdx) => (
            <div key={abIdx} style={{
              display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center',
              padding: 'var(--spacing-sm)',
              border: '1px solid var(--palette-outline-variant)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <input
                style={{ ...inputStyle, maxWidth: '160px' }}
                type="text"
                value={ab.action_part}
                placeholder="Action part (e.g. removeBlock)"
                onChange={(e) => updateActionPart(abIdx, e.target.value)}
              />
              <span style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)' }}>
                &rarr;
              </span>
              <input
                style={inputStyle}
                type="text"
                value={ab.binding}
                placeholder="ActionBinding reference (or leave blank for Unbound)"
                onChange={(e) => updateActionBindingRef(abIdx, e.target.value)}
              />
              {ab.binding
                ? <Badge variant="success">{ab.binding}</Badge>
                : <Badge variant="secondary">Unbound</Badge>
              }
              <button style={removeButtonStyle} onClick={() => removeActionBinding(abIdx)} title="Remove action binding">
                &times;
              </button>
            </div>
          ))}

          {showAddActionBinding && (
            <Card variant="outlined">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                <div style={{
                  fontSize: 'var(--typography-label-md-size)',
                  fontWeight: 'var(--typography-label-md-weight)',
                  color: 'var(--palette-on-surface)',
                }}>
                  New Action Binding
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                  <input
                    style={{ ...inputStyle, maxWidth: '160px' }}
                    type="text"
                    value={newActionPart}
                    placeholder="Action part name"
                    onChange={(e) => setNewActionPart(e.target.value)}
                    autoFocus
                  />
                  <span style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)' }}>
                    &rarr;
                  </span>
                  <input
                    style={inputStyle}
                    type="text"
                    value={newActionBindingRef}
                    placeholder="ActionBinding reference"
                    onChange={(e) => setNewActionBindingRef(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                  <button data-part="button" data-variant="filled" onClick={commitAddActionBinding}>
                    Save
                  </button>
                  <button data-part="button" data-variant="outlined" onClick={() => {
                    setShowAddActionBinding(false);
                    setNewActionPart('');
                    setNewActionBindingRef('');
                  }}>
                    Cancel
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </section>

      {/* Actions */}
      <div style={{
        display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end',
        paddingTop: 'var(--spacing-md)',
        borderTop: '1px solid var(--palette-outline-variant)',
      }}>
        {onClose && (
          <button data-part="button" data-variant="outlined" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        )}
        <button data-part="button" data-variant="filled" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Bindings'}
        </button>
      </div>
    </div>
  );
};

export default SlotSourceEditor;
