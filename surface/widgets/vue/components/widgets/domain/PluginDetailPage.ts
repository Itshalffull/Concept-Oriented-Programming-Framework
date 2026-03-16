// ============================================================
// PluginDetailPage -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
} from 'vue';

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

export interface PluginDetailPageProps {
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
  installButton?: VNode | string;
  /** Tabs slot. */
  tabs?: VNode | string;
  /** Description content slot. */
  descriptionContent?: VNode | string;
  /** Screenshot gallery slot. */
  screenshotGallery?: VNode | string;
  /** Reviews content slot. */
  reviewsContent?: VNode | string;
  /** Changelog content slot. */
  changelogContent?: VNode | string;
}

export const PluginDetailPage = defineComponent({
  name: 'PluginDetailPage',

  props: {
    pluginName: { type: String, required: true as const },
    pluginId: { type: String, required: true as const },
    description: { type: String, default: '' },
    version: { type: String, default: '1.0.0' },
    author: { type: String, default: '' },
    downloads: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    lastUpdated: { type: String, default: '' },
    installed: { type: Boolean, default: false },
    updateAvailable: { type: Boolean, default: false },
    screenshots: { type: Array as PropType<any[]>, default: () => ([]) },
    reviews: { type: Array as PropType<any[]>, default: () => ([]) },
    changelog: { type: Array as PropType<any[]>, default: () => ([]) },
    activeTab: { type: String, default: 'description' },
    iconSrc: { type: String },
    onInstall: { type: Function as PropType<(...args: any[]) => any> },
    onUninstall: { type: Function as PropType<(...args: any[]) => any> },
    onUpdate: { type: Function as PropType<(...args: any[]) => any> },
    onTabChange: { type: Function as PropType<(...args: any[]) => any> },
    installButton: { type: null as unknown as PropType<any> },
    tabs: { type: null as unknown as PropType<any> },
    descriptionContent: { type: null as unknown as PropType<any> },
    screenshotGallery: { type: null as unknown as PropType<any> },
    reviewsContent: { type: null as unknown as PropType<any> },
    changelogContent: { type: null as unknown as PropType<any> },
  },

  emits: ['update', 'uninstall', 'install', 'tab-change'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ install: props.installed ? 'installed' : 'idle', tab: props.activeTab, });
    const send = (action: any) => { /* state machine dispatch */ };
    const handleInstallAction = () => {
    if (isBusy) return;
    if (props.installed && props.updateAvailable) { send({ type: 'UPDATE' }); props.onUpdate?.(); }
    else if (props.installed) { send({ type: 'UNINSTALL' }); props.onUninstall?.(); }
    else { send({ type: 'INSTALL' }); props.onInstall?.(); }
  };

    return (): VNode =>
      h('article', {
        'role': 'article',
        'aria-label': `${pluginName} plugin details`,
        'aria-busy': isBusy || undefined,
        'data-surface-widget': '',
        'data-widget-name': 'plugin-detail-page',
        'data-state': state.value.install,
        'data-plugin-id': props.pluginId,
        'data-installed': props.installed ? 'true' : 'false',
      }, [
        h('div', {
          'data-part': 'hero',
          'role': 'banner',
          'aria-label': `${pluginName} overview`,
        }, [
          props.iconSrc ? h('div', {
              'data-part': 'hero-icon',
              'role': 'img',
              'aria-label': `${pluginName} icon`,
            }, [
              h('img', { 'src': props.iconSrc, 'alt': `${pluginName} icon` }),
            ]) : null,
          h('h1', { 'data-part': 'hero-title' }, [
            props.pluginName,
          ]),
          h('div', {
            'data-part': 'hero-stats',
            'role': 'group',
            'aria-label': 'Plugin statistics',
            'data-version': props.version,
            'data-downloads': props.downloads,
            'data-rating': props.rating,
            'data-review-count': props.reviewCount,
            'data-last-updated': props.lastUpdated,
          }, [
            h('span', {}, [
              'v',
              props.version,
            ]),
            props.author ? h('span', {}, ['by ', props.author]) : null,
            h('span', {}, [
              props.downloads.toLocaleString(),
              'downloads',
            ]),
            h('span', {}, [
              props.rating.toFixed(1),
              '(',
              props.reviewCount,
              'reviews)',
            ]),
          ]),
          h('button', {
            'type': 'button',
            'data-part': 'install-button',
            'data-state': isBusy ? state.value.install : 'idle',
            'data-action': props.installed && props.updateAvailable ? 'update' : props.installed ? 'uninstall' : 'install',
            'aria-label': installLabel,
            'aria-busy': isBusy || undefined,
            'disabled': isBusy,
            'onClick': handleInstallAction,
          }, [
            props.installButton ?? installLabel,
          ]),
        ]),
        h('div', {
          'data-part': 'tabs',
          'data-active': currentTab,
          'role': 'tablist',
          'aria-label': 'Plugin content',
        }, [
          ...props.tabs ?? (['description', 'screenshots', 'reviews', 'changelog'] as const).map((t) => h('button', {
              'type': 'button',
              'role': 'tab',
              'aria-selected': currentTab === t,
              'onClick': () => handleTabSwitch(t),
            }, [
              t.charAt(0).toUpperCase() + t.slice(1),
            ])),
        ]),
        h('div', {
          'data-part': 'description-tab',
          'role': 'tabpanel',
          'aria-label': 'Description',
          'data-visible': currentTab === 'description' ? 'true' : 'false',
          'hidden': currentTab !== 'description',
        }, [
          props.descriptionContent ?? h('div', { 'innerHTML': props.description }),
        ]),
        h('div', {
          'data-part': 'screenshots-tab',
          'role': 'tabpanel',
          'aria-label': 'Screenshots',
          'data-visible': currentTab === 'screenshots' ? 'true' : 'false',
          'data-count': props.screenshots.length,
          'hidden': currentTab !== 'screenshots',
        }, [
          ...props.screenshotGallery ?? props.screenshots.map((s, i) => h('img', { 'src': s.src, 'alt': s.alt })),
        ]),
        h('div', {
          'data-part': 'reviews-tab',
          'role': 'tabpanel',
          'aria-label': 'Reviews',
          'data-visible': currentTab === 'reviews' ? 'true' : 'false',
          'data-count': props.reviewCount,
          'hidden': currentTab !== 'reviews',
        }, [
          ...props.reviewsContent ?? props.reviews.map((r, i) => h('div', { 'data-part': 'review' }, [
              h('strong', {}, [
                r.author,
              ]),
              '(',
              r.rating,
              ') -',
              r.date,
              h('p', {}, [
                r.text,
              ]),
            ])),
        ]),
        h('div', {
          'data-part': 'changelog-tab',
          'role': 'tabpanel',
          'aria-label': 'Changelog',
          'data-visible': currentTab === 'changelog' ? 'true' : 'false',
          'hidden': currentTab !== 'changelog',
        }, [
          ...props.changelogContent ?? props.changelog.map((entry, i) => h('div', { 'data-part': 'changelog-entry' }, [
              h('strong', {}, [
                entry.version,
              ]),
              '-',
              entry.date,
              h('ul', {}, [
                ...entry.changes.map((c, ci) => h('li', {}, [c])),
              ]),
            ])),
        ]),
        slots.default?.(),
      ]);
  },
});

export default PluginDetailPage;