// ============================================================
// Clef Surface NativeScript Widget — BlockEditor
//
// Block-based content editor with drag-and-drop blocks.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface BlockDef { id: string; type: string; content: string; }

export interface BlockEditorProps {
  blocks?: BlockDef[];
  readOnly?: boolean;
  placeholder?: string;
  onBlockChange?: (id: string, content: string) => void;
  onBlockAdd?: (type: string, afterId?: string) => void;
  onBlockDelete?: (id: string) => void;
  children?: View[];
}

export function createBlockEditor(props: BlockEditorProps): StackLayout {
  const { blocks = [], readOnly = false, placeholder = 'Start writing...', onBlockChange, onBlockAdd, onBlockDelete, children = [] } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-block-editor';
  container.accessibilityLabel = 'Block editor';

  if (blocks.length === 0) {
    const ph = new Label();
    ph.text = placeholder;
    ph.opacity = 0.5;
    container.addChild(ph);
  }

  for (const block of blocks) {
    const blockView = new StackLayout();
    blockView.className = `clef-block clef-block-${block.type}`;
    blockView.padding = '4';
    const content = new Label();
    content.text = block.content;
    content.textWrap = true;
    blockView.addChild(content);
    container.addChild(blockView);
  }

  for (const child of children) container.addChild(child);
  return container;
}

export default createBlockEditor;
