'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { smdReducer } from './StateMachineDiagram.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface StateDef {
  name: string;
  flags: string[];
}

export interface TransitionDef {
  id?: string;
  from: string;
  to: string;
  label: string;
}

export interface StateMachineDiagramProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** State definitions. */
  states: StateDef[];
  /** Transition definitions. */
  transitions: TransitionDef[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Available flags. */
  availableFlags?: string[];
  /** Called when states change. */
  onStatesChange?: (states: StateDef[]) => void;
  /** Called when transitions change. */
  onTransitionsChange?: (transitions: TransitionDef[]) => void;
  /** State form slot. */
  stateForm?: ReactNode;
  /** Transition form slot. */
  transitionForm?: ReactNode;
  /** Confirm dialog slot. */
  confirmDialog?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const StateMachineDiagram = forwardRef<HTMLDivElement, StateMachineDiagramProps>(
  function StateMachineDiagram(
    {
      states: stateDefs,
      transitions,
      ariaLabel = 'State machine diagram',
      readOnly = false,
      availableFlags = ['initial', 'published', 'default-revision'],
      onStatesChange,
      onTransitionsChange,
      stateForm,
      transitionForm,
      confirmDialog,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(smdReducer, 'viewing');

    const handleStateKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>, name: string) => {
        if (e.key === 'Enter') { e.preventDefault(); send({ type: 'EDIT_STATE', name }); }
        if (e.key === 'Delete') { e.preventDefault(); send({ type: 'DELETE_STATE', name }); }
      },
      [],
    );

    const handleTransitionKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>, id: string) => {
        if (e.key === 'Enter') { e.preventDefault(); send({ type: 'EDIT_TRANSITION', id }); }
        if (e.key === 'Delete') { e.preventDefault(); send({ type: 'DELETE_TRANSITION', id }); }
      },
      [],
    );

    return (
      <div
        ref={ref}
        role="region"
        aria-label={ariaLabel}
        aria-roledescription="state machine diagram"
        data-surface-widget=""
        data-widget-name="state-machine-diagram"
        data-state={state}
        data-readonly={readOnly ? 'true' : 'false'}
        data-state-count={stateDefs.length}
        data-transition-count={transitions.length}
        {...rest}
      >
        <div role="list" aria-label="States" data-part="state-list">
          {stateDefs.map((s) => (
            <div
              key={s.name}
              role="listitem"
              aria-label={`State: ${s.name}`}
              aria-current={s.flags.includes('initial') ? 'true' : undefined}
              data-state-name={s.name}
              data-flags={s.flags.join(',')}
              tabIndex={0}
              onClick={() => send({ type: 'EDIT_STATE', name: s.name })}
              onKeyDown={(e) => handleStateKeyDown(e, s.name)}
            >
              <span data-part="state-name">{s.name}</span>
              <div data-part="state-flags" role="group" aria-label={`Flags for ${s.name}`}>
                {s.flags.map((f) => (
                  <span key={f} data-part="flag">{f}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div role="list" aria-label="Transitions" data-part="transition-list">
          {transitions.map((t, i) => {
            const tid = t.id ?? `${t.from}-${t.to}-${i}`;
            return (
              <div
                key={tid}
                role="listitem"
                aria-label={`Transition: ${t.from} to ${t.to} via ${t.label}`}
                data-from={t.from}
                data-to={t.to}
                tabIndex={0}
                onClick={() => send({ type: 'EDIT_TRANSITION', id: tid })}
                onKeyDown={(e) => handleTransitionKeyDown(e, tid)}
              >
                <span data-part="transition-from">{t.from}</span>
                <span data-part="transition-arrow" aria-hidden="true">{'\u2192'}</span>
                <span data-part="transition-to">{t.to}</span>
                <span data-part="transition-label">{t.label}</span>
              </div>
            );
          })}
        </div>

        {!readOnly && (
          <>
            <button
              type="button"
              role="button"
              aria-label="Add state"
              data-part="add-state"
              data-visible="true"
              onClick={() => send({ type: 'ADD_STATE' })}
            >
              Add State
            </button>
            <button
              type="button"
              role="button"
              aria-label="Add transition"
              data-part="add-transition"
              data-visible="true"
              onClick={() => send({ type: 'ADD_TRANSITION' })}
            >
              Add Transition
            </button>
          </>
        )}

        {(state === 'addingState' || state === 'editingState') && stateForm}
        {(state === 'addingTransition' || state === 'editingTransition') && transitionForm}
        {(state === 'confirmingDeleteState' || state === 'confirmingDeleteTransition') && confirmDialog}
      </div>
    );
  },
);

StateMachineDiagram.displayName = 'StateMachineDiagram';
export { StateMachineDiagram };
export default StateMachineDiagram;
