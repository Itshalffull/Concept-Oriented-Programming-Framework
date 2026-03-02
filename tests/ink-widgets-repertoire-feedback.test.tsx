// ============================================================
// Clef Surface Ink Widget Rendering Tests — Feedback Category
//
// Validates terminal rendering output for all 10 feedback Ink
// widgets: Alert, AlertDialog, ContextMenu, Dialog, Drawer,
// HoverCard, Popover, Toast, ToastManager, Tooltip.
//
// Uses ink-testing-library to capture rendered frames and
// asserts on visible text content.
// ============================================================

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';

import { Alert } from '../surface/widgets/ink/components/widgets/feedback/Alert.js';
import { AlertDialog } from '../surface/widgets/ink/components/widgets/feedback/AlertDialog.js';
import { ContextMenu } from '../surface/widgets/ink/components/widgets/feedback/ContextMenu.js';
import type { ContextMenuItem } from '../surface/widgets/ink/components/widgets/feedback/ContextMenu.js';
import { Dialog } from '../surface/widgets/ink/components/widgets/feedback/Dialog.js';
import { Drawer } from '../surface/widgets/ink/components/widgets/feedback/Drawer.js';
import { HoverCard } from '../surface/widgets/ink/components/widgets/feedback/HoverCard.js';
import { Popover } from '../surface/widgets/ink/components/widgets/feedback/Popover.js';
import { Toast } from '../surface/widgets/ink/components/widgets/feedback/Toast.js';
import { ToastManager } from '../surface/widgets/ink/components/widgets/feedback/ToastManager.js';
import type { ToastItem } from '../surface/widgets/ink/components/widgets/feedback/ToastManager.js';
import { Tooltip } from '../surface/widgets/ink/components/widgets/feedback/Tooltip.js';

/* ===========================================================================
 * Alert
 * ========================================================================= */

describe('Alert — Ink Rendering', () => {
  it('renders with default info variant and title', () => {
    const output = render(<Alert title="Heads up" />).lastFrame();
    expect(output).toContain('Heads up');
    // Info variant icon (i)
    expect(output).toContain('\u2139');
  });

  it('renders description text below title', () => {
    const output = render(
      <Alert title="Warning" description="Check your input" variant="warning" />,
    ).lastFrame();
    expect(output).toContain('Warning');
    expect(output).toContain('Check your input');
    // Warning icon
    expect(output).toContain('\u26A0');
  });

  it('shows dismiss hint when closable', () => {
    const output = render(
      <Alert title="Closable alert" closable />,
    ).lastFrame();
    expect(output).toContain('[Esc to dismiss]');
  });

  it('does not show dismiss hint when not closable', () => {
    const output = render(
      <Alert title="Persistent alert" />,
    ).lastFrame();
    expect(output).not.toContain('[Esc to dismiss]');
  });

  it('renders error variant with error icon', () => {
    const output = render(
      <Alert title="Failed" variant="error" />,
    ).lastFrame();
    // Error icon (cross mark)
    expect(output).toContain('\u2716');
    expect(output).toContain('Failed');
  });

  it('renders success variant with check icon', () => {
    const output = render(
      <Alert title="Done" variant="success" />,
    ).lastFrame();
    // Success icon (check mark)
    expect(output).toContain('\u2714');
    expect(output).toContain('Done');
  });

  it('renders children content', () => {
    const output = render(
      <Alert title="Info">
        <Text>Extra details here</Text>
      </Alert>,
    ).lastFrame();
    expect(output).toContain('Extra details here');
  });
});

/* ===========================================================================
 * AlertDialog
 * ========================================================================= */

describe('AlertDialog — Ink Rendering', () => {
  it('renders nothing when closed', () => {
    const output = render(
      <AlertDialog open={false} title="Confirm delete" />,
    ).lastFrame();
    expect(output).toBe('');
  });

  it('renders title and default button labels when open', () => {
    const output = render(
      <AlertDialog open title="Delete item?" />,
    ).lastFrame();
    expect(output).toContain('Delete item?');
    expect(output).toContain('Cancel');
    expect(output).toContain('Confirm');
  });

  it('renders custom button labels', () => {
    const output = render(
      <AlertDialog
        open
        title="Remove account?"
        cancelLabel="Keep"
        confirmLabel="Remove"
      />,
    ).lastFrame();
    expect(output).toContain('Keep');
    expect(output).toContain('Remove');
  });

  it('renders description text when provided', () => {
    const output = render(
      <AlertDialog
        open
        title="Dangerous action"
        description="This cannot be undone."
      />,
    ).lastFrame();
    expect(output).toContain('Dangerous action');
    expect(output).toContain('This cannot be undone.');
  });

  it('shows keyboard hint when open', () => {
    const output = render(
      <AlertDialog open title="Confirm" />,
    ).lastFrame();
    expect(output).toContain('Tab: switch focus');
    expect(output).toContain('Enter: activate');
  });

  it('renders warning icon in title', () => {
    const output = render(
      <AlertDialog open title="Warning" />,
    ).lastFrame();
    // Warning triangle icon
    expect(output).toContain('\u26A0');
  });
});

