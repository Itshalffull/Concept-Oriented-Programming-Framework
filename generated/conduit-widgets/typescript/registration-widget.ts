import type {
  WidgetSpec,
  WidgetInstance,
} from './widget-spec';

export interface RegistrationContext {
  username: string;
  email: string;
  password: string;
  errors: string[];
  token: string | null;
}

export const registrationWidgetSpec: WidgetSpec = {
  name: 'registration',
  version: '1.0.0',
  category: 'form',

  concepts: [
    {
      concept: 'urn:clef/User',
      actions: ['register'],
      queries: [],
    },
    {
      concept: 'urn:clef/Password',
      actions: ['validate', 'set'],
      queries: [],
    },
  ],

  anatomy: {
    component: 'RegistrationForm',
    parts: [
      'root',
      'form',
      'usernameField',
      'emailField',
      'passwordField',
      'submitButton',
      'errorBanner',
      'successMessage',
    ],
    slots: ['header', 'footer'],
  },

  elements: [
    {
      id: 'registration.username',
      kind: 'input-text',
      label: 'Username',
      dataType: 'string',
      required: true,
      scope: '#/properties/username',
      constraints: { maxLength: 50 },
    },
    {
      id: 'registration.email',
      kind: 'input-text',
      label: 'Email',
      dataType: 'string',
      required: true,
      scope: '#/properties/email',
      constraints: { pattern: '^[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}$' },
    },
    {
      id: 'registration.password',
      kind: 'input-text',
      label: 'Password',
      dataType: 'string',
      required: true,
      scope: '#/properties/password',
      constraints: { minLength: 8 },
    },
    {
      id: 'registration.submit',
      kind: 'trigger',
      label: 'Sign Up',
      dataType: 'void',
      required: false,
      scope: '#/actions/register',
    },
  ],

  machine: {
    initial: 'idle',
    states: {
      idle: {
        name: 'idle',
        on: {
          SUBMIT: { target: 'validating', action: 'collectFormData' },
        },
      },
      validating: {
        name: 'validating',
        on: {
          VALID: { target: 'registering', action: 'invokeRegister' },
          INVALID: { target: 'idle', action: 'setErrors' },
        },
      },
      registering: {
        name: 'registering',
        on: {
          REGISTERED: { target: 'success', action: 'setToken' },
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
          RETRY: { target: 'idle', action: 'clearErrors' },
        },
      },
    },
    context: {
      username: '',
      email: '',
      password: '',
      errors: [],
      token: null,
    },
  },

  a11y: {
    role: 'form',
    label: 'User Registration',
    description: 'Create a new account on Conduit',
    keyboard: {
      Tab: 'moveFocusNext',
      'Shift+Tab': 'moveFocusPrev',
      Enter: 'submitForm',
    },
    liveRegions: ['errorBanner', 'successMessage'],
  },
};

export function createRegistrationInstance(
  initialContext?: Partial<RegistrationContext>,
): WidgetInstance<RegistrationContext> {
  const defaultContext: RegistrationContext = {
    username: '',
    email: '',
    password: '',
    errors: [],
    token: null,
    ...initialContext,
  };

  const instance: WidgetInstance<RegistrationContext> = {
    spec: registrationWidgetSpec,
    state: registrationWidgetSpec.machine.initial,
    context: { ...defaultContext },

    transition(event: string, payload?: Record<string, unknown>) {
      const currentState = registrationWidgetSpec.machine.states[instance.state];
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
        case 'usernameField':
          return { ...base, value: instance.context.username, required: true, maxLength: 50, 'aria-label': 'Username' };
        case 'emailField':
          return { ...base, value: instance.context.email, required: true, type: 'email', 'aria-label': 'Email' };
        case 'passwordField':
          return { ...base, value: instance.context.password, required: true, type: 'password', minLength: 8, 'aria-label': 'Password' };
        case 'submitButton':
          return { ...base, disabled: instance.state === 'registering' || instance.state === 'success', 'aria-label': 'Sign Up' };
        case 'errorBanner':
          return { ...base, role: 'alert', 'aria-live': 'polite', hidden: instance.context.errors.length === 0 };
        case 'successMessage':
          return { ...base, role: 'status', 'aria-live': 'polite', hidden: instance.state !== 'success' };
        case 'form':
          return { ...base, role: 'form', 'aria-label': 'User Registration' };
        default:
          return base;
      }
    },

    destroy() {
      instance.state = registrationWidgetSpec.machine.initial;
      Object.assign(instance.context, defaultContext);
    },
  };

  return instance;
}
