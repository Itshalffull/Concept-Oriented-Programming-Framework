import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export interface SignaturePadProps {
  width?: number; height?: number; penColor?: string; disabled?: boolean; label?: string; onChange?: (dataUrl: string | null) => void; style?: ViewStyle;
}

export const SignaturePad: React.FC<SignaturePadProps> = (props) => {
  const { width, height, penColor, disabled, label, onChange, style, style } = props;
  return (<View style={[s.root, { width: width || '100%', height: height || 200 }, disabled && s.disabled, style]} accessibilityRole="image" accessibilityLabel={label || 'Signature pad'}><View style={[s.canvas, { borderColor: disabled ? '#e2e8f0' : '#cbd5e1' }]}><Text style={s.placeholder}>Sign here</Text></View></View>);
};

const s = StyleSheet.create({
  root: {}, disabled: { opacity: 0.5 }, canvas: { flex: 1, borderWidth: 1, borderRadius: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }, placeholder: { fontSize: 14, color: '#94a3b8' }
});

SignaturePad.displayName = 'SignaturePad';
export default SignaturePad;
