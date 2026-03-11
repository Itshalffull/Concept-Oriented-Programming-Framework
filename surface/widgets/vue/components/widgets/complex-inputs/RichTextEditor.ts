// ============================================================
// RichTextEditor -- Vue 3 Component
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

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface RichTextEditorProps {
  /** Initial HTML content. */
  value?: string;
  /** Default (uncontrolled) content. */
  defaultValue?: string;
  /** Placeholder text when empty. */
  placeholder?: string;
  /** Accessible label. */
  label?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Whether the field is required. */
  required?: boolean;
  /** Disabled state. */
  disabled?: boolean;
  /** Enable "/" command palette. */
  enableSlashCommands?: boolean;
  /** Enable inline bubble toolbar on selection. */
  enableBubbleMenu?: boolean;
  /** Auto-focus on mount. */
  autofocus?: boolean;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when content changes. */
  onChange?: (html: string) => void;
}

export const RichTextEditor = defineComponent({
  name: 'RichTextEditor',

  props: {
    value: { type: String },
    defaultValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    label: { type: String, default: 'Rich text editor' },
    readOnly: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    enableSlashCommands: { type: Boolean, default: true },
    enableBubbleMenu: { type: Boolean, default: true },
    autofocus: { type: Boolean, default: false },
    size: { type: String, default: 'md' },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['change'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const machine = ref<any>({ content: props.defaultValue ? 'editing' : 'empty', interaction: 'idle', slashCommand: 'hidden', activeFormats: new Set(), });
    const send = (action: any) => { /* state machine dispatch */ };
    const editorRef = ref<any>(null);
    const execCommand = (command: string, props.value?: string) => {
      if (props.readOnly || props.disabled) return;
      document.execCommand(command, false, props.value);
      editorRef.value?.focus();
    };

  const handleFormat = (formatType: string) => {
      if (props.readOnly || props.disabled) return;
      switch (formatType) {
        case 'bold': execCommand('bold'); send({ type: 'FORMAT_BOLD' }); break;
        case 'italic': execCommand('italic'); send({ type: 'FORMAT_ITALIC' }); break;
        case 'underline': execCommand('underline'); send({ type: 'FORMAT_UNDERLINE' }); break;
        case 'strikethrough': execCommand('strikeThrough'); send({ type: 'FORMAT_STRIKETHROUGH' }); break;
        case 'code': execCommand('formatBlock', 'pre'); send({ type: 'FORMAT_CODE' }); break;
      }
      send({ type: 'FORMAT_COMPLETE' });
    };

  const handleEditorKeyDown = (e: any) => {
      if (props.readOnly || props.disabled) return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === 'b') { e.preventDefault(); handleFormat('bold'); }
      else if (mod && e.key === 'i') { e.preventDefault(); handleFormat('italic'); }
      else if (mod && e.key === 'u') { e.preventDefault(); handleFormat('underline'); }
      else if (mod && e.key === 'e') { e.preventDefault(); handleFormat('code'); }
      else if (mod && e.key === 'k') { e.preventDefault(); send({ type: 'FORMAT_LINK' }); }
      else if (e.key === '/' && props.enableSlashCommands) {
        send({ type: 'SLASH_TRIGGER' });
      }
      else if (e.key === 'Escape') {
        send({ type: 'ESCAPE' });
      }
    };

  const handleEditorInput = () => {
    const editor = editorRef.value;
    if (!editor) return;
    const html = editor.innerHTML;
    if (html === '' || html === '<br>') {
      send({ type: 'CLEAR' });
    } else {
      send({ type: 'INPUT' });
    }
    props.onChange?.(html);
  };
    const handleSelect = () => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      send({ type: 'SELECT_TEXT' });
    } else {
      send({ type: 'COLLAPSE_SELECTION' });
    }
  };
    const editor = editorRef.value;
    const html = editor.innerHTML;

    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': 'Rich text editor',
        'data-part': 'root',
        'data-state': isEmpty ? 'empty' : 'filled',
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-readonly': props.readOnly ? 'true' : 'false',
        'data-focused': isEditorFocused ? 'true' : 'false',
        'data-size': props.size,
        'data-surface-widget': '',
        'data-widget-name': 'rich-text-editor',
      }, [
        h('div', {
          'role': 'toolbar',
          'aria-label': 'Formatting options',
          'aria-controls': editorId,
          'data-part': 'toolbar',
          'data-disabled': props.disabled || props.readOnly ? 'true' : 'false',
        }, [
          ...toolbarButtons.map((btn) => h('button', {
              'type': 'button',
              'aria-props': true,
              'label': btn.label,
              'aria-pressed': machine.value.activeFormats.has(btn.format) ? 'true' : 'false',
              'data-active': machine.value.activeFormats.has(btn.format) ? 'true' : 'false',
              'props': true,
              'disabled': props.disabled || props.readOnly,
              'onClick': () => handleFormat(btn.format),
            }, [
              btn.shortcut,
            ])),
        ]),
        h('div', {
          'ref': editorRef,
          'id': editorId,
          'role': 'textbox',
          'aria-multiline': 'true',
          'contenteditable': !props.readOnly && !props.disabled,
          'aria-label': props.label,
          'aria-placeholder': isEmpty ? placeholder : '',
          'aria-readonly': props.readOnly ? 'true' : 'false',
          'aria-disabled': props.disabled ? 'true' : 'false',
          'data-part': 'editor',
          'data-empty': isEmpty ? 'true' : 'false',
          'tabindex': props.disabled ? -1 : 0,
          'suppressContentEditableWarning': true,
          'onInput': handleEditorInput,
          'onFocus': () => send({ type: 'FOCUS' }),
          'onBlur': () => send({ type: 'BLUR' }),
          'onPaste': () => send({ type: 'PASTE' }),
          'onSelect': handleSelect,
          'onKeyDown': handleEditorKeyDown,
          'eslint-disable-next-line': true,
          'react': true,
          'no-danger': true,
          'dangerouslySetInnerHTML': props.defaultValue ? { __html: props.defaultValue } : undefined,
        }),
        isEmpty ? h('span', {
            'data-part': 'placeholder',
            'aria-hidden': 'true',
            'data-visible': 'true',
          }, [
            props.placeholder,
          ]) : null,
        h('div', {
          'role': 'listbox',
          'aria-label': 'Insert block',
          'data-part': 'slash-menu',
          'data-state': isSlashVisible ? 'open' : 'closed',
          'data-visible': isSlashVisible ? 'true' : 'false',
        }),
        h('div', {
          'role': 'toolbar',
          'aria-label': 'Selection formatting',
          'data-part': 'bubble-menu',
          'data-state': isBubbleVisible ? 'open' : 'closed',
          'data-visible': isBubbleVisible ? 'true' : 'false',
        }, [
          ...isBubbleVisible && toolbarButtons.map((btn) => h('button', {
              'type': 'button',
              'aria-props': true,
              'label': btn.label,
              'aria-pressed': machine.value.activeFormats.has(btn.format) ? 'true' : 'false',
              'onClick': () => handleFormat(btn.format),
            }, [
              btn.shortcut,
            ])),
        ]),
      ]);
  },
});

export default RichTextEditor;