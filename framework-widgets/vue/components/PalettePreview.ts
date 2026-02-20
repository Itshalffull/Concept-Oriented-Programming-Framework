// ============================================================
// PalettePreview — Vue 3 Component
//
// Renders a color scale swatch grid. Each swatch is a colored
// cell labeled with its step (50, 100, ..., 950) and hex value.
// Supports multiple named palettes rendered as rows.
// ============================================================

import {
  defineComponent,
  h,
  computed,
  type PropType,
  type VNode,
} from 'vue';

import type { ColorScale, SemanticRole } from '../../shared/types.js';

import { contrastRatio } from '../../shared/coif-bridge.js';

// --- Types ---

export interface PaletteEntry {
  name: string;
  role?: SemanticRole;
  scale: ColorScale;
}

// Color step keys in display order
const COLOR_STEPS = [
  '50', '100', '200', '300', '400',
  '500', '600', '700', '800', '900', '950',
] as const;

export const PalettePreview = defineComponent({
  name: 'PalettePreview',

  props: {
    /** Array of named palettes to preview */
    palettes: {
      type: Array as PropType<PaletteEntry[]>,
      required: true,
      validator: (v: unknown) => Array.isArray(v),
    },
    /** Size of each swatch cell */
    swatchSize: {
      type: String as PropType<string>,
      default: '48px',
    },
    /** Whether to show hex value labels */
    showValues: {
      type: Boolean as PropType<boolean>,
      default: true,
    },
    /** Whether to show step number labels */
    showSteps: {
      type: Boolean as PropType<boolean>,
      default: true,
    },
  },

  setup(props) {
    /** Determine appropriate text color for contrast */
    function textColorFor(bg: string): string {
      const whiteContrast = contrastRatio('#ffffff', bg);
      const blackContrast = contrastRatio('#000000', bg);
      return whiteContrast > blackContrast ? '#ffffff' : '#000000';
    }

    const gridStyle = computed(() => ({
      display: 'grid',
      'grid-template-columns': `repeat(${COLOR_STEPS.length}, ${props.swatchSize})`,
      gap: '2px',
    }));

    function renderSwatch(color: string, step: string): VNode {
      const textColor = textColorFor(color);
      return h(
        'div',
        {
          class: 'coif-palette-preview__swatch',
          style: {
            'background-color': color,
            color: textColor,
            width: props.swatchSize,
            height: props.swatchSize,
            display: 'flex',
            'flex-direction': 'column',
            'align-items': 'center',
            'justify-content': 'center',
            'font-size': '10px',
            'line-height': '1.3',
            'border-radius': '4px',
          },
          title: `${step}: ${color}`,
          'data-step': step,
          'data-color': color,
        },
        [
          props.showSteps
            ? h('span', { class: 'coif-palette-preview__step' }, step)
            : null,
          props.showValues
            ? h('span', { class: 'coif-palette-preview__value' }, color)
            : null,
        ],
      );
    }

    function renderPaletteRow(entry: PaletteEntry): VNode {
      const scale = entry.scale as unknown as Record<string, string>;
      const swatches = COLOR_STEPS.map((step) =>
        renderSwatch(scale[step], step),
      );

      return h(
        'div',
        {
          class: 'coif-palette-preview__row',
          'data-palette': entry.name,
          'data-role': entry.role ?? undefined,
        },
        [
          h(
            'div',
            {
              class: 'coif-palette-preview__label',
              style: {
                'font-weight': '600',
                'margin-bottom': '4px',
                'font-size': '12px',
              },
            },
            [
              entry.name,
              entry.role
                ? h(
                    'span',
                    {
                      class: 'coif-palette-preview__role',
                      style: { 'margin-left': '8px', opacity: '0.6' },
                    },
                    `(${entry.role})`,
                  )
                : null,
            ],
          ),
          h(
            'div',
            { class: 'coif-palette-preview__swatches', style: gridStyle.value },
            swatches,
          ),
        ],
      );
    }

    return (): VNode =>
      h(
        'div',
        {
          class: 'coif-palette-preview',
          role: 'presentation',
          style: { display: 'flex', 'flex-direction': 'column', gap: '16px' },
        },
        props.palettes.map(renderPaletteRow),
      );
  },
});

export default PalettePreview;
