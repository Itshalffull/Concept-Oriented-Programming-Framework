// ============================================================
// Clef Surface NativeScript Widget — ImageGallery
//
// Image gallery with grid view and lightbox.
// ============================================================

import { StackLayout, Label, Image, ScrollView, FlexboxLayout } from '@nativescript/core';

export interface GalleryImage { id: string; src: string; alt?: string; thumbnail?: string; }

export interface ImageGalleryProps {
  images?: GalleryImage[];
  columns?: number;
  gap?: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onOpen?: (id: string) => void;
}

export function createImageGallery(props: ImageGalleryProps): ScrollView {
  const { images = [], columns = 3, gap = 4, selectedId, onSelect, onOpen } = props;
  const scrollView = new ScrollView();
  const grid = new FlexboxLayout();
  grid.className = 'clef-widget-image-gallery';
  grid.flexWrap = 'wrap';

  for (const img of images) {
    const thumb = new StackLayout();
    thumb.className = img.id === selectedId ? 'clef-gallery-item-selected' : 'clef-gallery-item';
    thumb.margin = String(gap / 2);
    const image = new Image();
    image.src = img.thumbnail || img.src;
    image.stretch = 'aspectFill';
    image.width = 100;
    image.height = 100;
    image.accessibilityLabel = img.alt || 'Gallery image';
    thumb.addChild(image);
    thumb.on('tap', () => { onSelect?.(img.id); onOpen?.(img.id); });
    grid.addChild(thumb);
  }

  scrollView.content = grid;
  return scrollView;
}

export default createImageGallery;
