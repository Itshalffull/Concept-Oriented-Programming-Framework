import type {
  WidgetSpec,
  WidgetInstance,
} from './widget-spec';

export interface ArticleEditorContext {
  slug: string | null;
  title: string;
  description: string;
  body: string;
  tagInput: string;
  tagList: string[];
  errors: string[];
  mode: 'create' | 'update';
}

export const articleEditorWidgetSpec: WidgetSpec = {
  name: 'article-editor',
  version: '1.0.0',
  category: 'form',

  concepts: [
    {
      concept: 'urn:clef/Article',
      actions: ['create', 'update'],
      queries: ['get'],
    },
    {
      concept: 'urn:clef/Tag',
      actions: ['add', 'remove'],
      queries: ['list'],
    },
  ],

  anatomy: {
    component: 'ArticleEditor',
    parts: [
      'root',
      'form',
      'titleField',
      'descriptionField',
      'bodyEditor',
      'tagInput',
      'tagList',
      'tagItem',
      'publishButton',
      'errorBanner',
    ],
    slots: ['header', 'footer'],
  },

  elements: [
    {
      id: 'article-editor.title',
      kind: 'input-text',
      label: 'Article Title',
      dataType: 'string',
      required: true,
      scope: '#/properties/title',
      constraints: { maxLength: 200 },
    },
    {
      id: 'article-editor.description',
      kind: 'input-text',
      label: 'Description',
      dataType: 'string',
      required: true,
      scope: '#/properties/description',
      constraints: { maxLength: 500 },
    },
    {
      id: 'article-editor.body',
      kind: 'rich-text',
      label: 'Article Body',
      dataType: 'string',
      required: true,
      scope: '#/properties/body',
    },
    {
      id: 'article-editor.tagInput',
      kind: 'input-text',
      label: 'Add Tag',
      dataType: 'string',
      required: false,
      scope: '#/properties/tagInput',
    },
    {
      id: 'article-editor.tagList',
      kind: 'container',
      label: 'Tags',
      dataType: 'array',
      required: false,
      scope: '#/properties/tagList',
      children: [
        {
          id: 'article-editor.tagItem',
          kind: 'output-text',
          label: 'Tag',
          dataType: 'string',
          required: false,
          scope: '#/properties/tagList/items',
        },
      ],
    },
    {
      id: 'article-editor.publish',
      kind: 'trigger',
      label: 'Publish Article',
      dataType: 'void',
      required: false,
      scope: '#/actions/create',
    },
  ],

  machine: {
    initial: 'idle',
    states: {
      idle: {
        name: 'idle',
        on: {
          EDIT: { target: 'editing', action: 'initCreate' },
          LOAD: { target: 'loading', action: 'initUpdate' },
        },
      },
      loading: {
        name: 'loading',
        on: {
          LOADED: { target: 'editing', action: 'populateForm' },
          ERROR: { target: 'error', action: 'setErrors' },
        },
      },
      editing: {
        name: 'editing',
        on: {
          SUBMIT: { target: 'validating', action: 'collectFormData' },
          ADD_TAG: { target: 'editing', action: 'addTag' },
          REMOVE_TAG: { target: 'editing', action: 'removeTag' },
        },
      },
      validating: {
        name: 'validating',
        on: {
          VALID: { target: 'publishing', action: 'invokePublish' },
          INVALID: { target: 'editing', action: 'setErrors' },
        },
      },
      publishing: {
        name: 'publishing',
        on: {
          PUBLISHED: { target: 'success', action: 'setSlug' },
          ERROR: { target: 'error', action: 'setErrors' },
        },
      },
      success: {
        name: 'success',
        on: {},
      },
      error: {
        name: 'error',
        on: {
          RETRY: { target: 'editing', action: 'clearErrors' },
        },
      },
    },
    context: {
      slug: null,
      title: '',
      description: '',
      body: '',
      tagInput: '',
      tagList: [],
      errors: [],
      mode: 'create',
    },
  },

  a11y: {
    role: 'form',
    label: 'Article Editor',
    description: 'Create or edit an article on Conduit',
    keyboard: {
      Tab: 'moveFocusNext',
      'Shift+Tab': 'moveFocusPrev',
      Enter: 'submitForm',
      'Ctrl+Enter': 'publishArticle',
    },
    liveRegions: ['errorBanner'],
  },
};

export function createArticleEditorInstance(
  initialContext?: Partial<ArticleEditorContext>,
): WidgetInstance<ArticleEditorContext> {
  const defaultContext: ArticleEditorContext = {
    slug: null,
    title: '',
    description: '',
    body: '',
    tagInput: '',
    tagList: [],
    errors: [],
    mode: 'create',
    ...initialContext,
  };

  const instance: WidgetInstance<ArticleEditorContext> = {
    spec: articleEditorWidgetSpec,
    state: articleEditorWidgetSpec.machine.initial,
    context: { ...defaultContext },

    transition(event: string, payload?: Record<string, unknown>) {
      const currentState = articleEditorWidgetSpec.machine.states[instance.state];
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
        case 'titleField':
          return { ...base, value: instance.context.title, required: true, maxLength: 200, 'aria-label': 'Article Title' };
        case 'descriptionField':
          return { ...base, value: instance.context.description, required: true, maxLength: 500, 'aria-label': 'Description' };
        case 'bodyEditor':
          return { ...base, value: instance.context.body, required: true, 'aria-label': 'Article Body' };
        case 'tagInput':
          return { ...base, value: instance.context.tagInput, 'aria-label': 'Add Tag' };
        case 'tagList':
          return { ...base, 'aria-label': 'Tags', items: instance.context.tagList };
        case 'publishButton':
          return { ...base, disabled: instance.state === 'publishing' || instance.state === 'success', 'aria-label': instance.context.mode === 'update' ? 'Update Article' : 'Publish Article' };
        case 'errorBanner':
          return { ...base, role: 'alert', 'aria-live': 'polite', hidden: instance.context.errors.length === 0 };
        case 'form':
          return { ...base, role: 'form', 'aria-label': 'Article Editor' };
        default:
          return base;
      }
    },

    destroy() {
      instance.state = articleEditorWidgetSpec.machine.initial;
      Object.assign(instance.context, defaultContext);
    },
  };

  return instance;
}
