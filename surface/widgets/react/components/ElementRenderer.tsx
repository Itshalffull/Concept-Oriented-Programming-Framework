// ============================================================
// ElementRenderer — Given an ElementConfig, renders the
// appropriate HTML input/select/button/etc with proper ARIA
// attributes.  Recursive for group/container elements that
// have children.
//
// Uses mapElementToHTML from the bridge to determine the
// concrete tag, input type, ARIA role, and attributes for
// each abstract ElementKind.
// ============================================================

import React, {
  useMemo,
  useCallback,
  type ReactNode,
  type CSSProperties,
  type ChangeEvent,
} from 'react';

import type { ElementConfig, ElementKind } from '../../shared/types.js';
import { mapElementToHTML, type ElementRenderHint } from '../../shared/surface-bridge.js';

// --------------- Props ---------------

export interface ElementRendererProps {
  /** The Clef Surface element configuration. */
  element: ElementConfig;
  /** Current value for the element (controlled). */
  value?: unknown;
  /** Value change handler. */
  onChange?: (id: string, value: unknown) => void;
  /** Click / trigger handler for buttons and navigation. */
  onTrigger?: (id: string) => void;
  /** Selection options for selection-single / selection-multi elements. */
  options?: Array<{ label: string; value: string }>;
  /** Whether the element is disabled. */
  disabled?: boolean;
  /** Whether the element is read-only. */
  readOnly?: boolean;
  /** Additional class name. */
  className?: string;
  /** Additional inline styles. */
  style?: CSSProperties;
  /**
   * Custom renderer override.  When provided for a given element
   * kind, that function is called instead of the default rendering.
   */
  renderOverride?: (
    element: ElementConfig,
    hint: ElementRenderHint,
    defaultRender: () => ReactNode
  ) => ReactNode;
}

// --------------- Helpers ---------------

function constraintToInputProps(
  constraints: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!constraints) return {};
  const props: Record<string, unknown> = {};

  if (constraints.min !== undefined) props.min = constraints.min;
  if (constraints.max !== undefined) props.max = constraints.max;
  if (constraints.minLength !== undefined) props.minLength = constraints.minLength;
  if (constraints.maxLength !== undefined) props.maxLength = constraints.maxLength;
  if (constraints.pattern !== undefined) props.pattern = constraints.pattern;
  if (constraints.step !== undefined) props.step = constraints.step;
  if (constraints.placeholder !== undefined) props.placeholder = constraints.placeholder;

  return props;
}

// --------------- Component ---------------

