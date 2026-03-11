// ============================================================
// SignaturePad -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
  onMounted,
  onUnmounted,
  watch,
} from 'vue';

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface SignaturePadProps {
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

export const SignaturePad = defineComponent({
  name: 'SignaturePad',

  props: {
    width: { type: Number, default: 400 },
    height: { type: Number, default: 200 },
    penColor: { type: String, default: '#000' },
    penWidth: { type: Number, default: 2.0 },
    backgroundColor: { type: String, default: '#fff' },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    name: { type: String },
    label: { type: String, default: 'Signature' },
    exportFormat: { type: String, default: 'png' },
    size: { type: String, default: 'md' },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['change'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const machine = ref<any>({ content: 'empty', focus: 'unfocused', });
    const send = (action: any) => { /* state machine dispatch */ };
    const canvasRef = ref<any>(null);
    const ctxRef = ref<any>(null);
    const isDrawingRef = ref<any>(false);
    const dataUrlRef = ref<any>(null);
    const exportSignature = () => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const mimeType = props.exportFormat === 'png' ? 'image/png' : 'image/svg+xml';
    const dataUrl = canvas.toDataURL(mimeType);
    dataUrlRef.value = dataUrl;
    props.onChange?.(dataUrl);
  };
    const clearCanvas = () => {
    const canvas = canvasRef.value;
    const ctx = ctxRef.value;
    if (!canvas || !ctx) return;
    ctx.fillStyle = props.backgroundColor;
    ctx.fillRect(0, 0, props.width, props.height);
    dataUrlRef.value = null;
    props.onChange?.(null);
    send({ type: 'CLEAR' });
  };
    const handleStrokeStart = (e: ReactPointerEvent) => {
      if (props.disabled) return;
      e.preventDefault();
      const ctx = ctxRef.value;
      if (!ctx) return;
      isDrawingRef.value = true;
      const pt = getPoint(e);
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.strokeStyle = props.penColor;
      ctx.lineWidth = props.penWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      send({ type: 'STROKE_START' });
    };

  const handleStrokeMove = (e: ReactPointerEvent) => {
      if (!isDrawingRef.value) return;
      e.preventDefault();
      const ctx = ctxRef.value;
      if (!ctx) return;
      const pt = getPoint(e);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    };

  const handleStrokeEnd = () => {
    if (!isDrawingRef.value) return;
    isDrawingRef.value = false;
    const ctx = ctxRef.value;
    if (ctx) ctx.closePath();
    send({ type: 'STROKE_END' });
    exportSignature();
  };
    const canvas = canvasRef.value;
    const ctx = canvas.getContext('2d');
    const mimeType = props.exportFormat === 'png' ? 'image/png' : 'image/svg+xml';
    const dataUrl = canvas.toDataURL(mimeType);
    const rect = canvas.getBoundingClientRect();

    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': props.label,
        'data-part': 'root',
        'data-state': contentState,
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-size': props.size,
        'data-surface-widget': '',
        'data-widget-name': 'signature-pad',
      }, [
        h('span', {
          'id': labelId,
          'data-part': 'label',
          'data-disabled': props.disabled ? 'true' : 'false',
          'data-required': props.required ? 'true' : 'false',
        }, [
          props.label,
        ]),
        h('canvas', {
          'ref': canvasRef,
          'role': 'application',
          'aria-label': `${label} drawing area`,
          'aria-roledescription': 'signature pad',
          'aria-describedby': labelId,
          'width': props.width,
          'height': props.height,
          'data-part': 'canvas',
          'data-state': machine.value.content === 'drawing' ? 'drawing' : 'idle',
          'data-empty': machine.value.content === 'empty' ? 'true' : 'false',
          'style': {
          width: `${width}px`,
          height: `${height}px`,
          props.backgroundColor,
          cursor: props.disabled ? 'not-allowed' : 'crosshair',
          touchAction: 'none',
        },
          'tabindex': props.disabled ? -1 : 0,
          'onPointerDown': handleStrokeStart,
          'onPointerMove': handleStrokeMove,
          'onPointerUp': handleStrokeEnd,
          'onPointerLeave': handleStrokeEnd,
          'onFocus': () => send({ type: 'FOCUS' }),
          'onBlur': () => send({ type: 'BLUR' }),
        }),
        h('button', {
          'type': 'button',
          'data-part': 'clear-button',
          'aria-label': 'Clear signature',
          'disabled': props.disabled || machine.value.content === 'empty',
          'data-visible': machine.value.content !== 'empty' ? 'true' : 'false',
          'onClick': clearCanvas,
        }, 'Clear'),
        props.name && <input type="hidden" props.name={props.name} value={dataUrlRef.value ?? ''} />,
      ]);
  },
});

export default SignaturePad;