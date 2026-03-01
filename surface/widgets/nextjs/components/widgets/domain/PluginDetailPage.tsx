'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { pdpReducer, type PDPState } from './PluginDetailPage.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface PluginScreenshot {
  src: string;
  alt: string;
}

export interface PluginReview {
  author: string;
  rating: number;
  text: string;
  date: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export interface PluginDetailPageProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Plugin display name. */
  pluginName: string;
  /** Plugin ID. */
  pluginId: string;
  /** Description (markdown or HTML). */
  description?: string;
  /** Version string. */
  version?: string;
  /** Author name. */
  author?: string;
  /** Download count. */
  downloads?: number;
  /** Average rating. */
  rating?: number;
  /** Review count. */
  reviewCount?: number;
  /** Last updated date string. */
  lastUpdated?: string;
  /** Whether installed. */
  installed?: boolean;
  /** Whether an update is available. */
  updateAvailable?: boolean;
  /** Screenshots. */
  screenshots?: PluginScreenshot[];
  /** Reviews. */
  reviews?: PluginReview[];
  /** Changelog. */
  changelog?: ChangelogEntry[];
  /** Active tab. */
  activeTab?: 'description' | 'screenshots' | 'reviews' | 'changelog';
  /** Icon source URL. */
  iconSrc?: string;
  /** Called on install. */
  onInstall?: () => void;
  /** Called on uninstall. */
  onUninstall?: () => void;
  /** Called on update. */
  onUpdate?: () => void;
  /** Called on tab change. */
  onTabChange?: (tab: string) => void;
  /** Install button slot. */
  installButton?: ReactNode;
  /** Tabs slot. */
  tabs?: ReactNode;
  /** Description content slot. */
  descriptionContent?: ReactNode;
  /** Screenshot gallery slot. */
  screenshotGallery?: ReactNode;
  /** Reviews content slot. */
  reviewsContent?: ReactNode;
  /** Changelog content slot. */
  changelogContent?: ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const PluginDetailPage = forwardRef<HTMLElement, PluginDetailPageProps>(function PluginDetailPage(
  {
    pluginName,
    pluginId,
    description = '',
    version = '1.0.0',
    author = '',
    downloads = 0,
    rating = 0,
    reviewCount = 0,
    lastUpdated = '',
    installed = false,
    updateAvailable = false,
    screenshots = [],
    reviews = [],
    changelog = [],
    activeTab: controlledTab = 'description',
    iconSrc,
    onInstall,
    onUninstall,
    onUpdate,
    onTabChange,
    installButton,
    tabs: tabsSlot,
    descriptionContent,
    screenshotGallery,
    reviewsContent,
    changelogContent,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(pdpReducer, {
    install: installed ? 'installed' : 'idle',
    tab: controlledTab,
  });

  const isBusy = state.install === 'installing' || state.install === 'uninstalling' || state.install === 'updating';
  const currentTab = controlledTab ?? state.tab;

  const handleInstallAction = useCallback(() => {
    if (isBusy) return;
    if (installed && updateAvailable) { send({ type: 'UPDATE' }); onUpdate?.(); }
    else if (installed) { send({ type: 'UNINSTALL' }); onUninstall?.(); }
    else { send({ type: 'INSTALL' }); onInstall?.(); }
  }, [isBusy, installed, updateAvailable, onInstall, onUninstall, onUpdate]);

  const handleTabSwitch = useCallback(
    (tab: PDPState['tab']) => {
      send({ type: 'SWITCH_TAB', tab });
      onTabChange?.(tab);
    },
    [onTabChange],
  );

  const installLabel = installed && updateAvailable ? 'Update' : installed ? 'Uninstall' : 'Install';

  return (
    <article
      ref={ref}
      role="article"
      aria-label={`${pluginName} plugin details`}
      aria-busy={isBusy || undefined}
      data-surface-widget=""
      data-widget-name="plugin-detail-page"
      data-state={state.install}
      data-plugin-id={pluginId}
      data-installed={installed ? 'true' : 'false'}
      {...rest}
    >
      <div data-part="hero" role="banner" aria-label={`${pluginName} overview`}>
        {iconSrc && (
          <div data-part="hero-icon" role="img" aria-label={`${pluginName} icon`}>
            <img src={iconSrc} alt={`${pluginName} icon`} />
          </div>
        )}
        <h1 data-part="hero-title">{pluginName}</h1>
        <div
          data-part="hero-stats"
          role="group"
          aria-label="Plugin statistics"
          data-version={version}
          data-downloads={downloads}
          data-rating={rating}
          data-review-count={reviewCount}
          data-last-updated={lastUpdated}
        >
          <span>v{version}</span>
          {author && <span>by {author}</span>}
          <span>{downloads.toLocaleString()} downloads</span>
          <span>{rating.toFixed(1)} ({reviewCount} reviews)</span>
        </div>
        <button
          type="button"
          data-part="install-button"
          data-state={isBusy ? state.install : 'idle'}
          data-action={installed && updateAvailable ? 'update' : installed ? 'uninstall' : 'install'}
          aria-label={installLabel}
          aria-busy={isBusy || undefined}
          disabled={isBusy}
          onClick={handleInstallAction}
        >
          {installButton ?? installLabel}
        </button>
      </div>

      <div data-part="tabs" data-active={currentTab} role="tablist" aria-label="Plugin content">
        {tabsSlot ?? (
          <>
            {(['description', 'screenshots', 'reviews', 'changelog'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={currentTab === t}
                onClick={() => handleTabSwitch(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </>
        )}
      </div>

      <div
        data-part="description-tab"
        role="tabpanel"
        aria-label="Description"
        data-visible={currentTab === 'description' ? 'true' : 'false'}
        hidden={currentTab !== 'description'}
      >
        {descriptionContent ?? (
          <div dangerouslySetInnerHTML={{ __html: description }} />
        )}
      </div>

      <div
        data-part="screenshots-tab"
        role="tabpanel"
        aria-label="Screenshots"
        data-visible={currentTab === 'screenshots' ? 'true' : 'false'}
        data-count={screenshots.length}
        hidden={currentTab !== 'screenshots'}
      >
        {screenshotGallery ?? screenshots.map((s, i) => (
          <img key={i} src={s.src} alt={s.alt} />
        ))}
      </div>

      <div
        data-part="reviews-tab"
        role="tabpanel"
        aria-label="Reviews"
        data-visible={currentTab === 'reviews' ? 'true' : 'false'}
        data-count={reviewCount}
        hidden={currentTab !== 'reviews'}
      >
        {reviewsContent ?? reviews.map((r, i) => (
          <div key={i} data-part="review">
            <strong>{r.author}</strong> ({r.rating}) - {r.date}
            <p>{r.text}</p>
          </div>
        ))}
      </div>

      <div
        data-part="changelog-tab"
        role="tabpanel"
        aria-label="Changelog"
        data-visible={currentTab === 'changelog' ? 'true' : 'false'}
        hidden={currentTab !== 'changelog'}
      >
        {changelogContent ?? changelog.map((entry, i) => (
          <div key={i} data-part="changelog-entry">
            <strong>{entry.version}</strong> - {entry.date}
            <ul>
              {entry.changes.map((c, ci) => <li key={ci}>{c}</li>)}
            </ul>
          </div>
        ))}
      </div>

      {children}
    </article>
  );
});

PluginDetailPage.displayName = 'PluginDetailPage';
export { PluginDetailPage };
export default PluginDetailPage;
