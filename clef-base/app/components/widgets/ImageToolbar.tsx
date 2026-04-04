'use client';

/**
 * ImageToolbar — floating toolbar that appears when a region is drawn on
 * RegionOverlay, allowing users to create image region records.
 *
 * Matches SpanToolbar styling patterns (dark inverse-surface background,
 * inverse-on-surface text, same radius/elevation tokens).
 */

import React from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ImageToolbarProps {
  /** Whether the toolbar is visible (typically after a region is drawn). */
  visible: boolean;
  /** Absolute position of the toolbar relative to its containing element. */
  position: { x: number; y: number };
  /** Called when the user clicks "Create Region". */
  onCreateRegion: () => void;
  /** Called when the user clicks "Copy Region Reference". */
  onCopyReference: () => void;
  /** Called when the user cancels (dismiss the drawn region). */
  onCancel: () => void;
}

// ─── ImageToolbar Component ────────────────────────────────────────────────

export const ImageToolbar: React.FC<ImageToolbarProps> = ({
  visible,
  position,
  onCreateRegion,
  onCopyReference,
  onCancel,
}) => {
  if (!visible) return null;

  const btnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--palette-inverse-on-surface, #fff)',
    padding: '4px 8px',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    fontSize: '13px',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  };

  return (
    <div
      data-part="image-toolbar"
      role="toolbar"
      aria-label="Image region actions"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 1200,
        background: 'var(--palette-inverse-surface, #1a1a2e)',
        borderRadius: 'var(--radius-md)',
        padding: '2px 4px',
        display: 'flex',
        alignItems: 'center',
        gap: '1px',
        boxShadow: 'var(--elevation-3, 0 6px 16px rgba(0,0,0,0.2))',
        userSelect: 'none',
      }}
    >
      <button
        style={btnStyle}
        title="Create Region"
        onMouseDown={(e) => { e.preventDefault(); onCreateRegion(); }}
      >
        <span style={{ fontSize: '14px' }}>{'📐'}</span> Region
      </button>

      <Separator />

      <button
        style={btnStyle}
        title="Copy Region Reference"
        onMouseDown={(e) => { e.preventDefault(); onCopyReference(); }}
      >
        <span style={{ fontSize: '14px' }}>{'📋'}</span> Copy Ref
      </button>

      <Separator />

      <button
        style={{ ...btnStyle, opacity: 0.6 }}
        title="Cancel"
        onMouseDown={(e) => { e.preventDefault(); onCancel(); }}
      >
        {'✕'}
      </button>
    </div>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const Separator: React.FC = () => (
  <div style={{
    width: 1,
    height: 20,
    background: 'rgba(255,255,255,0.2)',
    margin: '0 2px',
    flexShrink: 0,
  }} />
);

export default ImageToolbar;
