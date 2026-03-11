import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface OptionItem { value: string; label: string; disabled?: boolean; }

export interface ComboboxProps {
  value?: string; defaultValue?: string; inputValue?: string; options: OptionItem[];
  placeholder?: string; allowCustom?: boolean; label: string; disabled?: boolean;
  required?: boolean; name?: string; onChange?: (value: string) => void;
  onInputChange?: (inputValue: string) => void; size?: 'sm' | 'md' | 'lg'; style?: ViewStyle;
}

export const Combobox: React.FC<ComboboxProps> = ({
  value: valueProp, defaultValue = '', options, placeholder = 'Search...',
  allowCustom = false, label, disabled = false, onChange, onInputChange, style,
}) => {
  const [iv, setIv] = useState(defaultValue);
  const value = valueProp ?? iv;
  const sv = useCallback((v: string) => { setIv(v); onChange?.(v); }, [onChange]);
  const [li, setLi] = useState(options.find((o) => o.value === value)?.label ?? '');
  const [open, setOpen] = useState(false);
  const fil = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(li.toLowerCase())), [options, li]);
  const sel = useCallback((ov: string) => {
    const o = options.find((x) => x.value === ov); sv(ov); setLi(o?.label ?? ov); onInputChange?.(o?.label ?? ov); setOpen(false);
  }, [options, sv, onInputChange]);

  return (
    <View style={[s.root, style]}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.wrap, disabled && s.dis]}>
        <TextInput value={li} placeholder={placeholder} placeholderTextColor="#94a3b8" editable={!disabled}
          onChangeText={(t) => { setLi(t); onInputChange?.(t); setOpen(true); }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
          accessibilityRole="combobox" accessibilityLabel={label} style={s.input} />
        {value ? <Pressable onPress={() => { sv(''); setLi(''); }} accessibilityLabel="Clear" hitSlop={8}>
          <Text style={s.clr}>×</Text></Pressable> : null}
      </View>
      {open && <ScrollView style={s.ct} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {fil.length > 0 ? fil.map((o) => (
          <Pressable key={o.value} onPress={() => !o.disabled && sel(o.value)} style={[s.it, o.value === value && s.itS]}>
            <Text style={s.itL}>{o.label}</Text></Pressable>
        )) : <Pressable onPress={() => allowCustom && li.trim() && sel(li.trim())} style={s.it}>
          <Text style={s.em}>{allowCustom ? 'Create "' + li + '"' : 'No results'}</Text></Pressable>}
      </ScrollView>}
    </View>
  );
};

const s = StyleSheet.create({
  root: { zIndex: 10 }, label: { fontSize: 14, fontWeight: '500', color: '#1e293b', marginBottom: 4 },
  wrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, backgroundColor: '#fff', paddingHorizontal: 10 },
  dis: { backgroundColor: '#f1f5f9', opacity: 0.6 },
  input: { flex: 1, fontSize: 15, color: '#1e293b', paddingVertical: 8 },
  clr: { fontSize: 18, color: '#94a3b8', paddingHorizontal: 4 },
  ct: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, backgroundColor: '#fff', maxHeight: 200, marginTop: 2 },
  it: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  itS: { backgroundColor: '#eff6ff' }, itL: { fontSize: 14, color: '#334155' },
  em: { fontSize: 14, color: '#94a3b8' },
});
Combobox.displayName = 'Combobox'; export default Combobox;
