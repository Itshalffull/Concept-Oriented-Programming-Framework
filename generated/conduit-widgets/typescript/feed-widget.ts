import type {
  WidgetSpec,
  WidgetInstance,
} from './widget-spec';

export interface ArticlePreview {
  slug: string;
  title: string;
  description: string;
  author: string;
  authorImage: string;
  createdAt: string;
  favorited: boolean;
  favoritesCount: number;
  tagList: string[];
}

export interface FeedContext {
  activeTab: 'global' | 'personal' | 'tag';
  selectedTag: string | null;
  articles: ArticlePreview[];
  tags: string[];
  currentPage: number;
  totalPages: number;
  errors: string[];
}

export const feedWidgetSpec: WidgetSpec = {
  name: 'feed',
  version: '1.0.0',
  category: 'composite',

  concepts: [
    {
      concept: 'urn:copf/Article',
      actions: [],
      queries: ['get'],
    },
    {
      concept: 'urn:copf/Tag',
      actions: [],
      queries: ['list'],
    },
    {
      concept: 'urn:copf/Favorite',
      actions: [],
      queries: ['isFavorited', 'count'],
    },
  ],

  anatomy: {
    component: 'Feed',
    parts: [
      'root',
      'tabBar',
      'globalFeedTab',
      'myFeedTab',
      'tagFeedTab',
      'articleList',
      'articlePreview',
      'articleTitle',
      'articleDescription',
      'articleMeta',
      'tagSidebar',
      'tagItem',
      'pagination',
      'prevButton',
      'nextButton',
      'pageIndicator',
    ],
    slots: ['banner', 'sidebar'],
  },

  elements: [
    {
      id: 'feed.tabBar',
      kind: 'group',
      label: 'Feed Tabs',
      dataType: 'object',
      required: true,
      scope: '#/properties/activeTab',
      children: [
        {
          id: 'feed.globalFeedTab',
          kind: 'trigger',
          label: 'Global Feed',
          dataType: 'void',
          required: false,
          scope: '#/actions/selectTab/global',
        },
        {
          id: 'feed.myFeedTab',
          kind: 'trigger',
          label: 'Your Feed',
          dataType: 'void',
          required: false,
          scope: '#/actions/selectTab/personal',
        },
        {
          id: 'feed.tagFeedTab',
          kind: 'trigger',
          label: 'Tag Feed',
          dataType: 'void',
          required: false,
          scope: '#/actions/selectTab/tag',
        },
      ],
    },
    {
      id: 'feed.articleList',
      kind: 'container',
      label: 'Articles',
      dataType: 'array',
      required: true,
      scope: '#/properties/articles',
      children: [
        {
          id: 'feed.articlePreview',
          kind: 'group',
          label: 'Article Preview',
          dataType: 'object',
          required: false,
          scope: '#/properties/articles/items',
          children: [
            {
              id: 'feed.articleTitle',
              kind: 'output-text',
              label: 'Title',
              dataType: 'string',
              required: true,
              scope: '#/properties/articles/items/title',
            },
            {
              id: 'feed.articleDescription',
              kind: 'output-text',
              label: 'Description',
              dataType: 'string',
              required: true,
              scope: '#/properties/articles/items/description',
            },
            {
              id: 'feed.articleMeta',
              kind: 'group',
              label: 'Article Meta',
              dataType: 'object',
              required: true,
              scope: '#/properties/articles/items/meta',
            },
          ],
        },
      ],
    },
    {
      id: 'feed.tagSidebar',
      kind: 'container',
      label: 'Popular Tags',
      dataType: 'array',
      required: false,
      scope: '#/properties/tags',
      children: [
        {
          id: 'feed.tagItem',
          kind: 'trigger',
          label: 'Tag',
          dataType: 'string',
          required: false,
          scope: '#/properties/tags/items',
        },
      ],
    },
    {
      id: 'feed.pagination',
      kind: 'group',
      label: 'Pagination',
      dataType: 'object',
      required: false,
      scope: '#/properties/pagination',
      children: [
        {
          id: 'feed.prevPage',
          kind: 'trigger',
          label: 'Previous Page',
          dataType: 'void',
          required: false,
          scope: '#/actions/prevPage',
        },
        {
          id: 'feed.pageIndicator',
          kind: 'output-text',
          label: 'Page Indicator',
          dataType: 'string',
          required: false,
          scope: '#/properties/currentPage',
        },
        {
          id: 'feed.nextPage',
          kind: 'trigger',
          label: 'Next Page',
          dataType: 'void',
          required: false,
          scope: '#/actions/nextPage',
        },
      ],
    },
  ],

  machine: {
    initial: 'loading',
    states: {
      loading: {
        name: 'loading',
        on: {
          LOADED: { target: 'ready', action: 'populateFeed' },
          ERROR: { target: 'error', action: 'setErrors' },
        },
      },
      ready: {
        name: 'ready',
        on: {
          SELECT_TAG: { target: 'loading', action: 'setTagFilter' },
          CHANGE_TAB: { target: 'loading', action: 'setActiveTab' },
          CHANGE_PAGE: { target: 'loading', action: 'setPage' },
        },
      },
      error: {
        name: 'error',
        on: {
          RETRY: { target: 'loading', action: 'reloadFeed' },
        },
      },
    },
    context: {
      activeTab: 'global',
      selectedTag: null,
      articles: [],
      tags: [],
      currentPage: 1,
      totalPages: 1,
      errors: [],
    },
  },

  a11y: {
    role: 'feed',
    label: 'Article Feed',
    description: 'Browse articles from the Conduit community',
    keyboard: {
      Tab: 'moveFocusNext',
      'Shift+Tab': 'moveFocusPrev',
      Enter: 'activateFocused',
      ArrowLeft: 'prevPage',
      ArrowRight: 'nextPage',
    },
    liveRegions: ['articleList', 'pageIndicator'],
  },
};

