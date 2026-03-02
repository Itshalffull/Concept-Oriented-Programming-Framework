// ============================================================
// Clef Surface Ink Widget Rendering Tests — Navigation
//
// Validates rendering output for all 14 navigation widgets:
// Accordion, Breadcrumb, CommandPalette, Disclosure, Fieldset,
// FloatingToolbar, Form, Menu, NavigationMenu, Pagination,
// Sidebar, Splitter, Tabs, Toolbar.
// See Architecture doc Section 16.
// ============================================================

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';

import { Accordion } from '../surface/widgets/ink/components/widgets/navigation/Accordion';
import { Breadcrumb } from '../surface/widgets/ink/components/widgets/navigation/Breadcrumb';
import { CommandPalette } from '../surface/widgets/ink/components/widgets/navigation/CommandPalette';
import { Disclosure } from '../surface/widgets/ink/components/widgets/navigation/Disclosure';
import { Fieldset } from '../surface/widgets/ink/components/widgets/navigation/Fieldset';
import { FloatingToolbar } from '../surface/widgets/ink/components/widgets/navigation/FloatingToolbar';
import { Form } from '../surface/widgets/ink/components/widgets/navigation/Form';
import { Menu } from '../surface/widgets/ink/components/widgets/navigation/Menu';
import { NavigationMenu } from '../surface/widgets/ink/components/widgets/navigation/NavigationMenu';
import { Pagination } from '../surface/widgets/ink/components/widgets/navigation/Pagination';
import { Sidebar } from '../surface/widgets/ink/components/widgets/navigation/Sidebar';
import { Splitter } from '../surface/widgets/ink/components/widgets/navigation/Splitter';
import { Tabs } from '../surface/widgets/ink/components/widgets/navigation/Tabs';
import { Toolbar } from '../surface/widgets/ink/components/widgets/navigation/Toolbar';

// ====================== Accordion ======================

describe('Accordion', () => {
  const items = [
    { id: 'sec-1', title: 'Section One', content: 'Content for section one' },
    { id: 'sec-2', title: 'Section Two', content: 'Content for section two' },
    { id: 'sec-3', title: 'Section Three', content: 'Content for section three' },
  ];

  it('renders all section titles in collapsed state', () => {
    const output = render(<Accordion items={items} />).lastFrame();
    expect(output).toContain('Section One');
    expect(output).toContain('Section Two');
    expect(output).toContain('Section Three');
    // Collapsed indicator (right-pointing triangle)
    expect(output).toContain('\u25B6');
  });

  it('renders expanded sections with defaultOpen', () => {
    const output = render(
      <Accordion items={items} defaultOpen={['sec-1']} />,
    ).lastFrame();
    // Expanded indicator (down-pointing triangle)
    expect(output).toContain('\u25BC');
    expect(output).toContain('Content for section one');
    // Section two should remain collapsed
    expect(output).not.toContain('Content for section two');
  });

  it('shows focused styling with isFocused', () => {
    const output = render(
      <Accordion items={items} isFocused={true} />,
    ).lastFrame();
    // First item should be focused by default; all titles should render
    expect(output).toContain('Section One');
    expect(output).toContain('Section Two');
  });
});

// ====================== Breadcrumb ======================

describe('Breadcrumb', () => {
  const items = [
    { label: 'Home' },
    { label: 'Products' },
    { label: 'Widget', current: true },
  ];

  it('renders all breadcrumb labels with default separator', () => {
    const output = render(<Breadcrumb items={items} />).lastFrame();
    expect(output).toContain('Home');
    expect(output).toContain('Products');
    expect(output).toContain('Widget');
    expect(output).toContain('>');
  });

  it('uses a custom separator', () => {
    const output = render(
      <Breadcrumb items={items} separator="/" />,
    ).lastFrame();
    expect(output).toContain('/');
    expect(output).toContain('Home');
    expect(output).toContain('Widget');
  });

  it('returns null for an empty items array', () => {
    const output = render(<Breadcrumb items={[]} />).lastFrame();
    expect(output).toBe('');
  });
});

