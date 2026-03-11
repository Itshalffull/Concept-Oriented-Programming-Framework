// ============================================================
// Clef Surface NativeScript Widget — MarkdownPreview
//
// Markdown content renderer/preview.
// ============================================================

import { StackLayout, Label, ScrollView } from '@nativescript/core';

export interface MarkdownPreviewProps {
  content?: string;
  maxHeight?: number;
}

export function createMarkdownPreview(props: MarkdownPreviewProps): ScrollView {
  const { content = '', maxHeight } = props;
  const scrollView = new ScrollView();
  if (maxHeight) scrollView.height = maxHeight;
  const container = new StackLayout();
  container.className = 'clef-widget-markdown-preview';
  container.padding = '8';
  const contentLabel = new Label();
  contentLabel.text = content;
  contentLabel.textWrap = true;
  container.addChild(contentLabel);
  scrollView.content = container;
  return scrollView;
}

export default createMarkdownPreview;
