import { defineComponent, h, ref, computed, type PropType } from 'vue';

export type PromptTemplateEditorState = 'editing' | 'messageSelected' | 'compiling';
export type PromptTemplateEditorEvent =
  | { type: 'ADD_MESSAGE' }
  | { type: 'REMOVE_MESSAGE' }
  | { type: 'REORDER' }
  | { type: 'COMPILE' }
  | { type: 'SELECT_MESSAGE'; id?: string }
  | { type: 'DESELECT' }
  | { type: 'COMPILE_COMPLETE' }
  | { type: 'COMPILE_ERROR' };

export function promptTemplateEditorReducer(state: PromptTemplateEditorState, event: PromptTemplateEditorEvent): PromptTemplateEditorState {
  switch (state) {
    case 'editing':
      if (event.type === 'ADD_MESSAGE') return 'editing';
      if (event.type === 'REMOVE_MESSAGE') return 'editing';
      if (event.type === 'REORDER') return 'editing';
      if (event.type === 'COMPILE') return 'compiling';
      if (event.type === 'SELECT_MESSAGE') return 'messageSelected';
      return state;
    case 'messageSelected':
      if (event.type === 'DESELECT') return 'editing';
      if (event.type === 'SELECT_MESSAGE') return 'messageSelected';
      return state;
    case 'compiling':
      if (event.type === 'COMPILE_COMPLETE') return 'editing';
      if (event.type === 'COMPILE_ERROR') return 'editing';
      return state;
    default:
      return state;
  }
}

interface TemplateMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface TemplateVariable {
  name: string;
  defaultValue?: string;
}

const ROLES: Array<'system' | 'user' | 'assistant'> = ['system', 'user', 'assistant'];
const ROLE_LABELS: Record<string, string> = { system: 'System', user: 'User', assistant: 'Assistant' };

function extractVars(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

let nextId = 1;

export const PromptTemplateEditor = defineComponent({
  name: 'PromptTemplateEditor',
  props: {
    messages: { type: Array as PropType<TemplateMessage[]>, required: true },
    variables: { type: Array as PropType<TemplateVariable[]>, required: true },
    modelId: { type: String, default: undefined },
    showParameters: { type: Boolean, default: true },
    showTokenCount: { type: Boolean, default: true },
    maxMessages: { type: Number, default: 20 },
  },
  emits: ['update:messages', 'compile', 'selectMessage'],
  setup(props, { emit }) {
    const state = ref<PromptTemplateEditorState>('editing');
    const localMessages = ref<TemplateMessage[]>([...props.messages]);
    const selectedMsgId = ref<string | null>(null);
    const dragId = ref<string | null>(null);

    function send(event: PromptTemplateEditorEvent) {
      state.value = promptTemplateEditorReducer(state.value, event);
    }

    const allText = computed(() => localMessages.value.map((m) => m.content).join('\n'));
    const tokenCount = computed(() => estimateTokens(allText.value));
    const detectedVars = computed(() => extractVars(allText.value));

    function emitUpdate() { emit('update:messages', [...localMessages.value]); }

    function addMessage() {
      if (localMessages.value.length >= props.maxMessages) return;
      localMessages.value.push({ id: `tmpl-${nextId++}`, role: 'user', content: '' });
      send({ type: 'ADD_MESSAGE' });
      emitUpdate();
    }

    function removeMessage(id: string) {
      localMessages.value = localMessages.value.filter((m) => m.id !== id);
      send({ type: 'REMOVE_MESSAGE' });
      emitUpdate();
    }

    function updateContent(id: string, content: string) {
      const msg = localMessages.value.find((m) => m.id === id);
      if (msg) msg.content = content;
      emitUpdate();
    }

    function updateRole(id: string, role: TemplateMessage['role']) {
      const msg = localMessages.value.find((m) => m.id === id);
      if (msg) msg.role = role;
      emitUpdate();
    }

    function moveMessage(id: string, dir: -1 | 1) {
      const idx = localMessages.value.findIndex((m) => m.id === id);
      if (idx < 0) return;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= localMessages.value.length) return;
      const arr = [...localMessages.value];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      localMessages.value = arr;
      send({ type: 'REORDER' });
      emitUpdate();
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); send({ type: 'COMPILE' }); emit('compile'); }
    }

    return () => {
      const children: any[] = [];

      // Message blocks
      children.push(h('div', { 'data-part': 'message-list' },
        localMessages.value.map((msg, index) => {
          const isSelected = selectedMsgId.value === msg.id;
          return h('div', {
            key: msg.id, 'data-part': 'message-block', 'data-role': msg.role,
            'data-selected': isSelected ? 'true' : 'false',
            onClick: () => { selectedMsgId.value = msg.id; send({ type: 'SELECT_MESSAGE', id: msg.id }); emit('selectMessage', msg.id); },
          }, [
            h('div', { 'data-part': 'message-header' }, [
              h('select', {
                'data-part': 'role-selector', value: msg.role,
                onChange: (e: Event) => updateRole(msg.id, (e.target as HTMLSelectElement).value as TemplateMessage['role']),
                'aria-label': `Message ${index + 1} role`,
              }, ROLES.map((r) => h('option', { value: r }, ROLE_LABELS[r]))),
              h('div', { 'data-part': 'message-actions' }, [
                h('button', { type: 'button', 'data-part': 'move-up', disabled: index === 0, onClick: (e: Event) => { e.stopPropagation(); moveMessage(msg.id, -1); }, 'aria-label': 'Move up' }, '\u2191'),
                h('button', { type: 'button', 'data-part': 'move-down', disabled: index === localMessages.value.length - 1, onClick: (e: Event) => { e.stopPropagation(); moveMessage(msg.id, 1); }, 'aria-label': 'Move down' }, '\u2193'),
                h('button', { type: 'button', 'data-part': 'delete-button', onClick: (e: Event) => { e.stopPropagation(); removeMessage(msg.id); }, 'aria-label': `Remove message ${index + 1}` }, '\u2715'),
              ]),
            ]),
            h('textarea', {
              'data-part': 'template-input', role: 'textbox',
              'aria-label': `${ROLE_LABELS[msg.role]} message content`,
              value: msg.content,
              onInput: (e: Event) => updateContent(msg.id, (e.target as HTMLTextAreaElement).value),
              rows: 3,
            }),
          ]);
        })));

      // Add button
      children.push(h('button', {
        type: 'button', 'data-part': 'add-button',
        disabled: localMessages.value.length >= props.maxMessages,
        onClick: addMessage, 'aria-label': 'Add message',
      }, '+ Add Message'));

      // Variable pills
      children.push(h('div', { 'data-part': 'variable-pills', 'aria-label': 'Detected variables' },
        detectedVars.value.length > 0
          ? detectedVars.value.map((v) => h('span', { key: v, 'data-part': 'variable-pill' }, `{{${v}}}`))
          : [h('span', { 'data-part': 'no-variables' }, 'No variables detected')]));

      // Parameter panel
      if (props.showParameters && props.modelId) {
        children.push(h('div', { 'data-part': 'parameter-panel' }, [
          h('span', { 'data-part': 'model-label' }, props.modelId),
        ]));
      }

      // Token count
      if (props.showTokenCount) {
        children.push(h('span', {
          'data-part': 'token-count', role: 'status', 'aria-live': 'polite',
        }, `~${tokenCount.value} tokens`));
      }

      return h('div', {
        role: 'form',
        'aria-label': 'Prompt template editor',
        'data-surface-widget': '',
        'data-widget-name': 'prompt-template-editor',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default PromptTemplateEditor;
