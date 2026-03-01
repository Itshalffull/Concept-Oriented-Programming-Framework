'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useReducer,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';

import { slashMenuReducer } from './SlashMenu.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface BlockTypeDef {
  label: string;
  description: string;
  icon: string;
  group: string;
}

export interface SlashMenuProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Available block types. */
  blockTypes: BlockTypeDef[];
  /** Whether the menu is open. */
  open?: boolean;
  /** Maximum visible items before scroll. */
  maxVisible?: number;
  /** Position for the floating menu. */
  position?: { x: number; y: number };
  /** Called when a block type is selected. */
  onSelect?: (type: BlockTypeDef) => void;
  /** Called when the menu closes. */
  onClose?: () => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const SlashMenu = forwardRef<HTMLDivElement, SlashMenuProps>(function SlashMenu(
  {
    blockTypes,
    open: controlledOpen = false,
    maxVisible = 10,
    position,
    onSelect,
    onClose,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(slashMenuReducer, controlledOpen ? 'open' : 'closed');
  const [filterValue, setFilterValue] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (controlledOpen && state === 'closed') send({ type: 'OPEN' });
  }, [controlledOpen, state]);

  useEffect(() => {
    if (state === 'open' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state]);

  const filtered = blockTypes.filter(
    (bt) =>
      bt.label.toLowerCase().includes(filterValue.toLowerCase()) ||
      bt.description.toLowerCase().includes(filterValue.toLowerCase()),
  );

  const groups = Array.from(new Set(filtered.map((bt) => bt.group)));

  const flatFiltered = filtered.slice(0, maxVisible);

  const handleFilter = useCallback(
    (value: string) => {
      setFilterValue(value);
      setHighlightIndex(0);
      const matches = blockTypes.filter(
        (bt) =>
          bt.label.toLowerCase().includes(value.toLowerCase()) ||
          bt.description.toLowerCase().includes(value.toLowerCase()),
      );
      if (matches.length === 0) {
        send({ type: 'FILTER_EMPTY' });
      } else {
        send({ type: 'INPUT' });
      }
    },
    [blockTypes],
  );

  const handleSelect = useCallback(
    (bt: BlockTypeDef) => {
      onSelect?.(bt);
      send({ type: 'SELECT' });
      setFilterValue('');
      onClose?.();
    },
    [onSelect, onClose],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (flatFiltered[highlightIndex]) handleSelect(flatFiltered[highlightIndex]);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        send({ type: 'ESCAPE' });
        setFilterValue('');
        onClose?.();
      }
      if (e.key === 'Home') {
        e.preventDefault();
        setHighlightIndex(0);
      }
      if (e.key === 'End') {
        e.preventDefault();
        setHighlightIndex(flatFiltered.length - 1);
      }
    },
    [flatFiltered, highlightIndex, handleSelect, onClose],
  );

  const isVisible = state === 'open' || state === 'empty';

  if (!isVisible) return null;

  return (
    <div
      ref={ref}
      data-surface-widget=""
      data-widget-name="slash-menu"
      data-part="slash-menu"
      data-state={state}
      style={{
        position: 'absolute',
        top: position ? `${position.y}px` : 'auto',
        left: position ? `${position.x}px` : 'auto',
      }}
      {...rest}
    >
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        value={filterValue}
        placeholder="Filter..."
        aria-expanded={state === 'open'}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        autoComplete="off"
        data-part="input"
        onChange={(e) => handleFilter(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { send({ type: 'BLUR' }); onClose?.(); }}
      />

      <div role="listbox" aria-label="Block types" data-part="groups">
        {groups.map((groupName) => {
          const groupItems = flatFiltered.filter((bt) => bt.group === groupName);
          if (groupItems.length === 0) return null;
          return (
            <div
              key={groupName}
              role="group"
              aria-labelledby={`group-label-${groupName}`}
              data-group={groupName}
            >
              <span
                id={`group-label-${groupName}`}
                data-part="group-label"
                aria-hidden="true"
              >
                {groupName}
              </span>
              {groupItems.map((bt) => {
                const globalIdx = flatFiltered.indexOf(bt);
                return (
                  <div
                    key={bt.label}
                    role="option"
                    aria-selected={globalIdx === highlightIndex}
                    aria-label={bt.label}
                    data-part="item"
                    data-highlighted={globalIdx === highlightIndex ? 'true' : 'false'}
                    data-type={bt.label}
                    data-group={bt.group}
                    onClick={() => handleSelect(bt)}
                    onPointerEnter={() => setHighlightIndex(globalIdx)}
                  >
                    <span aria-hidden="true" data-part="item-icon" data-type={bt.label}>
                      {bt.icon}
                    </span>
                    <span data-part="item-label">{bt.label}</span>
                    <span data-part="item-description">{bt.description}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});

SlashMenu.displayName = 'SlashMenu';
export { SlashMenu };
export default SlashMenu;
