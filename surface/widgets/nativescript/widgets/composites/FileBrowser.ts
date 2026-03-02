// ============================================================
// Clef Surface NativeScript Widget — FileBrowser
//
// File and folder tree navigation widget. Displays a
// hierarchical tree structure with expand/collapse toggles,
// file/folder icons, and tap-to-select behaviour.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, GridLayout, Label, ScrollView, Button } from '@nativescript/core';

// --------------- Types ---------------

export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  size?: number;
  modified?: string;
}

// --------------- Props ---------------

export interface FileBrowserProps {
  /** Root tree of files and folders. */
  tree?: FileNode[];
  /** Currently selected file path. */
  selectedPath?: string;
  /** Set of expanded folder paths. */
  expandedPaths?: Set<string>;
  /** Whether to show file sizes. */
  showSize?: boolean;
  /** Called when a file is selected. */
  onSelect?: (path: string, node: FileNode) => void;
  /** Called when a folder is toggled. */
  onToggle?: (path: string, expanded: boolean) => void;
}

// --------------- Component ---------------

export function createFileBrowser(props: FileBrowserProps = {}): StackLayout {
  const {
    tree = [],
    selectedPath = '',
    expandedPaths = new Set<string>(),
    showSize = false,
    onSelect,
    onToggle,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-file-browser';
  container.padding = 12;

  // Header
  const header = new Label();
  header.text = 'Files';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  header.marginBottom = 8;
  container.addChild(header);

  if (tree.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No files.';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 16;
    container.addChild(emptyLabel);
    return container;
  }

  const scrollView = new ScrollView();
  const list = new StackLayout();

  function renderNode(node: FileNode, depth: number, parentPath: string): void {
    const path = parentPath ? `${parentPath}/${node.name}` : node.name;
    const isExpanded = expandedPaths.has(path);
    const isSelected = path === selectedPath;

    const row = new GridLayout();
    row.columns = 'auto, auto, *, auto';
    row.padding = 4;
    row.marginLeft = depth * 16;
    row.borderRadius = 3;

    if (isSelected) {
      row.backgroundColor = '#DDEEFF' as any;
    }

    // Expand/collapse indicator for folders
    const toggleLabel = new Label();
    if (node.type === 'folder') {
      toggleLabel.text = isExpanded ? '\u25BC ' : '\u25B6 ';
      toggleLabel.fontSize = 10;
    } else {
      toggleLabel.text = '  ';
    }
    toggleLabel.verticalAlignment = 'middle';
    GridLayout.setColumn(toggleLabel, 0);
    row.addChild(toggleLabel);

    // Icon
    const icon = new Label();
    icon.text = node.type === 'folder' ? '\uD83D\uDCC1 ' : '\uD83D\uDCC4 ';
    icon.fontSize = 13;
    icon.verticalAlignment = 'middle';
    GridLayout.setColumn(icon, 1);
    row.addChild(icon);

    // Name
    const nameLabel = new Label();
    nameLabel.text = node.name;
    nameLabel.fontSize = 13;
    nameLabel.fontWeight = isSelected ? 'bold' : 'normal';
    nameLabel.verticalAlignment = 'middle';
    GridLayout.setColumn(nameLabel, 2);
    row.addChild(nameLabel);

    // File size
    if (showSize && node.type === 'file' && node.size != null) {
      const sizeLabel = new Label();
      sizeLabel.text = formatSize(node.size);
      sizeLabel.opacity = 0.4;
      sizeLabel.fontSize = 10;
      sizeLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(sizeLabel, 3);
      row.addChild(sizeLabel);
    }

    row.on('tap', () => {
      if (node.type === 'folder' && onToggle) {
        onToggle(path, !isExpanded);
      }
      if (onSelect) {
        onSelect(path, node);
      }
    });

    list.addChild(row);

    // Render children if expanded folder
    if (node.type === 'folder' && isExpanded && node.children) {
      // Sort: folders first, then files
      const sorted = [...node.children].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      sorted.forEach((child) => renderNode(child, depth + 1, path));
    }
  }

  const sorted = [...tree].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  sorted.forEach((node) => renderNode(node, 0, ''));

  scrollView.content = list;
  container.addChild(scrollView);
  return container;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

createFileBrowser.displayName = 'FileBrowser';
export default createFileBrowser;
