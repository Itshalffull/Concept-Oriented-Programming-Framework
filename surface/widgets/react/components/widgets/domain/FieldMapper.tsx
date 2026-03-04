/* ---------------------------------------------------------------------------
 * FieldMapper state machine
 * States: idle (initial), editing, picking
 * ------------------------------------------------------------------------- */

export type FMState = 'idle' | 'editing' | 'picking';
export type FMEvent =
  | { type: 'FOCUS_INPUT'; target: string }
  | { type: 'BLUR' }
  | { type: 'OPEN_PICKER'; target: string }
  | { type: 'SELECT_FIELD' }
  | { type: 'CLOSE_PICKER' }
  | { type: 'ESCAPE' }
  | { type: 'INSERT_TOKEN' };

export function fmReducer(state: FMState, event: FMEvent): FMState {
  switch (state) {
    case 'idle':
      if (event.type === 'FOCUS_INPUT') return 'editing';
      if (event.type === 'OPEN_PICKER') return 'picking';
      return state;
    case 'editing':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'OPEN_PICKER') return 'picking';
      if (event.type === 'INSERT_TOKEN') return 'editing';
      return state;
    case 'picking':
      if (event.type === 'SELECT_FIELD') return 'editing';
      if (event.type === 'CLOSE_PICKER') return 'editing';
      if (event.type === 'ESCAPE') return 'editing';
      return state;
    default:
      return state;
  }
}


import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { fmReducer } from './FieldMapper.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface TargetFieldDef {
  name: string;
  type: string;
  required: boolean;
}

export interface SourceFieldGroup {
  stepName: string;
  fields: Array<{ name: string; type: string }>;
}

export interface MappingEntry {
  targetName: string;
  value: string;
  tokens: Array<{ field: string; step: string }>;
}

export interface FieldMapperProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Target fields. */
  targetFields: TargetFieldDef[];
  /** Source fields grouped by step. */
  sourceFields: SourceFieldGroup[];
  /** Current mappings. */
  mappings: MappingEntry[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Called on mapping change. */
  onMappingChange?: (mappings: MappingEntry[]) => void;
  /** Called on token insert. */
  onTokenInsert?: (targetName: string, field: string, step: string) => void;
  /** Field picker slot. */
  fieldPicker?: ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const FieldMapper = forwardRef<HTMLDivElement, FieldMapperProps>(function FieldMapper(
  {
    targetFields,
    sourceFields,
    mappings,
    ariaLabel = 'Field Mapper',
    readOnly = false,
    onMappingChange,
    onTokenInsert,
    fieldPicker,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(fmReducer, 'idle');

  const getMapping = useCallback(
    (targetName: string) => mappings.find((m) => m.targetName === targetName),
    [mappings],
  );

  return (
    <div
      ref={ref}
      role="group"
      aria-label={ariaLabel}
      aria-roledescription="field mapper"
      data-surface-widget=""
      data-widget-name="field-mapper"
      data-state={state}
      data-readonly={readOnly ? 'true' : 'false'}
      data-field-count={targetFields.length}
      {...rest}
    >
      {targetFields.map((field, index) => {
        const mapping = getMapping(field.name);
        const hasTokens = (mapping?.tokens.length ?? 0) > 0;

        return (
          <div
            key={field.name}
            role="group"
            aria-label={`Mapping for ${field.name}`}
            data-part="mapping-row"
            data-target={field.name}
            data-required={field.required ? 'true' : 'false'}
            data-filled={mapping?.value ? 'true' : 'false'}
          >
            <div data-part="target-field" data-type={field.type} data-required={field.required ? 'true' : 'false'}>
              <span data-part="target-label" id={`target-${index}`}>
                {field.name}
              </span>
            </div>

            <div
              data-part="mapping-input"
              role="textbox"
              aria-label={`Value for ${field.name}`}
              aria-labelledby={`target-${index}`}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              data-has-tokens={hasTokens ? 'true' : 'false'}
              onFocus={() => send({ type: 'FOCUS_INPUT', target: field.name })}
              onBlur={() => send({ type: 'BLUR' })}
            >
              {mapping?.value}
            </div>

            {!readOnly && (
              <button
                type="button"
                role="button"
                aria-label={`Insert field token for ${field.name}`}
                aria-haspopup="dialog"
                aria-expanded={state === 'picking' || undefined}
                data-part="insert-field"
                data-visible="true"
                tabIndex={-1}
                onClick={() => send({ type: 'OPEN_PICKER', target: field.name })}
              >
                {'{'}...{'}'}
              </button>
            )}
          </div>
        );
      })}

      {state === 'picking' && (
        <div data-part="field-picker" role="dialog" aria-label="Select source field" data-state="open">
          {fieldPicker ?? (
            <div>
              {sourceFields.map((group) => (
                <div key={group.stepName} data-part="field-group">
                  <span data-part="group-label">{group.stepName}</span>
                  {group.fields.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      data-part="source-field"
                      data-field-name={f.name}
                      data-field-type={f.type}
                      onClick={() => {
                        onTokenInsert?.('', f.name, group.stepName);
                        send({ type: 'SELECT_FIELD' });
                      }}
                    >
                      {f.name} ({f.type})
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
});

FieldMapper.displayName = 'FieldMapper';
export { FieldMapper };
export default FieldMapper;
