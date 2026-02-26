import type {
  WidgetSpec,
  WidgetInstance,
} from './widget-spec';

export interface CommentItem {
  id: number;
  body: string;
  author: string;
  authorImage: string;
  createdAt: string;
}

export interface CommentContext {
  articleSlug: string;
  comments: CommentItem[];
  newCommentBody: string;
  deletingCommentId: number | null;
  errors: string[];
}

export const commentWidgetSpec: WidgetSpec = {
  name: 'comment',
  version: '1.0.0',
  category: 'composite',

  concepts: [
    {
      concept: 'urn:clef/Comment',
      actions: ['create', 'delete'],
      queries: ['list'],
    },
  ],

  anatomy: {
    component: 'CommentSection',
    parts: [
      'root',
      'list',
      'commentItem',
      'commentBody',
      'commentAuthor',
      'commentDate',
      'deleteButton',
      'addForm',
      'bodyInput',
      'submitButton',
      'errorBanner',
    ],
    slots: ['header', 'footer'],
  },

  elements: [
    {
      id: 'comment.commentList',
      kind: 'container',
      label: 'Comments',
      dataType: 'array',
      required: false,
      scope: '#/properties/comments',
      children: [
        {
          id: 'comment.commentItem',
          kind: 'group',
          label: 'Comment',
          dataType: 'object',
          required: false,
          scope: '#/properties/comments/items',
          children: [
            {
              id: 'comment.commentBody',
              kind: 'output-text',
              label: 'Comment Body',
              dataType: 'string',
              required: true,
              scope: '#/properties/comments/items/body',
            },
            {
              id: 'comment.commentAuthor',
              kind: 'output-text',
              label: 'Author',
              dataType: 'string',
              required: true,
              scope: '#/properties/comments/items/author',
            },
            {
              id: 'comment.commentDate',
              kind: 'output-date',
              label: 'Date',
              dataType: 'string',
              required: true,
              scope: '#/properties/comments/items/createdAt',
            },
            {
              id: 'comment.deleteButton',
              kind: 'trigger',
              label: 'Delete Comment',
              dataType: 'void',
              required: false,
              scope: '#/actions/delete',
            },
          ],
        },
      ],
    },
    {
      id: 'comment.addForm',
      kind: 'group',
      label: 'Add Comment',
      dataType: 'object',
      required: false,
      scope: '#/actions/create',
      children: [
        {
          id: 'comment.bodyInput',
          kind: 'input-text',
          label: 'Comment Body',
          dataType: 'string',
          required: true,
          scope: '#/properties/newCommentBody',
        },
        {
          id: 'comment.submitButton',
          kind: 'trigger',
          label: 'Post Comment',
          dataType: 'void',
          required: false,
          scope: '#/actions/create',
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
          LOADED: { target: 'ready', action: 'populateComments' },
          ERROR: { target: 'error', action: 'setErrors' },
        },
      },
      ready: {
        name: 'ready',
        on: {
          ADD_COMMENT: { target: 'submitting', action: 'collectComment' },
          DELETE_COMMENT: { target: 'deleting', action: 'markForDeletion' },
        },
      },
      submitting: {
        name: 'submitting',
        on: {
          ADDED: { target: 'ready', action: 'appendComment' },
          ADD_ERROR: { target: 'error', action: 'setErrors' },
        },
      },
      deleting: {
        name: 'deleting',
        on: {
          DELETED: { target: 'ready', action: 'removeComment' },
          DELETE_ERROR: { target: 'error', action: 'setErrors' },
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
      articleSlug: '',
      comments: [],
      newCommentBody: '',
      deletingCommentId: null,
      errors: [],
    },
  },

  a11y: {
    role: 'region',
    label: 'Comments',
    description: 'Article comments section',
    keyboard: {
      Tab: 'moveFocusNext',
      'Shift+Tab': 'moveFocusPrev',
      Enter: 'submitComment',
      Delete: 'deleteComment',
    },
    liveRegions: ['list', 'errorBanner'],
  },
};

export function createCommentInstance(
  initialContext?: Partial<CommentContext>,
): WidgetInstance<CommentContext> {
  const defaultContext: CommentContext = {
    articleSlug: '',
    comments: [],
    newCommentBody: '',
    deletingCommentId: null,
    errors: [],
    ...initialContext,
  };

  const instance: WidgetInstance<CommentContext> = {
    spec: commentWidgetSpec,
    state: commentWidgetSpec.machine.initial,
    context: { ...defaultContext },

    transition(event: string, payload?: Record<string, unknown>) {
      const currentState = commentWidgetSpec.machine.states[instance.state];
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
          return { ...base, role: 'region', 'aria-label': 'Comments' };
        case 'list':
          return { ...base, 'aria-live': 'polite', 'aria-label': 'Comment list' };
        case 'bodyInput':
          return { ...base, value: instance.context.newCommentBody, required: true, 'aria-label': 'Write a comment' };
        case 'submitButton':
          return { ...base, disabled: instance.state === 'submitting', 'aria-label': 'Post Comment' };
        case 'deleteButton':
          return { ...base, disabled: instance.state === 'deleting', 'aria-label': 'Delete Comment' };
        case 'errorBanner':
          return { ...base, role: 'alert', 'aria-live': 'assertive', hidden: instance.context.errors.length === 0 };
        case 'addForm':
          return { ...base, role: 'form', 'aria-label': 'Add a comment' };
        default:
          return base;
      }
    },

    destroy() {
      instance.state = commentWidgetSpec.machine.initial;
      Object.assign(instance.context, defaultContext);
    },
  };

  return instance;
}
