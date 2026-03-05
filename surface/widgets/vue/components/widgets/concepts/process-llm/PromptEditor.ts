import { defineComponent, h, ref, computed, watch, type PropType } from 'vue';

export type PromptEditorState = 'editing' | 'testing' | 'viewing';
export type PromptEditorEvent =
  | { type: 'TEST' }
  | { type: 'INPUT' }
  | { type: 'TEST_COMPLETE'; result?: string }
  | { type: 'TEST_ERROR'; error?: string }
  | { type: 'EDIT' };

export function promptEditorReducer(state: PromptEditorState, event: PromptEditorEvent): PromptEditorState {
  switch (state) {
    case 'editing':
      if (event.type === 'TEST') return 'testing';
      if (event.type === 'INPUT') return 'editing';
      return state;
    case 'testing':
      if (event.type === 'TEST_COMPLETE') return 'viewing';
      if (event.type === 'TEST_ERROR') return 'editing';
      return state;
    case 'viewing':
      if (event.type === 'EDIT') return 'editing';
      if (event.type === 'TEST') return 'testing';
      return state;
    default:
      return state;
  }
}

interface PromptMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PromptTool {
  name: string;
  description?: string;
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const ROLE_LABELS: Record<string, string> = { system: 'System', user: 'User', assistant: 'Assistant' };
const ROLES: Array<'system' | 'user' | 'assistant'> = ['system', 'user', 'assistant'];

let nextMsgId = 1;
function generateMsgId(): string {
  return `msg-${nextMsgId++}`;
}

export const PromptEditor = defineComponent({
  name: 'PromptEditor',
  props: {
    systemPrompt: { type: String, default: undefined },
    userPrompt: { type: String, required: true },
    model: { type: String, required: true },
    tools: { type: Array as PropType<PromptTool[]>, required: true },
    showTest: { type: Boolean, default: true },
    showTools: { type: Boolean, default: true },
    showTokenCount: { type: Boolean, default: true },
    messages: { type: Array as PropType<PromptMessage[]>, default: undefined },
    testResult: { type: String, default: undefined },
    testError: { type: String, default: undefined },
  },
  emits: ['systemPromptChange', 'userPromptChange', 'messagesChange', 'test'],
  setup(props, { emit, slots }) {
    const state = ref<PromptEditorState>('editing');
    const systemText = ref(props.systemPrompt ?? '');
    const userText = ref(props.userPrompt);
    const messageList = ref<PromptMessage[]>(props.messages ? [...props.messages] : []);
    const lastTestResult = ref(props.testResult);
    const lastTestError = ref(props.testError);

    function send(event: PromptEditorEvent) {
      state.value = promptEditorReducer(state.value, event);
    }

    const allText = computed(() => {
      let total = systemText.value + userText.value;
      for (const msg of messageList.value) total += msg.content;
      return total;
    });

    const tokenCount = computed(() => estimateTokens(allText.value));
    const detectedVariables = computed(() => extractVariables(allText.value));

    // Sync test results from props
    watch(() => props.testResult, (v) => {
      if (v !== undefined && state.value === 'testing') {
        lastTestResult.value = v;
        send({ type: 'TEST_COMPLETE', result: v });
      }
    });

    watch(() => props.testError, (v) => {
      if (v !== undefined && state.value === 'testing') {
        lastTestError.value = v;
        send({ type: 'TEST_ERROR', error: v });
      }
    });

    function handleSystemChange(value: string) {
      systemText.value = value;
      send({ type: 'INPUT' });
      emit('systemPromptChange', value);
    }

    function handleUserChange(value: string) {
      userText.value = value;
      send({ type: 'INPUT' });
      emit('userPromptChange', value);
    }

    function handleMessageContentChange(id: string, content: string) {
      messageList.value = messageList.value.map((m) => (m.id === id ? { ...m, content } : m));
      send({ type: 'INPUT' });
      emit('messagesChange', messageList.value);
    }

    function handleMessageRoleChange(id: string, role: PromptMessage['role']) {
      messageList.value = messageList.value.map((m) => (m.id === id ? { ...m, role } : m));
      emit('messagesChange', messageList.value);
    }

    function handleAddMessage() {
      const newMsg: PromptMessage = { id: generateMsgId(), role: 'user', content: '' };
      messageList.value = [...messageList.value, newMsg];
      emit('messagesChange', messageList.value);
    }

    function handleRemoveMessage(id: string) {
      messageList.value = messageList.value.filter((m) => m.id !== id);
      emit('messagesChange', messageList.value);
    }

    function handleMoveMessage(id: string, direction: -1 | 1) {
      const index = messageList.value.findIndex((m) => m.id === id);
      if (index < 0) return;
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= messageList.value.length) return;
      const updated = [...messageList.value];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      messageList.value = updated;
      emit('messagesChange', messageList.value);
    }

    function handleTest() {
      send({ type: 'TEST' });
      emit('test');
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleTest();
      }
    }

    return () => {
      const children: any[] = [];

      // System prompt block
      children.push(h('div', { 'data-part': 'system-block' }, [
        h('label', { 'data-part': 'block-label' }, [
          h('span', { 'data-part': 'role-tag' }, 'System'),
          h('textarea', {
            'data-part': 'system-textarea', role: 'textbox',
            'aria-label': 'System prompt', placeholder: 'System instructions...',
            value: systemText.value,
            onInput: (e: Event) => handleSystemChange((e.target as HTMLTextAreaElement).value),
            rows: 3,
          }),
        ]),
      ]));

      // User prompt block
      children.push(h('div', { 'data-part': 'user-block' }, [
        h('label', { 'data-part': 'block-label' }, [
          h('span', { 'data-part': 'role-tag' }, 'User'),
          h('textarea', {
            'data-part': 'user-textarea', role: 'textbox',
            'aria-label': 'User prompt', placeholder: 'User prompt template...',
            value: userText.value,
            onInput: (e: Event) => handleUserChange((e.target as HTMLTextAreaElement).value),
            rows: 5,
          }),
        ]),
      ]));

      // Additional message blocks
      messageList.value.forEach((msg, index) => {
        children.push(h('div', { key: msg.id, 'data-part': 'message-block', 'data-role': msg.role }, [
          h('div', { 'data-part': 'message-header' }, [
            h('select', {
              'data-part': 'role-selector', value: msg.role,
              onChange: (e: Event) => handleMessageRoleChange(msg.id, (e.target as HTMLSelectElement).value as PromptMessage['role']),
              'aria-label': `Message ${index + 1} role`,
            }, ROLES.map((r) => h('option', { key: r, value: r }, ROLE_LABELS[r]))),
            h('div', { 'data-part': 'message-actions' }, [
              h('button', { type: 'button', 'data-part': 'move-up', disabled: index === 0, onClick: () => handleMoveMessage(msg.id, -1), 'aria-label': 'Move message up' }, '\u2191'),
              h('button', { type: 'button', 'data-part': 'move-down', disabled: index === messageList.value.length - 1, onClick: () => handleMoveMessage(msg.id, 1), 'aria-label': 'Move message down' }, '\u2193'),
              h('button', { type: 'button', 'data-part': 'remove-message', onClick: () => handleRemoveMessage(msg.id), 'aria-label': `Remove message ${index + 1}` }, '\u2715'),
            ]),
          ]),
          h('textarea', {
            'data-part': 'message-content', role: 'textbox',
            'aria-label': `${ROLE_LABELS[msg.role]} message content`,
            value: msg.content,
            onInput: (e: Event) => handleMessageContentChange(msg.id, (e.target as HTMLTextAreaElement).value),
            rows: 3,
          }),
        ]));
      });

      // Add message button
      children.push(h('button', {
        type: 'button', 'data-part': 'add-message',
        onClick: handleAddMessage, 'aria-label': 'Add message',
      }, '+ Add Message'));

      // Variable pills
      children.push(h('div', { 'data-part': 'variables', 'aria-label': 'Detected template variables' },
        detectedVariables.value.length > 0
          ? detectedVariables.value.map((variable) => h('span', { key: variable, 'data-part': 'variable-pill', 'aria-label': `Variable: ${variable}` }, `{{${variable}}}`))
          : [h('span', { 'data-part': 'no-variables' }, 'No template variables detected')],
      ));

      // Model badge
      children.push(h('div', { 'data-part': 'model' }, [
        h('span', { 'data-part': 'model-label' }, props.model),
      ]));

      // Token count
      if (props.showTokenCount) {
        children.push(h('span', {
          'data-part': 'token-count', role: 'status', 'aria-live': 'polite', 'data-visible': 'true',
        }, `~${tokenCount.value} tokens`));
      }

      // Test button
      if (props.showTest) {
        children.push(h('button', {
          type: 'button', 'data-part': 'test', 'data-visible': 'true',
          onClick: handleTest, disabled: state.value === 'testing',
          'aria-label': 'Test prompt',
        }, state.value === 'testing' ? 'Testing...' : 'Test Prompt'));
      }

      // Test result panel
      children.push(h('div', {
        'data-part': 'test-panel',
        'data-visible': state.value === 'viewing' ? 'true' : 'false',
        'aria-hidden': state.value !== 'viewing' ? 'true' : 'false',
      }, [
        state.value === 'viewing' && lastTestResult.value ? h('div', { 'data-part': 'test-result' }, [
          h('div', { 'data-part': 'test-result-header' }, [
            h('span', {}, 'Test Result'),
            h('button', {
              type: 'button', 'data-part': 'edit-button',
              onClick: () => send({ type: 'EDIT' }),
              'aria-label': 'Back to editing',
            }, 'Edit'),
          ]),
          h('pre', { 'data-part': 'test-output' }, lastTestResult.value),
        ]) : null,
        lastTestError.value ? h('div', { 'data-part': 'test-error', role: 'alert' }, lastTestError.value) : null,
      ]));

      // Tool list
      if (props.showTools && props.tools.length > 0) {
        children.push(h('div', { 'data-part': 'tools', 'data-visible': 'true', 'aria-label': 'Available tools' }, [
          h('span', { 'data-part': 'tools-header' }, `Tools (${props.tools.length})`),
          h('ul', { 'data-part': 'tool-list', role: 'list' },
            props.tools.map((tool) => h('li', { key: tool.name, 'data-part': 'tool-item', role: 'listitem' }, [
              h('span', { 'data-part': 'tool-name' }, tool.name),
              tool.description ? h('span', { 'data-part': 'tool-description' }, tool.description) : null,
            ])),
          ),
        ]));
      }

      if (slots.default) children.push(slots.default());

      return h('div', {
        role: 'form',
        'aria-label': 'Prompt editor',
        'data-surface-widget': '',
        'data-widget-name': 'prompt-editor',
        'data-part': 'root',
        'data-state': state.value,
        onKeydown: handleKeydown,
        tabindex: 0,
      }, children);
    };
  },
});

export default PromptEditor;