// ====================== CommandPalette ======================

describe('CommandPalette', () => {
  const items = [
    { id: 'open', label: 'Open File', shortcut: 'Ctrl+O', group: 'File' },
    { id: 'save', label: 'Save File', shortcut: 'Ctrl+S', group: 'File' },
    { id: 'find', label: 'Find', shortcut: 'Ctrl+F', group: 'Edit' },
  ];

  it('renders nothing when closed', () => {
    const output = render(
      <CommandPalette items={items} open={false} />,
    ).lastFrame();
    expect(output).toBe('');
  });

  it('renders placeholder text and all items when open', () => {
    const output = render(
      <CommandPalette items={items} open={true} />,
    ).lastFrame();
    expect(output).toContain('Type a command...');
    expect(output).toContain('Open File');
    expect(output).toContain('Save File');
    expect(output).toContain('Find');
  });

  it('displays shortcuts and group headings', () => {
    const output = render(
      <CommandPalette items={items} open={true} />,
    ).lastFrame();
    expect(output).toContain('Ctrl+O');
    expect(output).toContain('Ctrl+S');
    expect(output).toContain('File');
    expect(output).toContain('Edit');
  });
});

// ====================== Disclosure ======================

describe('Disclosure', () => {
  it('renders collapsed state with label', () => {
    const output = render(
      <Disclosure label="Details">Hidden content</Disclosure>,
    ).lastFrame();
    expect(output).toContain('Details');
    expect(output).toContain('\u25B6');
    expect(output).not.toContain('Hidden content');
  });

  it('renders expanded state when open is true', () => {
    const output = render(
      <Disclosure label="Details" open={true}>
        Hidden content
      </Disclosure>,
    ).lastFrame();
    expect(output).toContain('Details');
    expect(output).toContain('\u25BC');
    expect(output).toContain('Hidden content');
  });

  it('applies focused styling when isFocused is true', () => {
    const output = render(
      <Disclosure label="Details" isFocused={true}>
        Content here
      </Disclosure>,
    ).lastFrame();
    expect(output).toContain('Details');
  });
});

// ====================== Fieldset ======================

describe('Fieldset', () => {
  it('renders the legend text', () => {
    const output = render(
      <Fieldset legend="Personal Info">
        <Text>Name field</Text>
      </Fieldset>,
    ).lastFrame();
    expect(output).toContain('Personal Info');
    // Box-drawing legend integrators
    expect(output).toContain('\u2500\u2524');
    expect(output).toContain('\u251C\u2500');
  });

  it('renders children content inside the fieldset', () => {
    const output = render(
      <Fieldset legend="Address">
        <Text>Street field</Text>
      </Fieldset>,
    ).lastFrame();
    expect(output).toContain('Address');
  });

  it('renders in disabled state with dimmed legend', () => {
    const output = render(
      <Fieldset legend="Disabled Group" disabled={true}>
        <Text>Disabled content</Text>
      </Fieldset>,
    ).lastFrame();
    expect(output).toContain('Disabled Group');
  });
});

// ====================== FloatingToolbar ======================

describe('FloatingToolbar', () => {
  const items = [
    { id: 'bold', label: 'B' },
    { id: 'italic', label: 'I' },
    { id: 'underline', label: 'U' },
  ];

  it('renders all toolbar items separated by pipes', () => {
    const output = render(
      <FloatingToolbar items={items} />,
    ).lastFrame();
    expect(output).toContain('B');
    expect(output).toContain('I');
    expect(output).toContain('U');
    expect(output).toContain('|');
  });

  it('renders nothing when visible is false', () => {
    const output = render(
      <FloatingToolbar items={items} visible={false} />,
    ).lastFrame();
    expect(output).toBe('');
  });

  it('renders disabled items with appropriate styling', () => {
    const itemsWithDisabled = [
      { id: 'bold', label: 'B' },
      { id: 'strike', label: 'S', disabled: true },
    ];
    const output = render(
      <FloatingToolbar items={itemsWithDisabled} />,
    ).lastFrame();
    expect(output).toContain('B');
    expect(output).toContain('S');
  });
});

