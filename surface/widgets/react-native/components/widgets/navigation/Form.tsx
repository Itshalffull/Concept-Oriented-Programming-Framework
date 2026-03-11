import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface FormProps {
  onSubmit?: () => Promise<void> | void;
  onReset?: () => void;
  onValidate?: () => Promise<string[]> | string[];
  disabled?: boolean;
  children?: ReactNode;
  submitLabel?: string;
  resetLabel?: string;
  showReset?: boolean;
  style?: ViewStyle;
}

export const Form: React.FC<FormProps> = ({
  onSubmit,
  onReset,
  onValidate,
  disabled = false,
  children,
  submitLabel = 'Submit',
  resetLabel = 'Reset',
  showReset = false,
  style,
}) => {
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const isSubmitting = state === 'submitting';

  const handleSubmit = useCallback(async () => {
    if (disabled || isSubmitting) return;
    setState('submitting');
    setErrors([]);

    if (onValidate) {
      try {
        const validationErrors = await onValidate();
        if (validationErrors?.length) {
          setState('error');
          setErrors(validationErrors);
          return;
        }
      } catch {
        setState('error');
        setErrors(['Validation failed']);
        return;
      }
    }

    if (onSubmit) {
      try {
        await onSubmit();
        setState('success');
      } catch {
        setState('error');
        setErrors(['Submission failed']);
      }
    } else {
      setState('success');
    }
  }, [disabled, isSubmitting, onValidate, onSubmit]);

  const handleReset = useCallback(() => {
    setState('idle');
    setErrors([]);
    onReset?.();
  }, [onReset]);

  return (
    <View style={[styles.root, style]}>
      <View style={styles.fields}>{children}</View>
      {errors.length > 0 && (
        <View style={styles.errorSummary} accessibilityRole="alert">
          {errors.map((err, i) => <Text key={i} style={styles.errorText}>{err}</Text>)}
        </View>
      )}
      <View style={styles.actions}>
        <Pressable
          onPress={handleSubmit}
          style={[styles.submitButton, (isSubmitting || disabled) && styles.buttonDisabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting || disabled }}
        >
          <Text style={styles.submitText}>{submitLabel}</Text>
        </Pressable>
        {showReset && (
          <Pressable onPress={handleReset} style={styles.resetButton} accessibilityRole="button">
            <Text style={styles.resetText}>{resetLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {},
  fields: { marginBottom: 16 },
  errorSummary: { marginBottom: 12, padding: 8, backgroundColor: '#fef2f2', borderRadius: 6 },
  errorText: { fontSize: 13, color: '#ef4444' },
  actions: { flexDirection: 'row', gap: 12 },
  submitButton: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#3b82f6', borderRadius: 6 },
  submitText: { fontSize: 14, color: '#fff', fontWeight: '500' },
  resetButton: { paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6 },
  resetText: { fontSize: 14, color: '#475569' },
  buttonDisabled: { opacity: 0.5 },
});

Form.displayName = 'Form';
export default Form;
