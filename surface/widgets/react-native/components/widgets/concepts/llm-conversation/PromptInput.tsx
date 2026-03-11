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

import React, { forwardRef, useReducer, useCallback, type ReactNode } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

export interface PromptInputProps {
  value: string;
  onSubmit?: (value: string) => void | Promise<void>;
  onChange?: (value: string) => void;
  placeholder?: string;
  maxLength?: number | undefined;
  showModelSelector?: boolean;
  showAttach?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}

const PromptInput = forwardRef<View, PromptInputProps>(function PromptInput(
  { value, onSubmit, onChange, placeholder = 'Type a message...', maxLength, showModelSelector = true, showAttach = true, disabled = false, children },
  ref,
) {
  const [state, send] = useReducer(promptInputReducer, value ? 'composing' : 'empty');

  const handleInput = useCallback((newValue: string) => {
    onChange?.(newValue);
    if (newValue.length === 0) send({ type: 'CLEAR' });
    else send({ type: 'INPUT', value: newValue });
  }, [onChange]);

  const handleSubmit = useCallback(async () => {
    if (!value.trim() || disabled || state === 'submitting') return;
    send({ type: 'SUBMIT' });
    try {
      await onSubmit?.(value);
      send({ type: 'SUBMIT_COMPLETE' });
    } catch {
      send({ type: 'SUBMIT_ERROR' });
    }
  }, [value, disabled, state, onSubmit]);

  const isSubmitDisabled = state === 'empty' || state === 'submitting' || disabled;
  const isInputDisabled = state === 'submitting' || disabled;

  return (
    <View ref={ref} testID="prompt-input" accessibilityRole="none" accessibilityLabel="Message input" style={s.root}>
      <View style={s.inputRow}>
        <TextInput
          value={value}
          onChangeText={handleInput}
          placeholder={placeholder}
          maxLength={maxLength}
          editable={!isInputDisabled}
          multiline
          accessibilityLabel="Type your message"
          style={s.textInput}
          onSubmitEditing={handleSubmit}
          blurOnSubmit={false}
        />
      </View>
      <View style={s.bottomRow}>
        {showAttach && (
          <Pressable onPress={() => send({ type: 'ATTACH' })} accessibilityRole="button" accessibilityLabel="Attach file" disabled={isInputDisabled}>
            <Text style={[s.attachText, isInputDisabled && s.disabledText]}>Attach</Text>
          </Pressable>
        )}
        {showModelSelector && children && <View style={s.modelSlot}>{children}</View>}
        <Text style={s.counter} accessibilityLiveRegion="polite">
          {value.length}{maxLength != null ? ` / ${maxLength}` : ''}
        </Text>
        <Pressable onPress={handleSubmit} accessibilityRole="button" accessibilityLabel="Send message" disabled={isSubmitDisabled}
          style={[s.submitBtn, isSubmitDisabled && s.submitBtnDisabled]}>
          <Text style={s.submitText}>{state === 'submitting' ? '...' : 'Send'}</Text>
        </Pressable>
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  root: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden' },
  inputRow: { padding: 8 },
  textInput: { fontSize: 14, lineHeight: 20, minHeight: 40, maxHeight: 120, textAlignVertical: 'top' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 8 },
  attachText: { fontSize: 13, color: '#6366f1', fontWeight: '600' },
  disabledText: { color: '#d1d5db' },
  modelSlot: { flex: 1 },
  counter: { fontSize: 11, color: '#9ca3af' },
  submitBtn: { backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  submitBtnDisabled: { backgroundColor: '#d1d5db' },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

PromptInput.displayName = 'PromptInput';
export { PromptInput };
export default PromptInput;
