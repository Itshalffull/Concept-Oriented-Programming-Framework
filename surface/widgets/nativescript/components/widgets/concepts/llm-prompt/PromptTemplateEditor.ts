import {
  StackLayout,
  Label,
  Button,
  ScrollView,
  TextField,
  TextView,
  Switch,
} from '@nativescript/core';

export type PromptTemplateEditorState = 'editing' | 'messageSelected' | 'compiling';
export type PromptTemplateEditorEvent =
  | { type: 'ADD_MESSAGE' }
  | { type: 'REMOVE_MESSAGE'; index?: number }
  | { type: 'REORDER'; from?: number; to?: number }
  | { type: 'COMPILE' }
  | { type: 'SELECT_MESSAGE'; index?: number }
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

export type MessageRole = 'system' | 'user' | 'assistant';

export interface TemplateMessage {
  role: MessageRole;
  content: string;
}

export interface TemplateVariable {
  name: string;
  type: string;
  defaultValue?: string;
  description?: string;
}

export interface PromptTemplateEditorProps {
  messages?: TemplateMessage[];
  variables?: TemplateVariable[];
  modelId?: string;
  showParameters?: boolean;
  showTokenCount?: boolean;
  maxMessages?: number;
  onMessagesChange?: (messages: TemplateMessage[]) => void;
  onCompile?: (messages: TemplateMessage[], resolvedVariables: Record<string, string>) => void;
}

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

function extractAllVariables(messages: TemplateMessage[]): string[] {
  const found = new Set<string>();
  for (const msg of messages) {
    const re = new RegExp(VARIABLE_REGEX.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = re.exec(msg.content)) !== null) {
      found.add(match[1]);
    }
  }
  return Array.from(found);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function resolveTemplate(content: string, values: Record<string, string>): string {
  return content.replace(VARIABLE_REGEX, (full, name) =>
    values[name] !== undefined ? values[name] : full,
  );
}

