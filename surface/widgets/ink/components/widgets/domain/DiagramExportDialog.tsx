// ============================================================
// Clef Surface Ink Widget — DiagramExportDialog
//
// Export dialog for diagrams supporting multiple formats.
// Adapts the diagram-export-dialog.widget spec.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface DiagramExportDialogProps {
  /** Whether the dialog is open. */
  open?: boolean;
  /** Available export formats. */
  formats?: string[];
  /** Currently selected format. */
  selectedFormat?: string;
  /** Callback when export is confirmed. */
  onExport?: (format: string) => void;
  /** Callback when dialog is closed. */
  onClose?: () => void;
}

// --------------- Component ---------------

export const DiagramExportDialog: React.FC<DiagramExportDialogProps> = ({
  open = false,
  formats = ['svg', 'png', 'pdf'],
  selectedFormat = 'svg',
}) => {
  if (!open) return null;
  return (
    <Box flexDirection="column" borderStyle="double">
      <Text bold>Export Diagram</Text>
      {formats.map((fmt) => (
        <Text key={fmt}>{fmt === selectedFormat ? '> ' : '  '}{fmt}</Text>
      ))}
    </Box>
  );
};

export default DiagramExportDialog;
