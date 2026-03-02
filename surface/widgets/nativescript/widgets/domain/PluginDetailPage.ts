// ============================================================
// Clef Surface NativeScript Widget — PluginDetailPage
//
// Plugin detail with configuration. Renders a full plugin
// info page with metadata, screenshots, reviews, changelog,
// and install/config actions.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Image,
  Button,
  ScrollView,
  Color,
} from '@nativescript/core';

// --------------- Types ---------------

export interface PluginScreenshot {
  src: string;
  alt?: string;
}

export interface PluginReview {
  author: string;
  rating: number;
  text: string;
  date?: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export interface PluginDetailPageProps {
  name?: string;
  description?: string;
  version?: string;
  author?: string;
  icon?: string;
  category?: string;
  rating?: number;
  downloadCount?: number;
  installed?: boolean;
  enabled?: boolean;
  screenshots?: PluginScreenshot[];
  reviews?: PluginReview[];
  changelog?: ChangelogEntry[];
  configFields?: Array<{ key: string; label: string; value: string; type: string }>;
  accentColor?: string;
  onInstall?: () => void;
  onUninstall?: () => void;
  onEnable?: () => void;
  onDisable?: () => void;
  onConfigure?: () => void;
  onRate?: (rating: number) => void;
}

// --------------- Helpers ---------------

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '\u2605'.repeat(full) + (half ? '\u2606' : '') + '\u2606'.repeat(empty);
}

// --------------- Component ---------------

