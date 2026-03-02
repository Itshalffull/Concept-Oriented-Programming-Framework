// ============================================================
// Clef Surface Ink Widget — DataList
//
// Key-value pair display rendering a list of labelled data
// fields. Each item consists of a term (label) and a detail
// (value). Supports horizontal and vertical layout orientations.
// Terminal adaptation: "Label: Value" list format with alignment.
// See widget spec: repertoire/widgets/data-display/data-list.widget
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Types ---------------

export interface DataListItem {
  label: string;
  value: string;
}

// --------------- Props ---------------

export interface DataListProps {
  /** Array of label-value pairs to display. */
  items: DataListItem[];
  /** Layout orientation for the list. */
  orientation?: 'horizontal' | 'vertical';
}

// --------------- Component ---------------

export const DataList: React.FC<DataListProps> = ({
  items,
  orientation = 'vertical',
}) => {
  if (items.length === 0) {
    return <Text dimColor>No data</Text>;
  }

  if (orientation === 'horizontal') {
    return (
      <Box flexDirection="row" flexWrap="wrap">
        {items.map((item, i) => (
          <Box key={`dl-${i}`} marginRight={3}>
            <Text bold>{item.label}: </Text>
            <Text>{item.value}</Text>
          </Box>
        ))}
      </Box>
    );
  }

  // Vertical layout: align labels to max label width
  const maxLabelLen = Math.max(...items.map((item) => item.label.length), 1);

  return (
    <Box flexDirection="column">
      {items.map((item, i) => (
        <Box key={`dl-${i}`}>
          <Text bold>{item.label.padEnd(maxLabelLen, ' ')}</Text>
          <Text dimColor> : </Text>
          <Text>{item.value}</Text>
        </Box>
      ))}
    </Box>
  );
};

DataList.displayName = 'DataList';
export default DataList;
