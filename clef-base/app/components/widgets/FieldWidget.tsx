'use client';

import React, { useState, useCallback, useId } from 'react';
import type { SchemaField } from './FormMode';
import { validateField, parseValidationRules } from '../../../lib/form-validation';

// ---------------------------------------------------------------------------
// FieldTypeRegistry — maps type strings to renderer config
// ---------------------------------------------------------------------------

export interface FieldTypeConfig {
  component:
    | 'text'
    | 'textarea'
    | 'number'
    | 'date'
    | 'datetime'
    | 'boolean'
    | 'select'
    | 'multi-select'
    | 'relation'
    | 'media'
    | 'url'
    | 'email'
    | 'rich-text'
    | 'json'
    | 'person'
    | 'file'
    | 'rating'
    | 'currency'
    | 'percentage';
  label: string;
  icon: string;
  group: 'text' | 'number' | 'date' | 'choice' | 'reference' | 'special';
}

export const FIELD_TYPE_REGISTRY: Record<string, FieldTypeConfig> = {
  text:         { component: 'text',         label: 'Text',         icon: 'T',  group: 'text'      },
  textarea:     { component: 'textarea',     label: 'Long Text',    icon: '¶',  group: 'text'      },
  'rich-text':  { component: 'rich-text',    label: 'Rich Text',    icon: '✎',  group: 'text'      },
  url:          { component: 'url',          label: 'URL',          icon: '🔗', group: 'text'      },
  email:        { component: 'email',        label: 'Email',        icon: '@',  group: 'text'      },
  number:       { component: 'number',       label: 'Number',       icon: '#',  group: 'number'    },
  currency:     { component: 'currency',     label: 'Currency',     icon: '$',  group: 'number'    },
  percentage:   { component: 'percentage',   label: 'Percentage',   icon: '%',  group: 'number'    },
  rating:       { component: 'rating',       label: 'Rating',       icon: '★',  group: 'number'    },
  date:         { component: 'date',         label: 'Date',         icon: '📅', group: 'date'      },
  datetime:     { component: 'datetime',     label: 'Date & Time',  icon: '🕐', group: 'date'      },
  boolean:      { component: 'boolean',      label: 'Boolean',      icon: '✓',  group: 'choice'    },
  select:       { component: 'select',       label: 'Select',       icon: '▾',  group: 'choice'    },
  'multi-select': { component: 'multi-select', label: 'Multi-Select', icon: '⊞', group: 'choice'  },
  relation:     { component: 'relation',     label: 'Relation',     icon: '↗',  group: 'reference' },
  person:       { component: 'person',       label: 'Person',       icon: '👤', group: 'reference' },
  media:        { component: 'media',        label: 'Media',        icon: '🖼',  group: 'special'   },
  file:         { component: 'file',         label: 'File',         icon: '📎', group: 'special'   },
  json:         { component: 'json',         label: 'JSON',         icon: '{}', group: 'special'   },
};

// ---------------------------------------------------------------------------
// FieldWidget props
// ---------------------------------------------------------------------------

interface FieldWidgetProps {
  field: SchemaField;
  value: unknown;
  onChange: (value: unknown) => void;
}

// ---------------------------------------------------------------------------
// Sub-renderers
// ---------------------------------------------------------------------------

// --- Text ---
const TextInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field, value, onChange, hasError, errId }) => {
  const str = String(value ?? '');
  const maxLen = getMaxLength(field);
  return (
    <div style={{ position: 'relative' }} data-part="text-input-wrapper">
      <input
        type="text"
        value={str}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        aria-describedby={hasError ? errId : undefined}
        aria-invalid={hasError || undefined}
        data-surface="mag651-field-control"
        data-state={hasError ? 'error' : 'idle'}
        data-part="field-input"
      />
      {maxLen != null && (
        <span style={{ position: 'absolute', right: 'var(--spacing-sm)', bottom: 'var(--spacing-xs)' }} data-part="field-meta">
          {str.length}/{maxLen}
        </span>
      )}
    </div>
  );
};

