import React, { useState, useCallback } from 'react';
import { View, Text, TextInput as RNTextInput, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface TokenInputProps {
  tokens?: string[]; placeholder?: string; disabled?: boolean;
  onChange?: (tokens: string[]) => void; style?: ViewStyle;
}

export const TokenInput: React.FC<TokenInputProps> = ({ tokens: initial = [], placeholder = 'Add token...', disabled = false, onChange, style }) => {
  const [tokens, setTokens] = useState<string[]>(initial);
  const [text, setText] = useState('');

  const addToken = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || tokens.includes(trimmed)) return;
    const next = [...tokens, trimmed];
    setTokens(next); setText(''); onChange?.(next);
  }, [text, tokens, onChange]);

  const removeToken = useCallback((idx: number) => {
    const next = tokens.filter((_, i) => i !== idx);
    setTokens(next); onChange?.(next);
  }, [tokens, onChange]);

  return (
    <View style={[styles.root, style]}>
      <View style={styles.tokenRow}>{tokens.map((t, i) => (
        <View key={`${t}-${i}`} style={styles.token}>
          <Text style={styles.tokenText}>{t}</Text>
          {!disabled && <Pressable onPress={() => removeToken(i)} hitSlop={4}><Text style={styles.removeText}>\u00D7</Text></Pressable>}
        </View>
      ))}</View>
      <RNTextInput value={text} onChangeText={setText} onSubmitEditing={addToken} placeholder={placeholder} editable={!disabled} style={styles.input} returnKeyType="done" placeholderTextColor="#94a3b8" />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 6 },
  tokenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  token: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 4, paddingVertical: 2, paddingHorizontal: 8 },
  tokenText: { fontSize: 13, color: '#1e293b' },
  removeText: { fontSize: 16, color: '#94a3b8', marginLeft: 4 },
  input: { fontSize: 14, color: '#1e293b', paddingVertical: 4, paddingHorizontal: 4 },
});

TokenInput.displayName = 'TokenInput';
export default TokenInput;