/* ===========================================================================
 * ContextMenu
 * ========================================================================= */

describe('ContextMenu — Ink Rendering', () => {
  const sampleItems: ContextMenuItem[] = [
    { label: 'Copy' },
    { label: 'Paste' },
    { label: 'Delete', danger: true },
  ];

  it('renders nothing when closed', () => {
    const output = render(
      <ContextMenu open={false} items={sampleItems} />,
    ).lastFrame();
    expect(output).toBe('');
  });

  it('renders all item labels when open', () => {
    const output = render(
      <ContextMenu open items={sampleItems} />,
    ).lastFrame();
    expect(output).toContain('Copy');
    expect(output).toContain('Paste');
    expect(output).toContain('Delete');
  });

  it('renders shortcut hints when provided', () => {
    const items: ContextMenuItem[] = [
      { label: 'Undo', shortcut: 'Ctrl+Z' },
      { label: 'Redo', shortcut: 'Ctrl+Y' },
    ];
    const output = render(
      <ContextMenu open items={items} />,
    ).lastFrame();
    expect(output).toContain('Ctrl+Z');
    expect(output).toContain('Ctrl+Y');
  });

  it('renders nothing when open but items are empty', () => {
    const output = render(
      <ContextMenu open items={[]} />,
    ).lastFrame();
    expect(output).toBe('');
  });

  it('renders highlight indicator on first item by default', () => {
    const output = render(
      <ContextMenu open items={sampleItems} />,
    ).lastFrame();
    // The highlighted item gets the arrow pointer
    expect(output).toContain('\u276F');
  });
});

/* ===========================================================================
 * Dialog
 * ========================================================================= */

describe('Dialog — Ink Rendering', () => {
  it('renders nothing when closed', () => {
    const output = render(
      <Dialog open={false} title="Settings" />,
    ).lastFrame();
    expect(output).toBe('');
  });

  it('renders title and close indicator when open', () => {
    const output = render(
      <Dialog open title="Settings" />,
    ).lastFrame();
    expect(output).toContain('Settings');
    // Close indicator [X]
    expect(output).toContain('\u2715');
  });

  it('renders description text', () => {
    const output = render(
      <Dialog open title="Edit" description="Modify your preferences below." />,
    ).lastFrame();
    expect(output).toContain('Edit');
    expect(output).toContain('Modify your preferences below.');
  });

  it('renders children content inside dialog body', () => {
    const output = render(
      <Dialog open title="Form">
        <Text>Name: John</Text>
      </Dialog>,
    ).lastFrame();
    expect(output).toContain('Name: John');
  });

  it('shows escape hint when closeOnEscape is true (default)', () => {
    const output = render(
      <Dialog open title="Modal" />,
    ).lastFrame();
    expect(output).toContain('Esc: close');
  });

  it('hides close indicator and escape hint when closeOnEscape is false', () => {
    const output = render(
      <Dialog open title="Locked" closeOnEscape={false} />,
    ).lastFrame();
    expect(output).not.toContain('\u2715');
    expect(output).not.toContain('Esc: close');
  });
});

/* ===========================================================================
 * Drawer
 * ========================================================================= */

describe('Drawer — Ink Rendering', () => {
  it('renders nothing when closed', () => {
    const output = render(
      <Drawer open={false} title="Menu" />,
    ).lastFrame();
    expect(output).toBe('');
  });

  it('renders title and position indicator when open with default right position', () => {
    const output = render(
      <Drawer open title="Details" />,
    ).lastFrame();
    expect(output).toContain('Details');
    // Right position indicator
    expect(output).toContain('RIGHT');
    expect(output).toContain('\u25B6');
  });

  it('renders left position indicator', () => {
    const output = render(
      <Drawer open title="Navigation" position="left" />,
    ).lastFrame();
    expect(output).toContain('Navigation');
    expect(output).toContain('LEFT');
    expect(output).toContain('\u25C0');
  });

  it('shows escape close hint', () => {
    const output = render(
      <Drawer open title="Sidebar" />,
    ).lastFrame();
    expect(output).toContain('[Esc]');
    expect(output).toContain('Esc: close drawer');
  });

  it('renders children content in body', () => {
    const output = render(
      <Drawer open title="Panel">
        <Text>Drawer body content</Text>
      </Drawer>,
    ).lastFrame();
    expect(output).toContain('Drawer body content');
  });

  it('renders top position indicator', () => {
    const output = render(
      <Drawer open title="Top sheet" position="top" />,
    ).lastFrame();
    expect(output).toContain('TOP');
    expect(output).toContain('\u25B2');
  });

  it('renders bottom position indicator', () => {
    const output = render(
      <Drawer open title="Bottom sheet" position="bottom" />,
    ).lastFrame();
    expect(output).toContain('BOTTOM');
    expect(output).toContain('\u25BC');
  });
});

