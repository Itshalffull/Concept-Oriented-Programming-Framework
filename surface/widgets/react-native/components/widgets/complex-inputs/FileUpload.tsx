import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export interface FileUploadProps {
  accept?: string; multiple?: boolean; maxSize?: number; maxFiles?: number; disabled?: boolean; onChange?: (files: string[]) => void; style?: ViewStyle;
}

export const FileUpload: React.FC<FileUploadProps> = (props) => {
  const { accept, multiple, maxSize, maxFiles, disabled, onChange, style } = props;
  return (<View style={[s.root, style]} accessibilityRole="button" accessibilityLabel="File upload"><View style={[s.dropzone, disabled && s.disabled]}><Text style={s.icon}>{'\u{1F4C1}'}</Text><Text style={s.label}>Tap to select files</Text><Text style={s.hint}>{accept ? `Accepts: ${accept}` : 'All file types'}</Text></View></View>);
};

const s = StyleSheet.create({
  root: {}, dropzone: { borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 8, padding: 24, alignItems: 'center' }, disabled: { opacity: 0.5 }, icon: { fontSize: 32, marginBottom: 8 }, label: { fontSize: 14, color: '#1e293b', fontWeight: '500' }, hint: { fontSize: 12, color: '#94a3b8', marginTop: 4 }
});

FileUpload.displayName = 'FileUpload';
export default FileUpload;
