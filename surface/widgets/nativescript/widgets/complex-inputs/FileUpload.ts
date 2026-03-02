// ============================================================
// Clef Surface NativeScript Widget — FileUpload
//
// File upload control with a drop-zone area, file list display
// showing selected files with size and remove buttons, progress
// indicators per file, and configurable accept/size constraints.
//
// Adapts the file-upload.widget spec: anatomy (root, dropZone,
// fileList, fileItem, progressBar, removeButton), states
// (idle, dragging, uploading, complete, error), and connect
// attributes to NativeScript views and tap handlers.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  Progress,
  ContentView,
} from '@nativescript/core';

// --------------- Props ---------------

export interface FileItem {
  name: string;
  size: number;
  progress?: number;
  status?: 'pending' | 'uploading' | 'complete' | 'error';
}

export interface FileUploadProps {
  files?: FileItem[];
  accept?: string[];
  maxFileSize?: number;
  maxFiles?: number;
  enabled?: boolean;
  onFilesChange?: (files: FileItem[]) => void;
  onUpload?: (file: FileItem) => void;
}

// --------------- Helpers ---------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --------------- Component ---------------

/**
 * Creates a NativeScript file upload widget with a tap-to-browse
 * drop zone, file list with progress bars and status labels,
 * per-file remove buttons, and constraints display.
 */
