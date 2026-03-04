// ============================================================
// DiffViewer -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
  computed,
} from 'vue';

export interface FileDiff {
  fileName: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  range: string;
  lines: DiffLine[];
}

export interface DiffViewerProps {
  original?: string;
  modified?: string;
  mode?: 'side-by-side' | 'unified';
  language?: string;
  fileName?: string;
  files?: FileDiff[];
  contextLines?: number;
  showLineNumbers?: boolean;
  showInlineHighlight?: boolean;
  showFileList?: boolean;
  expandCollapsed?: boolean;
  loading?: boolean;
  additions?: number;
  deletions?: number;
  onModeChange?: (mode: 'side-by-side' | 'unified') => void;
  onFileSelect?: (fileName: string) => void;
}

export const DiffViewer = defineComponent({
  name: 'DiffViewer',

  props: {
    original: { type: String, default: '' },
    modified: { type: String, default: '' },
    mode: { type: String, default: 'side-by-side' },
    language: { type: String },
    fileName: { type: String },
    files: { type: Array as PropType<any[]>, default: () => ([]) },
    contextLines: { type: Number, default: 3 },
    showLineNumbers: { type: Boolean, default: true },
    showInlineHighlight: { type: Boolean, default: true },
    showFileList: { type: Boolean, default: true },
    expandCollapsed: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    additions: { type: Number, default: 0 },
    deletions: { type: Number, default: 0 },
    onModeChange: { type: Function as PropType<(...args: any[]) => any> },
    onFileSelect: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['mode-change', 'file-select'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ mode: props.mode === 'unified' ? 'unified' : 'sideBySide', loading: props.loading ? 'loading' : 'idle', expandedRanges: new Set(), selectedFile: props.files.length > 0 ? props.files[0].fileName : null, currentChangeIndex: 0, });
    const send = (action: any) => { /* state machine dispatch */ };
    const diffLines = computed(() => computeDiffLines(props.original, props.modified));
    const additions = props.additions || diffLines.filter((l) => l.type === 'added').length;
    const deletions = props.deletions || diffLines.filter((l) => l.type === 'removed').length;
    const modeDisplay = state.value.mode === 'sideBySide' ? 'side-by-side' : 'unified';

    return (): VNode =>
      h('div', {
        'role': 'region',
        'aria-label': props.fileName ? `Diff viewer: ${fileName}` : 'Diff viewer',
        'aria-busy': props.loading ? 'true' : 'false',
        'data-surface-widget': '',
        'data-widget-name': 'diff-viewer',
        'data-part': 'root',
        'data-mode': modeDisplay,
        'data-state': props.loading ? 'loading' : 'idle',
      }, [
        h('div', {
          'role': 'toolbar',
          'aria-label': 'Diff controls',
          'data-part': 'toolbar',
        }, [
          h('button', {
            'type': 'button',
            'data-part': 'mode-toggle',
            'aria-label': 'Diff view mode',
            'onClick': handleModeToggle,
          }, [
            modeDisplay,
          ]),
          h('span', {
            'data-part': 'change-stats',
            'data-additions': additions,
            'data-deletions': deletions,
            'aria-live': 'polite',
            'aria-atomic': 'true',
            'aria-label': `${additions} additions, ${deletions} deletions`,
          }, [
            '+',
            additions,
            '-',
            deletions,
          ]),
          h('button', {
            'type': 'button',
            'data-part': 'prev-change-button',
            'aria-label': 'Previous change',
            'onClick': () => send({ type: 'PREV_CHANGE' }),
          }, 'Prev'),
          h('button', {
            'type': 'button',
            'data-part': 'next-change-button',
            'aria-label': 'Next change',
            'onClick': () => send({ type: 'NEXT_CHANGE' }),
          }, 'Next'),
        ]),
        props.showFileList && props.files.length > 1 ? h('div', {
            'role': 'list',
            'aria-label': 'Changed files',
            'data-part': 'file-list',
          }, [
            ...props.files.map((file) => h('div', {
                'role': 'listitem',
                'data-part': 'file-item',
                'data-file': file.fileName,
                'data-selected': state.value.selectedFile === file.fileName ? 'true' : 'false',
                'tabindex': 0,
                'onClick': () => {
                  send({ type: 'SELECT_FILE', fileName: file.fileName });
                  props.onFileSelect?.(file.fileName);
                },
              }, [
                h('span', { 'data-part': 'file-item-name' }, [
                  file.fileName,
                ]),
                h('span', { 'data-part': 'file-item-stats', 'aria-hidden': 'true' }, [
                  '+',
                  file.additions,
                  '-',
                  file.deletions,
                ]),
              ])),
          ]) : null,
        h('div', {
          'role': 'document',
          'aria-label': state.value.mode === 'sideBySide' ? 'Side-by-side diff' : 'Unified diff',
          'aria-roledescription': 'diff',
          'data-part': 'diff-panel',
          'data-mode': modeDisplay,
          'tabindex': 0,
        }, [
          state.value.mode === 'sideBySide' ? (
            <div data-part="side-by-side-container">
              <div data-part="left-header">Original</div>
              <div data-part="right-header">Modified</div>
              <div role="region" aria-label="Original version" data-part="left-pane">
                {diffLines
                  .filter((l) => l.type !== 'added')
                  .map((line, i) => (
                    <div
                      key={`left-${i}`}
                      data-part={
                        line.type === 'removed' ? 'removed-line' : 'unchanged-line'
                      }
                      data-line={line.oldLineNumber}
                      aria-label={
                        line.type === 'removed'
                          ? `Removed line ${line.oldLineNumber}: ${line.content}`
                          : `Line ${line.oldLineNumber}`
                      }
                    >
                      {props.showLineNumbers ? h('span', { 'data-part': 'line-number', 'aria-hidden': 'true' }, [
              line.oldLineNumber,
            ]) : null,
        ]),
        slots.default?.(),
      ]);
  },
});
  },
});))

export default DiffViewer;