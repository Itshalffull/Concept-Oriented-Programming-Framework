// ============================================================
// PalettePreview — Next.js Server Component that renders a
// color scale swatch grid.
//
// Given a Clef Surface ColorScale (50-950) and an optional
// semantic role label, renders each shade as a visual swatch
// cell with the hex value and step label. Contrast ratio
// against white and black is computed so that the text overlay
// is readable.
//
// Server Component friendly — no 'use client' needed.
// Functional component only — no classes.
// ============================================================

import { type ReactNode, type CSSProperties } from 'react';

import type { ColorScale, SemanticRole } from '../../shared/types.js';
import { contrastRatio } from '../../shared/surface-bridge.js';

// --------------- Props ---------------

export interface PalettePreviewProps {
  /** The 50-950 color scale to render. */
  readonly scale: ColorScale;
  /** Semantic role label (e.g. "primary", "error"). */
  readonly role?: SemanticRole | string;
  /** Human-readable palette name displayed as a heading. */
  readonly name?: string;
  /** Show hex values on each swatch. @default true */
  readonly showValues?: boolean;
  /** Show step labels (50, 100, ...). @default true */
  readonly showLabels?: boolean;
  /** Optional class name. */
  readonly className?: string;
  /** Optional inline styles for the root grid. */
  readonly style?: CSSProperties;
}

// --------------- Constants ---------------

const STEPS = [
  '50', '100', '200', '300', '400',
  '500', '600', '700', '800', '900', '950',
] as const;

type StepKey = (typeof STEPS)[number];

// --------------- Helpers ---------------

/**
 * Choose black or white text for readability based on the
 * contrast ratio against the swatch background.
 */
const textColorForBackground = (bg: string): string => {
  const ratioWhite = contrastRatio('#ffffff', bg);
  const ratioBlack = contrastRatio('#000000', bg);
  return ratioWhite >= ratioBlack ? '#ffffff' : '#000000';
};

const swatchCellStyle = (bg: string, fg: string): CSSProperties => ({
  backgroundColor: bg,
  color: fg,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 4px',
  minHeight: '64px',
  fontFamily: 'monospace',
  fontSize: '11px',
  lineHeight: 1.4,
  borderRadius: '4px',
});

// --------------- Component ---------------

export const PalettePreview = ({
  scale,
  role,
  name,
  showValues = true,
  showLabels = true,
  className,
  style,
}: PalettePreviewProps): ReactNode => {
  const scaleRecord = scale as unknown as Record<string, string>;

  const swatches = STEPS.map((step) => {
    const color = scaleRecord[step] ?? '#cccccc';
    return {
      step,
      color,
      textColor: textColorForBackground(color),
    };
  });

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${STEPS.length}, 1fr)`,
    gap: '2px',
    ...style,
  };

  return (
    <div
      className={className}
      data-surface-palette=""
      data-surface-adapter="nextjs"
      data-role={role ?? undefined}
    >
      {(name || role) && (
        <div
          data-surface-palette-header=""
          style={{
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
          }}
        >
          {name && (
            <strong data-surface-palette-name="">{name}</strong>
          )}
          {role && (
            <span
              data-surface-palette-role=""
              style={{ opacity: 0.7, fontSize: '0.85em' }}
            >
              ({role})
            </span>
          )}
        </div>
      )}

      <div
        data-surface-palette-grid=""
        style={gridStyle}
        role="img"
        aria-label={`Color scale${name ? ` for ${name}` : ''}${role ? ` (${role})` : ''}`}
      >
        {swatches.map(({ step, color, textColor }) => (
          <div
            key={step}
            data-surface-swatch=""
            data-step={step}
            style={swatchCellStyle(color, textColor)}
            title={`${step}: ${color}`}
          >
            {showLabels && (
              <span data-surface-swatch-label="">{step}</span>
            )}
            {showValues && (
              <span data-surface-swatch-value="">{color}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

PalettePreview.displayName = 'PalettePreview';
export default PalettePreview;
