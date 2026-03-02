// ============================================================
// Clef Surface NativeScript Widget — PluginCard
//
// Plugin information card with name, version, description,
// author, and an enable/disable toggle switch. Supports
// optional configure and uninstall action buttons.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, GridLayout, Label, Switch, Button } from '@nativescript/core';

// --------------- Types ---------------

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  enabled: boolean;
  iconText?: string;
}

// --------------- Props ---------------

export interface PluginCardProps {
  /** Plugin metadata. */
  plugin?: PluginInfo;
  /** Whether configure action is available. */
  showConfigure?: boolean;
  /** Whether uninstall action is available. */
  showUninstall?: boolean;
  /** Called when the enabled toggle changes. */
  onToggle?: (id: string, enabled: boolean) => void;
  /** Called when configure is tapped. */
  onConfigure?: (id: string) => void;
  /** Called when uninstall is tapped. */
  onUninstall?: (id: string) => void;
}

// --------------- Component ---------------

export function createPluginCard(props: PluginCardProps = {}): StackLayout {
  const {
    plugin = { id: '', name: 'Unknown Plugin', version: '0.0.0', enabled: false },
    showConfigure = true,
    showUninstall = false,
    onToggle,
    onConfigure,
    onUninstall,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-plugin-card';
  container.padding = 12;
  container.borderRadius = 8;
  container.borderWidth = 1;
  container.borderColor = '#E0E0E0';
  container.backgroundColor = '#FFFFFF' as any;

  // Top row: icon + name + version + toggle
  const topRow = new GridLayout();
  topRow.columns = 'auto, *, auto, auto';
  topRow.marginBottom = 8;

  // Icon
  const iconContainer = new StackLayout();
  iconContainer.width = 40;
  iconContainer.height = 40;
  iconContainer.borderRadius = 8;
  iconContainer.backgroundColor = (plugin.enabled ? '#E3F2FD' : '#F5F5F5') as any;
  iconContainer.horizontalAlignment = 'center';
  iconContainer.verticalAlignment = 'middle';
  const iconLabel = new Label();
  iconLabel.text = plugin.iconText || plugin.name.charAt(0).toUpperCase();
  iconLabel.fontSize = 18;
  iconLabel.fontWeight = 'bold';
  iconLabel.horizontalAlignment = 'center';
  iconLabel.verticalAlignment = 'middle';
  iconContainer.addChild(iconLabel);
  GridLayout.setColumn(iconContainer, 0);
  topRow.addChild(iconContainer);

  // Name + version
  const nameStack = new StackLayout();
  nameStack.marginLeft = 8;
  nameStack.verticalAlignment = 'middle';
  GridLayout.setColumn(nameStack, 1);

  const nameLabel = new Label();
  nameLabel.text = plugin.name;
  nameLabel.fontWeight = 'bold';
  nameLabel.fontSize = 14;
  nameStack.addChild(nameLabel);

  const versionLabel = new Label();
  versionLabel.text = `v${plugin.version}`;
  versionLabel.opacity = 0.5;
  versionLabel.fontSize = 11;
  nameStack.addChild(versionLabel);

  topRow.addChild(nameStack);

  // Status label
  const statusLabel = new Label();
  statusLabel.text = plugin.enabled ? 'Enabled' : 'Disabled';
  statusLabel.fontSize = 11;
  statusLabel.opacity = 0.6;
  statusLabel.verticalAlignment = 'middle';
  statusLabel.marginRight = 4;
  GridLayout.setColumn(statusLabel, 2);
  topRow.addChild(statusLabel);

  // Toggle switch
  const toggle = new Switch();
  toggle.checked = plugin.enabled;
  toggle.verticalAlignment = 'middle';
  GridLayout.setColumn(toggle, 3);
  if (onToggle) {
    toggle.on('checkedChange', () => onToggle(plugin.id, toggle.checked));
  }
  topRow.addChild(toggle);

  container.addChild(topRow);

  // Description
  if (plugin.description) {
    const descLabel = new Label();
    descLabel.text = plugin.description;
    descLabel.textWrap = true;
    descLabel.opacity = 0.7;
    descLabel.fontSize = 12;
    descLabel.marginBottom = 8;
    container.addChild(descLabel);
  }

  // Author
  if (plugin.author) {
    const authorLabel = new Label();
    authorLabel.text = `By ${plugin.author}`;
    authorLabel.opacity = 0.5;
    authorLabel.fontSize = 11;
    authorLabel.marginBottom = 8;
    container.addChild(authorLabel);
  }

  // Action buttons
  const hasActions = showConfigure || showUninstall;
  if (hasActions) {
    const actionsRow = new StackLayout();
    actionsRow.orientation = 'horizontal' as any;

    if (showConfigure) {
      const configBtn = new Button();
      configBtn.text = 'Configure';
      configBtn.fontSize = 11;
      configBtn.padding = 4;
      configBtn.marginRight = 8;
      if (onConfigure) {
        configBtn.on('tap', () => onConfigure(plugin.id));
      }
      actionsRow.addChild(configBtn);
    }

    if (showUninstall) {
      const uninstallBtn = new Button();
      uninstallBtn.text = 'Uninstall';
      uninstallBtn.fontSize = 11;
      uninstallBtn.padding = 4;
      uninstallBtn.color = '#F44336' as any;
      if (onUninstall) {
        uninstallBtn.on('tap', () => onUninstall(plugin.id));
      }
      actionsRow.addChild(uninstallBtn);
    }

    container.addChild(actionsRow);
  }

  return container;
}

createPluginCard.displayName = 'PluginCard';
export default createPluginCard;
