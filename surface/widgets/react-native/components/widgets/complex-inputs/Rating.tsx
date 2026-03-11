import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface RatingProps {
  value?: number; max?: number; disabled?: boolean; readOnly?: boolean; onChange?: (value: number) => void; style?: ViewStyle;
}

export const Rating: React.FC<RatingProps> = (props) => {
  const { value, max, disabled, readOnly, onChange, style } = props;
  const [rating, setRating] = useState(value ?? 0);
  const stars = max || 5;
  const handlePress = useCallback((v: number) => { if (disabled || readOnly) return; setRating(v); onChange?.(v); }, [disabled, readOnly, onChange]);
  return (<View style={[s.root, style]} accessibilityRole="adjustable" accessibilityLabel={`Rating: ${rating} of ${stars}`} accessibilityValue={{ min: 0, max: stars, now: rating }}>{Array.from({ length: stars }, (_, i) => (<Pressable key={i} onPress={() => handlePress(i + 1)} disabled={disabled || readOnly} hitSlop={4}><Text style={[s.star, i < rating && s.filled]}>{i < rating ? '\u2605' : '\u2606'}</Text></Pressable>))}</View>);
};

const s = StyleSheet.create({
  root: { flexDirection: 'row', gap: 4 }, star: { fontSize: 24, color: '#cbd5e1' }, filled: { color: '#f59e0b' }
});

Rating.displayName = 'Rating';
export default Rating;
