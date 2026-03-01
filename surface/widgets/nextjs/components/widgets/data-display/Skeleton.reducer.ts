export type SkeletonState = { current: 'loading' | 'hidden' };

export type SkeletonAction =
  | { type: 'CONTENT_READY' }
  | { type: 'CONTENT_LOADING' };

export function skeletonReducer(state: SkeletonState, action: SkeletonAction): SkeletonState {
  switch (state.current) {
    case 'loading':
      if (action.type === 'CONTENT_READY') return { current: 'hidden' };
      return state;
    case 'hidden':
      if (action.type === 'CONTENT_LOADING') return { current: 'loading' };
      return state;
    default:
      return state;
  }
}

export const skeletonInitialState: SkeletonState = { current: 'loading' };
