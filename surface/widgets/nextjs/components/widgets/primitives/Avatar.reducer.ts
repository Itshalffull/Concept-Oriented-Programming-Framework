// State machine from avatar.widget spec: loading -> loaded | error
export type AvatarState = 'loading' | 'loaded' | 'error';
export type AvatarEvent =
  | { type: 'LOAD_SUCCESS' }
  | { type: 'LOAD_ERROR' }
  | { type: 'INVALIDATE' }
  | { type: 'RETRY' };

export function avatarReducer(state: AvatarState, event: AvatarEvent): AvatarState {
  switch (state) {
    case 'loading':
      if (event.type === 'LOAD_SUCCESS') return 'loaded';
      if (event.type === 'LOAD_ERROR') return 'error';
      return state;
    case 'loaded':
      if (event.type === 'INVALIDATE') return 'loading';
      return state;
    case 'error':
      if (event.type === 'RETRY') return 'loading';
      return state;
    default:
      return state;
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
