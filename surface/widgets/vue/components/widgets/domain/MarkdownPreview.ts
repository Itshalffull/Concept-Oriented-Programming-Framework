// ============================================================
// MarkdownPreview -- Vue 3 Component
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

export interface MarkdownPreviewProps {
  /** Raw markdown source string. */
  source: string;
  /** Whether to sanitize output. */
  sanitize?: boolean;
  /** Accessible label. */
  ariaLabel?: string;
  /** Whether to apply syntax highlighting. */
  syntaxHighlight?: boolean;
  /** Target for links. */
  linkTarget?: '_self' | '_blank';
  /** Maximum height with overflow scroll. */
  maxHeight?: string;
  /** Custom markdown renderer. Returns HTML string. */
  renderMarkdown?: (source: string) => string;
}

export const MarkdownPreview = defineComponent({
  name: 'MarkdownPreview',

  props: {
    source: { type: String, required: true as const },
    sanitize: { type: Boolean, default: true },
    ariaLabel: { type: String, default: 'Markdown preview' },
    syntaxHighlight: { type: Boolean, default: true },
    linkTarget: { type: String, default: '_blank' },
    maxHeight: { type: String },
    renderMarkdown: { type: Function as PropType<(...args: any[]) => any> },
  },

  setup(props, { slots, emit }) {
    const renderedHtml = props.renderMarkdown ? props.renderMarkdown(props.source) : props.source;

    return (): VNode =>
      h('div', {
        'role': 'document',
        'aria-label': props.ariaLabel,
        'aria-roledescription': 'markdown content',
        'data-surface-widget': '',
        'data-widget-name': 'markdown-preview',
        'data-part': 'markdown-preview',
        'data-state': state,
        'data-sanitized': props.sanitize ? 'true' : 'false',
        'data-syntax-highlight': props.syntaxHighlight ? 'true' : 'false',
        'tabindex': 0,
        'style': {
          maxHeight: props.maxHeight || undefined,
          overflow: props.maxHeight ? 'auto' : 'visible',
        },
      }, [
        h('div', {
          'data-part': 'content',
          'role': 'region',
          'aria-label': 'Rendered content',
          'dangerouslySetInnerHTML': { __html: renderedHtml },
        }),
      ]);
  },
});

export default MarkdownPreview;