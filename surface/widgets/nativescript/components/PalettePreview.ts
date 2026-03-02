// ============================================================
// Clef Surface NativeScript Widget — PalettePreview
//
// Displays a grid of Clef Surface design token color swatches
// using NativeScript. Renders labeled color boxes for visual
// design review.
// ============================================================

import { StackLayout, WrapLayout, Label, ContentView } from '@nativescript/core';

// --------------- Props ---------------

export interface PalettePreviewProps {
  tokens?: Record<string, string>;
  title?: string;
  columns?: number;
  showLabels?: boolean;
  showValues?: boolean;
  swatchSize?: number;
}

// --------------- Component ---------------

export function createPalettePreview(props: PalettePreviewProps = {}): StackLayout {
  const {
    tokens = {},
    title = 'Palette',
    columns = 4,
    showLabels = true,
    showValues = false,
    swatchSize = 48,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-palette-preview';

  const titleLabel = new Label();
  titleLabel.text = title;
  titleLabel.fontWeight = 'bold';
  titleLabel.marginBottom = 8;
  container.addChild(titleLabel);

  const colorTokens = Object.entries(tokens).filter(
    ([, value]) => value.startsWith('#') || value.startsWith('rgb'),
  );

  if (colorTokens.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No color tokens found';
    emptyLabel.opacity = 0.6;
    container.addChild(emptyLabel);
    return container;
  }

  const grid = new WrapLayout();
  grid.orientation = 'horizontal';
  grid.itemWidth = swatchSize + 16;
  grid.itemHeight = swatchSize + (showLabels ? 24 : 0) + (showValues ? 16 : 0);

  colorTokens.forEach(([name, value]) => {
    const swatchContainer = new StackLayout();
    swatchContainer.horizontalAlignment = 'center';
    swatchContainer.margin = 4;

    const swatch = new ContentView();
    swatch.width = swatchSize;
    swatch.height = swatchSize;
    swatch.borderRadius = 4;
    swatch.backgroundColor = value as any;
    swatch.borderWidth = 1;
    swatch.borderColor = '#CCCCCC';
    swatchContainer.addChild(swatch);

    if (showLabels) {
      const nameLabel = new Label();
      nameLabel.text = name;
      nameLabel.fontSize = 10;
      nameLabel.horizontalAlignment = 'center';
      nameLabel.opacity = 0.7;
      swatchContainer.addChild(nameLabel);
    }

    if (showValues) {
      const valueLabel = new Label();
      valueLabel.text = value;
      valueLabel.fontSize = 9;
      valueLabel.horizontalAlignment = 'center';
      valueLabel.opacity = 0.5;
      swatchContainer.addChild(valueLabel);
    }

    grid.addChild(swatchContainer);
  });

  container.addChild(grid);
  return container;
}

createPalettePreview.displayName = 'PalettePreview';
export default createPalettePreview;
