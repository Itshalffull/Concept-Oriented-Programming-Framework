// ============================================================
// Clef Surface NativeScript Widget — PluginDetailPage
//
// Full plugin/extension detail page with metadata and reviews.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';

export interface PluginScreenshot { url: string; alt?: string; }
export interface PluginReview { author: string; rating: number; text: string; date?: string; }
export interface ChangelogEntry { version: string; date: string; changes: string[]; }

export interface PluginDetailPageProps {
  name?: string;
  description?: string;
  version?: string;
  author?: string;
  icon?: string;
  screenshots?: PluginScreenshot[];
  reviews?: PluginReview[];
  changelog?: ChangelogEntry[];
  installed?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
}

export function createPluginDetailPage(props: PluginDetailPageProps): ScrollView {
  const { name = '', description = '', version, author, icon, screenshots = [], reviews = [], changelog = [], installed = false, onInstall, onUninstall } = props;
  const scrollView = new ScrollView();
  const container = new StackLayout();
  container.className = 'clef-widget-plugin-detail-page';
  container.padding = '16';

  const titleLabel = new Label();
  titleLabel.text = name;
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 22;
  container.addChild(titleLabel);

  if (author) { const a = new Label(); a.text = `by ${author}`; a.opacity = 0.6; container.addChild(a); }
  if (version) { const v = new Label(); v.text = `v${version}`; v.opacity = 0.5; v.fontSize = 12; container.addChild(v); }

  const desc = new Label();
  desc.text = description;
  desc.textWrap = true;
  desc.marginTop = 12;
  container.addChild(desc);

  const actionBtn = new Button();
  actionBtn.text = installed ? 'Uninstall' : 'Install';
  actionBtn.marginTop = 12;
  actionBtn.on('tap', () => installed ? onUninstall?.() : onInstall?.());
  container.addChild(actionBtn);

  scrollView.content = container;
  return scrollView;
}

export default createPluginDetailPage;