// --- Textarea ---
const TextareaInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field, value, onChange, hasError, errId }) => {
  const str = String(value ?? '');
  const maxLen = getMaxLength(field);
  return (
    <div style={{ position: 'relative' }} data-part="textarea-wrapper">
      <textarea
        value={str}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={field.placeholder}
        aria-describedby={hasError ? errId : undefined}
        aria-invalid={hasError || undefined}
        data-surface="mag651-field-control"
        data-state={hasError ? 'error' : 'idle'}
        data-part="field-textarea"
      />
      {maxLen != null && (
        <span style={{ display: 'block', textAlign: 'right' }} data-part="field-meta">
          {str.length}/{maxLen}
        </span>
      )}
    </div>
  );
};

// --- Rich Text (mini textarea — full block editor too heavy) ---
const RichTextInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field, value, onChange, hasError, errId }) => (
  <div data-part="rich-text-wrapper">
    <textarea
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      rows={5}
      placeholder={field.placeholder ?? 'Rich text (markdown supported)'}
      aria-describedby={hasError ? errId : undefined}
      aria-invalid={hasError || undefined}
      data-surface="mag651-field-control"
      data-state={hasError ? 'error' : 'idle'}
      data-part="field-rich-text-input"
    />
    <span data-part="field-hint">
      Basic implementation — full block editor upgrade pending
    </span>
  </div>
);

// --- Number ---
const NumberInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field, value, onChange, hasError, errId }) => {
  const { min, max, step } = getNumericParams(field);
  return (
    <input
      type="number"
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      placeholder={field.placeholder}
      min={min}
      max={max}
      step={step}
      aria-describedby={hasError ? errId : undefined}
      aria-invalid={hasError || undefined}
      data-surface="mag651-field-control"
      data-state={hasError ? 'error' : 'idle'}
      data-part="field-number-input"
    />
  );
};

// --- Currency ---
const CurrencyInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field, value, onChange, hasError, errId }) => (
  <div data-surface="mag651-field-control-group" data-layout="inline" data-part="currency-wrapper">
    <span data-part="field-addon" data-edge="start">$</span>
    <input
      type="number"
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      placeholder={field.placeholder ?? '0.00'}
      step="0.01"
      min="0"
      aria-describedby={hasError ? errId : undefined}
      aria-invalid={hasError || undefined}
      data-surface="mag651-field-control"
      data-state={hasError ? 'error' : 'idle'}
      data-part="field-currency-input"
    />
  </div>
);

// --- Percentage ---
const PercentageInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field, value, onChange, hasError, errId }) => (
  <div data-surface="mag651-field-control-group" data-layout="inline" data-part="percentage-wrapper">
    <input
      type="number"
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      placeholder={field.placeholder ?? '0'}
      step="1"
      min="0"
      max="100"
      aria-describedby={hasError ? errId : undefined}
      aria-invalid={hasError || undefined}
      data-surface="mag651-field-control"
      data-state={hasError ? 'error' : 'idle'}
      data-part="field-percentage-input"
    />
    <span data-part="field-addon" data-edge="end">%</span>
  </div>
);

// --- Date ---
const DateInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field, value, onChange, hasError, errId }) => (
  <input
    type="date"
    value={String(value ?? '')}
    onChange={(e) => onChange(e.target.value)}
    aria-describedby={hasError ? errId : undefined}
    aria-invalid={hasError || undefined}
    data-surface="mag651-field-control"
    data-state={hasError ? 'error' : 'idle'}
    data-part="field-date-input"
  />
);

// --- DateTime ---
const DateTimeInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field, value, onChange, hasError, errId }) => (
  <input
    type="datetime-local"
    value={String(value ?? '')}
    onChange={(e) => onChange(e.target.value)}
    aria-describedby={hasError ? errId : undefined}
    aria-invalid={hasError || undefined}
    data-surface="mag651-field-control"
    data-state={hasError ? 'error' : 'idle'}
    data-part="field-datetime-input"
  />
);