export function createPromptTemplateEditor(props: PromptTemplateEditorProps): {
  view: StackLayout;
  dispose: () => void;
} {
  let state: PromptTemplateEditorState = 'editing';
  const disposers: (() => void)[] = [];
  let messages: TemplateMessage[] = props.messages ?? [{ role: 'system', content: '' }];
  let selectedIndex: number | null = null;
  let previewMode = false;
  const variableValues: Record<string, string> = {};
  const maxMessages = props.maxMessages ?? 20;
  const declaredVariables = props.variables ?? [];

  function send(event: PromptTemplateEditorEvent) {
    state = promptTemplateEditorReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'prompt-template-editor';
  root.automationText = 'Prompt template editor';

  const toolbar = new StackLayout();
  toolbar.orientation = 'horizontal';
  toolbar.marginBottom = 8;

  const previewToggle = new Button();
  previewToggle.text = 'Preview';
  const previewTapCb = () => {
    previewMode = !previewMode;
    previewToggle.text = previewMode ? 'Edit' : 'Preview';
    update();
  };
  previewToggle.on('tap', previewTapCb);
  disposers.push(() => previewToggle.off('tap', previewTapCb));
  toolbar.addChild(previewToggle);

  const compileBtn = new Button();
  compileBtn.text = 'Compile';
  compileBtn.marginLeft = 8;
  const compileTapCb = () => {
    send({ type: 'COMPILE' });
    try {
      const resolved = buildResolvedValues();
      props.onCompile?.(messages, resolved);
      send({ type: 'COMPILE_COMPLETE' });
    } catch {
      send({ type: 'COMPILE_ERROR' });
    }
  };
  compileBtn.on('tap', compileTapCb);
  disposers.push(() => compileBtn.off('tap', compileTapCb));
  toolbar.addChild(compileBtn);
  root.addChild(toolbar);

  const messageScroll = new ScrollView();
  const messageList = new StackLayout();
  messageScroll.content = messageList;
  root.addChild(messageScroll);

  const addBtn = new Button();
  addBtn.text = '+ Add Message';
  addBtn.marginTop = 8;
  const addTapCb = () => {
    if (messages.length >= maxMessages) return;
    messages = [...messages, { role: 'user', content: '' }];
    props.onMessagesChange?.(messages);
    send({ type: 'ADD_MESSAGE' });
  };
  addBtn.on('tap', addTapCb);
  disposers.push(() => addBtn.off('tap', addTapCb));
  root.addChild(addBtn);

  const variablePanel = new StackLayout();
  variablePanel.marginTop = 16;
  root.addChild(variablePanel);

  const parametersPanel = new StackLayout();
  parametersPanel.marginTop = 12;
  root.addChild(parametersPanel);

  const tokenLabel = new Label();
  tokenLabel.marginTop = 8;
  tokenLabel.fontSize = 12;
  root.addChild(tokenLabel);

  function buildResolvedValues(): Record<string, string> {
    const allNames = new Set([
      ...extractAllVariables(messages),
      ...declaredVariables.map((v) => v.name),
    ]);
    const result: Record<string, string> = {};
    for (const name of allNames) {
      const decl = declaredVariables.find((v) => v.name === name);
      result[name] = variableValues[name] ?? decl?.defaultValue ?? '';
    }
    return result;
  }

  function update() {
    compileBtn.isEnabled = state !== 'compiling';
    compileBtn.text = state === 'compiling' ? 'Compiling...' : 'Compile';
    addBtn.isEnabled = messages.length < maxMessages;

    const resolved = buildResolvedValues();

    messageList.removeChildren();
    messages.forEach((msg, index) => {
      const block = new StackLayout();
      block.padding = 8;
      block.marginBottom = 8;
      block.borderRadius = 6;
      block.borderWidth = selectedIndex === index ? 2 : 1;
      block.borderColor = selectedIndex === index ? '#3b82f6' : '#e5e7eb';

      const headerRow = new StackLayout();
      headerRow.orientation = 'horizontal';

      const roleLabel = new Label();
      roleLabel.text = msg.role;
      roleLabel.fontWeight = 'bold';
      headerRow.addChild(roleLabel);

      const cycleBtn = new Button();
      cycleBtn.text = 'Role';
      cycleBtn.marginLeft = 8;
      cycleBtn.on('tap', () => {
        const roles: MessageRole[] = ['system', 'user', 'assistant'];
        const next = roles[(roles.indexOf(msg.role) + 1) % roles.length];
        messages = messages.map((m, i) => (i === index ? { ...m, role: next } : m));
        props.onMessagesChange?.(messages);
        update();
      });
      headerRow.addChild(cycleBtn);

      if (messages.length > 1) {
        const delBtn = new Button();
        delBtn.text = 'Delete';
        delBtn.marginLeft = 8;
        delBtn.on('tap', () => {
          messages = messages.filter((_, i) => i !== index);
          props.onMessagesChange?.(messages);
          if (selectedIndex === index) {
            selectedIndex = null;
            send({ type: 'DESELECT' });
          } else {
            send({ type: 'REMOVE_MESSAGE', index });
          }
        });
        headerRow.addChild(delBtn);
      }

      block.addChild(headerRow);

      block.on('tap', () => {
        selectedIndex = index;
        send({ type: 'SELECT_MESSAGE', index });
      });

      if (previewMode) {
        const previewLbl = new Label();
        previewLbl.text = resolveTemplate(msg.content, resolved);
        previewLbl.textWrap = true;
        previewLbl.marginTop = 8;
        previewLbl.fontFamily = 'monospace';
        block.addChild(previewLbl);
      } else {
        const contentInput = new TextView();
        contentInput.text = msg.content;
        contentInput.hint = `Enter ${msg.role} prompt... Use {{variable}} for placeholders`;
        contentInput.marginTop = 8;
        contentInput.on('textChange', () => {
          messages = messages.map((m, i) =>
            i === index ? { ...m, content: contentInput.text } : m,
          );
          props.onMessagesChange?.(messages);
        });
        block.addChild(contentInput);

        const vars = extractAllVariables([msg]);
        if (vars.length > 0) {
          const pillRow = new StackLayout();
          pillRow.orientation = 'horizontal';
          pillRow.marginTop = 4;
          for (const varName of vars) {
            const pill = new Label();
            const decl = declaredVariables.find((v) => v.name === varName);
            pill.text = decl ? `${varName}: ${decl.type}` : varName;
            pill.fontSize = 12;
            pill.padding = '2 8';
            pill.borderRadius = 12;
            pill.marginRight = 4;
            pillRow.addChild(pill);
          }
          block.addChild(pillRow);
        }
      }

      messageList.addChild(block);
    });

    variablePanel.removeChildren();
    const allVarNames = [
      ...new Set([...extractAllVariables(messages), ...declaredVariables.map((v) => v.name)]),
    ];
    if (allVarNames.length > 0) {
      const hdr = new Label();
      hdr.text = 'Variables';
      hdr.fontWeight = 'bold';
      hdr.fontSize = 14;
      variablePanel.addChild(hdr);

      for (const varName of allVarNames) {
        const row = new StackLayout();
        row.orientation = 'horizontal';
        row.marginTop = 4;

        const decl = declaredVariables.find((v) => v.name === varName);
        const lbl = new Label();
        lbl.text = `{{${varName}}}${decl ? ` (${decl.type})` : ''}`;
        lbl.width = 140;
        lbl.fontSize = 13;
        lbl.fontFamily = 'monospace';
        row.addChild(lbl);

        const inp = new TextField();
        inp.text = variableValues[varName] ?? '';
        inp.hint = decl?.defaultValue ?? '';
        inp.fontSize = 13;
        inp.on('textChange', () => {
          variableValues[varName] = inp.text;
        });
        row.addChild(inp);

        variablePanel.addChild(row);
      }
    }

    parametersPanel.removeChildren();
    if (props.showParameters !== false) {
      const modelLbl = new Label();
      modelLbl.text = `Model: ${props.modelId ?? ''}`;
      parametersPanel.addChild(modelLbl);
      parametersPanel.visibility = 'visible';
    } else {
      parametersPanel.visibility = 'collapsed';
    }

    if (props.showTokenCount !== false) {
      const totalContent = messages.map((m) => m.content).join('\n');
      tokenLabel.text = `${totalContent.length} chars | ~${estimateTokens(totalContent)} tokens`;
      tokenLabel.visibility = 'visible';
    } else {
      tokenLabel.visibility = 'collapsed';
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

export default createPromptTemplateEditor;
