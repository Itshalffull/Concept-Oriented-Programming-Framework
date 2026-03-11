// ============================================================
// CodeBlock -- Vue 3 Component
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

export interface CodeBlockProps {
  /** Source code content. */
  code: string;
  /** Programming language for syntax highlighting. */
  language?: string;
  /** Show line numbers. */
  showLineNumbers?: boolean;
  /** Lines to highlight (1-based). */
  highlightLines?: number[];
  /** Show the header bar with language + copy button. */
  showHeader?: boolean;
  /** Wrap long lines. */
  wrapLines?: boolean;
  /** Max height with scroll. */
  maxHeight?: string;
  /** Custom aria label. */
  ariaLabel?: string;
  /** Custom syntax highlighter. Returns highlighted HTML string. */
  highlightSyntax?: (code: string, language: string) => string;
  /** Custom copy button content. */
  copyIcon?: VNode | string;
}

export const CodeBlock = defineComponent({
  name: 'CodeBlock',

  props: {
    code: { type: String, required: true as const },
    language: { type: String, default: 'plaintext' },
    showLineNumbers: { type: Boolean, default: true },
    highlightLines: { type: Array as PropType<any[]> },
    showHeader: { type: Boolean, default: true },
    wrapLines: { type: Boolean, default: false },
    maxHeight: { type: String },
    ariaLabel: { type: String },
    highlightSyntax: { type: Function as PropType<(...args: any[]) => any> },
    copyIcon: { type: null as unknown as PropType<any> },
  },

  setup(props, { slots, emit }) {
    const state = ref<any>('idle');
    const send = (action: any) => { /* state machine dispatch */ };
    const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.code);
    } catch {
      /* fallback: noop */
    }
    send({ type: 'COPY' });
  };

    return (): VNode =>
      h('div', {
        'role': 'region',
        'aria-label': props.ariaLabel ?? `${language} code block`,
        'aria-roledescription': 'code block',
        'data-surface-widget': '',
        'data-widget-name': 'code-block',
        'data-part': 'code-block',
        'data-language': props.language,
        'data-state': state.value,
        'data-line-numbers': props.showLineNumbers ? 'true' : 'false',
        'data-wrap': props.wrapLines ? 'true' : 'false',
        'style': {
        maxHeight: props.maxHeight || undefined,
        overflow: props.maxHeight ? 'auto' : 'visible',
      },
        'onPointerEnter': () => send({ type: 'HOVER' }),
        'onPointerLeave': () => send({ type: 'UNHOVER' }),
        'onFocus': () => send({ type: 'FOCUS' }),
        'onBlur': () => send({ type: 'BLUR' }),
      }, [
        props.showHeader ? h('div', { 'data-part': 'header', 'data-visible': 'true' }, [
            h('span', { 'data-part': 'language', 'aria-label': `Language: ${language}` }, [
              props.language,
            ]),
            h('button', {
              'type': 'button',
              'role': 'button',
              'aria-label': state.value === 'copied' ? 'Copied to clipboard' : 'Copy code to clipboard',
              'aria-live': 'polite',
              'data-part': 'copy-button',
              'data-state': state.value === 'copied' ? 'copied' : 'idle',
              'tabindex': 0,
              'onClick': handleCopy,
            }, [
              props.copyIcon ?? (state.value === 'copied' ? 'Copied!' : 'Copy'),
            ]),
          ]) : null,
        h('div', { 'data-part': 'code-container', 'style': { display: 'flex' } }, [
          props.showLineNumbers ? h('div', {
              'data-part': 'line-numbers',
              'data-visible': 'true',
              'aria-hidden': 'true',
              'data-count': lines.length,
            }, [
              ...lines.map((_, i) => h('span', { 'data-part': 'line-number' }, [
                  i + 1,
                ])),
            ]) : null,
          h('pre', { 'data-part': 'pre', 'data-wrap': props.wrapLines ? 'true' : 'false' }, [
            renderedCode
              ? h('code', {
                'role': 'code',
                'data-part': 'code',
                'aria-label': `${language} source code`,
                'aria-readonly': 'true',
                'data-language': props.language,
                'data-wrap': props.wrapLines ? 'true' : 'false',
                'tabindex': 0,
                'dangerouslySetInnerHTML': { __html: renderedCode },
              })
              : h('code', {
                'role': 'code',
                'data-part': 'code',
                'aria-label': `${language} source code`,
                'aria-readonly': 'true',
                'data-language': props.language,
                'data-wrap': props.wrapLines ? 'true' : 'false',
                'tabindex': 0,
              }, [
                ...lines.map((line, i) => h('span', { 'data-part': 'code-line', 'data-highlighted': props.highlightLines?.includes(i + 1) ? 'true' : 'false' }, [
                    line,
                    '\n',
                  ])),
              ]),
          ]),
        ]),
      ]);
  },
});

export default CodeBlock;