import { StackLayout, Label, Button, TextField, FlexboxLayout, ActivityIndicator } from '@nativescript/core';

/* ---------------------------------------------------------------------------
 * PromptInput state machine
 * States: empty, composing, submitting
 * ------------------------------------------------------------------------- */

export type PromptInputState = 'empty' | 'composing' | 'submitting';
export type PromptInputEvent =
  | { type: 'INPUT'; value?: string }
  | { type: 'PASTE' }
  | { type: 'ATTACH' }
  | { type: 'CLEAR' }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_COMPLETE' }
  | { type: 'SUBMIT_ERROR' };

export function promptInputReducer(state: PromptInputState, event: PromptInputEvent): PromptInputState {
  switch (state) {
    case 'empty':
      if (event.type === 'INPUT') return 'composing';
      if (event.type === 'PASTE') return 'composing';
      if (event.type === 'ATTACH') return 'composing';
      return state;
    case 'composing':
      if (event.type === 'CLEAR') return 'empty';
      if (event.type === 'SUBMIT') return 'submitting';
      return state;
    case 'submitting':
      if (event.type === 'SUBMIT_COMPLETE') return 'empty';
      if (event.type === 'SUBMIT_ERROR') return 'composing';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface PromptInputProps {
  value: string;
  onSubmit?: (value: string) => void | Promise<void>;
  onChange?: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  showModelSelector?: boolean;
  showAttach?: boolean;
  disabled?: boolean;
}

/* ---------------------------------------------------------------------------
 * Widget
 * ------------------------------------------------------------------------- */

export function createPromptInput(props: PromptInputProps): { view: StackLayout; dispose: () => void } {
  const {
    value,
    onSubmit,
    onChange,
    placeholder = 'Type a message...',
    maxLength,
    showAttach = true,
    disabled = false,
  } = props;

  let widgetState: PromptInputState = value ? 'composing' : 'empty';
  let currentValue = value;
  const disposers: (() => void)[] = [];

  function send(event: PromptInputEvent) {
    widgetState = promptInputReducer(widgetState, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'prompt-input';
  root.automationText = 'Message input';

  // Text input
  const textField = new TextField();
  textField.className = 'prompt-input-field';
  textField.hint = placeholder;
  textField.text = value;
  textField.automationText = 'Type your message';
  textField.isEnabled = !disabled;
  if (maxLength != null) {
    textField.maxLength = maxLength;
  }

  const textHandler = () => {
    currentValue = textField.text || '';
    onChange?.(currentValue);
    if (currentValue.length === 0) {
      send({ type: 'CLEAR' });
    } else {
      send({ type: 'INPUT', value: currentValue });
    }
  };
  textField.on('textChange', textHandler);
  disposers.push(() => textField.off('textChange', textHandler));

  // Submit on return key
  const returnHandler = () => {
    handleSubmit();
  };
  textField.on('returnPress', returnHandler);
  disposers.push(() => textField.off('returnPress', returnHandler));

  root.addChild(textField);

  // Button row
  const buttonRow = new FlexboxLayout();
  buttonRow.className = 'prompt-input-buttons';
  buttonRow.flexDirection = 'row' as any;
  buttonRow.alignItems = 'center' as any;

  // Attach button
  if (showAttach) {
    const attachBtn = new Button();
    attachBtn.className = 'prompt-input-attach';
    attachBtn.text = 'Attach';
    attachBtn.automationText = 'Attach file';
    const attachHandler = () => {
      send({ type: 'ATTACH' });
    };
    attachBtn.on('tap', attachHandler);
    disposers.push(() => attachBtn.off('tap', attachHandler));
    buttonRow.addChild(attachBtn);
  }

  // Character counter
  const counter = new Label();
  counter.className = 'prompt-input-counter';
  counter.text = maxLength != null ? `${currentValue.length} / ${maxLength}` : String(currentValue.length);
  buttonRow.addChild(counter);

  // Submit button
  const submitBtn = new Button();
  submitBtn.className = 'prompt-input-submit';
  submitBtn.text = 'Send';
  submitBtn.automationText = 'Send message';

  const submitSpinner = new ActivityIndicator();
  submitSpinner.className = 'prompt-input-spinner';
  submitSpinner.busy = false;
  submitSpinner.visibility = 'collapse' as any;
  submitSpinner.width = 16;
  submitSpinner.height = 16;

  async function handleSubmit() {
    if (!currentValue.trim() || disabled || widgetState === 'submitting') return;
    send({ type: 'SUBMIT' });
    try {
      await onSubmit?.(currentValue);
      send({ type: 'SUBMIT_COMPLETE' });
      textField.text = '';
      currentValue = '';
    } catch {
      send({ type: 'SUBMIT_ERROR' });
    }
  }

  const submitHandler = () => { handleSubmit(); };
  submitBtn.on('tap', submitHandler);
  disposers.push(() => submitBtn.off('tap', submitHandler));
  buttonRow.addChild(submitBtn);
  buttonRow.addChild(submitSpinner);

  root.addChild(buttonRow);

  function update() {
    const isSubmitDisabled = widgetState === 'empty' || widgetState === 'submitting' || disabled;
    const isInputDisabled = widgetState === 'submitting' || disabled;

    submitBtn.isEnabled = !isSubmitDisabled;
    textField.isEnabled = !isInputDisabled;

    if (widgetState === 'submitting') {
      submitBtn.text = '';
      submitSpinner.visibility = 'visible' as any;
      submitSpinner.busy = true;
    } else {
      submitBtn.text = 'Send';
      submitSpinner.visibility = 'collapse' as any;
      submitSpinner.busy = false;
    }

    counter.text = maxLength != null ? `${currentValue.length} / ${maxLength}` : String(currentValue.length);
  }

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createPromptInput;
