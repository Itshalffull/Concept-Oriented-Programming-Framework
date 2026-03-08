'use client';

// ============================================================
// Clef Surface Next.js Widget — TripleZoneLayout
//
// Three-zone layout dividing content into fieldset (structured
// data fields), canvas (block content / rich editor area), and
// related items panel. Supports collapsible zones and responsive
// stacking. Used as the primary detail/editor layout for
// version-space entities.
// ============================================================

import React, { useState, useCallback } from 'react';

// --------------- Types ---------------

export type ZoneName = 'fieldset' | 'canvas' | 'related';
export type LayoutMode = 'horizontal' | 'stacked';

// --------------- Props ---------------

export interface TripleZoneLayoutProps {
  /** Layout mode: horizontal (side-by-side) or stacked (vertical). */
  layoutMode?: LayoutMode;
  /** Which zones are currently collapsed. */
  collapsedZones?: ZoneName[];
  /** Content for the fieldset zone (structured data). */
  fieldsetContent?: React.ReactNode;
  /** Content for the canvas zone (block / rich content). */
  canvasContent?: React.ReactNode;
  /** Content for the related items zone. */
  relatedContent?: React.ReactNode;
  /** Callback when a zone's collapse state changes. */
  onToggleZone?: (zone: ZoneName, collapsed: boolean) => void;
  /** Label for the fieldset zone. */
  fieldsetLabel?: string;
  /** Label for the canvas zone. */
  canvasLabel?: string;
  /** Label for the related items zone. */
  relatedLabel?: string;
}

// --------------- State Machine ---------------

type FocusedZone = ZoneName | null;

// --------------- Component ---------------

export const TripleZoneLayout: React.FC<TripleZoneLayoutProps> = ({
  layoutMode = 'horizontal',
  collapsedZones: collapsedZonesProp = [],
  fieldsetContent,
  canvasContent,
  relatedContent,
  onToggleZone,
  fieldsetLabel = 'Fields',
  canvasLabel = 'Content',
  relatedLabel = 'Related',
}) => {
  const [collapsedZones, setCollapsedZones] = useState<Set<ZoneName>>(
    new Set(collapsedZonesProp),
  );
  const [focusedZone, setFocusedZone] = useState<FocusedZone>(null);

  // Sync prop
  React.useEffect(() => {
    setCollapsedZones(new Set(collapsedZonesProp));
  }, [collapsedZonesProp]);

  const handleToggleZone = useCallback(
    (zone: ZoneName) => {
      setCollapsedZones((prev) => {
        const next = new Set(prev);
        const willCollapse = !next.has(zone);
        if (willCollapse) {
          next.add(zone);
        } else {
          next.delete(zone);
        }
        onToggleZone?.(zone, willCollapse);
        return next;
      });
    },
    [onToggleZone],
  );

  const handleFocusZone = useCallback((zone: ZoneName) => {
    setFocusedZone(zone);
  }, []);

  const isCollapsed = (zone: ZoneName) => collapsedZones.has(zone);

  const renderZone = (
    zone: ZoneName,
    label: string,
    content: React.ReactNode,
  ) => (
    <section
      role="region"
      aria-label={label}
      data-zone={zone}
      data-collapsed={isCollapsed(zone) ? 'true' : 'false'}
      data-focused={focusedZone === zone ? 'true' : 'false'}
      data-part={`zone-${zone}`}
      onFocus={() => handleFocusZone(zone)}
    >
      {/* Zone header with collapse toggle */}
      <div data-part={`zone-${zone}-header`}>
        <span data-part={`zone-${zone}-label`}>{label}</span>
        <button
          data-part={`zone-${zone}-toggle`}
          aria-label={`${isCollapsed(zone) ? 'Expand' : 'Collapse'} ${label}`}
          aria-expanded={!isCollapsed(zone) ? 'true' : 'false'}
          onClick={() => handleToggleZone(zone)}
          type="button"
        />
      </div>

      {/* Zone content */}
      <div
        data-part={`zone-${zone}-content`}
        hidden={isCollapsed(zone)}
      >
        {content}
      </div>
    </section>
  );

  return (
    <div
      role="group"
      aria-label="Triple zone layout"
      data-layout={layoutMode}
      data-part="root"
    >
      {renderZone('fieldset', fieldsetLabel, fieldsetContent)}
      {renderZone('canvas', canvasLabel, canvasContent)}
      {renderZone('related', relatedLabel, relatedContent)}
    </div>
  );
};

TripleZoneLayout.displayName = 'TripleZoneLayout';
export default TripleZoneLayout;
