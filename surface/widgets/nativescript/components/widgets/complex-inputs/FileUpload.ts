// ============================================================
// Clef Surface NativeScript Widget — FileUpload
//
// File upload with drag-drop zone and progress display.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';

export interface FileUploadProps {
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
  description?: string;
  onUpload?: (files: any[]) => void;
  onRemove?: (index: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function createFileUpload(props: FileUploadProps): StackLayout {
  const {
    accept, maxSize, maxFiles = 1, multiple = false,
    disabled = false, label = 'Upload files',
    description = 'Tap to select files', onUpload, onRemove, size = 'md',
  } = props;

  const container = new StackLayout();
  container.className = `clef-widget-file-upload clef-size-${size}`;
  container.padding = '24';
  container.horizontalAlignment = 'center';

  const icon = new Label();
  icon.text = '\u2191';
  icon.fontSize = 32;
  icon.horizontalAlignment = 'center';
  container.addChild(icon);

  const titleLabel = new Label();
  titleLabel.text = label;
  titleLabel.fontWeight = 'bold';
  titleLabel.horizontalAlignment = 'center';
  container.addChild(titleLabel);

  const desc = new Label();
  desc.text = description;
  desc.opacity = 0.6;
  desc.horizontalAlignment = 'center';
  container.addChild(desc);

  const uploadBtn = new Button();
  uploadBtn.text = 'Select Files';
  uploadBtn.isEnabled = !disabled;
  uploadBtn.marginTop = 12;
  uploadBtn.accessibilityLabel = label;
  container.addChild(uploadBtn);

  return container;
}

export default createFileUpload;