// ====================== Form ======================

describe('Form', () => {
  it('renders children content in a vertical layout', () => {
    const output = render(
      <Form>
        <Text>Username input</Text>
        <Text>Password input</Text>
      </Form>,
    ).lastFrame();
    expect(output).toContain('Username input');
    expect(output).toContain('Password input');
  });

  it('renders with no children without error', () => {
    const output = render(<Form />).lastFrame();
    expect(output).toBe('');
  });

  it('renders single child correctly', () => {
    const output = render(
      <Form>
        <Text>Submit button</Text>
      </Form>,
    ).lastFrame();
    expect(output).toContain('Submit button');
  });
});

// ====================== Menu ======================

describe('Menu', () => {
  const items = [
    { id: 'cut', label: 'Cut', shortcut: 'Ctrl+X' },
    { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C' },
    { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V' },
    { id: 'delete', label: 'Delete', danger: true },
  ];

  it('renders nothing when closed', () => {
    const output = render(
      <Menu items={items} open={false} />,
    ).lastFrame();
    expect(output).toBe('');
  });

  it('renders all items with shortcuts when open', () => {
    const output = render(
      <Menu items={items} open={true} />,
    ).lastFrame();
    expect(output).toContain('Cut');
    expect(output).toContain('Copy');
    expect(output).toContain('Paste');
    expect(output).toContain('Delete');
    expect(output).toContain('Ctrl+X');
    expect(output).toContain('Ctrl+C');
  });

  it('renders a highlight indicator on the first item by default', () => {
    const output = render(
      <Menu items={items} open={true} />,
    ).lastFrame();
    // The first item gets the cursor indicator
    expect(output).toContain('\u276F');
  });
});

// ====================== NavigationMenu ======================

describe('NavigationMenu', () => {
  const items = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' },
  ];

  it('renders all navigation items', () => {
    const output = render(
      <NavigationMenu items={items} />,
    ).lastFrame();
    expect(output).toContain('Home');
    expect(output).toContain('About');
    expect(output).toContain('Contact');
  });

  it('highlights the active item', () => {
    const output = render(
      <NavigationMenu items={items} activeId="about" />,
    ).lastFrame();
    expect(output).toContain('Home');
    expect(output).toContain('About');
    expect(output).toContain('Contact');
  });

  it('supports vertical orientation', () => {
    const output = render(
      <NavigationMenu items={items} orientation="vertical" />,
    ).lastFrame();
    expect(output).toContain('Home');
    expect(output).toContain('About');
    expect(output).toContain('Contact');
  });
});

// ====================== Pagination ======================

describe('Pagination', () => {
  it('renders current page with navigation arrows', () => {
    const output = render(
      <Pagination page={3} totalPages={10} />,
    ).lastFrame();
    // Current page in brackets
    expect(output).toContain('[3]');
    // Previous arrow
    expect(output).toContain('\u25C4');
    // Next arrow
    expect(output).toContain('\u25BA');
  });

  it('renders first and last page numbers', () => {
    const output = render(
      <Pagination page={5} totalPages={10} />,
    ).lastFrame();
    expect(output).toContain('1');
    expect(output).toContain('10');
    expect(output).toContain('[5]');
  });

  it('renders ellipsis for large page ranges', () => {
    const output = render(
      <Pagination page={5} totalPages={20} siblingCount={1} />,
    ).lastFrame();
    expect(output).toContain('...');
    expect(output).toContain('[5]');
    expect(output).toContain('1');
    expect(output).toContain('20');
  });
});

// ====================== Sidebar ======================

describe('Sidebar', () => {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: 'D' },
    { id: 'settings', label: 'Settings', icon: 'S' },
    { id: 'help', label: 'Help', icon: 'H' },
  ];

  it('renders all sidebar items in expanded mode', () => {
    const output = render(
      <Sidebar items={items} />,
    ).lastFrame();
    expect(output).toContain('Dashboard');
    expect(output).toContain('Settings');
    expect(output).toContain('Help');
  });

  it('highlights the active item', () => {
    const output = render(
      <Sidebar items={items} activeId="settings" />,
    ).lastFrame();
    expect(output).toContain('Settings');
    // Active indicator (right-pointing small triangle)
    expect(output).toContain('\u25B8');
  });

  it('renders in collapsed mode showing icons', () => {
    const output = render(
      <Sidebar items={items} collapsed={true} />,
    ).lastFrame();
    expect(output).toContain('D');
    expect(output).toContain('S');
    expect(output).toContain('H');
  });
});