export const ElementRenderer: React.FC<ElementRendererProps> = ({
  element,
  value,
  onChange,
  onTrigger,
  options,
  disabled = false,
  readOnly = false,
  className,
  style,
  renderOverride,
}) => {
  const hint = useMemo(() => mapElementToHTML(element.kind), [element.kind]);

  const constraintProps = useMemo(
    () => constraintToInputProps(element.constraints),
    [element.constraints]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      if (!onChange) return;
      const target = e.target;

      if (target instanceof HTMLInputElement && target.type === 'checkbox') {
        onChange(element.id, target.checked);
      } else if (target instanceof HTMLSelectElement && target.multiple) {
        const selected = Array.from(target.selectedOptions).map((o) => o.value);
        onChange(element.id, selected);
      } else {
        onChange(element.id, target.value);
      }
    },
    [onChange, element.id]
  );

  const handleTrigger = useCallback(() => {
    onTrigger?.(element.id);
  }, [onTrigger, element.id]);

  // --- Build ARIA attributes ---
  const ariaProps = useMemo(() => {
    const aria: Record<string, string | boolean> = {};
    if (hint.role) aria['role'] = hint.role;
    if (element.required) aria['aria-required'] = true;
    if (element.label) aria['aria-label'] = element.label;
    if (disabled) aria['aria-disabled'] = true;
    if (readOnly) aria['aria-readonly'] = true;

    // Spread any extra attributes from the hint
    for (const [key, val] of Object.entries(hint.attributes)) {
      aria[key] = val;
    }

    return aria;
  }, [hint, element.required, element.label, disabled, readOnly]);

  // --- Default render logic ---
  const defaultRender = useCallback((): ReactNode => {
    const commonProps = {
      id: element.id,
      className,
      style,
      disabled,
      ...ariaProps,
      'data-surface-element': '',
      'data-element-kind': element.kind,
    };

    // --- Group / Container (recursive) ---
    if (element.kind === 'group' || element.kind === 'container') {
      const Tag = hint.tag as 'fieldset' | 'div';
      return (
        <Tag {...commonProps}>
          {element.kind === 'group' && element.label && (
            <legend>{element.label}</legend>
          )}
          {element.children?.map((child) => (
            <ElementRenderer
              key={child.id}
              element={child}
              onChange={onChange}
              onTrigger={onTrigger}
              disabled={disabled}
              readOnly={readOnly}
            />
          ))}
        </Tag>
      );
    }

    // --- Selection (single or multi) ---
    if (element.kind === 'selection-single' || element.kind === 'selection-multi') {
      const isMulti = element.kind === 'selection-multi';
      return (
        <div {...commonProps}>
          {element.label && (
            <label htmlFor={`${element.id}-select`}>{element.label}</label>
          )}
          <select
            id={`${element.id}-select`}
            multiple={isMulti}
            value={
              isMulti
                ? Array.isArray(value) ? value as string[] : []
                : (value as string) ?? ''
            }
            onChange={handleChange}
            disabled={disabled}
            aria-label={element.label}
            {...(hint.role ? { role: hint.role } : {})}
          >
            {!isMulti && (
              <option value="" disabled>
                Select...
              </option>
            )}
            {(options ?? (element.constraints?.options as Array<{ label: string; value: string }>) ?? []).map(
              (opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              )
            )}
          </select>
        </div>
      );
    }

    // --- Trigger (button) ---
    if (element.kind === 'trigger') {
      return (
        <button
          {...commonProps}
          type="button"
          onClick={handleTrigger}
        >
          {element.label}
        </button>
      );
    }

    // --- Navigation (anchor) ---
    if (element.kind === 'navigation') {
      return (
        <a
          {...commonProps}
          href={(value as string) ?? '#'}
          onClick={(e) => {
            e.preventDefault();
            handleTrigger();
          }}
        >
          {element.label}
        </a>
      );
    }

    // --- Output elements ---
    if (element.kind.startsWith('output-')) {
      const Tag = hint.tag as 'span' | 'time';
      return (
        <div data-surface-element="" data-element-kind={element.kind} className={className} style={style}>
          {element.label && (
            <label>{element.label}</label>
          )}
          <Tag {...ariaProps}>
            {value !== undefined && value !== null ? String(value) : ''}
          </Tag>
        </div>
      );
    }

    // --- Rich text ---
    if (element.kind === 'rich-text') {
      return (
        <div data-surface-element="" data-element-kind={element.kind} className={className} style={style}>
          {element.label && (
            <label htmlFor={`${element.id}-richtext`}>{element.label}</label>
          )}
          <div
            id={`${element.id}-richtext`}
            contentEditable={!readOnly && !disabled}
            role="textbox"
            aria-label={element.label}
            aria-multiline="true"
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: (value as string) ?? '' }}
          />
        </div>
      );
    }

    // --- File upload ---
    if (element.kind === 'file-upload') {
      return (
        <div data-surface-element="" data-element-kind={element.kind} className={className} style={style}>
          {element.label && (
            <label htmlFor={`${element.id}-file`}>{element.label}</label>
          )}
          <input
            id={`${element.id}-file`}
            type="file"
            onChange={(e) => {
              onChange?.(element.id, e.target.files);
            }}
            disabled={disabled}
            aria-label={element.label}
            {...constraintProps}
          />
        </div>
      );
    }

    // --- Media display ---
    if (element.kind === 'media-display') {
      return (
        <figure data-surface-element="" data-element-kind={element.kind} className={className} style={style}>
          {value && (
            <img src={value as string} alt={element.label} />
          )}
          {element.label && <figcaption>{element.label}</figcaption>}
        </figure>
      );
    }

    // --- Default: input elements (text, number, date, bool) ---
    const inputType = hint.inputType ?? 'text';
    const isBool = element.kind === 'input-bool';

    return (
      <div data-surface-element="" data-element-kind={element.kind} className={className} style={style}>
        {element.label && (
          <label htmlFor={`${element.id}-input`}>{element.label}</label>
        )}
        <input
          id={`${element.id}-input`}
          type={inputType}
          checked={isBool ? (value as boolean) ?? false : undefined}
          value={!isBool ? (value as string) ?? '' : undefined}
          onChange={handleChange}
          disabled={disabled}
          readOnly={readOnly}
          required={element.required}
          aria-label={element.label}
          {...(hint.role ? { role: hint.role } : {})}
          {...constraintProps}
        />
      </div>
    );
  }, [
    element, hint, className, style, disabled, readOnly, ariaProps,
    constraintProps, value, options, onChange, onTrigger,
    handleChange, handleTrigger,
  ]);

  // --- Allow render override ---
  if (renderOverride) {
    return <>{renderOverride(element, hint, defaultRender)}</>;
  }

  return <>{defaultRender()}</>;
};

ElementRenderer.displayName = 'ElementRenderer';
export default ElementRenderer;
