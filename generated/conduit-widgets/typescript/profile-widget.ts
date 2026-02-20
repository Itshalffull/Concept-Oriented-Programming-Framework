import type {
  WidgetSpec,
  WidgetInstance,
} from './widget-spec';

export interface ProfileContext {
  username: string;
  bio: string;
  image: string;
  following: boolean;
  isOwnProfile: boolean;
  errors: string[];
}

export const profileWidgetSpec: WidgetSpec = {
  name: 'profile',
  version: '1.0.0',
  category: 'composite',

  concepts: [
    {
      concept: 'urn:copf/Profile',
      actions: ['update'],
      queries: ['get'],
    },
    {
      concept: 'urn:copf/Follow',
      actions: ['follow', 'unfollow'],
      queries: ['isFollowing'],
    },
  ],

  anatomy: {
    component: 'ProfileView',
    parts: [
      'root',
      'header',
      'avatar',
      'username',
      'bio',
      'editButton',
      'form',
      'bioInput',
      'imageInput',
      'saveButton',
      'cancelButton',
      'followButton',
      'errorBanner',
    ],
    slots: ['banner', 'tabs', 'content'],
  },

  elements: [
    {
      id: 'profile.avatar',
      kind: 'media-display',
      label: 'Avatar',
      dataType: 'string',
      required: false,
      scope: '#/properties/image',
    },
    {
      id: 'profile.username',
      kind: 'output-text',
      label: 'Username',
      dataType: 'string',
      required: true,
      scope: '#/properties/username',
    },
    {
      id: 'profile.bio',
      kind: 'output-text',
      label: 'Bio',
      dataType: 'string',
      required: false,
      scope: '#/properties/bio',
    },
    {
      id: 'profile.bioInput',
      kind: 'input-text',
      label: 'Bio',
      dataType: 'string',
      required: false,
      scope: '#/properties/bio',
    },
    {
      id: 'profile.imageInput',
      kind: 'input-text',
      label: 'Profile Image URL',
      dataType: 'string',
      required: false,
      scope: '#/properties/image',
    },
    {
      id: 'profile.editButton',
      kind: 'trigger',
      label: 'Edit Profile',
      dataType: 'void',
      required: false,
      scope: '#/actions/update',
    },
    {
      id: 'profile.saveButton',
      kind: 'trigger',
      label: 'Save Profile',
      dataType: 'void',
      required: false,
      scope: '#/actions/update',
    },
    {
      id: 'profile.followButton',
      kind: 'trigger',
      label: 'Follow',
      dataType: 'void',
      required: false,
      scope: '#/actions/follow',
    },
  ],

  machine: {
    initial: 'loading',
    states: {
      loading: {
        name: 'loading',
        on: {
          LOADED: { target: 'viewing', action: 'populateProfile' },
          ERROR: { target: 'error', action: 'setErrors' },
        },
      },
      viewing: {
        name: 'viewing',
        on: {
          EDIT: { target: 'editing', guard: 'isOwnProfile' },
          FOLLOW: { target: 'toggling', action: 'invokeFollow' },
          UNFOLLOW: { target: 'toggling', action: 'invokeUnfollow' },
        },
      },
      editing: {
        name: 'editing',
        on: {
          SAVE: { target: 'saving', action: 'collectFormData' },
          CANCEL: { target: 'viewing', action: 'discardEdits' },
        },
      },
      saving: {
        name: 'saving',
        on: {
          SAVED: { target: 'viewing', action: 'applyUpdate' },
          SAVE_ERROR: { target: 'error', action: 'setErrors' },
        },
      },
      toggling: {
        name: 'toggling',
        on: {
          TOGGLED: { target: 'viewing', action: 'applyFollowState' },
          ERROR: { target: 'viewing', action: 'setErrors' },
        },
      },
      error: {
        name: 'error',
        on: {
          DISMISS: { target: 'viewing', action: 'clearErrors' },
        },
      },
    },
    context: {
      username: '',
      bio: '',
      image: '',
      following: false,
      isOwnProfile: false,
      errors: [],
    },
  },

  a11y: {
    role: 'region',
    label: 'User Profile',
    description: 'View or edit a user profile',
    keyboard: {
      Tab: 'moveFocusNext',
      'Shift+Tab': 'moveFocusPrev',
      Enter: 'activateFocused',
      Escape: 'cancelEdit',
    },
    liveRegions: ['errorBanner'],
  },
};

export function createProfileInstance(
  initialContext?: Partial<ProfileContext>,
): WidgetInstance<ProfileContext> {
  const defaultContext: ProfileContext = {
    username: '',
    bio: '',
    image: '',
    following: false,
    isOwnProfile: false,
    errors: [],
    ...initialContext,
  };

  const instance: WidgetInstance<ProfileContext> = {
    spec: profileWidgetSpec,
    state: profileWidgetSpec.machine.initial,
    context: { ...defaultContext },

    transition(event: string, payload?: Record<string, unknown>) {
      const currentState = profileWidgetSpec.machine.states[instance.state];
      if (!currentState) return;
      const transition = currentState.on[event];
      if (!transition) return;

      if (transition.guard === 'isOwnProfile' && !instance.context.isOwnProfile) {
        return;
      }

      if (payload) {
        Object.assign(instance.context, payload);
      }
      instance.state = transition.target;
    },

    getProps(part: string): Record<string, unknown> {
      const base: Record<string, unknown> = { 'data-part': part, 'data-state': instance.state };

      switch (part) {
        case 'root':
          return { ...base, role: 'region', 'aria-label': `Profile: ${instance.context.username}` };
        case 'avatar':
          return { ...base, src: instance.context.image, alt: `${instance.context.username}'s avatar` };
        case 'username':
          return { ...base, textContent: instance.context.username };
        case 'bio':
          return { ...base, textContent: instance.context.bio };
        case 'bioInput':
          return { ...base, value: instance.context.bio, 'aria-label': 'Bio', hidden: instance.state !== 'editing' };
        case 'imageInput':
          return { ...base, value: instance.context.image, 'aria-label': 'Profile Image URL', hidden: instance.state !== 'editing' };
        case 'editButton':
          return { ...base, hidden: !instance.context.isOwnProfile || instance.state === 'editing', 'aria-label': 'Edit Profile' };
        case 'saveButton':
          return { ...base, hidden: instance.state !== 'editing', disabled: instance.state === 'saving', 'aria-label': 'Save Profile' };
        case 'cancelButton':
          return { ...base, hidden: instance.state !== 'editing', 'aria-label': 'Cancel Editing' };
        case 'followButton':
          return { ...base, hidden: instance.context.isOwnProfile, 'aria-pressed': instance.context.following, 'aria-label': instance.context.following ? `Unfollow ${instance.context.username}` : `Follow ${instance.context.username}`, disabled: instance.state === 'toggling' };
        case 'errorBanner':
          return { ...base, role: 'alert', 'aria-live': 'assertive', hidden: instance.context.errors.length === 0 };
        default:
          return base;
      }
    },

    destroy() {
      instance.state = profileWidgetSpec.machine.initial;
      Object.assign(instance.context, defaultContext);
    },
  };

  return instance;
}