/* ===========================================================================
 * HoverCard
 * ========================================================================= */

describe('HoverCard — Ink Rendering', () => {
  it('renders trigger children when closed', () => {
    const output = render(
      <HoverCard open={false} content="Preview info">
        <Text>Hover me</Text>
      </HoverCard>,
    ).lastFrame();
    expect(output).toContain('Hover me');
    expect(output).not.toContain('Preview info');
  });

  it('renders card content when open', () => {
    const output = render(
      <HoverCard open content="User profile details">
        <Text>@username</Text>
      </HoverCard>,
    ).lastFrame();
    expect(output).toContain('@username');
    expect(output).toContain('User profile details');
  });

  it('renders arrow pointer when open', () => {
    const output = render(
      <HoverCard open content="Card content">
        <Text>Trigger</Text>
      </HoverCard>,
    ).lastFrame();
    // Down-pointing triangle
    expect(output).toContain('\u25BC');
  });

  it('renders ReactNode content when provided', () => {
    const output = render(
      <HoverCard open content={<Text>Rich content</Text>}>
        <Text>Trigger text</Text>
      </HoverCard>,
    ).lastFrame();
    expect(output).toContain('Rich content');
    expect(output).toContain('Trigger text');
  });
});

/* ===========================================================================
 * Popover
 * ========================================================================= */

describe('Popover — Ink Rendering', () => {
  it('renders trigger children when closed', () => {
    const output = render(
      <Popover open={false} content="Hidden content">
        <Text>Click me</Text>
      </Popover>,
    ).lastFrame();
    expect(output).toContain('Click me');
    expect(output).not.toContain('Hidden content');
  });

  it('renders popover surface with content when open', () => {
    const output = render(
      <Popover open content="Popover body" title="Options">
        <Text>Trigger</Text>
      </Popover>,
    ).lastFrame();
    expect(output).toContain('Trigger');
    expect(output).toContain('Options');
    expect(output).toContain('Popover body');
  });

  it('renders arrow pointer when open', () => {
    const output = render(
      <Popover open content="Content">
        <Text>Trigger</Text>
      </Popover>,
    ).lastFrame();
    expect(output).toContain('\u25BC');
  });

  it('renders escape hint in title bar when title is provided', () => {
    const output = render(
      <Popover open title="Settings" content="Content here">
        <Text>Open settings</Text>
      </Popover>,
    ).lastFrame();
    expect(output).toContain('[Esc]');
  });

  it('renders without title bar when no title', () => {
    const output = render(
      <Popover open content="Standalone content">
        <Text>Trigger</Text>
      </Popover>,
    ).lastFrame();
    expect(output).toContain('Standalone content');
    expect(output).not.toContain('[Esc]');
  });
});

/* ===========================================================================
 * Toast
 * ========================================================================= */

describe('Toast — Ink Rendering', () => {
  it('renders compact single-line toast with title only', () => {
    const output = render(
      <Toast title="File saved" duration={0} />,
    ).lastFrame();
    expect(output).toContain('File saved');
    // Default info icon
    expect(output).toContain('\u2139');
  });

  it('renders multi-line bordered toast with description', () => {
    const output = render(
      <Toast title="Error" description="Connection timed out" variant="error" duration={0} />,
    ).lastFrame();
    expect(output).toContain('Error');
    expect(output).toContain('Connection timed out');
    // Error icon
    expect(output).toContain('\u2716');
  });

  it('renders success variant with check icon', () => {
    const output = render(
      <Toast title="Uploaded" variant="success" duration={0} />,
    ).lastFrame();
    expect(output).toContain('Uploaded');
    expect(output).toContain('\u2714');
  });

  it('renders warning variant with warning icon', () => {
    const output = render(
      <Toast title="Low disk space" variant="warning" duration={0} />,
    ).lastFrame();
    expect(output).toContain('Low disk space');
    expect(output).toContain('\u26A0');
  });

  it('renders action label when action prop is provided (compact mode)', () => {
    const output = render(
      <Toast
        title="Item deleted"
        action={{ label: 'Undo', onAction: () => {} }}
        duration={0}
      />,
    ).lastFrame();
    expect(output).toContain('[Undo]');
  });

  it('renders action label in bordered mode with description', () => {
    const output = render(
      <Toast
        title="Deleted"
        description="3 files removed"
        action={{ label: 'Restore', onAction: () => {} }}
        duration={0}
      />,
    ).lastFrame();
    expect(output).toContain('[Restore]');
    expect(output).toContain('3 files removed');
  });
});