export function createFileUpload(props: FileUploadProps = {}): StackLayout {
  const {
    files: initialFiles = [],
    accept = [],
    maxFileSize = 10 * 1024 * 1024,
    maxFiles = 5,
    enabled = true,
    onFilesChange,
    onUpload,
  } = props;

  const fileList: FileItem[] = [...initialFiles];

  const container = new StackLayout();
  container.className = 'clef-widget-file-upload';
  container.padding = 8;

  // -- Drop zone --
  const dropZone = new StackLayout();
  dropZone.className = 'clef-file-upload-dropzone';
  dropZone.borderWidth = 2;
  dropZone.borderColor = '#90CAF9';
  dropZone.borderRadius = 8;
  dropZone.padding = 24;
  dropZone.horizontalAlignment = 'stretch';
  dropZone.backgroundColor = '#F5F9FF' as any;
  dropZone.marginBottom = 12;

  const dropIcon = new Label();
  dropIcon.text = '\u2B06';
  dropIcon.fontSize = 32;
  dropIcon.horizontalAlignment = 'center';
  dropIcon.opacity = 0.5;
  dropZone.addChild(dropIcon);

  const dropLabel = new Label();
  dropLabel.text = 'Tap to browse files';
  dropLabel.fontSize = 14;
  dropLabel.horizontalAlignment = 'center';
  dropLabel.marginTop = 8;
  dropZone.addChild(dropLabel);

  if (accept.length > 0) {
    const acceptLabel = new Label();
    acceptLabel.text = `Accepted: ${accept.join(', ')}`;
    acceptLabel.fontSize = 11;
    acceptLabel.horizontalAlignment = 'center';
    acceptLabel.opacity = 0.6;
    acceptLabel.marginTop = 4;
    dropZone.addChild(acceptLabel);
  }

  const constraintLabel = new Label();
  constraintLabel.text = `Max ${maxFiles} files, ${formatFileSize(maxFileSize)} each`;
  constraintLabel.fontSize = 11;
  constraintLabel.horizontalAlignment = 'center';
  constraintLabel.opacity = 0.5;
  constraintLabel.marginTop = 2;
  dropZone.addChild(constraintLabel);

  if (enabled) {
    dropZone.on('tap', () => {
      // In a real app this would open the native file picker.
      // Here we emit a placeholder event for wiring.
      const placeholder: FileItem = {
        name: `file-${fileList.length + 1}.txt`,
        size: 1024,
        progress: 0,
        status: 'pending',
      };
      if (fileList.length < maxFiles) {
        fileList.push(placeholder);
        renderFileList();
        if (onFilesChange) onFilesChange([...fileList]);
      }
    });
  }

  container.addChild(dropZone);

  // -- File list --
  const fileListContainer = new StackLayout();
  fileListContainer.className = 'clef-file-upload-list';
  container.addChild(fileListContainer);

  function renderFileList(): void {
    fileListContainer.removeChildren();

    if (fileList.length === 0) {
      const empty = new Label();
      empty.text = 'No files selected';
      empty.opacity = 0.5;
      empty.horizontalAlignment = 'center';
      fileListContainer.addChild(empty);
      return;
    }

    fileList.forEach((file, index) => {
      const row = new GridLayout();
      row.columns = '*, auto, auto';
      row.rows = 'auto, auto';
      row.padding = 8;
      row.marginBottom = 4;
      row.borderWidth = 1;
      row.borderColor = '#E0E0E0';
      row.borderRadius = 4;

      // File name
      const nameLabel = new Label();
      nameLabel.text = file.name;
      nameLabel.fontSize = 13;
      nameLabel.fontWeight = 'bold';
      nameLabel.col = 0;
      nameLabel.row = 0;
      row.addChild(nameLabel);

      // File size
      const sizeLabel = new Label();
      sizeLabel.text = formatFileSize(file.size);
      sizeLabel.fontSize = 11;
      sizeLabel.opacity = 0.6;
      sizeLabel.col = 1;
      sizeLabel.row = 0;
      sizeLabel.marginLeft = 8;
      row.addChild(sizeLabel);

      // Remove button
      const removeBtn = new Button();
      removeBtn.text = '\u2715';
      removeBtn.fontSize = 14;
      removeBtn.col = 2;
      removeBtn.row = 0;
      removeBtn.backgroundColor = 'transparent' as any;
      removeBtn.borderWidth = 0;
      removeBtn.width = 32;
      removeBtn.height = 32;
      if (enabled) {
        removeBtn.on('tap', () => {
          fileList.splice(index, 1);
          renderFileList();
          if (onFilesChange) onFilesChange([...fileList]);
        });
      }
      row.addChild(removeBtn);

      // Progress bar
      if (file.status === 'uploading' || file.status === 'pending') {
        const progress = new Progress();
        progress.value = file.progress ?? 0;
        progress.maxValue = 100;
        progress.col = 0;
        progress.colSpan = 2;
        progress.row = 1;
        progress.marginTop = 4;
        row.addChild(progress);
      }

      // Status label
      if (file.status === 'complete') {
        const statusLabel = new Label();
        statusLabel.text = '\u2713 Complete';
        statusLabel.fontSize = 11;
        statusLabel.color = '#4CAF50' as any;
        statusLabel.col = 0;
        statusLabel.row = 1;
        statusLabel.marginTop = 4;
        row.addChild(statusLabel);
      } else if (file.status === 'error') {
        const statusLabel = new Label();
        statusLabel.text = '\u2717 Error';
        statusLabel.fontSize = 11;
        statusLabel.color = '#F44336' as any;
        statusLabel.col = 0;
        statusLabel.row = 1;
        statusLabel.marginTop = 4;
        row.addChild(statusLabel);
      }

      fileListContainer.addChild(row);
    });
  }

  // -- Upload all button --
  const uploadBtn = new Button();
  uploadBtn.text = 'Upload All';
  uploadBtn.isEnabled = enabled;
  uploadBtn.marginTop = 8;
  uploadBtn.on('tap', () => {
    fileList.forEach((file) => {
      if (file.status === 'pending') {
        file.status = 'uploading';
        if (onUpload) onUpload(file);
      }
    });
    renderFileList();
  });
  container.addChild(uploadBtn);

  renderFileList();

  if (!enabled) {
    container.opacity = 0.38;
  }

  return container;
}

createFileUpload.displayName = 'FileUpload';
export default createFileUpload;
