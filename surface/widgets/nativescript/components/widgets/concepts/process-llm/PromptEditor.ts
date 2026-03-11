import {
  StackLayout,
  Label,
  Button,
  ScrollView,
  TextView,
} from '@nativescript/core';

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

export interface PromptMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PromptTool {
  name: string;
  description?: string;
}

export interface PromptEditorProps {
  systemPrompt?: string;
  userPrompt: string;
  model: string;
  tools: PromptTool[];
  showTest?: boolean;
  showTools?: boolean;
  showTokenCount?: boolean;
  messages?: PromptMessage[];
  testResult?: string;
  testError?: string;
  onSystemPromptChange?: (value: string) => void;
  onUserPromptChange?: (value: string) => void;
  onMessagesChange?: (messages: PromptMessage[]) => void;
  onTest?: () => void;
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const ROLE_LABELS: Record<string, string> = {
  system: 'System',
  user: 'User',
  assistant: 'Assistant',
};
const ROLES: Array<'system' | 'user' | 'assistant'> = ['system', 'user', 'assistant'];

let nextMsgId = 1;
function generateMsgId(): string {
  return `msg-${nextMsgId++}`;
}

export function createPromptEditor(props: PromptEditorProps): {
  view: StackLayout;
  dispose: () => void;
} {
  let state: PromptEditorState = 'editing';
  let systemText = props.systemPrompt ?? '';
  let userText = props.userPrompt;
  let messages: PromptMessage[] = props.messages ?? [];
  let lastTestResult = props.testResult;
  let lastTestError = props.testError;
  const disposers: (() => void)[] = [];

  function send(event: PromptEditorEvent) {
    state = promptEditorReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'prompt-editor';
  root.automationText = 'Prompt editor';

  // System prompt
  const sysBlock = new StackLayout();
  const sysLabel = new Label();
  sysLabel.text = 'System';
  sysLabel.fontWeight = 'bold';
  sysBlock.addChild(sysLabel);

  const sysInput = new TextView();
  sysInput.text = systemText;
  sysInput.hint = 'System instructions...';
  sysInput.on('textChange', () => {
    systemText = sysInput.text;
    send({ type: 'INPUT' });
    props.onSystemPromptChange?.(systemText);
  });
  sysBlock.addChild(sysInput);
  root.addChild(sysBlock);

  // User prompt
  const userBlock = new StackLayout();
  const userLabel = new Label();
  userLabel.text = 'User';
  userLabel.fontWeight = 'bold';
  userBlock.addChild(userLabel);

  const userInput = new TextView();
  userInput.text = userText;
  userInput.hint = 'User prompt template...';
  userInput.on('textChange', () => {
    userText = userInput.text;
    send({ type: 'INPUT' });
    props.onUserPromptChange?.(userText);
  });
  userBlock.addChild(userInput);
  root.addChild(userBlock);

  // Additional messages container
  const msgContainer = new StackLayout();
  root.addChild(msgContainer);

  // Add message button
  const addMsgBtn = new Button();
  addMsgBtn.text = '+ Add Message';
  addMsgBtn.on('tap', () => {
    const newMsg: PromptMessage = { id: generateMsgId(), role: 'user', content: '' };
    messages = [...messages, newMsg];
    props.onMessagesChange?.(messages);
    update();
  });
  root.addChild(addMsgBtn);

  // Variables display
  const variablesRow = new StackLayout();
  variablesRow.orientation = 'horizontal';
  variablesRow.marginTop = 8;
  root.addChild(variablesRow);

  // Model badge
  const modelLbl = new Label();
  modelLbl.marginTop = 4;
  root.addChild(modelLbl);

  // Token count
  const tokenLbl = new Label();
  tokenLbl.fontSize = 12;
  tokenLbl.marginTop = 4;
  root.addChild(tokenLbl);

  // Test button
  const testBtn = new Button();
  testBtn.text = 'Test Prompt';
  testBtn.marginTop = 8;
  const testTapCb = () => {
    send({ type: 'TEST' });
    props.onTest?.();
  };
  testBtn.on('tap', testTapCb);
  disposers.push(() => testBtn.off('tap', testTapCb));
  root.addChild(testBtn);

  // Test result panel
  const testPanel = new StackLayout();
  testPanel.marginTop = 8;
  testPanel.padding = 12;
  testPanel.borderWidth = 1;
  testPanel.borderColor = '#e5e7eb';
  testPanel.borderRadius = 6;
  root.addChild(testPanel);

  // Tool list
  const toolPanel = new StackLayout();
  toolPanel.marginTop = 8;
  root.addChild(toolPanel);

  function update() {
    // Messages
    msgContainer.removeChildren();
    messages.forEach((msg, index) => {
      const block = new StackLayout();
      block.padding = 8;
      block.marginTop = 8;
      block.borderWidth = 1;
      block.borderColor = '#e5e7eb';
      block.borderRadius = 4;

      const msgHeader = new StackLayout();
      msgHeader.orientation = 'horizontal';

      // Role cycle button
      const roleBtn = new Button();
      roleBtn.text = ROLE_LABELS[msg.role];
      roleBtn.on('tap', () => {
        const nextRole = ROLES[(ROLES.indexOf(msg.role) + 1) % ROLES.length];
        messages = messages.map((m) => (m.id === msg.id ? { ...m, role: nextRole } : m));
        props.onMessagesChange?.(messages);
        update();
      });
      msgHeader.addChild(roleBtn);

      // Move up
      const upBtn = new Button();
      upBtn.text = '\u2191';
      upBtn.isEnabled = index > 0;
      upBtn.marginLeft = 4;
      upBtn.on('tap', () => {
        if (index <= 0) return;
        const updated = [...messages];
        [updated[index], updated[index - 1]] = [updated[index - 1], updated[index]];
        messages = updated;
        props.onMessagesChange?.(messages);
        update();
      });
      msgHeader.addChild(upBtn);

      // Move down
      const downBtn = new Button();
      downBtn.text = '\u2193';
      downBtn.isEnabled = index < messages.length - 1;
      downBtn.marginLeft = 4;
      downBtn.on('tap', () => {
        if (index >= messages.length - 1) return;
        const updated = [...messages];
        [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
        messages = updated;
        props.onMessagesChange?.(messages);
        update();
      });
      msgHeader.addChild(downBtn);

      // Remove
      const removeBtn = new Button();
      removeBtn.text = '\u2715';
      removeBtn.marginLeft = 4;
      removeBtn.on('tap', () => {
        messages = messages.filter((m) => m.id !== msg.id);
        props.onMessagesChange?.(messages);
        update();
      });
      msgHeader.addChild(removeBtn);

      block.addChild(msgHeader);

      const contentInput = new TextView();
      contentInput.text = msg.content;
      contentInput.hint = `${ROLE_LABELS[msg.role]} message content`;
      contentInput.marginTop = 4;
      contentInput.on('textChange', () => {
        messages = messages.map((m) =>
          m.id === msg.id ? { ...m, content: contentInput.text } : m,
        );
        props.onMessagesChange?.(messages);
        send({ type: 'INPUT' });
      });
      block.addChild(contentInput);

      msgContainer.addChild(block);
    });

    // Variables
    variablesRow.removeChildren();
    let allText = systemText + userText;
    for (const msg of messages) allText += msg.content;
    const vars = extractVariables(allText);

    if (vars.length > 0) {
      for (const v of vars) {
        const pill = new Label();
        pill.text = `{{${v}}}`;
        pill.padding = '2 6';
        pill.marginRight = 4;
        pill.fontSize = 12;
        pill.borderRadius = 8;
        variablesRow.addChild(pill);
      }
    } else {
      const noVars = new Label();
      noVars.text = 'No template variables detected';
      noVars.fontSize = 12;
      variablesRow.addChild(noVars);
    }

    // Model
    modelLbl.text = props.model;

    // Token count
    if (props.showTokenCount !== false) {
      tokenLbl.visibility = 'visible';
      tokenLbl.text = `~${estimateTokens(allText)} tokens`;
    } else {
      tokenLbl.visibility = 'collapsed';
    }

    // Test button
    if (props.showTest !== false) {
      testBtn.visibility = 'visible';
      testBtn.isEnabled = state !== 'testing';
      testBtn.text = state === 'testing' ? 'Testing...' : 'Test Prompt';
    } else {
      testBtn.visibility = 'collapsed';
    }

    // Test panel
    testPanel.removeChildren();
    if (state === 'viewing' && lastTestResult) {
      testPanel.visibility = 'visible';
      const resultHdr = new StackLayout();
      resultHdr.orientation = 'horizontal';

      const resultTitle = new Label();
      resultTitle.text = 'Test Result';
      resultTitle.fontWeight = 'bold';
      resultHdr.addChild(resultTitle);

      const editBtn = new Button();
      editBtn.text = 'Edit';
      editBtn.marginLeft = 8;
      editBtn.on('tap', () => send({ type: 'EDIT' }));
      resultHdr.addChild(editBtn);

      testPanel.addChild(resultHdr);

      const resultVal = new Label();
      resultVal.text = lastTestResult;
      resultVal.textWrap = true;
      resultVal.fontFamily = 'monospace';
      resultVal.fontSize = 12;
      resultVal.marginTop = 4;
      testPanel.addChild(resultVal);
    } else if (lastTestError) {
      testPanel.visibility = 'visible';
      const errLbl = new Label();
      errLbl.text = lastTestError;
      errLbl.color = '#dc2626' as any;
      errLbl.textWrap = true;
      testPanel.addChild(errLbl);
    } else {
      testPanel.visibility = 'collapsed';
    }

    // Tool list
    toolPanel.removeChildren();
    if (props.showTools !== false && props.tools.length > 0) {
      toolPanel.visibility = 'visible';

      const toolHeader = new Label();
      toolHeader.text = `Tools (${props.tools.length})`;
      toolHeader.fontWeight = 'bold';
      toolPanel.addChild(toolHeader);

      for (const tool of props.tools) {
        const toolRow = new StackLayout();
        toolRow.orientation = 'horizontal';
        toolRow.marginTop = 2;

        const toolName = new Label();
        toolName.text = tool.name;
        toolName.fontWeight = 'bold';
        toolName.fontSize = 13;
        toolRow.addChild(toolName);

        if (tool.description) {
          const toolDesc = new Label();
          toolDesc.text = tool.description;
          toolDesc.marginLeft = 8;
          toolDesc.fontSize = 12;
          toolRow.addChild(toolDesc);
        }

        toolPanel.addChild(toolRow);
      }
    } else {
      toolPanel.visibility = 'collapsed';
    }
  }

  update();

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createPromptEditor;
