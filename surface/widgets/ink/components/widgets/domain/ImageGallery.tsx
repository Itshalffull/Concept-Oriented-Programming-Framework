// ============================================================
// Clef Surface Ink Widget — ImageGallery
//
// Thumbnail grid with image placeholders rendered in the terminal.
// Since terminal cannot display actual images, each item shows as
// a bracketed placeholder with alt text and optional caption.
// Arrow keys navigate the grid.
//
// Adapts the image-gallery.widget spec: anatomy (root, grid,
// thumbnail, lightbox, lightboxImage, prevButton, nextButton,
// counter, closeButton), states, and connect attributes.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface GalleryImage {
  src: string;
  alt: string;
  caption?: string;
}

// --------------- Props ---------------

export interface ImageGalleryProps {
  /** Array of images to display. */
  images: GalleryImage[];
  /** Index of the currently selected image. */
  selectedIndex?: number;
  /** Number of columns in the grid. */
  columns?: number;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when an image is selected. */
  onSelect?: (index: number) => void;
}

// --------------- Component ---------------

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  selectedIndex = 0,
  columns = 3,
  isFocused = false,
  onSelect,
}) => {
  const [focusedIndex, setFocusedIndex] = useState(selectedIndex);

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.rightArrow) {
        setFocusedIndex((i) => Math.min(i + 1, images.length - 1));
      } else if (key.leftArrow) {
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (key.downArrow) {
        setFocusedIndex((i) => Math.min(i + columns, images.length - 1));
      } else if (key.upArrow) {
        setFocusedIndex((i) => Math.max(i - columns, 0));
      } else if (key.return) {
        onSelect?.(focusedIndex);
      }
    },
    { isActive: isFocused },
  );

  // Break into rows
  const rows: GalleryImage[][] = [];
  for (let i = 0; i < images.length; i += columns) {
    rows.push(images.slice(i, i + columns));
  }

  const itemWidth = 20;

  return (
    <Box flexDirection="column">
      {rows.map((row, rowIndex) => (
        <Box key={rowIndex} gap={1}>
          {row.map((image, colIndex) => {
            const globalIndex = rowIndex * columns + colIndex;
            const isFocusedItem = isFocused && focusedIndex === globalIndex;
            const isSelected = globalIndex === selectedIndex;

            return (
              <Box
                key={globalIndex}
                flexDirection="column"
                width={itemWidth}
                borderStyle={isFocusedItem ? 'single' : undefined}
                borderColor={isFocusedItem ? 'cyan' : undefined}
              >
                <Text
                  inverse={isSelected}
                  bold={isFocusedItem}
                  color={isFocusedItem ? 'cyan' : undefined}
                >
                  {'\uD83D\uDDBC'} {image.alt.slice(0, itemWidth - 4)}
                </Text>
                {image.caption && (
                  <Text dimColor wrap="truncate">
                    {image.caption.slice(0, itemWidth - 2)}
                  </Text>
                )}
              </Box>
            );
          })}
        </Box>
      ))}

      {/* Counter */}
      <Box marginTop={1} justifyContent="center">
        <Text dimColor>
          {focusedIndex + 1} of {images.length}
        </Text>
      </Box>

      {isFocused && (
        <Box marginTop={0}>
          <Text dimColor>
            {'\u2190\u2191\u2192\u2193'} navigate {'  '} Enter select
          </Text>
        </Box>
      )}
    </Box>
  );
};

ImageGallery.displayName = 'ImageGallery';
export default ImageGallery;
