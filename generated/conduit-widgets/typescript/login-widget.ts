import type {
  WidgetSpec,
  WidgetInstance,
} from './widget-spec';

export interface LoginContext {
  email: string;
  password: string;
  errors: string[];
  token: string | null;
}

export const loginWidgetSpec: WidgetSpec = {
  name: 'login',
  version: '1.0.0',
  category: 'form',

  concepts: [
    {
      concept: 'urn:clef/Password',
      actions: ['check'],
      queries: [],
    },
    {
      concept: 'urn:clef/JWT',
      actions: ['generate'],
      queries: [],
    },
  ],

  anatomy: {
    component: 'LoginForm',
    parts: [
      'root',
      'form',
      'emailField',
      'passwordField',
      'submitButton',
      'errorBanner',
    ],
    slots: ['header', 'footer'],
  },

  elements: [
    {
      id: 'login.email',
      kind: 'input-text',
      label: 'Email',
      dataType: 'string',
      required: true,
      scope: '#/properties/email',
      constraints: { pattern: '^[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}$' },
    },
    {
      id: 'login.password',
      kind: 'input-text',
      label: 'Password',
      dataType: 'string',
      required: true,
      scope: '#/properties/password',
    },
    {
      id: 'login.submit',
      kind: 'trigger',
      label: 'Sign In',
      dataType: 'void',
      required: false,
      scope: '#/actions/check',
    },
  ],

  machine: {
    initial: 'idle',
    states: {
      idle: {
        name: 'idle',
        on: {
          SUBMIT: { target: 'submitting', action: 'collectCredentials' },
        },
      },
      submitting: {
        name: 'submitting',
        on: {
          AUTHENTICATED: { target: 'success', action: 'setToken' },
          FAILED: { target: 'error', action: 'setErrors' },
        },
      },
      success: {
        name: 'success',
        on: {},
      },
      error: {
        name: 'error',
        on: {
          RETRY: { target: 'idle', action: 'clearErrors' },
        },
      },
    },
    context: {
      email: '',
      password: '',
      errors: [],
      token: null,
    },
  },

  a11y: {
    role: 'form',
    label: 'User Login',
    description: 'Sign in to your Conduit account',
    keyboard: {
      Tab: 'moveFocusNext',
      'Shift+Tab': 'moveFocusPrev',
      Enter: 'submitForm',
    },
    liveRegions: ['errorBanner'],
  },
};

export function createLoginInstance(
  initialContext?: Partial<LoginContext>,
): WidgetInstance<LoginContext> {
  const defaultContext: LoginContext = {
    email: '',
    password: '',
    errors: [],
    token: null,
    ...initialContext,
  };

  const instance: WidgetInstance<LoginContext> = {
    spec: loginWidgetSpec,
    state: loginWidgetSpec.machine.initial,
    context: { ...defaultContext },

    transition(event: string, payload?: Record<string, unknown>) {
      const currentState = loginWidgetSpec.machine.states[instance.state];
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
        case 'emailField':
          return { ...base, value: instance.context.email, required: true, type: 'email', 'aria-label': 'Email' };
        case 'passwordField':
          return { ...base, value: instance.context.password, required: true, type: 'password', 'aria-label': 'Password' };
        case 'submitButton':
          return { ...base, disabled: instance.state === 'submitting' || instance.state === 'success', 'aria-label': 'Sign In' };
        case 'errorBanner':
          return { ...base, role: 'alert', 'aria-live': 'polite', hidden: instance.context.errors.length === 0 };
        case 'form':
          return { ...base, role: 'form', 'aria-label': 'User Login' };
        default:
          return base;
      }
    },

    destroy() {
      instance.state = loginWidgetSpec.machine.initial;
      Object.assign(instance.context, defaultContext);
    },
  };

  return instance;
}
