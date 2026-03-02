// ============================================================
// Clef Surface Ink Widget — StatCard
//
// Key performance indicator display showing a labelled numeric
// value with an optional trend indicator and description. Used
// in dashboards and summary views. Terminal adaptation: bordered
// card with label, large value, and colored change indicator.
// See widget spec: repertoire/widgets/data-display/stat-card.widget
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface StatCardProps {
  /** Descriptive label identifying the metric. */
  label: string;
  /** Primary numeric or formatted value. */
  value: string;
  /** Change delta or percentage string (e.g., "+12%"). */
  change?: string;
  /** Direction of the change. */
  changeType?: 'increase' | 'decrease' | 'neutral';
  /** Optional icon or emoji. */
  icon?: string;
}

// --------------- Helpers ---------------

const TREND_ICONS: Record<string, string> = {
  increase: '\u25B2', // ▲
  decrease: '\u25BC', // ▼
  neutral: '\u25C6',  // ◆
};

const TREND_COLORS: Record<string, string> = {
  increase: 'green',
  decrease: 'red',
  neutral: 'yellow',
};

// --------------- Component ---------------

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  change,
  changeType = 'neutral',
  icon,
}) => {
  const trendIcon = TREND_ICONS[changeType] ?? TREND_ICONS.neutral;
  const trendColor = TREND_COLORS[changeType] ?? TREND_COLORS.neutral;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      paddingX={1}
      paddingY={0}
    >
      {/* Label row */}
      <Box>
        {icon && <Text>{icon} </Text>}
        <Text dimColor>{label}</Text>
      </Box>

      {/* Value */}
      <Box marginTop={0}>
        <Text bold>{value}</Text>
      </Box>

      {/* Change indicator */}
      {change && (
        <Box>
          <Text color={trendColor}>
            {trendIcon} {change}
          </Text>
        </Box>
      )}
    </Box>
  );
};

StatCard.displayName = 'StatCard';
export default StatCard;
