'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { signatureReducer } from './SignaturePad.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface SignaturePadProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Canvas width in pixels. */
  width?: number;
  /** Canvas height in pixels. */
  height?: number;
  /** Stroke color. */
  penColor?: string;
  /** Stroke width. */
  penWidth?: number;
  /** Canvas background color. */
  backgroundColor?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Whether the field is required. */
  required?: boolean;
  /** Form field name. */
  name?: string;
  /** Accessible label. */
  label?: string;
  /** Export format. */
  exportFormat?: 'png' | 'svg';
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when signature changes (data URL). */
  onChange?: (dataUrl: string | null) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const SignaturePad = forwardRef<HTMLDivElement, SignaturePadProps>(function SignaturePad(
  {
    width = 400,
    height = 200,
    penColor = '#000',
    penWidth = 2.0,
    backgroundColor = '#fff',
    disabled = false,
    required = false,
    name,
    label = 'Signature',
    exportFormat = 'png',
    size = 'md',
    onChange,
    ...rest
  },
  ref,
) {
  const [machine, send] = useReducer(signatureReducer, {
    content: 'empty',
    focus: 'unfocused',
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const labelId = useId();
  const dataUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }, [width, height, backgroundColor]);

  const exportSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mimeType = exportFormat === 'png' ? 'image/png' : 'image/svg+xml';
    const dataUrl = canvas.toDataURL(mimeType);
    dataUrlRef.current = dataUrl;
    onChange?.(dataUrl);
  }, [exportFormat, onChange]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
    dataUrlRef.current = null;
    onChange?.(null);
    send({ type: 'CLEAR' });
  }, [backgroundColor, width, height, onChange]);

  const getPoint = (e: ReactPointerEvent | ReactTouchEvent | PointerEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    if ('clientX' in e) {
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    return { x: 0, y: 0 };
  };

  const handleStrokeStart = useCallback(
    (e: ReactPointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      const ctx = ctxRef.current;
      if (!ctx) return;
      isDrawingRef.current = true;
      const pt = getPoint(e);
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      send({ type: 'STROKE_START' });
    },
    [disabled, penColor, penWidth],
  );

  const handleStrokeMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const ctx = ctxRef.current;
      if (!ctx) return;
      const pt = getPoint(e);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    },
    [],
  );

  const handleStrokeEnd = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const ctx = ctxRef.current;
    if (ctx) ctx.closePath();
    send({ type: 'STROKE_END' });
    exportSignature();
  }, [exportSignature]);

  const contentState = machine.content === 'empty' ? 'empty' : machine.content === 'drawing' ? 'drawing' : 'drawn';

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      data-part="root"
      data-state={contentState}
      data-disabled={disabled ? 'true' : 'false'}
      data-size={size}
      data-surface-widget=""
      data-widget-name="signature-pad"
      {...rest}
    >
      <span id={labelId} data-part="label" data-disabled={disabled ? 'true' : 'false'} data-required={required ? 'true' : 'false'}>
        {label}
      </span>

      <canvas
        ref={canvasRef}
        role="application"
        aria-label={`${label} drawing area`}
        aria-roledescription="signature pad"
        aria-describedby={labelId}
        width={width}
        height={height}
        data-part="canvas"
        data-state={machine.content === 'drawing' ? 'drawing' : 'idle'}
        data-empty={machine.content === 'empty' ? 'true' : 'false'}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor,
          cursor: disabled ? 'not-allowed' : 'crosshair',
          touchAction: 'none',
        }}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handleStrokeStart}
        onPointerMove={handleStrokeMove}
        onPointerUp={handleStrokeEnd}
        onPointerLeave={handleStrokeEnd}
        onFocus={() => send({ type: 'FOCUS' })}
        onBlur={() => send({ type: 'BLUR' })}
      />

      <button
        type="button"
        data-part="clear-button"
        aria-label="Clear signature"
        disabled={disabled || machine.content === 'empty'}
        data-visible={machine.content !== 'empty' ? 'true' : 'false'}
        onClick={clearCanvas}
      >
        Clear
      </button>

      {name && <input type="hidden" name={name} value={dataUrlRef.current ?? ''} />}
    </div>
  );
});

SignaturePad.displayName = 'SignaturePad';
export { SignaturePad };
export default SignaturePad;
