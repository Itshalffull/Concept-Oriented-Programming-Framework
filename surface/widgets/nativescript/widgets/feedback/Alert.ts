// ============================================================
// Clef Surface NativeScript Widget — Alert
//
// Alert banner with severity levels (info, success, warning,
// error). Renders a horizontal bar with an icon label, message
// text, and an optional dismiss button. Background color
// adapts to the chosen severity.
// ============================================================

import { StackLayout, GridLayout, Label, Button, Color } from '@nativescript/core';

// --------------- Types ---------------

export type AlertSeverity = 'info' | 'success' | 'warning' | 'error';

// --------------- Props ---------------

export interface AlertProps {
  message: string;
  severity?: AlertSeverity;
  title?: string;
  dismissible?: boolean;
  visible?: boolean;
  icon?: string;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: number;
  onDismiss?: () => void;
}

// --------------- Helpers ---------------

const SEVERITY_CONFIG: Record<AlertSeverity, { bg: string; fg: string; icon: string }> = {
  info:    { bg: '#E3F2FD', fg: '#0D47A1', icon: '\u2139' },
  success: { bg: '#E8F5E9', fg: '#1B5E20', icon: '\u2713' },
  warning: { bg: '#FFF8E1', fg: '#E65100', icon: '\u26A0' },
  error:   { bg: '#FFEBEE', fg: '#B71C1C', icon: '\u2716' },
};

// --------------- Component ---------------

export function createAlert(props: AlertProps = { message: '' }): GridLayout {
  const {
    message,
    severity = 'info',
    title,
    dismissible = false,
    visible = true,
    icon,
    backgroundColor,
    textColor,
    borderRadius = 8,
    onDismiss,
  } = props;

  const config = SEVERITY_CONFIG[severity];
  const bg = backgroundColor ?? config.bg;
  const fg = textColor ?? config.fg;
  const resolvedIcon = icon ?? config.icon;

  const container = new GridLayout();
  container.className = `clef-alert clef-alert-${severity}`;
  container.columns = 'auto, *, auto';
  container.rows = 'auto';
  container.padding = 12;
  container.borderRadius = borderRadius;
  container.backgroundColor = bg as any;
  container.visibility = visible ? 'visible' : 'collapse';

  // --- Icon ---
  const iconLabel = new Label();
  iconLabel.text = resolvedIcon;
  iconLabel.className = 'clef-alert-icon';
  iconLabel.fontSize = 18;
  iconLabel.fontWeight = 'bold';
  iconLabel.color = new Color(fg);
  iconLabel.verticalAlignment = 'middle';
  iconLabel.marginRight = 10;
  GridLayout.setColumn(iconLabel, 0);
  container.addChild(iconLabel);

  // --- Text content ---
  const textStack = new StackLayout();
  textStack.className = 'clef-alert-content';
  textStack.verticalAlignment = 'middle';

  if (title) {
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.className = 'clef-alert-title';
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = 14;
    titleLabel.color = new Color(fg);
    titleLabel.textWrap = true;
    titleLabel.marginBottom = 2;
    textStack.addChild(titleLabel);
  }

  const messageLabel = new Label();
  messageLabel.text = message;
  messageLabel.className = 'clef-alert-message';
  messageLabel.fontSize = 13;
  messageLabel.color = new Color(fg);
  messageLabel.textWrap = true;
  textStack.addChild(messageLabel);

  GridLayout.setColumn(textStack, 1);
  container.addChild(textStack);

  // --- Dismiss button ---
  if (dismissible) {
    const dismissBtn = new Button();
    dismissBtn.text = '\u2715';
    dismissBtn.className = 'clef-alert-dismiss';
    dismissBtn.fontSize = 16;
    dismissBtn.color = new Color(fg);
    dismissBtn.backgroundColor = 'transparent' as any;
    dismissBtn.borderWidth = 0;
    dismissBtn.verticalAlignment = 'middle';
    dismissBtn.padding = '0 4';
    dismissBtn.on('tap', () => {
      container.visibility = 'collapse';
      if (onDismiss) onDismiss();
    });
    GridLayout.setColumn(dismissBtn, 2);
    container.addChild(dismissBtn);
  }

  return container;
}

createAlert.displayName = 'Alert';
export default createAlert;