/* ===========================================================================
 * ToastManager
 * ========================================================================= */

describe('ToastManager — Ink Rendering', () => {
  it('renders nothing when toasts array is empty', () => {
    const output = render(
      <ToastManager toasts={[]} />,
    ).lastFrame();
    expect(output).toBe('');
  });

  it('renders position label and all toast titles', () => {
    const toasts: ToastItem[] = [
      { id: '1', title: 'First toast', variant: 'info' },
      { id: '2', title: 'Second toast', variant: 'success' },
    ];
    const output = render(
      <ToastManager toasts={toasts} position="top-right" />,
    ).lastFrame();
    expect(output).toContain('Notifications (top-right)');
    expect(output).toContain('First toast');
    expect(output).toContain('Second toast');
  });

  it('respects maxVisible and shows overflow count', () => {
    const toasts: ToastItem[] = [
      { id: '1', title: 'Toast A' },
      { id: '2', title: 'Toast B' },
      { id: '3', title: 'Toast C' },
    ];
    const output = render(
      <ToastManager toasts={toasts} maxVisible={2} />,
    ).lastFrame();
    expect(output).toContain('Toast A');
    expect(output).toContain('Toast B');
    expect(output).not.toContain('Toast C');
    expect(output).toContain('+1 more notification(s)');
  });

  it('renders variant icons for each toast', () => {
    const toasts: ToastItem[] = [
      { id: '1', title: 'Info msg', variant: 'info' },
      { id: '2', title: 'Error msg', variant: 'error' },
    ];
    const output = render(
      <ToastManager toasts={toasts} />,
    ).lastFrame();
    // Info icon
    expect(output).toContain('\u2139');
    // Error icon
    expect(output).toContain('\u2716');
  });

  it('renders toast descriptions when provided', () => {
    const toasts: ToastItem[] = [
      { id: '1', title: 'Build failed', description: 'Check logs for details', variant: 'error' },
    ];
    const output = render(
      <ToastManager toasts={toasts} />,
    ).lastFrame();
    expect(output).toContain('Build failed');
    expect(output).toContain('Check logs for details');
  });

  it('uses default bottom-right position label', () => {
    const toasts: ToastItem[] = [
      { id: '1', title: 'Notification' },
    ];
    const output = render(
      <ToastManager toasts={toasts} />,
    ).lastFrame();
    expect(output).toContain('Notifications (bottom-right)');
  });
});

/* ===========================================================================
 * Tooltip
 * ========================================================================= */

describe('Tooltip — Ink Rendering', () => {
  it('renders only trigger children when not visible', () => {
    const output = render(
      <Tooltip content="Helpful tip" visible={false}>
        <Text>Hover target</Text>
      </Tooltip>,
    ).lastFrame();
    expect(output).toContain('Hover target');
    expect(output).not.toContain('Helpful tip');
  });

  it('renders tooltip content above children with default top placement', () => {
    const output = render(
      <Tooltip content="Save your work" visible>
        <Text>Save button</Text>
      </Tooltip>,
    ).lastFrame();
    expect(output).toContain('Save your work');
    expect(output).toContain('Save button');
    // Down-pointing arrow for top placement
    expect(output).toContain('\u25BC');
  });

  it('renders tooltip content below children with bottom placement', () => {
    const output = render(
      <Tooltip content="More options" visible placement="bottom">
        <Text>Menu icon</Text>
      </Tooltip>,
    ).lastFrame();
    expect(output).toContain('More options');
    expect(output).toContain('Menu icon');
    // Up-pointing arrow for bottom placement
    expect(output).toContain('\u25B2');
  });

  it('always renders trigger children regardless of visibility', () => {
    const hidden = render(
      <Tooltip content="Tip" visible={false}>
        <Text>Always present</Text>
      </Tooltip>,
    ).lastFrame();
    const shown = render(
      <Tooltip content="Tip" visible>
        <Text>Always present</Text>
      </Tooltip>,
    ).lastFrame();
    expect(hidden).toContain('Always present');
    expect(shown).toContain('Always present');
  });
});