// --- Boolean toggle ---
const BooleanToggle: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void }> = ({ field: _field, value, onChange }) => {
  const checked = Boolean(value);
  return (
    <label data-surface="mag651-toggle" data-part="boolean-label">
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        data-surface="mag651-toggle-track"
        data-state={checked ? 'on' : 'off'}
      >
        <span data-surface="mag651-toggle-thumb" data-part="toggle-thumb" />
      </span>
      <span data-part="toggle-label">
        {checked ? 'Yes' : 'No'}
      </span>
    </label>
  );
};

// --- Select with search ---
const SelectInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field, value, onChange, hasError, errId }) => {
  const [search, setSearch] = useState('');
  const options = field.options ?? [];
  const filtered = search ? options.filter(o => o.toLowerCase().includes(search.toLowerCase())) : options;

  return (
    <div data-part="select-wrapper">
      {options.length > 6 && (
        <input
          type="text"
          placeholder="Search options..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-surface="mag651-field-control"
          data-kind="search"
          data-part="field-select-search"
        />
      )}
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hasError ? errId : undefined}
        aria-invalid={hasError || undefined}
        data-surface="mag651-field-control"
        data-state={hasError ? 'error' : 'idle'}
        data-part="field-select-input"
      >
        <option value="">Select...</option>
        {filtered.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
};

// --- Multi-select tag chip picker ---
const MultiSelectInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field, value, onChange, hasError, errId }) => {
  const [open, setOpen] = useState(false);
  const selected: string[] = Array.isArray(value) ? (value as string[]) : (typeof value === 'string' && value ? value.split(',').map(s => s.trim()) : []);
  const options = field.options ?? [];
  const available = options.filter(o => !selected.includes(o));

  const add = (opt: string) => {
    onChange([...selected, opt]);
  };
  const remove = (opt: string) => {
    onChange(selected.filter(s => s !== opt));
  };

  return (
    <div data-part="multi-select-wrapper" style={{ position: 'relative' }}>
      <div
        data-surface="mag651-field-control"
        data-state={hasError ? 'error' : 'idle'}
        data-layout="wrap"
        onClick={() => setOpen(o => !o)}
        aria-describedby={hasError ? errId : undefined}
        data-part="field-multiselect-display"
      >
        {selected.length === 0 && (
          <span style={{ opacity: 0.5 }} data-part="field-placeholder">{field.placeholder ?? 'Select values...'}</span>
        )}
        {selected.map(s => (
          <span
            key={s}
            data-part="field-chip"
          >
            {s}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(s); }}
              data-part="field-chip-remove"
              aria-label={`Remove ${s}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {open && available.length > 0 && (
        <div data-surface="mag651-field-dropdown" data-part="multi-select-dropdown">
          {available.map(opt => (
            <div
              key={opt}
              onClick={() => { add(opt); setOpen(false); }}
              data-part="field-dropdown-option"
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- URL ---
const UrlInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field, value, onChange, hasError, errId }) => {
  const str = String(value ?? '');
  return (
    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }} data-part="url-wrapper">
      <input
        type="url"
        value={str}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? 'https://'}
        aria-describedby={hasError ? errId : undefined}
        aria-invalid={hasError || undefined}
        data-surface="mag651-field-control"
        data-state={hasError ? 'error' : 'idle'}
        data-part="field-url-input"
      />
      {str && (
        <a
          href={str}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open link in new tab"
          data-part="field-link-out"
        >
          ↗
        </a>
      )}
    </div>
  );
};

// --- Email ---
const EmailInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field, value, onChange, hasError, errId }) => (
  <div data-part="email-wrapper">
    <input
      type="email"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? 'name@example.com'}
      aria-describedby={hasError ? errId : undefined}
      aria-invalid={hasError || undefined}
      data-surface="mag651-field-control"
      data-state={hasError ? 'error' : 'idle'}
      data-part="field-email-input"
    />
  </div>
);

// --- Relation (basic text input with type indicator — picker upgrade pending) ---
const RelationInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field, value, onChange, hasError, errId }) => (
  <div data-part="relation-wrapper">
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? 'Enter entity ID or name'}
      aria-describedby={hasError ? errId : undefined}
      aria-invalid={hasError || undefined}
      data-surface="mag651-field-control"
      data-state={hasError ? 'error' : 'idle'}
      data-part="field-relation-input"
    />
    <span data-part="field-hint">
      Relation — picker upgrade pending
    </span>
  </div>
);

// --- Person (basic text input with user search hint — picker upgrade pending) ---
const PersonInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field, value, onChange, hasError, errId }) => (
  <div data-part="person-wrapper">
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? 'Search for a user'}
      aria-describedby={hasError ? errId : undefined}
      aria-invalid={hasError || undefined}
      data-surface="mag651-field-control"
      data-state={hasError ? 'error' : 'idle'}
      data-part="field-person-input"
    />
    <span data-part="field-hint">
      Person — user picker upgrade pending
    </span>
  </div>
);

// --- Media (drag-drop zone + file input + preview) ---
const MediaInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field: _field, value, onChange, hasError, errId }) => {
  const [dragOver, setDragOver] = useState(false);
  const fileUrl = typeof value === 'string' ? value : null;
  const isImage = fileUrl && /\.(png|jpe?g|gif|webp|svg)$/i.test(fileUrl);

  const handleFile = useCallback((file: File) => {
    // Produce an object-URL for preview (real upload is backend concern via sync)
    const url = URL.createObjectURL(file);
    onChange(url);
  }, [onChange]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
      aria-describedby={hasError ? errId : undefined}
      data-surface="mag651-field-control"
      data-part="media-dropzone"
      data-state={dragOver ? 'drag-over' : hasError ? 'error' : 'idle'}
    >
      {isImage ? (
        <img
          src={fileUrl}
          alt="Preview"
          style={{ maxWidth: '100%', maxHeight: '120px', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--spacing-sm)' }}
          data-part="media-preview"
        />
      ) : fileUrl ? (
        <div style={{ marginBottom: 'var(--spacing-sm)', fontSize: 'var(--typography-body-sm-size)' }} data-part="media-filename">
          {fileUrl}
        </div>
      ) : null}
      <label style={{ cursor: 'pointer' }} data-part="media-label">
        <span style={{ color: 'var(--palette-primary)', textDecoration: 'underline', fontSize: 'var(--typography-body-md-size)' }}>
          Choose file
        </span>
        {' or drag and drop'}
        <input
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          data-part="media-file-input"
        />
      </label>
      <div data-part="field-hint">
        Media — upload integration pending
      </div>
    </div>
  );
};

// --- File (file input with filename display) ---
const FileInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field: _field, value, onChange, hasError, errId }) => {
  const fileName = typeof value === 'string' ? value : null;
  return (
    <div data-part="file-wrapper">
      {fileName && (
        <div data-part="field-meta" style={{ color: 'var(--palette-primary)' }}>
          {fileName}
        </div>
      )}
      <input
        type="file"
        aria-describedby={hasError ? errId : undefined}
        aria-invalid={hasError || undefined}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onChange(file.name);
        }}
        data-part="file-input"
      />
    </div>
  );
};

// --- Rating (1-5 stars) ---
const RatingInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field: _field, value, onChange, hasError, errId }) => {
  const [hovered, setHovered] = useState(0);
  const rating = typeof value === 'number' ? value : Number(value) || 0;
  return (
    <div style={{ display: 'flex', gap: '4px' }} aria-describedby={hasError ? errId : undefined} data-part="rating-wrapper">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '24px',
            color: star <= (hovered || rating)
              ? 'var(--palette-primary)'
              : 'var(--palette-outline)',
            padding: 0,
            lineHeight: 1,
            transition: 'color 0.1s',
          }}
          data-part="star"
          data-state={star <= (hovered || rating) ? 'filled' : 'empty'}
        >
          ★
        </button>
      ))}
    </div>
  );
};

// --- JSON ---
const JsonInput: React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; hasError: boolean; errId: string }> = ({ field: _field, value, onChange, hasError, errId }) => {
  const [jsonValid, setJsonValid] = useState<boolean | null>(null);
  const strVal = typeof value === 'string' ? value : JSON.stringify(value ?? '', null, 2);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const str = e.target.value;
    onChange(str);
    try {
      JSON.parse(str);
      setJsonValid(true);
    } catch {
      setJsonValid(str === '' ? null : false);
    }
  };

  return (
    <div data-part="json-wrapper">
      <textarea
        value={strVal}
        onChange={handleChange}
        rows={5}
        aria-describedby={hasError ? errId : undefined}
        aria-invalid={hasError || undefined}
        style={{
          fontFamily: 'var(--typography-font-family-mono)',
          fontSize: 'var(--typography-code-sm-size)',
          resize: 'vertical',
        }}
        data-surface="mag651-field-control"
        data-state={hasError ? 'error' : 'idle'}
        data-part="field-json-input"
      />
      {jsonValid === false && (
        <span data-part="field-error">
          Invalid JSON
        </span>
      )}
      {jsonValid === true && (
        <span style={{ color: 'var(--palette-success)' }} data-part="field-hint">
          Valid JSON
        </span>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMaxLength(field: SchemaField): number | null {
  if (!field.validations) return null;
  const rules = parseValidationRules(field.validations);
  const rule = rules.find(r => r.type === 'max-length');
  return rule ? (rule.params.max as number) : null;
}

function getNumericParams(field: SchemaField): { min?: number; max?: number; step?: number } {
  if (!field.validations) return {};
  const rules = parseValidationRules(field.validations);
  const minRule = rules.find(r => r.type === 'min-value');
  const maxRule = rules.find(r => r.type === 'max-value');
  return {
    min: minRule ? (minRule.params.min as number) : undefined,
    max: maxRule ? (maxRule.params.max as number) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Main FieldWidget
// ---------------------------------------------------------------------------

export const FieldWidget: React.FC<FieldWidgetProps> = ({ field, value, onChange }) => {
  const [touched, setTouched] = useState(false);
  const errorId = useId();

  const rules = field.validations ? parseValidationRules(field.validations) : [];
  const errors = touched && rules.length > 0 ? validateField(value, rules) : [];
  const hasError = errors.length > 0;

  const handleBlur = useCallback(() => setTouched(true), []);
  const handleChange = useCallback((v: unknown) => {
    onChange(v);
    // Re-validate after change once touched
  }, [onChange]);

  const type = field.type ?? 'text';

  const renderInput = () => {
    switch (type) {
      case 'textarea':
        return <TextareaInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'rich-text':
        return <RichTextInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'number':
        return <NumberInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'currency':
        return <CurrencyInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'percentage':
        return <PercentageInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'date':
        return <DateInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'datetime':
        return <DateTimeInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'boolean':
        return <BooleanToggle field={field} value={value} onChange={handleChange} />;
      case 'select':
        return <SelectInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'multi-select':
        return <MultiSelectInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'url':
        return <UrlInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'email':
        return <EmailInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'relation':
        return <RelationInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'person':
        return <PersonInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'media':
        return <MediaInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'file':
        return <FileInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'rating':
        return <RatingInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      case 'json':
        return <JsonInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
      default:
        // Handles 'text' and any unknown type — backward compatible default
        return <TextInput field={field} value={value} onChange={handleChange} hasError={hasError} errId={errorId} />;
    }
  };

  return (
    <div
      onBlur={handleBlur}
      data-part="field-widget"
      data-type={type}
      data-state={hasError ? 'error' : touched ? 'touched' : 'idle'}
    >
      {renderInput()}
      {field.helpText && !hasError && (
        <span
          data-part="field-help"
        >
          {field.helpText}
        </span>
      )}
      {hasError && (
        <div
          id={errorId}
          role="alert"
          data-part="field-error"
        >
          {errors.map((err, i) => (
            <div key={i} data-part="field-error-message">{err}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FieldWidget;
