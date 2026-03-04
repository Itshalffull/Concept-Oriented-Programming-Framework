/* ---------------------------------------------------------------------------
 * State machine
 * Content: empty (initial) -> editing
 * Interaction: idle (initial) -> focused -> selecting -> formatting
 * SlashCommand: hidden (initial) -> visible
 * Events: INPUT, FOCUS, BLUR, SELECT_TEXT, FORMAT_*, SLASH_TRIGGER, etc.
 * ------------------------------------------------------------------------- */

export type ContentState = 'empty' | 'editing';
export type InteractionState = 'idle' | 'focused' | 'selecting' | 'formatting';
export type SlashState = 'hidden' | 'visible';

export interface RichTextMachine {
  content: ContentState;
  interaction: InteractionState;
  slashCommand: SlashState;
  activeFormats: Set<string>;
}

export type RichTextEvent =
  | { type: 'INPUT' }
  | { type: 'PASTE' }
  | { type: 'CLEAR' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'SELECT_TEXT' }
  | { type: 'COLLAPSE_SELECTION' }
  | { type: 'FORMAT_BOLD' }
  | { type: 'FORMAT_ITALIC' }
  | { type: 'FORMAT_UNDERLINE' }
  | { type: 'FORMAT_STRIKETHROUGH' }
  | { type: 'FORMAT_CODE' }
  | { type: 'FORMAT_LINK' }
  | { type: 'FORMAT_COMPLETE' }
  | { type: 'SLASH_TRIGGER' }
  | { type: 'SLASH_SELECT' }
  | { type: 'SLASH_DISMISS' }
  | { type: 'ESCAPE' };

export function richTextReducer(state: RichTextMachine, event: RichTextEvent): RichTextMachine {
  const s: RichTextMachine = {
    content: state.content,
    interaction: state.interaction,
    slashCommand: state.slashCommand,
    activeFormats: new Set(state.activeFormats),
  };

  switch (event.type) {
    case 'INPUT':
    case 'PASTE':
      if (s.content === 'empty') s.content = 'editing';
      break;
    case 'CLEAR':
      s.content = 'empty';
      break;
    case 'FOCUS':
      if (s.interaction === 'idle') s.interaction = 'focused';
      break;
    case 'BLUR':
      s.interaction = 'idle';
      s.slashCommand = 'hidden';
      break;
    case 'SELECT_TEXT':
      if (s.interaction === 'focused' || s.interaction === 'formatting') s.interaction = 'selecting';
      break;
    case 'COLLAPSE_SELECTION':
      if (s.interaction === 'selecting' || s.interaction === 'formatting') s.interaction = 'focused';
      break;
    case 'FORMAT_BOLD':
      s.interaction = 'formatting';
      if (s.activeFormats.has('bold')) s.activeFormats.delete('bold');
      else s.activeFormats.add('bold');
      break;
    case 'FORMAT_ITALIC':
      s.interaction = 'formatting';
      if (s.activeFormats.has('italic')) s.activeFormats.delete('italic');
      else s.activeFormats.add('italic');
      break;
    case 'FORMAT_UNDERLINE':
      s.interaction = 'formatting';
      if (s.activeFormats.has('underline')) s.activeFormats.delete('underline');
      else s.activeFormats.add('underline');
      break;
    case 'FORMAT_STRIKETHROUGH':
      s.interaction = 'formatting';
      if (s.activeFormats.has('strikethrough')) s.activeFormats.delete('strikethrough');
      else s.activeFormats.add('strikethrough');
      break;
    case 'FORMAT_CODE':
      s.interaction = 'formatting';
      if (s.activeFormats.has('code')) s.activeFormats.delete('code');
      else s.activeFormats.add('code');
      break;
    case 'FORMAT_LINK':
      s.interaction = 'formatting';
      break;
    case 'FORMAT_COMPLETE':
      if (s.interaction === 'formatting') s.interaction = 'selecting';
      break;
    case 'SLASH_TRIGGER':
      s.slashCommand = 'visible';
      break;
    case 'SLASH_SELECT':
    case 'SLASH_DISMISS':
    case 'ESCAPE':
      s.slashCommand = 'hidden';
      break;
  }

  return s;
}

