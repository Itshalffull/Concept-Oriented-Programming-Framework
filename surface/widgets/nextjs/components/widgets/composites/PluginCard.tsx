'use client';

import {
  forwardRef,
  useCallback,
  useId,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { pluginCardReducer, formatNumber, buttonLabel } from './PluginCard.reducer.js';
import type { PluginLifecycleState } from './PluginCard.reducer.js';

/* ---------------------------------------------------------------------------
 * Types derived from plugin-card.widget spec props
 * ------------------------------------------------------------------------- */

export type { PluginLifecycleState };

export interface PluginCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  pluginId: string;
  pluginName: string;
  authorName: string;
  versionString?: string;
  descriptionText: string;
  ratingValue?: number;
  ratingCount?: number;
  installCountValue?: number;
  tags?: string[];
  iconUrl?: string;
  state?: 'available' | 'installed' | 'enabled';
  progress?: number;
  disabled?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
  onEnable?: () => void;
  onDisable?: () => void;
  renderIcon?: () => ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const PluginCard = forwardRef<HTMLDivElement, PluginCardProps>(
  function PluginCard(
    {
      pluginId,
      pluginName,
      authorName,
      versionString,
      descriptionText,
      ratingValue,
      ratingCount,
      installCountValue,
      tags = [],
      iconUrl,
      state: controlledState = 'available',
      progress = 0,
      disabled = false,
      onInstall,
      onUninstall,
      onEnable,
      onDisable,
      renderIcon,
      children,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(pluginCardReducer, {
      lifecycle: controlledState,
      hover: 'idle',
      focus: 'unfocused',
    });

    const descriptionId = useId();
    const nameId = useId();

    const isTransitioning =
      state.lifecycle === 'installing' || state.lifecycle === 'uninstalling';

    const handleAction = useCallback(() => {
      if (disabled || isTransitioning) return;
      switch (state.lifecycle) {
        case 'available':
          send({ type: 'INSTALL' });
          onInstall?.();
          break;
        case 'installed':
          send({ type: 'ENABLE' });
          onEnable?.();
          break;
        case 'enabled':
          send({ type: 'DISABLE' });
          onDisable?.();
          break;
      }
    }, [disabled, isTransitioning, state.lifecycle, onInstall, onEnable, onDisable]);

    const actionAriaLabel = (() => {
      switch (state.lifecycle) {
        case 'available': return `Install ${pluginName}`;
        case 'installing': return `Installing ${pluginName}`;
        case 'installed': return `Enable ${pluginName}`;
        case 'enabled': return `Disable ${pluginName}`;
        case 'uninstalling': return `Uninstalling ${pluginName}`;
      }
    })();

    const actionDataState = (() => {
      switch (state.lifecycle) {
        case 'available': return 'install';
        case 'installing': return 'installing';
        case 'installed': return 'enable';
        case 'enabled': return 'disable';
        case 'uninstalling': return 'uninstalling';
      }
    })();

    const statusText = (() => {
      switch (state.lifecycle) {
        case 'available': return 'Available';
        case 'installed': return 'Installed';
        case 'enabled': return 'Enabled';
        default: return '...';
      }
    })();

    return (
      <div
        ref={ref}
        role="article"
        aria-label={pluginName}
        aria-describedby={descriptionId}
        data-surface-widget=""
        data-widget-name="plugin-card"
        data-part="root"
        data-state={state.lifecycle}
        data-hovered={state.hover === 'hovered' ? 'true' : 'false'}
        tabIndex={0}
        onPointerEnter={() => send({ type: 'POINTER_ENTER' })}
        onPointerLeave={() => send({ type: 'POINTER_LEAVE' })}
        onFocus={() => send({ type: 'FOCUS' })}
        onBlur={() => send({ type: 'BLUR' })}
        {...rest}
      >
        {/* Icon */}
        <div
          data-part="icon"
          data-has-image={iconUrl ? 'true' : 'false'}
          aria-hidden="true"
        >
          {renderIcon ? renderIcon() : iconUrl ? <img src={iconUrl} alt="" /> : null}
        </div>

        {/* Name & Author */}
        <span data-part="name" id={nameId}>{pluginName}</span>
        <span data-part="author">{authorName}</span>

        {/* Version */}
        {versionString && (
          <span data-part="version">v{versionString}</span>
        )}

        {/* Description */}
        <p data-part="description" id={descriptionId}>{descriptionText}</p>

        {/* Rating */}
        {ratingValue != null && (
          <div
            data-part="rating"
            aria-label={`${ratingValue} out of 5 stars`}
          >
            {'\u2605'.repeat(Math.round(ratingValue))}
            {'\u2606'.repeat(5 - Math.round(ratingValue))}
            {ratingCount != null && (
              <span data-part="rating-count" aria-hidden="true">
                ({ratingCount})
              </span>
            )}
          </div>
        )}

        {/* Install Count */}
        {installCountValue != null && (
          <span
            data-part="install-count"
            aria-label={`${installCountValue} installs`}
          >
            {formatNumber(installCountValue)} installs
          </span>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div data-part="tags" aria-label="Plugin tags">
            {tags.map((tag) => (
              <span key={tag} data-part="tag">{tag}</span>
            ))}
          </div>
        )}

        {/* Status Badge */}
        <span
          data-part="status-badge"
          data-state={state.lifecycle}
          aria-label={`Status: ${statusText.toLowerCase()}`}
        >
          {statusText}
        </span>

        {/* Progress Bar */}
        {isTransitioning && (
          <div
            role="progressbar"
            aria-label="Installation progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            data-part="progress-bar"
            data-progress={progress}
          />
        )}

        {/* Install/Action Button */}
        <button
          type="button"
          data-part="install-button"
          data-state={actionDataState}
          aria-label={actionAriaLabel}
          aria-disabled={isTransitioning || disabled ? 'true' : 'false'}
          disabled={isTransitioning || disabled}
          onClick={handleAction}
        >
          {buttonLabel(state.lifecycle)}
        </button>

        {/* More Button */}
        <button
          type="button"
          data-part="more-button"
          aria-haspopup="menu"
          aria-label={`More options for ${pluginName}`}
        >
          ...
        </button>

        {children}
      </div>
    );
  },
);

PluginCard.displayName = 'PluginCard';
export default PluginCard;
