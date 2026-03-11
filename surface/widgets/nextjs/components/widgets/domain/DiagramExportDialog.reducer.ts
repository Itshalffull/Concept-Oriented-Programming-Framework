/* ---------------------------------------------------------------------------
 * DiagramExportDialog state machine
 * States: open (initial), configured, exporting, complete, closed
 * ------------------------------------------------------------------------- */

export type ExportDialogState = 'open' | 'configured' | 'exporting' | 'complete' | 'closed';
export type ExportDialogEvent =
  | { type: 'SELECT_FORMAT'; format: string }
  | { type: 'TOGGLE_EMBED'; value: boolean }
  | { type: 'EXPORT' }
  | { type: 'COMPLETE' }
  | { type: 'ERROR' }
  | { type: 'CANCEL' }
  | { type: 'CLOSE' }
  | { type: 'EXPORT_AGAIN' };

export function exportDialogReducer(state: ExportDialogState, event: ExportDialogEvent): ExportDialogState {
  switch (state) {
    case 'open':
      if (event.type === 'SELECT_FORMAT') return 'configured';
      if (event.type === 'CANCEL') return 'closed';
      return state;
    case 'configured':
      if (event.type === 'EXPORT') return 'exporting';
      if (event.type === 'SELECT_FORMAT') return 'configured';
      if (event.type === 'CANCEL') return 'closed';
      return state;
    case 'exporting':
      if (event.type === 'COMPLETE') return 'complete';
      if (event.type === 'ERROR') return 'configured';
      return state;
    case 'complete':
      if (event.type === 'CLOSE') return 'closed';
      if (event.type === 'EXPORT_AGAIN') return 'configured';
      return state;
    case 'closed':
      return state;
    default:
      return state;
  }
}