export function createFeedInstance(
  initialContext?: Partial<FeedContext>,
): WidgetInstance<FeedContext> {
  const defaultContext: FeedContext = {
    activeTab: 'global',
    selectedTag: null,
    articles: [],
    tags: [],
    currentPage: 1,
    totalPages: 1,
    errors: [],
    ...initialContext,
  };

  const instance: WidgetInstance<FeedContext> = {
    spec: feedWidgetSpec,
    state: feedWidgetSpec.machine.initial,
    context: { ...defaultContext },

    transition(event: string, payload?: Record<string, unknown>) {
      const currentState = feedWidgetSpec.machine.states[instance.state];
      if (!currentState) return;
      const transition = currentState.on[event];
      if (!transition) return;

      if (payload) {
        Object.assign(instance.context, payload);
      }
      instance.state = transition.target;
    },

    getProps(part: string): Record<string, unknown> {
      const base: Record<string, unknown> = { 'data-part': part, 'data-state': instance.state };

      switch (part) {
        case 'root':
          return { ...base, role: 'feed', 'aria-label': 'Article Feed', 'aria-busy': instance.state === 'loading' };
        case 'tabBar':
          return { ...base, role: 'tablist', 'aria-label': 'Feed Tabs' };
        case 'globalFeedTab':
          return { ...base, role: 'tab', 'aria-selected': instance.context.activeTab === 'global', 'aria-label': 'Global Feed' };
        case 'myFeedTab':
          return { ...base, role: 'tab', 'aria-selected': instance.context.activeTab === 'personal', 'aria-label': 'Your Feed' };
        case 'tagFeedTab':
          return { ...base, role: 'tab', 'aria-selected': instance.context.activeTab === 'tag', hidden: !instance.context.selectedTag, 'aria-label': instance.context.selectedTag ? `#${instance.context.selectedTag}` : 'Tag Feed' };
        case 'articleList':
          return { ...base, 'aria-live': 'polite', 'aria-label': 'Articles' };
        case 'tagSidebar':
          return { ...base, 'aria-label': 'Popular Tags' };
        case 'prevButton':
          return { ...base, disabled: instance.context.currentPage <= 1, 'aria-label': 'Previous Page' };
        case 'nextButton':
          return { ...base, disabled: instance.context.currentPage >= instance.context.totalPages, 'aria-label': 'Next Page' };
        case 'pageIndicator':
          return { ...base, textContent: `Page ${instance.context.currentPage} of ${instance.context.totalPages}`, 'aria-live': 'polite' };
        case 'pagination':
          return { ...base, role: 'navigation', 'aria-label': 'Pagination' };
        default:
          return base;
      }
    },

    destroy() {
      instance.state = feedWidgetSpec.machine.initial;
      Object.assign(instance.context, defaultContext);
    },
  };

  return instance;
}