export function createPluginDetailPage(props: PluginDetailPageProps = {}): StackLayout {
  const {
    name = 'Plugin',
    description = '',
    version = '1.0.0',
    author = 'Unknown',
    icon,
    category,
    rating = 0,
    downloadCount = 0,
    installed = false,
    enabled = false,
    screenshots = [],
    reviews = [],
    changelog = [],
    configFields = [],
    accentColor = '#06b6d4',
    onInstall,
    onUninstall,
    onEnable,
    onDisable,
    onConfigure,
    onRate,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-plugin-detail-page';

  const scrollView = new ScrollView();
  const content = new StackLayout();
  content.padding = 12;

  // Header
  const headerRow = new GridLayout();
  headerRow.columns = 'auto, *, auto';
  headerRow.marginBottom = 12;

  // Icon
  if (icon) {
    const iconImage = new Image();
    iconImage.src = icon;
    iconImage.width = 48;
    iconImage.height = 48;
    iconImage.borderRadius = 8;
    iconImage.marginRight = 12;
    GridLayout.setColumn(iconImage, 0);
    headerRow.addChild(iconImage);
  } else {
    const iconPlaceholder = new Label();
    iconPlaceholder.text = '\uD83E\uDDE9';
    iconPlaceholder.fontSize = 32;
    iconPlaceholder.marginRight = 12;
    iconPlaceholder.verticalAlignment = 'middle';
    GridLayout.setColumn(iconPlaceholder, 0);
    headerRow.addChild(iconPlaceholder);
  }

  // Name and meta
  const metaStack = new StackLayout();

  const nameLabel = new Label();
  nameLabel.text = name;
  nameLabel.fontSize = 18;
  nameLabel.fontWeight = 'bold';
  nameLabel.color = new Color('#ffffff');
  metaStack.addChild(nameLabel);

  const authorLabel = new Label();
  authorLabel.text = `by ${author} \u2022 v${version}`;
  authorLabel.fontSize = 11;
  authorLabel.opacity = 0.5;
  metaStack.addChild(authorLabel);

  const ratingRow = new StackLayout();
  ratingRow.orientation = 'horizontal';

  const starsLabel = new Label();
  starsLabel.text = renderStars(rating);
  starsLabel.color = new Color('#eab308');
  starsLabel.fontSize = 12;
  starsLabel.marginRight = 4;
  ratingRow.addChild(starsLabel);

  const ratingLabel = new Label();
  ratingLabel.text = `${rating.toFixed(1)} \u2022 ${downloadCount.toLocaleString()} downloads`;
  ratingLabel.fontSize = 10;
  ratingLabel.opacity = 0.5;
  ratingRow.addChild(ratingLabel);

  metaStack.addChild(ratingRow);

  if (category) {
    const categoryLabel = new Label();
    categoryLabel.text = category;
    categoryLabel.fontSize = 10;
    categoryLabel.color = new Color(accentColor);
    categoryLabel.backgroundColor = new Color('#1a1a2e');
    categoryLabel.borderRadius = 3;
    categoryLabel.padding = 2;
    metaStack.addChild(categoryLabel);
  }

  GridLayout.setColumn(metaStack, 1);
  headerRow.addChild(metaStack);

  // Action buttons
  const actionStack = new StackLayout();
  actionStack.verticalAlignment = 'middle';

  if (installed) {
    const statusLabel = new Label();
    statusLabel.text = enabled ? '\u2714 Enabled' : '\u25CB Disabled';
    statusLabel.color = new Color(enabled ? '#22c55e' : '#888888');
    statusLabel.fontSize = 11;
    statusLabel.marginBottom = 4;
    actionStack.addChild(statusLabel);

    const toggleBtn = new Button();
    toggleBtn.text = enabled ? 'Disable' : 'Enable';
    toggleBtn.fontSize = 11;
    toggleBtn.marginBottom = 4;
    toggleBtn.on('tap', () => (enabled ? onDisable?.() : onEnable?.()));
    actionStack.addChild(toggleBtn);

    const uninstallBtn = new Button();
    uninstallBtn.text = 'Uninstall';
    uninstallBtn.fontSize = 11;
    uninstallBtn.on('tap', () => onUninstall?.());
    actionStack.addChild(uninstallBtn);
  } else {
    const installBtn = new Button();
    installBtn.text = 'Install';
    installBtn.fontSize = 12;
    installBtn.backgroundColor = new Color(accentColor);
    installBtn.color = new Color('#000000');
    installBtn.borderRadius = 4;
    installBtn.padding = 8;
    installBtn.on('tap', () => onInstall?.());
    actionStack.addChild(installBtn);
  }

  GridLayout.setColumn(actionStack, 2);
  headerRow.addChild(actionStack);

  content.addChild(headerRow);

  // Description
  if (description) {
    const descHeader = new Label();
    descHeader.text = 'Description';
    descHeader.fontWeight = 'bold';
    descHeader.fontSize = 13;
    descHeader.marginBottom = 4;
    content.addChild(descHeader);

    const descLabel = new Label();
    descLabel.text = description;
    descLabel.textWrap = true;
    descLabel.color = new Color('#c0c0c0');
    descLabel.marginBottom = 12;
    content.addChild(descLabel);
  }

  // Screenshots
  if (screenshots.length > 0) {
    const ssHeader = new Label();
    ssHeader.text = 'Screenshots';
    ssHeader.fontWeight = 'bold';
    ssHeader.fontSize = 13;
    ssHeader.marginBottom = 4;
    content.addChild(ssHeader);

    const ssScroll = new ScrollView();
    ssScroll.orientation = 'horizontal';
    ssScroll.height = 150;
    ssScroll.marginBottom = 12;

    const ssRow = new StackLayout();
    ssRow.orientation = 'horizontal';

    screenshots.forEach((ss) => {
      const img = new Image();
      img.src = ss.src;
      img.height = 140;
      img.stretch = 'aspectFit';
      img.borderRadius = 4;
      img.marginRight = 8;
      ssRow.addChild(img);
    });

    ssScroll.content = ssRow;
    content.addChild(ssScroll);
  }

  // Configuration
  if (installed && configFields.length > 0) {
    const configHeader = new GridLayout();
    configHeader.columns = '*, auto';
    configHeader.marginBottom = 4;

    const configLabel = new Label();
    configLabel.text = 'Configuration';
    configLabel.fontWeight = 'bold';
    configLabel.fontSize = 13;
    GridLayout.setColumn(configLabel, 0);
    configHeader.addChild(configLabel);

    const configBtn = new Button();
    configBtn.text = '\u2699 Edit';
    configBtn.fontSize = 10;
    configBtn.on('tap', () => onConfigure?.());
    GridLayout.setColumn(configBtn, 1);
    configHeader.addChild(configBtn);

    content.addChild(configHeader);

    configFields.forEach((field) => {
      const fieldRow = new GridLayout();
      fieldRow.columns = '*, *';
      fieldRow.padding = 4;
      fieldRow.marginBottom = 2;
      fieldRow.backgroundColor = new Color('#1a1a2e');
      fieldRow.borderRadius = 3;

      const keyLabel = new Label();
      keyLabel.text = field.label;
      keyLabel.fontSize = 11;
      keyLabel.opacity = 0.7;
      GridLayout.setColumn(keyLabel, 0);
      fieldRow.addChild(keyLabel);

      const valLabel = new Label();
      valLabel.text = field.value;
      valLabel.fontSize = 11;
      valLabel.color = new Color('#e0e0e0');
      valLabel.textAlignment = 'right';
      GridLayout.setColumn(valLabel, 1);
      fieldRow.addChild(valLabel);

      content.addChild(fieldRow);
    });

    content.addChild(new Label()); // spacer
  }

  // Reviews
  if (reviews.length > 0) {
    const reviewHeader = new Label();
    reviewHeader.text = `Reviews (${reviews.length})`;
    reviewHeader.fontWeight = 'bold';
    reviewHeader.fontSize = 13;
    reviewHeader.marginTop = 8;
    reviewHeader.marginBottom = 4;
    content.addChild(reviewHeader);

    reviews.slice(0, 5).forEach((review) => {
      const reviewBox = new StackLayout();
      reviewBox.padding = 8;
      reviewBox.marginBottom = 4;
      reviewBox.backgroundColor = new Color('#1a1a2e');
      reviewBox.borderRadius = 4;

      const reviewMeta = new StackLayout();
      reviewMeta.orientation = 'horizontal';

      const reviewStars = new Label();
      reviewStars.text = renderStars(review.rating);
      reviewStars.color = new Color('#eab308');
      reviewStars.fontSize = 10;
      reviewStars.marginRight = 4;
      reviewMeta.addChild(reviewStars);

      const reviewAuthor = new Label();
      reviewAuthor.text = `${review.author}${review.date ? ` \u2022 ${review.date}` : ''}`;
      reviewAuthor.fontSize = 10;
      reviewAuthor.opacity = 0.5;
      reviewMeta.addChild(reviewAuthor);

      reviewBox.addChild(reviewMeta);

      const reviewText = new Label();
      reviewText.text = review.text;
      reviewText.fontSize = 12;
      reviewText.textWrap = true;
      reviewText.color = new Color('#c0c0c0');
      reviewText.marginTop = 4;
      reviewBox.addChild(reviewText);

      content.addChild(reviewBox);
    });
  }

  // Changelog
  if (changelog.length > 0) {
    const clHeader = new Label();
    clHeader.text = 'Changelog';
    clHeader.fontWeight = 'bold';
    clHeader.fontSize = 13;
    clHeader.marginTop = 8;
    clHeader.marginBottom = 4;
    content.addChild(clHeader);

    changelog.slice(0, 3).forEach((entry) => {
      const entryBox = new StackLayout();
      entryBox.marginBottom = 6;

      const versionLabel = new Label();
      versionLabel.text = `v${entry.version} \u2022 ${entry.date}`;
      versionLabel.fontWeight = 'bold';
      versionLabel.fontSize = 11;
      versionLabel.color = new Color(accentColor);
      entryBox.addChild(versionLabel);

      entry.changes.forEach((change) => {
        const changeLabel = new Label();
        changeLabel.text = `  \u2022 ${change}`;
        changeLabel.fontSize = 11;
        changeLabel.color = new Color('#a0a0a0');
        changeLabel.textWrap = true;
        entryBox.addChild(changeLabel);
      });

      content.addChild(entryBox);
    });
  }

  scrollView.content = content;
  container.addChild(scrollView);

  return container;
}

export default createPluginDetailPage;
