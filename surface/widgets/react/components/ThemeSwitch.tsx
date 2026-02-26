// ============================================================
// ThemeSwitch — Component to toggle between Clef Surface themes.
//
// Renders a list of available themes with activate / deactivate
// controls. Each theme entry can be a button, a radio group
// item, or a toggle depending on the rendering mode.
// ============================================================

import React, {
  useState,
  useCallback,
  useMemo,
  type ReactNode,
  type CSSProperties,
} from 'react';

import type { ThemeConfig } from '../../shared/types.js';

// --------------- Props ---------------

export interface ThemeSwitchProps {
  /** Available theme configurations. */
  themes: ThemeConfig[];
  /** Called when the user activates a theme. */
  onActivate?: (theme: ThemeConfig) => void;
  /** Called when the user deactivates a theme. */
  onDeactivate?: (theme: ThemeConfig) => void;
  /**
   * Rendering mode.
   * - "radio"   : only one theme active at a time (mutual exclusion)
   * - "toggle"  : each theme is independently togglable (layered)
   * - "buttons" : simple button per theme
   *
   * @default "radio"
   */
  mode?: 'radio' | 'toggle' | 'buttons';
  /** Optional label rendered above the switcher. */
  label?: string;
  /** Optional class name for the root element. */
  className?: string;
  /** Optional inline styles. */
  style?: CSSProperties;
  /** Custom renderer for individual theme entries. */
  renderItem?: (
    theme: ThemeConfig,
    isActive: boolean,
    toggle: () => void
  ) => ReactNode;
}

// --------------- Component ---------------

export const ThemeSwitch: React.FC<ThemeSwitchProps> = ({
  themes,
  onActivate,
  onDeactivate,
  mode = 'radio',
  label,
  className,
  style,
  renderItem,
}) => {
  // Track internal active set — callers typically also manage
  // external state via the callbacks.
  const [activeNames, setActiveNames] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const t of themes) {
      if (t.active) initial.add(t.name);
    }
    return initial;
  });

  const handleToggle = useCallback(
    (theme: ThemeConfig) => {
      setActiveNames((prev) => {
        const next = new Set(prev);

        if (mode === 'radio') {
          // Deactivate all others first
          for (const name of prev) {
            if (name !== theme.name) {
              next.delete(name);
              const deactivated = themes.find((t) => t.name === name);
              if (deactivated) onDeactivate?.(deactivated);
            }
          }
        }

        if (next.has(theme.name)) {
          next.delete(theme.name);
          onDeactivate?.(theme);
        } else {
          next.add(theme.name);
          onActivate?.(theme);
        }

        return next;
      });
    },
    [mode, themes, onActivate, onDeactivate]
  );

  const roleProps = useMemo(() => {
    if (mode === 'radio') {
      return { role: 'radiogroup' as const };
    }
    return { role: 'group' as const };
  }, [mode]);

  return (
    <div
      className={className}
      style={style}
      data-surface-theme-switch=""
      data-mode={mode}
      {...roleProps}
      aria-label={label ?? 'Theme switcher'}
    >
      {label && (
        <span data-surface-theme-switch-label="" aria-hidden="true">
          {label}
        </span>
      )}

      {themes.map((theme) => {
        const isActive = activeNames.has(theme.name);
        const toggle = () => handleToggle(theme);

        if (renderItem) {
          return (
            <React.Fragment key={theme.name}>
              {renderItem(theme, isActive, toggle)}
            </React.Fragment>
          );
        }

        if (mode === 'radio') {
          return (
            <label
              key={theme.name}
              data-surface-theme-item=""
              data-active={isActive ? '' : undefined}
            >
              <input
                type="radio"
                name="surface-theme-switch"
                checked={isActive}
                onChange={toggle}
                aria-label={`Activate ${theme.name} theme`}
              />
              <span>{theme.name}</span>
            </label>
          );
        }

        if (mode === 'toggle') {
          return (
            <label
              key={theme.name}
              data-surface-theme-item=""
              data-active={isActive ? '' : undefined}
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={toggle}
                aria-label={`Toggle ${theme.name} theme`}
              />
              <span>{theme.name}</span>
            </label>
          );
        }

        // mode === 'buttons'
        return (
          <button
            key={theme.name}
            type="button"
            data-surface-theme-item=""
            data-active={isActive ? '' : undefined}
            aria-pressed={isActive}
            onClick={toggle}
          >
            {theme.name}
          </button>
        );
      })}
    </div>
  );
};

ThemeSwitch.displayName = 'ThemeSwitch';
export default ThemeSwitch;
