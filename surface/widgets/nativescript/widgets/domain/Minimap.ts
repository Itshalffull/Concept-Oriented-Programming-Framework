// ============================================================
// Clef Surface NativeScript Widget — Minimap
//
// Miniature overview of content. Renders a scaled-down
// representation of document structure with a draggable
// viewport indicator. Shows section headings and scroll
// position relative to the full document.
// ============================================================

import {
  StackLayout,
  Label,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface MinimapSection {
  label: string;
  height: number;
  color?: string;
  type?: string;
}

export interface MinimapProps {
  sections?: MinimapSection[];
  viewportTop?: number;
  viewportHeight?: number;
  totalHeight?: number;
  width?: number;
  height?: number;
  showLabels?: boolean;
  accentColor?: string;
  onViewportChange?: (top: number) => void;
  onSectionClick?: (index: number) => void;
}

// --------------- Component ---------------

export function createMinimap(props: MinimapProps = {}): StackLayout {
  const {
    sections = [],
    viewportTop = 0,
    viewportHeight = 100,
    totalHeight = 1000,
    width = 120,
    height = 200,
    showLabels = true,
    accentColor = '#06b6d4',
    onViewportChange,
    onSectionClick,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-minimap';
  container.width = width;
  container.height = height;
  container.backgroundColor = new Color('#0a0a1a');
  container.borderWidth = 1;
  container.borderColor = new Color('#333333');
  container.borderRadius = 4;
  container.clipToBounds = true;

  // Scale factor
  const scale = totalHeight > 0 ? height / totalHeight : 1;

  // Render sections as colored bars
  let yOffset = 0;
  sections.forEach((section, index) => {
    const sectionHeight = Math.max(2, Math.round(section.height * scale));

    const sectionBar = new StackLayout();
    sectionBar.height = sectionHeight;
    sectionBar.width = width - 4;
    sectionBar.marginLeft = 2;
    sectionBar.marginRight = 2;
    sectionBar.backgroundColor = new Color(section.color || '#1a1a2e');
    sectionBar.borderRadius = 1;
    sectionBar.marginBottom = 1;

    if (showLabels && sectionHeight >= 10) {
      const label = new Label();
      label.text = section.label;
      label.fontSize = 7;
      label.color = new Color('#888888');
      label.textWrap = false;
      label.paddingLeft = 2;
      sectionBar.addChild(label);
    }

    // Type indicator
    if (section.type) {
      const typeColors: Record<string, string> = {
        heading: '#3b82f6', code: '#22c55e', image: '#f97316',
        table: '#8b5cf6', list: '#eab308',
      };
      sectionBar.borderLeftWidth = 2;
      sectionBar.borderLeftColor = new Color(typeColors[section.type] || '#555555');
    }

    sectionBar.on(GestureTypes.tap as any, () => onSectionClick?.(index));
    container.addChild(sectionBar);

    yOffset += sectionHeight + 1;
  });

  // Fill remaining space
  if (yOffset < height) {
    const filler = new StackLayout();
    filler.height = height - yOffset;
    filler.backgroundColor = new Color('#05050f');
    container.addChild(filler);
  }

  // Viewport indicator overlay
  // Since NativeScript StackLayout doesn't support absolute positioning
  // within itself easily, we render the viewport indicator as a separate row
  const vpContainer = new StackLayout();
  vpContainer.marginTop = -height; // overlay on top
  vpContainer.height = height;
  vpContainer.clipToBounds = true;

  const vpTopSpace = new StackLayout();
  vpTopSpace.height = Math.round(viewportTop * scale);
  vpTopSpace.backgroundColor = new Color('#00000000');
  vpContainer.addChild(vpTopSpace);

  const vpIndicator = new StackLayout();
  vpIndicator.height = Math.max(8, Math.round(viewportHeight * scale));
  vpIndicator.width = width - 2;
  vpIndicator.borderWidth = 1;
  vpIndicator.borderColor = new Color(accentColor);
  vpIndicator.backgroundColor = new Color(`${accentColor}20`);
  vpIndicator.borderRadius = 2;
  vpIndicator.marginLeft = 1;

  vpIndicator.on(GestureTypes.pan as any, (args: any) => {
    const deltaY = args.deltaY ?? 0;
    const newTop = Math.max(0, Math.min(totalHeight - viewportHeight, viewportTop + deltaY / scale));
    onViewportChange?.(newTop);
  });

  vpContainer.addChild(vpIndicator);

  // Scroll position label
  const posLabel = new Label();
  posLabel.text = `${Math.round((viewportTop / totalHeight) * 100)}%`;
  posLabel.fontSize = 8;
  posLabel.color = new Color(accentColor);
  posLabel.horizontalAlignment = 'center';
  posLabel.marginTop = 2;
  container.addChild(posLabel);

  return container;
}

export default createMinimap;