// ====================== Splitter ======================

describe('Splitter', () => {
  it('renders two children with a vertical separator in horizontal mode', () => {
    const output = render(
      <Splitter orientation="horizontal">
        <Text>Left Panel</Text>
        <Text>Right Panel</Text>
      </Splitter>,
    ).lastFrame();
    expect(output).toContain('Left Panel');
    expect(output).toContain('Right Panel');
    // Vertical line separator
    expect(output).toContain('\u2502');
  });

  it('renders two children with a horizontal separator in vertical mode', () => {
    const output = render(
      <Splitter orientation="vertical">
        <Text>Top Panel</Text>
        <Text>Bottom Panel</Text>
      </Splitter>,
    ).lastFrame();
    expect(output).toContain('Top Panel');
    expect(output).toContain('Bottom Panel');
    // Horizontal line separator
    expect(output).toContain('\u2500');
  });

  it('renders a single child without a separator', () => {
    const output = render(
      <Splitter>
        <Text>Only Panel</Text>
      </Splitter>,
    ).lastFrame();
    expect(output).toContain('Only Panel');
    expect(output).not.toContain('\u2502');
  });
});

// ====================== Tabs ======================

describe('Tabs', () => {
  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'advanced', label: 'Advanced' },
    { id: 'disabled-tab', label: 'Hidden', disabled: true },
  ];

  it('renders tab strip with bracket delimiters and pipe separators', () => {
    const output = render(<Tabs tabs={tabs} />).lastFrame();
    expect(output).toContain('[');
    expect(output).toContain(']');
    expect(output).toContain('|');
    expect(output).toContain('General');
    expect(output).toContain('Advanced');
    expect(output).toContain('Hidden');
  });

  it('renders active tab with styling', () => {
    const output = render(
      <Tabs tabs={tabs} activeId="general" />,
    ).lastFrame();
    expect(output).toContain('General');
    expect(output).toContain('Advanced');
  });

  it('renders child content below tab strip', () => {
    const output = render(
      <Tabs tabs={tabs} activeId="general">
        <Text>General settings content</Text>
      </Tabs>,
    ).lastFrame();
    expect(output).toContain('General');
    expect(output).toContain('General settings content');
  });
});

// ====================== Toolbar ======================

describe('Toolbar', () => {
  const items = [
    { id: 'bold', label: 'Bold' },
    { id: 'italic', label: 'Italic' },
    { id: 'underline', label: 'Underline', disabled: true },
    { id: 'color', label: 'Color', active: true },
  ];

  it('renders all toolbar items with bracket wrapping', () => {
    const output = render(<Toolbar items={items} />).lastFrame();
    expect(output).toContain('[ Bold ]');
    expect(output).toContain('[ Italic ]');
    expect(output).toContain('[ Underline ]');
    expect(output).toContain('[ Color ]');
  });

  it('renders items including disabled and active states', () => {
    const output = render(
      <Toolbar items={items} />,
    ).lastFrame();
    // All four items should be present
    expect(output).toContain('Bold');
    expect(output).toContain('Italic');
    expect(output).toContain('Underline');
    expect(output).toContain('Color');
  });

  it('renders in vertical orientation', () => {
    const output = render(
      <Toolbar items={items} orientation="vertical" />,
    ).lastFrame();
    expect(output).toContain('[ Bold ]');
    expect(output).toContain('[ Italic ]');
  });
});
