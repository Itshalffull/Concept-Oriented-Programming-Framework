// ============================================================
// Minimap -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
} from 'vue';

export interface MinimapProps {
  /** Current zoom level. */
  zoom?: number;
  /** Pan X offset. */
  panX?: number;
  /** Pan Y offset. */
  panY?: number;
  /** Total content width. */
  contentWidth?: number;
  /** Total content height. */
  contentHeight?: number;
  /** Visible viewport width. */
  viewportWidth?: number;
  /** Visible viewport height. */
  viewportHeight?: number;
  /** Zoom percentage for display. */
  zoomPercent?: number;
  /** Viewport percentage. */
  viewportPercent?: number;
  /** Minimum zoom. */
  minZoom?: number;
  /** Maximum zoom. */
  maxZoom?: number;
  /** Called on zoom in. */
  onZoomIn?: () => void;
  /** Called on zoom out. */
  onZoomOut?: () => void;
  /** Called on zoom fit. */
  onZoomFit?: () => void;
  /** Called on pan change. */
  onPanChange?: (x: number, y: number) => void;
  /** Minimap canvas content. */
}

export const Minimap = defineComponent({
  name: 'Minimap',

  props: {
    zoom: { type: Number, default: 1.0 },
    panX: { type: Number, default: 0 },
    panY: { type: Number, default: 0 },
    contentWidth: { type: Number, default: 1000 },
    contentHeight: { type: Number, default: 1000 },
    viewportWidth: { type: Number, default: 800 },
    viewportHeight: { type: Number, default: 600 },
    zoomPercent: { type: Number, default: 100 },
    viewportPercent: { type: Number, default: 100 },
    minZoom: { type: Number, default: 0.1 },
    maxZoom: { type: Number, default: 10.0 },
    onZoomIn: { type: Function as PropType<(...args: any[]) => any> },
    onZoomOut: { type: Function as PropType<(...args: any[]) => any> },
    onZoomFit: { type: Function as PropType<(...args: any[]) => any> },
    onPanChange: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['pan-change'],

  setup(props, { slots, emit }) {
    const state = ref<any>('idle');
    const send = (action: any) => { /* state machine dispatch */ };
    const handleViewportPointerDown = (e: any) => {
      send({ type: 'PAN_START' });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

  const handleViewportPointerUp = () => {
    send({ type: 'PAN_END' });
  };

    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': 'Minimap',
        'aria-roledescription': 'minimap',
        'data-surface-widget': '',
        'data-widget-name': 'minimap',
        'data-part': 'minimap',
        'data-state': state.value,
      }, [
        h('div', {
          'data-part': 'minimap-canvas',
          'role': 'img',
          'aria-label': 'Content overview',
          'aria-hidden': 'true',
          'data-content-width': props.contentWidth,
          'data-content-height': props.contentHeight,
          'style': { position: 'relative', overflow: 'hidden' },
        }, [
          slots.default?.(),
          h('div', {
            'data-part': 'viewport',
            'role': 'slider',
            'aria-label': 'Viewport position',
            'aria-roledescription': 'viewport indicator',
            'aria-valuetext': `Viewing ${viewportPercent}% of content at ${zoomPercent}% zoom`,
            'tabindex': 0,
            'style': {
            position: 'absolute',
            left: `${vpLeft}px`,
            top: `${vpTop}px`,
            width: `${vpWidth}px`,
            height: `${vpHeight}px`,
            cursor: state.value === 'panning' ? 'grabbing' : 'grab',
          },
            'onPointerDown': handleViewportPointerDown,
            'onPointerUp': handleViewportPointerUp,
            'onPointerMove': handleViewportPointerMove,
          }),
        ]),
        h('div', {
          'data-part': 'zoom-controls',
          'role': 'group',
          'aria-label': 'Zoom controls',
        }, [
          h('button', {
            'type': 'button',
            'role': 'button',
            'aria-label': 'Zoom in',
            'data-part': 'zoom-in',
            'aria-disabled': props.zoom >= props.maxZoom || undefined,
            'onClick': props.onZoomIn,
          }, '+'),
          h('button', {
            'type': 'button',
            'role': 'button',
            'aria-label': 'Zoom out',
            'data-part': 'zoom-out',
            'aria-disabled': props.zoom <= props.minZoom || undefined,
            'onClick': props.onZoomOut,
          }, '-'),
          h('button', {
            'type': 'button',
            'role': 'button',
            'aria-label': 'Fit content to view',
            'data-part': 'zoom-fit',
            'onClick': props.onZoomFit,
          }, 'Fit'),
          h('span', {
            'data-part': 'zoom-level',
            'role': 'status',
            'aria-live': 'polite',
            'aria-label': `Zoom: ${zoomPercent}%`,
          }, [
            props.zoomPercent,
            '%',
          ]),
        ]),
      ]);
  },
});

export default Minimap;