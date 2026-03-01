/* ---------------------------------------------------------------------------
 * ImageGallery state machine
 * States: grid (initial), lightbox
 * ------------------------------------------------------------------------- */

export interface GalleryState {
  mode: 'grid' | 'lightbox';
  currentIndex: number;
}

export type GalleryEvent =
  | { type: 'OPEN_LIGHTBOX'; index: number }
  | { type: 'CLOSE' }
  | { type: 'ESCAPE' }
  | { type: 'NEXT' }
  | { type: 'PREV' };

export function galleryReducer(state: GalleryState, event: GalleryEvent): GalleryState {
  switch (state.mode) {
    case 'grid':
      if (event.type === 'OPEN_LIGHTBOX') return { mode: 'lightbox', currentIndex: event.index };
      return state;
    case 'lightbox':
      if (event.type === 'CLOSE' || event.type === 'ESCAPE') return { ...state, mode: 'grid' };
      if (event.type === 'NEXT') return { ...state, currentIndex: state.currentIndex + 1 };
      if (event.type === 'PREV') return { ...state, currentIndex: state.currentIndex - 1 };
      return state;
    default:
      return state;
  }
}
