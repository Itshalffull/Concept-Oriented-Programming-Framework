// ============================================================
// Clef Surface NativeScript Widget — FileBrowser
//
// File browser with navigation, upload, and file management.
// ============================================================

import { StackLayout, Label, Button, TextField, ScrollView } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface FileDef {
  id: string;
  name: string;
  fileType: string;
  isFolder: boolean;
  path: string;
  size?: string;
  modifiedDate?: string;
}

export interface FileBrowserProps {
  files?: FileDef[];
  currentPath?: string;
  selectedIds?: string[];
  viewMode?: 'grid' | 'list';
  showSearch?: boolean;
  loading?: boolean;
  onNavigate?: (path: string) => void;
  onSelect?: (ids: string[]) => void;
  onOpen?: (id: string) => void;
  children?: View[];
}

export function createFileBrowser(props: FileBrowserProps): StackLayout {
  const {
    files = [], currentPath = '/', selectedIds = [],
    viewMode = 'list', showSearch = true, loading = false,
    onNavigate, onSelect, onOpen, children = [],
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-file-browser';
  container.accessibilityLabel = 'File browser';

  const toolbar = new StackLayout();
  toolbar.orientation = 'horizontal';
  const pathLabel = new Label();
  pathLabel.text = currentPath;
  pathLabel.fontWeight = 'bold';
  toolbar.addChild(pathLabel);
  container.addChild(toolbar);

  if (showSearch) {
    const searchField = new TextField();
    searchField.hint = 'Search files...';
    searchField.accessibilityLabel = 'Search files';
    container.addChild(searchField);
  }

  if (loading) {
    const loadingLabel = new Label();
    loadingLabel.text = 'Loading...';
    loadingLabel.horizontalAlignment = 'center';
    container.addChild(loadingLabel);
  } else if (files.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No files';
    emptyLabel.horizontalAlignment = 'center';
    container.addChild(emptyLabel);
  } else {
    for (const file of files) {
      const row = new StackLayout();
      row.orientation = 'horizontal';
      row.padding = '8';
      const icon = new Label();
      icon.text = file.isFolder ? '\uD83D\uDCC1' : '\uD83D\uDCC4';
      icon.marginRight = 8;
      row.addChild(icon);
      const name = new Label();
      name.text = file.name;
      row.addChild(name);
      row.on('tap', () => {
        if (file.isFolder) onNavigate?.(file.path);
        else onOpen?.(file.id);
      });
      container.addChild(row);
    }
  }

  for (const child of children) container.addChild(child);
  return container;
}

export default createFileBrowser;
