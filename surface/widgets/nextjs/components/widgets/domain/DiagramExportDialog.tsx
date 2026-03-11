'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type HTMLAttributes,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { exportDialogReducer } from './DiagramExportDialog.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ExportFormat {
  name: string;
  label: string;
  mime_type: string;
}

export interface DiagramExportDialogProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Canvas to export. */
  canvasId: string;
  /** Available export formats. */
  formats?: ExportFormat[];
  /** Currently selected format. */
  selectedFormat?: string;
  /** Export width in pixels. */
  width?: number;
  /** Export height in pixels. */
  height?: number;
  /** Include background in export. */
  includeBackground?: boolean;
  /** Embed round-trip data. */
  embedData?: boolean;
  /** Called when format changes. */
  onFormatChange?: (format: string) => void;
  /** Called when size changes. */
  onSizeChange?: (width: number, height: number) => void;
  /** Called when background toggle changes. */
  onBackgroundChange?: (include: boolean) => void;
  /** Called when embed toggle changes. */
  onEmbedChange?: (embed: boolean) => void;
  /** Called on export. */
  onExport?: (format: string, width: number, height: number, background: boolean, embed: boolean) => void;
  /** Called on cancel. */
  onCancel?: () => void;
  /** Preview slot. */
  preview?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const DiagramExportDialog = forwardRef<HTMLDivElement, DiagramExportDialogProps>(
  function DiagramExportDialog(
    {
      canvasId,
      formats = [],
      selectedFormat,
      width = 1920,
      height = 1080,
      includeBackground = true,
      embedData = false,
      onFormatChange,
      onSizeChange,
      onBackgroundChange,
      onEmbedChange,
      onExport,
      onCancel,
      preview,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(exportDialogReducer, 'open');
    const formatRef = useRef<HTMLSelectElement>(null);

    // Focus trap: focus format selector on open
    useEffect(() => {
      if (state === 'open' || state === 'configured') {
        formatRef.current?.focus();
      }
    }, [state]);

    const handleFormatChange = useCallback(
      (e: ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        send({ type: 'SELECT_FORMAT', format: value });
        onFormatChange?.(value);
      },
      [onFormatChange],
    );

    const handleExport = useCallback(() => {
      if (state === 'exporting' || !selectedFormat) return;
      send({ type: 'EXPORT' });
      onExport?.(selectedFormat, width, height, includeBackground, embedData);
    }, [state, selectedFormat, width, height, includeBackground, embedData, onExport]);

    const handleCancel = useCallback(() => {
      send({ type: 'CANCEL' });
      onCancel?.();
    }, [onCancel]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); handleExport(); }
        if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
      },
      [handleExport, handleCancel],
    );

    if (state === 'closed') return null;

    return (
      <div
        ref={ref}
        role="dialog"
        aria-label="Export diagram"
        aria-modal="true"
        data-surface-widget=""
        data-widget-name="diagram-export-dialog"
        data-part="export-dialog"
        data-canvas={canvasId}
        data-state={state}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        <select
          ref={formatRef}
          data-part="format-selector"
          aria-label="Export format"
          value={selectedFormat ?? ''}
          onChange={handleFormatChange}
        >
          <option value="" disabled>Select format...</option>
          {formats.map((f) => (
            <option key={f.name} value={f.name}>{f.label}</option>
          ))}
        </select>

        <div data-part="size-options" role="group" aria-label="Export size">
          <input
            type="number"
            aria-label="Width"
            value={width}
            onChange={(e) => onSizeChange?.(Number(e.target.value), height)}
          />
          <input
            type="number"
            aria-label="Height"
            value={height}
            onChange={(e) => onSizeChange?.(width, Number(e.target.value))}
          />
        </div>

        <label data-part="background-toggle">
          <input
            type="checkbox"
            checked={includeBackground}
            onChange={(e) => onBackgroundChange?.(e.target.checked)}
          />
          Include background
        </label>

        <label data-part="embed-toggle">
          <input
            type="checkbox"
            checked={embedData}
            onChange={(e) => {
              send({ type: 'TOGGLE_EMBED', value: e.target.checked });
              onEmbedChange?.(e.target.checked);
            }}
          />
          Embed data
        </label>

        {preview && <div data-part="preview">{preview}</div>}

        <div data-part="actions">
          <button
            data-part="export-button"
            role="button"
            aria-label={`Export as ${selectedFormat ?? 'unknown'}`}
            disabled={state === 'exporting' || !selectedFormat}
            onClick={handleExport}
          >
            {state === 'exporting' ? 'Exporting...' : 'Export'}
          </button>

          <button
            data-part="cancel-button"
            role="button"
            aria-label="Cancel export"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  },
);

DiagramExportDialog.displayName = 'DiagramExportDialog';
export { DiagramExportDialog };
export default DiagramExportDialog;
