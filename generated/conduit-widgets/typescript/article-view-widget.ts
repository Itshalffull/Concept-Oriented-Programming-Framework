import type {
  WidgetSpec,
  WidgetInstance,
} from './widget-spec';

export interface ArticleViewContext {
  slug: string;
  title: string;
  body: string;
  description: string;
  author: string;
  authorImage: string;
  createdAt: string;
  favorited: boolean;
  favoritesCount: number;
  following: boolean;
  comments: Array<{
    id: number;
    body: string;
    author: string;
    createdAt: string;
  }>;
  errors: string[];
}

export const articleViewWidgetSpec: WidgetSpec = {
  name: 'article-view',
  version: '1.0.0',
  category: 'display',

  concepts: [
    {
      concept: 'urn:copf/Article',
      actions: [],
      queries: ['get'],
    },
    {
      concept: 'urn:copf/Favorite',
      actions: ['favorite', 'unfavorite'],
      queries: ['isFavorited', 'count'],
    },
    {
      concept: 'urn:copf/Follow',
      actions: ['follow', 'unfollow'],
      queries: ['isFollowing'],
    },
    {
      concept: 'urn:copf/Comment',
      actions: [],
      queries: ['list'],
    },
  ],

  anatomy: {
    component: 'ArticleView',
    parts: [
      'root',
      'header',
      'title',
      'meta',
      'authorLink',
      'date',
      'body',
      'actions',
      'favoriteButton',
      'favoriteCount',
      'followButton',
      'commentSection',
    ],
    slots: ['banner', 'sidebar', 'belowComments'],
  },

  elements: [
    {
      id: 'article-view.title',
      kind: 'output-text',
      label: 'Title',
      dataType: 'string',
      required: true,
      scope: '#/properties/title',
    },
    {
      id: 'article-view.meta',
      kind: 'group',
      label: 'Article Meta',
      dataType: 'object',
      required: true,
      scope: '#/properties/meta',
      children: [
        {
          id: 'article-view.author',
          kind: 'output-text',
          label: 'Author',
          dataType: 'string',
          required: true,
          scope: '#/properties/author',
        },
        {
          id: 'article-view.date',
          kind: 'output-date',
          label: 'Published Date',
          dataType: 'string',
          required: true,
          scope: '#/properties/createdAt',
        },
      ],
    },
    {
      id: 'article-view.body',
      kind: 'output-text',
      label: 'Article Body',
      dataType: 'string',
      required: true,
      scope: '#/properties/body',
    },
    {
      id: 'article-view.favoriteButton',
      kind: 'trigger',
      label: 'Favorite',
      dataType: 'void',
      required: false,
      scope: '#/actions/favorite',
    },
    {
      id: 'article-view.favoriteCount',
      kind: 'output-number',
      label: 'Favorite Count',
      dataType: 'number',
      required: false,
      scope: '#/properties/favoritesCount',
    },
    {
      id: 'article-view.followButton',
      kind: 'trigger',
      label: 'Follow Author',
      dataType: 'void',
      required: false,
      scope: '#/actions/follow',
    },
    {
      id: 'article-view.commentList',
      kind: 'container',
      label: 'Comments',
      dataType: 'array',
      required: false,
      scope: '#/properties/comments',
    },
  ],

  machine: {
    initial: 'loading',
    states: {
      loading: {
        name: 'loading',
        on: {
          LOADED: { target: 'ready', action: 'populateArticle' },
          ERROR: { target: 'error', action: 'setErrors' },
        },
      },
      ready: {
        name: 'ready',
        on: {
          FAVORITE: { target: 'acting', action: 'toggleFavorite' },
          FOLLOW: { target: 'acting', action: 'toggleFollow' },
          DISMISS: { target: 'ready', action: 'clearErrors' },
        },
      },
      acting: {
        name: 'acting',
        on: {
          DONE: { target: 'ready', action: 'applyResult' },
          ERROR: { target: 'ready', action: 'setErrors' },
        },
      },
      error: {
        name: 'error',
        on: {
          DISMISS: { target: 'ready', action: 'clearErrors' },
        },
      },
    },
    context: {
      slug: '',
      title: '',
      body: '',
      description: '',
      author: '',
      authorImage: '',
      createdAt: '',
      favorited: false,
      favoritesCount: 0,
      following: false,
      comments: [],
      errors: [],
    },
  },

  a11y: {
    role: 'article',
    label: 'Article',
    description: 'View a published article with comments and social actions',
    keyboard: {
      Tab: 'moveFocusNext',
      'Shift+Tab': 'moveFocusPrev',
      Enter: 'activateFocused',
      f: 'toggleFavorite',
      w: 'toggleFollow',
    },
    liveRegions: ['favoriteCount', 'commentSection'],
  },
};

export function createArticleViewInstance(
  initialContext?: Partial<ArticleViewContext>,
): WidgetInstance<ArticleViewContext> {
  const defaultContext: ArticleViewContext = {
    slug: '',
    title: '',
    body: '',
    description: '',
    author: '',
    authorImage: '',
    createdAt: '',
    favorited: false,
    favoritesCount: 0,
    following: false,
    comments: [],
    errors: [],
    ...initialContext,
  };

  const instance: WidgetInstance<ArticleViewContext> = {
    spec: articleViewWidgetSpec,
    state: articleViewWidgetSpec.machine.initial,
    context: { ...defaultContext },

    transition(event: string, payload?: Record<string, unknown>) {
      const currentState = articleViewWidgetSpec.machine.states[instance.state];
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
        case 'title':
          return { ...base, textContent: instance.context.title };
        case 'authorLink':
          return { ...base, textContent: instance.context.author, href: `/@${instance.context.author}` };
        case 'date':
          return { ...base, textContent: instance.context.createdAt, dateTime: instance.context.createdAt };
        case 'body':
          return { ...base, textContent: instance.context.body };
        case 'favoriteButton':
          return { ...base, 'aria-pressed': instance.context.favorited, 'aria-label': instance.context.favorited ? 'Unfavorite article' : 'Favorite article', disabled: instance.state === 'acting' };
        case 'favoriteCount':
          return { ...base, textContent: instance.context.favoritesCount, 'aria-live': 'polite' };
        case 'followButton':
          return { ...base, 'aria-pressed': instance.context.following, 'aria-label': instance.context.following ? 'Unfollow author' : 'Follow author', disabled: instance.state === 'acting' };
        case 'commentSection':
          return { ...base, 'aria-label': 'Comments', role: 'region' };
        case 'header':
          return { ...base, role: 'banner' };
        default:
          return base;
      }
    },

    destroy() {
      instance.state = articleViewWidgetSpec.machine.initial;
      Object.assign(instance.context, defaultContext);
    },
  };

  return instance;
}