import {
  forwardRef,
  useCallback,
  useId,
  useReducer,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface RichTextEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
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

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const RichTextEditor = forwardRef<HTMLDivElement, RichTextEditorProps>(function RichTextEditor(
  {
    value: _controlledValue,
    defaultValue = '',
    placeholder = '',
    label = 'Rich text editor',
    readOnly = false,
    required = false,
    disabled = false,
    enableSlashCommands = true,
    enableBubbleMenu = true,
    autofocus = false,
    size = 'md',
    onChange,
    ...rest
  },
  ref,
) {
  const [machine, send] = useReducer(richTextReducer, {
    content: defaultValue ? 'editing' : 'empty',
    interaction: 'idle',
    slashCommand: 'hidden',
    activeFormats: new Set(),
  });

  const editorRef = useRef<HTMLDivElement>(null);
  const editorId = useId();

  const execCommand = useCallback(
    (command: string, value?: string) => {
      if (readOnly || disabled) return;
      document.execCommand(command, false, value);
      editorRef.current?.focus();
    },
    [readOnly, disabled],
  );

  const handleFormat = useCallback(
    (formatType: string) => {
      if (readOnly || disabled) return;
      switch (formatType) {
        case 'bold': execCommand('bold'); send({ type: 'FORMAT_BOLD' }); break;
        case 'italic': execCommand('italic'); send({ type: 'FORMAT_ITALIC' }); break;
        case 'underline': execCommand('underline'); send({ type: 'FORMAT_UNDERLINE' }); break;
        case 'strikethrough': execCommand('strikeThrough'); send({ type: 'FORMAT_STRIKETHROUGH' }); break;
        case 'code': execCommand('formatBlock', 'pre'); send({ type: 'FORMAT_CODE' }); break;
      }
      send({ type: 'FORMAT_COMPLETE' });
    },
    [readOnly, disabled, execCommand],
  );

  const handleEditorKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (readOnly || disabled) return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === 'b') { e.preventDefault(); handleFormat('bold'); }
      else if (mod && e.key === 'i') { e.preventDefault(); handleFormat('italic'); }
      else if (mod && e.key === 'u') { e.preventDefault(); handleFormat('underline'); }
      else if (mod && e.key === 'e') { e.preventDefault(); handleFormat('code'); }
      else if (mod && e.key === 'k') { e.preventDefault(); send({ type: 'FORMAT_LINK' }); }
      else if (e.key === '/' && enableSlashCommands) {
        send({ type: 'SLASH_TRIGGER' });
      }
      else if (e.key === 'Escape') {
        send({ type: 'ESCAPE' });
      }
    },
    [readOnly, disabled, handleFormat, enableSlashCommands],
  );

  const handleEditorInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = editor.innerHTML;
    if (html === '' || html === '<br>') {
      send({ type: 'CLEAR' });
    } else {
      send({ type: 'INPUT' });
    }
    onChange?.(html);
  }, [onChange]);

  const handleSelect = useCallback(() => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      send({ type: 'SELECT_TEXT' });
    } else {
      send({ type: 'COLLAPSE_SELECTION' });
    }
  }, []);

  const isEditorFocused = machine.interaction !== 'idle';
  const isEmpty = machine.content === 'empty';
  const isBubbleVisible = (machine.interaction === 'selecting' || machine.interaction === 'formatting') && enableBubbleMenu;
  const isSlashVisible = machine.slashCommand === 'visible' && enableSlashCommands;

  const toolbarButtons = [
    { label: 'Bold', format: 'bold', shortcut: 'B' },
    { label: 'Italic', format: 'italic', shortcut: 'I' },
    { label: 'Underline', format: 'underline', shortcut: 'U' },
    { label: 'Strikethrough', format: 'strikethrough', shortcut: 'S' },
    { label: 'Code', format: 'code', shortcut: 'E' },
  ];

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Rich text editor"
      data-part="root"
      data-state={isEmpty ? 'empty' : 'filled'}
      data-disabled={disabled ? 'true' : 'false'}
      data-readonly={readOnly ? 'true' : 'false'}
      data-focused={isEditorFocused ? 'true' : 'false'}
      data-size={size}
      data-surface-widget=""
      data-widget-name="rich-text-editor"
      {...rest}
    >
      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Formatting options"
        aria-controls={editorId}
        data-part="toolbar"
        data-disabled={disabled || readOnly ? 'true' : 'false'}
      >
        {toolbarButtons.map((btn) => (
          <button
            key={btn.format}
            type="button"
            aria-label={btn.label}
            aria-pressed={machine.activeFormats.has(btn.format) ? 'true' : 'false'}
            data-active={machine.activeFormats.has(btn.format) ? 'true' : 'false'}
            disabled={disabled || readOnly}
            onClick={() => handleFormat(btn.format)}
          >
            {btn.shortcut}
          </button>
        ))}
      </div>

      {/* Editor surface */}
      <div
        ref={editorRef}
        id={editorId}
        role="textbox"
        aria-multiline="true"
        contentEditable={!readOnly && !disabled}
        aria-label={label}
        aria-placeholder={isEmpty ? placeholder : ''}
        aria-readonly={readOnly ? 'true' : 'false'}
        aria-disabled={disabled ? 'true' : 'false'}
        data-part="editor"
        data-empty={isEmpty ? 'true' : 'false'}
        tabIndex={disabled ? -1 : 0}
        suppressContentEditableWarning
        onInput={handleEditorInput}
        onFocus={() => send({ type: 'FOCUS' })}
        onBlur={() => send({ type: 'BLUR' })}
        onPaste={() => send({ type: 'PASTE' })}
        onSelect={handleSelect}
        onKeyDown={handleEditorKeyDown}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={defaultValue ? { __html: defaultValue } : undefined}
      />

      {/* Placeholder */}
      {isEmpty && (
        <span data-part="placeholder" aria-hidden="true" data-visible="true">
          {placeholder}
        </span>
      )}

      {/* Slash command menu */}
      <div
        role="listbox"
        aria-label="Insert block"
        data-part="slash-menu"
        data-state={isSlashVisible ? 'open' : 'closed'}
        data-visible={isSlashVisible ? 'true' : 'false'}
      />

      {/* Bubble menu */}
      <div
        role="toolbar"
        aria-label="Selection formatting"
        data-part="bubble-menu"
        data-state={isBubbleVisible ? 'open' : 'closed'}
        data-visible={isBubbleVisible ? 'true' : 'false'}
      >
        {isBubbleVisible && toolbarButtons.map((btn) => (
          <button
            key={`bubble-${btn.format}`}
            type="button"
            aria-label={btn.label}
            aria-pressed={machine.activeFormats.has(btn.format) ? 'true' : 'false'}
            onClick={() => handleFormat(btn.format)}
          >
            {btn.shortcut}
          </button>
        ))}
      </div>
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';
export { RichTextEditor };
export default RichTextEditor;
