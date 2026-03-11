'use client';

/**
 * StatCardsDisplay — renders data as a grid of stat cards.
 * Each record becomes a stat card showing a label and value.
 *
 * Fields config determines which field is the label and which is the value.
 * First field = label, second field = value, third field (optional) = description.
 */

import React from 'react';
import { StatCard } from './StatCard';
import type { FieldConfig } from './TableDisplay';

interface StatCardsDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
}

export const StatCardsDisplay: React.FC<StatCardsDisplayProps> = ({ data, fields }) => {
  const labelField = fields[0]?.key ?? 'label';
  const valueField = fields[1]?.key ?? 'value';
  const descField = fields[2]?.key ?? 'description';

  return (
    <div className="card-grid card-grid--stats">
      {data.map((item, index) => (
        <StatCard
          key={`${item[labelField]}-${index}`}
          label={String(item[labelField] ?? '')}
          value={String(item[valueField] ?? '0')}
          description={item[descField] ? String(item[descField]) : undefined}
        />
      ))}
    </div>
  );
};

export default StatCardsDisplay;
