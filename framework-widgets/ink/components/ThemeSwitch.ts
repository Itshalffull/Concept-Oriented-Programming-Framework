// ============================================================
// COIF Ink Widget — ThemeSwitch
//
// Terminal-rendered theme selector. Shows available themes as
// a selectable list with the active theme highlighted.
// Uses stdin key handlers for up/down/enter navigation.
// ============================================================

import type { ThemeConfig, ResolvedTheme } from '../../shared/types.js';
import { resolveTheme } from '../../shared/coif-bridge.js';
import type { TerminalNode } from './DesignTokenProvider.js';
import { hexToAnsiFg } from './DesignTokenProvider.js';

// --- ANSI Helpers ---

const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';
const ANSI_DIM = '\x1b[2m';
const ANSI_INVERSE = '\x1b[7m';
const ANSI_GREEN_FG = '\x1b[32m';
const ANSI_CYAN_FG = '\x1b[36m';
const ANSI_YELLOW_FG = '\x1b[33m';

// --- Box-Drawing ---

const BORDER_SINGLE = {
  topLeft: '\u250c', topRight: '\u2510',
  bottomLeft: '\u2514', bottomRight: '\u2518',
  horizontal: '\u2500', vertical: '\u2502',
};

// --- ThemeSwitch Props ---

export interface ThemeSwitchProps {
  /** Available theme configurations. */
  themes: ThemeConfig[];
  /** Currently selected theme index. */
  selectedIndex?: number;
  /** Callback when a theme is activated. */
  onSelect?: (theme: ThemeConfig, index: number) => void;
  /** Title displayed above the theme list. */
  title?: string;
  /** Width of the selector in columns. */
  width?: number;
  /** Accent color for the highlight (hex). */
  accentColor?: string;
  /** Whether to show theme priority numbers. */
  showPriority?: boolean;
}

/**
 * Creates a static ThemeSwitch terminal node showing the current
 * selection state. For interactivity, use ThemeSwitchInteractive.
 */
export function createThemeSwitch(props: ThemeSwitchProps): TerminalNode {
  const {
    themes,
    selectedIndex = 0,
    title = 'Theme Selector',
    width = 40,
    accentColor = '#00d4aa',
    showPriority = false,
  } = props;

  const accentAnsi = hexToAnsiFg(accentColor);
  const innerWidth = width - 4; // Account for border + padding

  // Build header
  const headerLine = ` ${accentAnsi}${ANSI_BOLD}${title}${ANSI_RESET}`;
  const separatorLine = `${ANSI_DIM}${'─'.repeat(innerWidth)}${ANSI_RESET}`;
  const hintLine = `${ANSI_DIM} ↑/↓ navigate  ⏎ select${ANSI_RESET}`;

  const children: (TerminalNode | string)[] = [
    { type: 'text', props: {}, children: [headerLine] },
    { type: 'text', props: {}, children: [separatorLine] },
  ];

  // Build theme list items
  for (let i = 0; i < themes.length; i++) {
    const theme = themes[i];
    const isSelected = i === selectedIndex;
    const isActive = theme.active;

    let prefix: string;
    if (isSelected && isActive) {
      prefix = `${accentAnsi}${ANSI_BOLD}❯ ● `;
    } else if (isSelected) {
      prefix = `${ANSI_CYAN_FG}${ANSI_BOLD}❯   `;
    } else if (isActive) {
      prefix = `${ANSI_GREEN_FG}  ● `;
    } else {
      prefix = `${ANSI_DIM}  ○ `;
    }

    let label = theme.name;
    if (showPriority) {
      label += ` ${ANSI_DIM}(p:${theme.priority})${ANSI_RESET}`;
    }
    if (theme.base) {
      label += ` ${ANSI_DIM}← ${theme.base}${ANSI_RESET}`;
    }

    const style = isSelected ? ANSI_BOLD : '';
    const activeTag = isActive ? ` ${ANSI_GREEN_FG}[active]${ANSI_RESET}` : '';
    const line = `${prefix}${style}${label}${ANSI_RESET}${activeTag}`;

    children.push({
      type: 'text',
      props: { selected: isSelected, active: isActive, index: i },
      children: [line],
    });
  }

  children.push(
    { type: 'text', props: {}, children: [separatorLine] },
    { type: 'text', props: {}, children: [hintLine] },
  );

  return {
    type: 'box',
    props: {
      role: 'theme-switch',
      borderStyle: 'single',
      flexDirection: 'column',
      width,
      padding: 1,
    },
    children,
  };
}

// --- Interactive ThemeSwitch ---

export class ThemeSwitchInteractive {
  private selectedIndex: number;
  private themes: ThemeConfig[];
  private onSelect?: (theme: ThemeConfig, index: number) => void;
  private listeners: Set<(node: TerminalNode) => void> = new Set();
  private destroyed = false;
  private props: ThemeSwitchProps;

  constructor(props: ThemeSwitchProps) {
    this.props = props;
    this.themes = [...props.themes];
    this.selectedIndex = props.selectedIndex ?? 0;
    this.onSelect = props.onSelect;
  }

  /** Handle a keypress event. Returns true if the key was consumed. */
  handleKey(key: string): boolean {
    if (this.destroyed) return false;

    switch (key) {
      case 'up':
      case 'k': {
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.notify();
        return true;
      }
      case 'down':
      case 'j': {
        this.selectedIndex = Math.min(this.themes.length - 1, this.selectedIndex + 1);
        this.notify();
        return true;
      }
      case 'return':
      case 'enter':
      case 'space': {
        this.activateSelected();
        return true;
      }
      case 'home': {
        this.selectedIndex = 0;
        this.notify();
        return true;
      }
      case 'end': {
        this.selectedIndex = this.themes.length - 1;
        this.notify();
        return true;
      }
      default:
        return false;
    }
  }

  /** Programmatically select a theme by index. */
  select(index: number): void {
    if (index >= 0 && index < this.themes.length) {
      this.selectedIndex = index;
      this.notify();
    }
  }

  /** Get the currently highlighted theme. */
  getSelectedTheme(): ThemeConfig {
    return this.themes[this.selectedIndex];
  }

  /** Get the current selection index. */
  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  /** Update the theme list at runtime. */
  updateThemes(themes: ThemeConfig[]): void {
    this.themes = [...themes];
    this.selectedIndex = Math.min(this.selectedIndex, this.themes.length - 1);
    this.notify();
  }

  /** Subscribe to re-renders. */
  onRender(listener: (node: TerminalNode) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  render(): TerminalNode {
    return createThemeSwitch({
      ...this.props,
      themes: this.themes,
      selectedIndex: this.selectedIndex,
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
  }

  private activateSelected(): void {
    // Deactivate all themes, activate the selected one
    for (let i = 0; i < this.themes.length; i++) {
      this.themes[i] = { ...this.themes[i], active: i === this.selectedIndex };
    }

    if (this.onSelect) {
      this.onSelect(this.themes[this.selectedIndex], this.selectedIndex);
    }

    this.notify();
  }

  private notify(): void {
    const node = this.render();
    for (const listener of this.listeners) {
      listener(node);
    }
  }
}
