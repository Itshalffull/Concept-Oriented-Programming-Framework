// ============================================================
// Clef Surface NativeScript Widget — ImageGallery
//
// Image grid with lightbox. Displays images in a wrap-layout
// grid with thumbnails, captions, and a detail overlay. Supports
// selection, navigation between images, and zoom controls.
// ============================================================

import {
  StackLayout,
  GridLayout,
  WrapLayout,
  Label,
  Image,
  Button,
  ScrollView,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface GalleryImage {
  id: string;
  src: string;
  thumbnail?: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface ImageGalleryProps {
  images?: GalleryImage[];
  columns?: number;
  thumbnailSize?: number;
  gap?: number;
  selectedImageId?: string;
  lightboxOpen?: boolean;
  lightboxIndex?: number;
  showCaptions?: boolean;
  accentColor?: string;
  onImageSelect?: (id: string) => void;
  onLightboxOpen?: (id: string) => void;
  onLightboxClose?: () => void;
  onLightboxNext?: () => void;
  onLightboxPrev?: () => void;
}

// --------------- Component ---------------

export function createImageGallery(props: ImageGalleryProps = {}): StackLayout {
  const {
    images = [],
    columns = 3,
    thumbnailSize = 100,
    gap = 4,
    selectedImageId,
    lightboxOpen = false,
    lightboxIndex = 0,
    showCaptions = true,
    accentColor = '#06b6d4',
    onImageSelect,
    onLightboxOpen,
    onLightboxClose,
    onLightboxNext,
    onLightboxPrev,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-image-gallery';

  // Header
  const header = new StackLayout();
  header.orientation = 'horizontal';
  header.padding = 4;
  header.marginBottom = 4;

  const titleLabel = new Label();
  titleLabel.text = '\uD83D\uDDBC Gallery';
  titleLabel.fontWeight = 'bold';
  titleLabel.color = new Color(accentColor);
  titleLabel.marginRight = 8;
  header.addChild(titleLabel);

  const countLabel = new Label();
  countLabel.text = `${images.length} images`;
  countLabel.fontSize = 11;
  countLabel.opacity = 0.5;
  header.addChild(countLabel);

  container.addChild(header);

  // Grid view
  if (!lightboxOpen) {
    const scrollView = new ScrollView();
    const grid = new WrapLayout();
    grid.orientation = 'horizontal';
    grid.padding = gap;

    images.forEach((img) => {
      const isSelected = img.id === selectedImageId;

      const cell = new StackLayout();
      cell.width = thumbnailSize;
      cell.marginRight = gap;
      cell.marginBottom = gap;
      cell.borderRadius = 4;
      cell.borderWidth = isSelected ? 2 : 1;
      cell.borderColor = new Color(isSelected ? accentColor : '#333333');
      cell.backgroundColor = new Color('#1a1a2e');

      // Thumbnail
      const thumbnail = new Image();
      thumbnail.src = img.thumbnail || img.src;
      thumbnail.width = thumbnailSize;
      thumbnail.height = thumbnailSize;
      thumbnail.stretch = 'aspectFill';
      thumbnail.borderRadius = 3;
      cell.addChild(thumbnail);

      // Caption
      if (showCaptions && (img.caption || img.alt)) {
        const captionLabel = new Label();
        captionLabel.text = img.caption || img.alt || '';
        captionLabel.fontSize = 9;
        captionLabel.textWrap = true;
        captionLabel.padding = 2;
        captionLabel.opacity = 0.7;
        captionLabel.maxLines = 2;
        cell.addChild(captionLabel);
      }

      // Dimensions
      if (img.width && img.height) {
        const dimLabel = new Label();
        dimLabel.text = `${img.width}\u00D7${img.height}`;
        dimLabel.fontSize = 8;
        dimLabel.opacity = 0.3;
        dimLabel.padding = 2;
        cell.addChild(dimLabel);
      }

      cell.on(GestureTypes.tap as any, () => onImageSelect?.(img.id));
      cell.on(GestureTypes.doubleTap as any, () => onLightboxOpen?.(img.id));

      grid.addChild(cell);
    });

    // Empty state
    if (images.length === 0) {
      const emptyLabel = new Label();
      emptyLabel.text = 'No images to display.';
      emptyLabel.opacity = 0.4;
      emptyLabel.horizontalAlignment = 'center';
      emptyLabel.marginTop = 20;
      grid.addChild(emptyLabel);
    }

    scrollView.content = grid;
    container.addChild(scrollView);
  }

  // Lightbox overlay
  if (lightboxOpen && images.length > 0) {
    const validIndex = Math.max(0, Math.min(lightboxIndex, images.length - 1));
    const currentImage = images[validIndex];

    const lightbox = new StackLayout();
    lightbox.className = 'clef-image-gallery-lightbox';
    lightbox.backgroundColor = new Color('#000000ee');
    lightbox.padding = 16;

    // Close button
    const closeRow = new GridLayout();
    closeRow.columns = '*, auto';

    const posLabel = new Label();
    posLabel.text = `${validIndex + 1} / ${images.length}`;
    posLabel.color = new Color('#ffffff');
    posLabel.fontSize = 13;
    GridLayout.setColumn(posLabel, 0);
    closeRow.addChild(posLabel);

    const closeBtn = new Button();
    closeBtn.text = '\u2716 Close';
    closeBtn.fontSize = 12;
    closeBtn.on('tap', () => onLightboxClose?.());
    GridLayout.setColumn(closeBtn, 1);
    closeRow.addChild(closeBtn);

    lightbox.addChild(closeRow);

    // Image
    const fullImage = new Image();
    fullImage.src = currentImage.src;
    fullImage.stretch = 'aspectFit';
    fullImage.marginTop = 8;
    fullImage.marginBottom = 8;
    lightbox.addChild(fullImage);

    // Caption
    if (currentImage.caption || currentImage.alt) {
      const captionLabel = new Label();
      captionLabel.text = currentImage.caption || currentImage.alt || '';
      captionLabel.color = new Color('#ffffff');
      captionLabel.fontSize = 13;
      captionLabel.textWrap = true;
      captionLabel.horizontalAlignment = 'center';
      captionLabel.marginBottom = 8;
      lightbox.addChild(captionLabel);
    }

    // Navigation
    const navRow = new GridLayout();
    navRow.columns = 'auto, *, auto';

    const prevBtn = new Button();
    prevBtn.text = '\u25C0 Prev';
    prevBtn.isEnabled = validIndex > 0;
    prevBtn.on('tap', () => onLightboxPrev?.());
    GridLayout.setColumn(prevBtn, 0);
    navRow.addChild(prevBtn);

    const nextBtn = new Button();
    nextBtn.text = 'Next \u25B6';
    nextBtn.isEnabled = validIndex < images.length - 1;
    nextBtn.on('tap', () => onLightboxNext?.());
    GridLayout.setColumn(nextBtn, 2);
    navRow.addChild(nextBtn);

    lightbox.addChild(navRow);

    container.addChild(lightbox);
  }

  return container;
}

export default createImageGallery;
