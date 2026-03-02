// ============================================================
// Clef Surface NativeScript Widget — ThemeSwitch
//
// NativeScript component that lets users toggle between
// available Clef Surface themes. Renders as a list of
// selectable theme options with the active theme highlighted.
// ============================================================

import { StackLayout, GridLayout, Label, EventData } from '@nativescript/core';

import type { ThemeConfig } from '../../shared/types.js';

// --------------- Props ---------------

export interface ThemeSwitchProps {
  themes?: ThemeConfig[];
  activeTheme?: string;
  label?: string;
  showPreview?: boolean;
  onThemeChange?: (themeName: string) => void;
}

// --------------- Component ---------------

export function createThemeSwitch(props: ThemeSwitchProps = {}): StackLayout {
  const {
    themes = [],
    activeTheme = '',
    label = 'Theme',
    showPreview = false,
    onThemeChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-theme-switch';

  const titleLabel = new Label();
  titleLabel.text = label;
  titleLabel.className = 'clef-theme-switch-title';
  titleLabel.fontWeight = 'bold';
  container.addChild(titleLabel);

  let selectedTheme = activeTheme;

  themes.forEach((theme) => {
    const row = new GridLayout();
    row.columns = 'auto, *';
    row.className = 'clef-theme-switch-option';
    row.padding = 4;

    const indicator = new Label();
    indicator.col = 0;
    indicator.text = theme.name === selectedTheme ? '◉' : '○';
    indicator.marginRight = 8;
    row.addChild(indicator);

    const nameLabel = new Label();
    nameLabel.col = 1;
    nameLabel.text = theme.name;
    nameLabel.color = theme.name === selectedTheme ? '#2196F3' : undefined;
    row.addChild(nameLabel);

    row.on('tap', () => {
      selectedTheme = theme.name;
      onThemeChange?.(theme.name);
    });

    container.addChild(row);
  });

  return container;
}

createThemeSwitch.displayName = 'ThemeSwitch';
export default createThemeSwitch;
