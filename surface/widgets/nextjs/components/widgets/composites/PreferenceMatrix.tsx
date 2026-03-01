'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { preferenceMatrixReducer } from './PreferenceMatrix.reducer.js';

/* ---------------------------------------------------------------------------
 * Types derived from preference-matrix.widget spec props
 * ------------------------------------------------------------------------- */

export interface PreferenceDef {
  eventKey: string;
  eventLabel: string;
  description?: string;
  group?: string;
  channels: Record<string, boolean>;
  locked?: Record<string, boolean>;
}

export interface ChannelDef {
  key: string;
  label: string;
}

export interface PreferenceGroupDef {
  key: string;
  name: string;
}

export interface PreferenceMatrixProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  preferences: PreferenceDef[];
  channels?: ChannelDef[] | string[];
  groups?: PreferenceGroupDef[];
  showSelectAll?: boolean;
  showDescriptions?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onChange?: (eventKey: string, channel: string, enabled: boolean) => void;
  onToggleAll?: (channel: string, enabled: boolean) => void;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const PreferenceMatrix = forwardRef<HTMLDivElement, PreferenceMatrixProps>(
  function PreferenceMatrix(
    {
      preferences,
      channels: rawChannels = ['email', 'push', 'in-app'],
      groups = [],
      showSelectAll = true,
      showDescriptions = false,
      disabled = false,
      loading = false,
      onChange,
      onToggleAll,
      children,
      ...rest
    },
    ref,
  ) {
    const channels: ChannelDef[] = rawChannels.map((c) =>
      typeof c === 'string' ? { key: c, label: c.charAt(0).toUpperCase() + c.slice(1) } : c,
    );

    const [state, send] = useReducer(preferenceMatrixReducer, {
      loading: loading ? 'loading' : 'idle',
      saving: 'idle',
      focusRow: 0,
      focusCol: 0,
    });

    const allEnabled = (channelKey: string) =>
      preferences.every((p) => p.channels[channelKey]);
    const someEnabled = (channelKey: string) =>
      preferences.some((p) => p.channels[channelKey]) && !allEnabled(channelKey);

    const handleToggle = useCallback(
      (eventKey: string, channelKey: string) => {
        if (disabled) return;
        const pref = preferences.find((p) => p.eventKey === eventKey);
        if (!pref) return;
        if (pref.locked?.[channelKey]) return;
        onChange?.(eventKey, channelKey, !pref.channels[channelKey]);
      },
      [disabled, preferences, onChange],
    );

    const handleToggleAll = useCallback(
      (channelKey: string) => {
        if (disabled) return;
        const allOn = allEnabled(channelKey);
        onToggleAll?.(channelKey, !allOn);
      },
      [disabled, preferences, onToggleAll],
    );

    const handleKeyNavigation = useCallback(
      (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
        let newRow = rowIdx;
        let newCol = colIdx;
        switch (e.key) {
          case 'ArrowRight':
            e.preventDefault();
            newCol = Math.min(colIdx + 1, channels.length - 1);
            break;
          case 'ArrowLeft':
            e.preventDefault();
            newCol = Math.max(colIdx - 1, 0);
            break;
          case 'ArrowDown':
            e.preventDefault();
            newRow = Math.min(rowIdx + 1, preferences.length - 1);
            break;
          case 'ArrowUp':
            e.preventDefault();
            newRow = Math.max(rowIdx - 1, 0);
            break;
          case 'Home':
            e.preventDefault();
            newCol = 0;
            break;
          case 'End':
            e.preventDefault();
            newCol = channels.length - 1;
            break;
          default:
            return;
        }
        send({ type: 'NAVIGATE', row: newRow, col: newCol });
      },
      [channels.length, preferences.length],
    );

    const grouped = groups.length > 0;
    const groupedPrefs = grouped
      ? groups.map((g) => ({
          ...g,
          items: preferences.filter((p) => p.group === g.key),
        }))
      : [{ key: 'default', name: '', items: preferences }];

    let globalRowIdx = 0;

    return (
      <div
        ref={ref}
        role="grid"
        aria-label="Notification preferences"
        aria-colcount={channels.length + 1}
        aria-busy={loading ? 'true' : 'false'}
        data-surface-widget=""
        data-widget-name="preference-matrix"
        data-part="root"
        data-disabled={disabled ? 'true' : 'false'}
        {...rest}
      >
        {/* Header */}
        <div role="row" data-part="header">
          <span role="columnheader" aria-colindex={1} data-part="header-cell">
            Event
          </span>
          {channels.map((ch, ci) => (
            <span
              key={ch.key}
              role="columnheader"
              aria-colindex={ci + 2}
              data-part="header-cell"
              data-channel={ch.key}
            >
              {ch.label}
              {showSelectAll && (
                <input
                  type="checkbox"
                  data-part="select-all-toggle"
                  aria-label={`Toggle all ${ch.label}`}
                  checked={allEnabled(ch.key)}
                  ref={(el) => {
                    if (el) el.indeterminate = someEnabled(ch.key);
                  }}
                  disabled={disabled}
                  data-channel={ch.key}
                  onChange={() => handleToggleAll(ch.key)}
                />
              )}
            </span>
          ))}
        </div>

        {/* Body */}
        <div data-part="body" data-state={loading ? 'loading' : 'idle'}>
          {groupedPrefs.map((group) => (
            <div
              key={group.key}
              role="rowgroup"
              aria-label={group.name || undefined}
              data-part="group"
              data-group={group.key}
            >
              {group.name && (
                <span data-part="group-label" id={`group-${group.key}`}>
                  {group.name}
                </span>
              )}

              {group.items.map((pref) => {
                const rowIdx = globalRowIdx++;
                return (
                  <div
                    key={pref.eventKey}
                    role="row"
                    aria-rowindex={rowIdx + 1}
                    data-part="row"
                    data-event={pref.eventKey}
                  >
                    <span role="rowheader" aria-colindex={1} data-part="row-label" id={`row-${pref.eventKey}`}>
                      {pref.eventLabel}
                    </span>

                    {showDescriptions && pref.description && (
                      <span
                        data-part="row-description"
                        id={`row-desc-${pref.eventKey}`}
                      >
                        {pref.description}
                      </span>
                    )}

                    {channels.map((ch, ci) => {
                      const isFocused = state.focusRow === rowIdx && state.focusCol === ci;
                      const isLocked = pref.locked?.[ch.key];
                      return (
                        <span
                          key={ch.key}
                          role="gridcell"
                          aria-colindex={ci + 2}
                          data-part="cell"
                          data-channel={ch.key}
                          data-event={pref.eventKey}
                        >
                          <input
                            type="checkbox"
                            data-part="toggle"
                            aria-label={`${pref.eventLabel} via ${ch.label}`}
                            aria-checked={pref.channels[ch.key] ? 'true' : 'false'}
                            aria-describedby={
                              showDescriptions && pref.description
                                ? `row-desc-${pref.eventKey}`
                                : undefined
                            }
                            checked={pref.channels[ch.key] ?? false}
                            disabled={disabled || Boolean(isLocked)}
                            data-channel={ch.key}
                            data-event={pref.eventKey}
                            tabIndex={isFocused ? 0 : -1}
                            onChange={() => handleToggle(pref.eventKey, ch.key)}
                            onKeyDown={(e) => handleKeyNavigation(e, rowIdx, ci)}
                          />
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {children}
      </div>
    );
  },
);

PreferenceMatrix.displayName = 'PreferenceMatrix';
export default PreferenceMatrix;
