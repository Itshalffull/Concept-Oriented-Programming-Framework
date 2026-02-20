import type {
  WidgetSpec,
  WidgetInstance,
} from './widget-spec';

export interface SettingsContext {
  imageUrl: string;
  username: string;
  bio: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  errors: string[];
  saved: boolean;
}

export const settingsWidgetSpec: WidgetSpec = {
  name: 'settings',
  version: '1.0.0',
  category: 'form',

  concepts: [
    {
      concept: 'urn:copf/Profile',
      actions: ['update'],
      queries: ['get'],
    },
    {
      concept: 'urn:copf/Password',
      actions: ['validate', 'set'],
      queries: [],
    },
  ],

  anatomy: {
    component: 'SettingsForm',
    parts: [
      'root',
      'profileSection',
      'imageField',
      'usernameField',
      'bioField',
      'passwordSection',
      'currentPasswordField',
      'newPasswordField',
      'saveButton',
      'logoutButton',
      'successMessage',
      'errorBanner',
    ],
    slots: ['header', 'footer'],
  },

  elements: [
    {
      id: 'settings.profileSection',
      kind: 'group',
      label: 'Profile Settings',
      dataType: 'object',
      required: true,
      scope: '#/properties/profile',
      children: [
        {
          id: 'settings.imageUrl',
          kind: 'input-text',
          label: 'Profile Image URL',
          dataType: 'string',
          required: false,
          scope: '#/properties/imageUrl',
        },
        {
          id: 'settings.username',
          kind: 'input-text',
          label: 'Username',
          dataType: 'string',
          required: true,
          scope: '#/properties/username',
        },
        {
          id: 'settings.bio',
          kind: 'input-text',
          label: 'Short Bio',
          dataType: 'string',
          required: false,
          scope: '#/properties/bio',
        },
      ],
    },
    {
      id: 'settings.passwordSection',
      kind: 'group',
      label: 'Password Settings',
      dataType: 'object',
      required: false,
      scope: '#/properties/password',
      children: [
        {
          id: 'settings.currentPassword',
          kind: 'input-text',
          label: 'Current Password',
          dataType: 'string',
          required: false,
          scope: '#/properties/currentPassword',
        },
        {
          id: 'settings.newPassword',
          kind: 'input-text',
          label: 'New Password',
          dataType: 'string',
          required: false,
          scope: '#/properties/newPassword',
          constraints: { minLength: 8 },
        },
      ],
    },
    {
      id: 'settings.saveButton',
      kind: 'trigger',
      label: 'Update Settings',
      dataType: 'void',
      required: false,
      scope: '#/actions/update',
    },
    {
      id: 'settings.logoutButton',
      kind: 'trigger',
      label: 'Logout',
      dataType: 'void',
      required: false,
      scope: '#/actions/logout',
    },
  ],

  machine: {
    initial: 'idle',
    states: {
      idle: {
        name: 'idle',
        on: {
          EDIT: { target: 'editing', action: 'beginEditing' },
        },
      },
      editing: {
        name: 'editing',
        on: {
          SAVE: { target: 'validating', action: 'collectFormData' },
          LOGOUT: { target: 'idle', action: 'invokeLogout' },
        },
      },
      validating: {
        name: 'validating',
        on: {
          VALID: { target: 'saving', action: 'invokeSave' },
          INVALID: { target: 'editing', action: 'setErrors' },
        },
      },
      saving: {
        name: 'saving',
        on: {
          SAVED: { target: 'success', action: 'applyUpdate' },
          SAVE_ERROR: { target: 'error', action: 'setErrors' },
        },
      },
      success: {
        name: 'success',
        on: {
          EDIT: { target: 'editing', action: 'beginEditing' },
        },
      },
      error: {
        name: 'error',
        on: {
          RETRY: { target: 'editing', action: 'clearErrors' },
        },
      },
    },
    context: {
      imageUrl: '',
      username: '',
      bio: '',
      email: '',
      currentPassword: '',
      newPassword: '',
      errors: [],
      saved: false,
    },
  },

  a11y: {
    role: 'form',
    label: 'User Settings',
    description: 'Update your profile and password settings',
    keyboard: {
      Tab: 'moveFocusNext',
      'Shift+Tab': 'moveFocusPrev',
      Enter: 'submitForm',
    },
    liveRegions: ['successMessage', 'errorBanner'],
  },
};

export function createSettingsInstance(
  initialContext?: Partial<SettingsContext>,
): WidgetInstance<SettingsContext> {
  const defaultContext: SettingsContext = {
    imageUrl: '',
    username: '',
    bio: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    errors: [],
    saved: false,
    ...initialContext,
  };

  const instance: WidgetInstance<SettingsContext> = {
    spec: settingsWidgetSpec,
    state: settingsWidgetSpec.machine.initial,
    context: { ...defaultContext },

    transition(event: string, payload?: Record<string, unknown>) {
      const currentState = settingsWidgetSpec.machine.states[instance.state];
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
          return { ...base, role: 'form', 'aria-label': 'User Settings' };
        case 'imageField':
          return { ...base, value: instance.context.imageUrl, 'aria-label': 'Profile Image URL' };
        case 'usernameField':
          return { ...base, value: instance.context.username, required: true, 'aria-label': 'Username' };
        case 'bioField':
          return { ...base, value: instance.context.bio, 'aria-label': 'Short Bio' };
        case 'currentPasswordField':
          return { ...base, value: instance.context.currentPassword, type: 'password', 'aria-label': 'Current Password' };
        case 'newPasswordField':
          return { ...base, value: instance.context.newPassword, type: 'password', minLength: 8, 'aria-label': 'New Password' };
        case 'saveButton':
          return { ...base, disabled: instance.state === 'saving' || instance.state === 'validating', 'aria-label': 'Update Settings' };
        case 'logoutButton':
          return { ...base, 'aria-label': 'Logout' };
        case 'successMessage':
          return { ...base, role: 'status', 'aria-live': 'polite', hidden: instance.state !== 'success' };
        case 'errorBanner':
          return { ...base, role: 'alert', 'aria-live': 'assertive', hidden: instance.context.errors.length === 0 };
        case 'profileSection':
          return { ...base, role: 'group', 'aria-label': 'Profile Settings' };
        case 'passwordSection':
          return { ...base, role: 'group', 'aria-label': 'Password Settings' };
        default:
          return base;
      }
    },

    destroy() {
      instance.state = settingsWidgetSpec.machine.initial;
      Object.assign(instance.context, defaultContext);
    },
  };

  return instance;
}
