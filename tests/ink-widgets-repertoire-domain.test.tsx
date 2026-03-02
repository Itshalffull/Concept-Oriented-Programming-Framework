// ============================================================
// Clef Surface Ink Widgets — Domain Category Rendering Tests
//
// Validates rendering behavior for all 25 domain-category Ink
// widgets: default render with required props, content display,
// and state variations. Uses ink-testing-library for terminal
// snapshot testing.
// ============================================================

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

import { AutomationBuilder } from '../surface/widgets/ink/components/widgets/domain/AutomationBuilder.js';
import { BlockEditor } from '../surface/widgets/ink/components/widgets/domain/BlockEditor.js';
import { Canvas } from '../surface/widgets/ink/components/widgets/domain/Canvas.js';
import { CanvasConnector } from '../surface/widgets/ink/components/widgets/domain/CanvasConnector.js';
import { CanvasNode } from '../surface/widgets/ink/components/widgets/domain/CanvasNode.js';
import { CodeBlock } from '../surface/widgets/ink/components/widgets/domain/CodeBlock.js';
import { ColorLabelPicker } from '../surface/widgets/ink/components/widgets/domain/ColorLabelPicker.js';
import { ConditionBuilder } from '../surface/widgets/ink/components/widgets/domain/ConditionBuilder.js';
import { CronEditor } from '../surface/widgets/ink/components/widgets/domain/CronEditor.js';
import { DragHandle } from '../surface/widgets/ink/components/widgets/domain/DragHandle.js';
import { FieldMapper } from '../surface/widgets/ink/components/widgets/domain/FieldMapper.js';
import { GraphView } from '../surface/widgets/ink/components/widgets/domain/GraphView.js';
import { ImageGallery } from '../surface/widgets/ink/components/widgets/domain/ImageGallery.js';
import { InlineEdit } from '../surface/widgets/ink/components/widgets/domain/InlineEdit.js';
import { MarkdownPreview } from '../surface/widgets/ink/components/widgets/domain/MarkdownPreview.js';
import { Minimap } from '../surface/widgets/ink/components/widgets/domain/Minimap.js';
import { Outliner } from '../surface/widgets/ink/components/widgets/domain/Outliner.js';
import { PluginDetailPage } from '../surface/widgets/ink/components/widgets/domain/PluginDetailPage.js';
import { PolicyEditor } from '../surface/widgets/ink/components/widgets/domain/PolicyEditor.js';
import { SlashMenu } from '../surface/widgets/ink/components/widgets/domain/SlashMenu.js';
import { StateMachineDiagram } from '../surface/widgets/ink/components/widgets/domain/StateMachineDiagram.js';
import { StepIndicator } from '../surface/widgets/ink/components/widgets/domain/StepIndicator.js';
import { TokenInput } from '../surface/widgets/ink/components/widgets/domain/TokenInput.js';
import { WorkflowEditor } from '../surface/widgets/ink/components/widgets/domain/WorkflowEditor.js';
import { WorkflowNode } from '../surface/widgets/ink/components/widgets/domain/WorkflowNode.js';

// ============================================================
// AutomationBuilder
// ============================================================

describe('AutomationBuilder', () => {
  it('renders with required steps prop', () => {
    const { lastFrame } = render(
      <AutomationBuilder steps={[]} />
    );
    const output = lastFrame();
    expect(output).toContain('[+ Add Step]');
  });

  it('displays step types and numbering', () => {
    const steps = [
      { id: 's1', type: 'Email' },
      { id: 's2', type: 'Webhook', config: { url: 'https://example.com' } },
    ];
    const { lastFrame } = render(
      <AutomationBuilder steps={steps} />
    );
    const output = lastFrame();
    expect(output).toContain('[1] Email');
    expect(output).toContain('(unconfigured)');
    expect(output).toContain('[2] Webhook');
    expect(output).toContain('(configured)');
  });

  it('shows navigation hints when focused', () => {
    const steps = [{ id: 's1', type: 'Delay' }];
    const { lastFrame } = render(
      <AutomationBuilder steps={steps} isFocused={true} />
    );
    const output = lastFrame();
    expect(output).toContain('navigate');
    expect(output).toContain('configure/add');
    expect(output).toContain('remove');
  });
});

// ============================================================
// BlockEditor
// ============================================================

describe('BlockEditor', () => {
  it('renders empty state with placeholder', () => {
    const { lastFrame } = render(
      <BlockEditor blocks={[]} />
    );
    const output = lastFrame();
    expect(output).toContain("Type '/' for commands...");
  });

  it('displays block content with type icons', () => {
    const blocks = [
      { id: 'b1', type: 'heading', content: 'Introduction' },
      { id: 'b2', type: 'paragraph', content: 'Hello world' },
      { id: 'b3', type: 'code', content: 'const x = 1' },
    ];
    const { lastFrame } = render(
      <BlockEditor blocks={blocks} />
    );
    const output = lastFrame();
    expect(output).toContain('Introduction');
    expect(output).toContain('Hello world');
    expect(output).toContain('const x = 1');
    expect(output).toContain('H');
    expect(output).toContain('<>');
  });

  it('shows focused block when isFocused is true', () => {
    const blocks = [
      { id: 'b1', type: 'paragraph', content: 'First block' },
      { id: 'b2', type: 'paragraph', content: 'Second block' },
    ];
    const { lastFrame } = render(
      <BlockEditor blocks={blocks} isFocused={true} />
    );
    const output = lastFrame();
    expect(output).toContain('navigate');
    expect(output).toContain('new block');
  });
});

// ============================================================
// Canvas
// ============================================================

describe('Canvas', () => {
  it('renders with default dimensions and zoom', () => {
    const { lastFrame } = render(<Canvas />);
    const output = lastFrame();
    expect(output).toContain('Canvas');
    expect(output).toContain('[60x20]');
    expect(output).toContain('zoom:100%');
    expect(output).toContain('(empty canvas)');
  });

  it('displays custom dimensions and pan offset', () => {
    const { lastFrame } = render(
      <Canvas width={80} height={30} panX={10} panY={-5} zoom={1.5} />
    );
    const output = lastFrame();
    expect(output).toContain('[80x30]');
    expect(output).toContain('zoom:150%');
    expect(output).toContain('pan:(10,-5)');
    expect(output).toContain('origin: (10,-5)');
  });

  it('renders children instead of empty message', () => {
    const { lastFrame } = render(
      <Canvas>
        <React.Fragment>Node A</React.Fragment>
      </Canvas>
    );
    const output = lastFrame();
    expect(output).not.toContain('(empty canvas)');
  });
});

// ============================================================
// CanvasConnector
// ============================================================

describe('CanvasConnector', () => {
  it('renders connector between two node IDs', () => {
    const { lastFrame } = render(
      <CanvasConnector fromId="nodeA" toId="nodeB" />
    );
    const output = lastFrame();
    expect(output).toContain('[nodeA]');
    expect(output).toContain('[nodeB]');
  });

  it('displays optional label on the connection', () => {
    const { lastFrame } = render(
      <CanvasConnector fromId="start" toId="end" label="data-flow" />
    );
    const output = lastFrame();
    expect(output).toContain('(data-flow)');
    expect(output).toContain('[start]');
    expect(output).toContain('[end]');
  });

  it('renders without label when not provided', () => {
    const { lastFrame } = render(
      <CanvasConnector fromId="x" toId="y" type="curved" />
    );
    const output = lastFrame();
    expect(output).toContain('[x]');
    expect(output).toContain('[y]');
    expect(output).not.toContain('(');
  });
});

// ============================================================
// CanvasNode
// ============================================================

describe('CanvasNode', () => {
  it('renders with required id and label', () => {
    const { lastFrame } = render(
      <CanvasNode id="n1" label="Start Node" />
    );
    const output = lastFrame();
    expect(output).toContain('Start Node');
    expect(output).toContain('(0,0)');
  });

  it('displays position and type label', () => {
    const { lastFrame } = render(
      <CanvasNode id="n2" label="Process" position={{ x: 5, y: 10 }} type="action" />
    );
    const output = lastFrame();
    expect(output).toContain('Process');
    expect(output).toContain('[action]');
    expect(output).toContain('(5,10)');
  });

  it('shows selected state indicator', () => {
    const { lastFrame } = render(
      <CanvasNode id="n3" label="Selected Node" selected={true} />
    );
    const output = lastFrame();
    expect(output).toContain('Selected Node');
    expect(output).toContain('[selected]');
  });
});

// ============================================================
// CodeBlock
// ============================================================

describe('CodeBlock', () => {
  it('renders code with language label', () => {
    const { lastFrame } = render(
      <CodeBlock code="const x = 42;" language="typescript" />
    );
    const output = lastFrame();
    expect(output).toContain('typescript');
    expect(output).toContain('const x = 42;');
  });

  it('displays line numbers by default', () => {
    const code = 'line one\nline two\nline three';
    const { lastFrame } = render(
      <CodeBlock code={code} />
    );
    const output = lastFrame();
    expect(output).toContain('1');
    expect(output).toContain('line one');
    expect(output).toContain('line two');
    expect(output).toContain('line three');
  });

  it('shows copy button when copyable is true', () => {
    const { lastFrame } = render(
      <CodeBlock code="hello" copyable={true} />
    );
    const output = lastFrame();
    expect(output).toContain('[Copy]');
  });
});

// ============================================================
// ColorLabelPicker
// ============================================================

describe('ColorLabelPicker', () => {
  it('renders color options', () => {
    const colors = [
      { name: 'Red', hex: '#ff0000' },
      { name: 'Blue', hex: '#0000ff' },
    ];
    const { lastFrame } = render(
      <ColorLabelPicker colors={colors} />
    );
    const output = lastFrame();
    expect(output).toContain('Red');
    expect(output).toContain('Blue');
  });

  it('marks the selected color with a check', () => {
    const colors = [
      { name: 'Green', hex: '#00ff00' },
      { name: 'Yellow', hex: '#ffff00' },
    ];
    const { lastFrame } = render(
      <ColorLabelPicker colors={colors} value="Green" />
    );
    const output = lastFrame();
    expect(output).toContain('Green');
    expect(output).toContain('\u2713');
  });

  it('shows empty message when no colors match', () => {
    const { lastFrame } = render(
      <ColorLabelPicker colors={[]} />
    );
    const output = lastFrame();
    expect(output).toContain('No matching colors.');
  });
});

// ============================================================
// ConditionBuilder
// ============================================================

describe('ConditionBuilder', () => {
  it('renders add button with no conditions', () => {
    const { lastFrame } = render(
      <ConditionBuilder conditions={[]} />
    );
    const output = lastFrame();
    expect(output).toContain('[+ Add Condition]');
  });

  it('displays conditions with IF and field/operator/value', () => {
    const conditions = [
      { field: 'status', operator: '=', value: 'active' },
      { field: 'age', operator: '>', value: '18', conjunction: 'AND' as const },
    ];
    const { lastFrame } = render(
      <ConditionBuilder conditions={conditions} />
    );
    const output = lastFrame();
    expect(output).toContain('IF');
    expect(output).toContain('status');
    expect(output).toContain('active');
    expect(output).toContain('AND');
    expect(output).toContain('age');
  });

  it('shows navigation hints when focused', () => {
    const conditions = [
      { field: 'name', operator: 'contains', value: 'test' },
    ];
    const { lastFrame } = render(
      <ConditionBuilder conditions={conditions} isFocused={true} />
    );
    const output = lastFrame();
    expect(output).toContain('navigate');
    expect(output).toContain('add');
    expect(output).toContain('remove');
  });
});

// ============================================================
// CronEditor
// ============================================================

describe('CronEditor', () => {
  it('renders wildcard cron expression with summary', () => {
    const { lastFrame } = render(
      <CronEditor value="* * * * *" />
    );
    const output = lastFrame();
    expect(output).toContain('Every minute');
    expect(output).toContain('min');
    expect(output).toContain('hour');
    expect(output).toContain('day');
    expect(output).toContain('month');
    expect(output).toContain('weekday');
  });

  it('displays daily schedule summary', () => {
    const { lastFrame } = render(
      <CronEditor value="30 9 * * *" />
    );
    const output = lastFrame();
    expect(output).toContain('Daily at 9:30');
  });

  it('shows keyboard hints when focused', () => {
    const { lastFrame } = render(
      <CronEditor value="* * * * *" isFocused={true} />
    );
    const output = lastFrame();
    expect(output).toContain('switch field');
    expect(output).toContain('adjust value');
    expect(output).toContain('wildcard');
  });
});

// ============================================================
// DragHandle
// ============================================================

describe('DragHandle', () => {
  it('renders vertical drag handle by default', () => {
    const { lastFrame } = render(<DragHandle />);
    const output = lastFrame();
    expect(output).toContain('\u2801\u2802\u2803');
  });

  it('renders horizontal drag handle', () => {
    const { lastFrame } = render(
      <DragHandle orientation="horizontal" />
    );
    const output = lastFrame();
    expect(output).toContain('\u2261');
  });

  it('renders in disabled state', () => {
    const { lastFrame } = render(
      <DragHandle disabled={true} />
    );
    const output = lastFrame();
    // The handle still renders the icon, just with dimColor styling
    expect(output).toBeTruthy();
    expect(output).toContain('\u2801\u2802\u2803');
  });
});

// ============================================================
// FieldMapper
// ============================================================

describe('FieldMapper', () => {
  it('renders source and target headers', () => {
    const { lastFrame } = render(
      <FieldMapper
        sourceFields={['email', 'name']}
        targetFields={['user_email', 'user_name']}
        mappings={[]}
      />
    );
    const output = lastFrame();
    expect(output).toContain('Source');
    expect(output).toContain('Target');
    expect(output).toContain('[+ Map]');
  });

  it('displays mapped field pairs with arrows', () => {
    const { lastFrame } = render(
      <FieldMapper
        sourceFields={['email', 'name']}
        targetFields={['user_email', 'user_name']}
        mappings={[
          { source: 'email', target: 'user_email' },
        ]}
      />
    );
    const output = lastFrame();
    expect(output).toContain('email');
    expect(output).toContain('user_email');
    // The component renders ' → ' using the unicode arrow character
    expect(output).toMatch(/email.*user_email/);
  });

  it('shows unmapped fields', () => {
    const { lastFrame } = render(
      <FieldMapper
        sourceFields={['email', 'name', 'phone']}
        targetFields={['user_email']}
        mappings={[
          { source: 'email', target: 'user_email' },
        ]}
      />
    );
    const output = lastFrame();
    expect(output).toContain('Unmapped');
    expect(output).toContain('name');
    expect(output).toContain('phone');
  });
});

// ============================================================
// GraphView
// ============================================================

describe('GraphView', () => {
  it('renders empty graph message', () => {
    const { lastFrame } = render(
      <GraphView nodes={[]} edges={[]} />
    );
    const output = lastFrame();
    expect(output).toContain('(empty graph)');
    expect(output).toContain('Graph');
    expect(output).toContain('0 nodes');
  });

  it('displays nodes with labels', () => {
    const nodes = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
    ];
    const edges = [{ from: 'a', to: 'b', label: 'connects' }];
    const { lastFrame } = render(
      <GraphView nodes={nodes} edges={edges} />
    );
    const output = lastFrame();
    expect(output).toContain('[Alpha]');
    expect(output).toContain('[Beta]');
    expect(output).toContain('2 nodes');
    expect(output).toContain('1 edges');
  });

  it('shows edge connections from nodes', () => {
    const nodes = [
      { id: 'x', label: 'Source' },
      { id: 'y', label: 'Dest' },
    ];
    const edges = [{ from: 'x', to: 'y' }];
    const { lastFrame } = render(
      <GraphView nodes={nodes} edges={edges} />
    );
    const output = lastFrame();
    expect(output).toContain('[Source]');
    expect(output).toContain('[Dest]');
  });
});

// ============================================================
// ImageGallery
// ============================================================

describe('ImageGallery', () => {
  it('renders images with alt text and counter', () => {
    const images = [
      { src: '/img1.png', alt: 'Sunset' },
      { src: '/img2.png', alt: 'Mountain' },
    ];
    const { lastFrame } = render(
      <ImageGallery images={images} />
    );
    const output = lastFrame();
    expect(output).toContain('Sunset');
    expect(output).toContain('Mountain');
    expect(output).toContain('1 of 2');
  });

  it('displays captions below images', () => {
    const images = [
      { src: '/photo.jpg', alt: 'Beach', caption: 'Summer vacation' },
    ];
    const { lastFrame } = render(
      <ImageGallery images={images} />
    );
    const output = lastFrame();
    expect(output).toContain('Beach');
    expect(output).toContain('Summer vacation');
  });

  it('shows navigation hints when focused', () => {
    const images = [
      { src: '/a.png', alt: 'A' },
      { src: '/b.png', alt: 'B' },
    ];
    const { lastFrame } = render(
      <ImageGallery images={images} isFocused={true} />
    );
    const output = lastFrame();
    expect(output).toContain('navigate');
    expect(output).toContain('select');
  });
});

// ============================================================
// InlineEdit
// ============================================================

describe('InlineEdit', () => {
  it('renders value in display mode', () => {
    const { lastFrame } = render(
      <InlineEdit value="Hello World" />
    );
    const output = lastFrame();
    expect(output).toContain('Hello World');
  });

  it('shows placeholder when value is empty', () => {
    const { lastFrame } = render(
      <InlineEdit value="" placeholder="Enter text..." />
    );
    const output = lastFrame();
    expect(output).toContain('Enter text...');
  });

  it('shows edit hint when focused in display mode', () => {
    const { lastFrame } = render(
      <InlineEdit value="Editable text" isFocused={true} />
    );
    const output = lastFrame();
    expect(output).toContain('Editable text');
    expect(output).toContain('[Enter to edit]');
  });
});

// ============================================================
// MarkdownPreview
// ============================================================

describe('MarkdownPreview', () => {
  it('renders heading with hash prefix', () => {
    const { lastFrame } = render(
      <MarkdownPreview content="# Main Title" />
    );
    const output = lastFrame();
    expect(output).toContain('# Main Title');
  });

  it('renders bullet list items', () => {
    const md = '- First item\n- Second item\n- Third item';
    const { lastFrame } = render(
      <MarkdownPreview content={md} />
    );
    const output = lastFrame();
    expect(output).toContain('First item');
    expect(output).toContain('Second item');
    expect(output).toContain('Third item');
    expect(output).toContain('\u2022');
  });

  it('renders blockquote content', () => {
    const md = '> This is a quoted passage';
    const { lastFrame } = render(
      <MarkdownPreview content={md} />
    );
    const output = lastFrame();
    expect(output).toContain('This is a quoted passage');
    expect(output).toContain('\u2502');
  });
});

// ============================================================
// Minimap
// ============================================================

describe('Minimap', () => {
  it('renders position indicator with line range', () => {
    const content = Array.from({ length: 100 }, (_, i) => `Line ${i + 1} content here`);
    const { lastFrame } = render(
      <Minimap
        content={content}
        visibleRange={{ start: 0, end: 20 }}
        totalLines={100}
      />
    );
    const output = lastFrame();
    expect(output).toContain('1-20/100');
  });

  it('renders density visualization for content', () => {
    const content = [
      'short',
      'a much longer line of content that fills more space',
      '',
      '    indented line',
    ];
    const { lastFrame } = render(
      <Minimap
        content={content}
        visibleRange={{ start: 0, end: 4 }}
        totalLines={4}
        width={5}
        height={4}
      />
    );
    const output = lastFrame();
    expect(output).toContain('1-4/4');
  });

  it('renders with custom dimensions', () => {
    const content = Array.from({ length: 50 }, () => 'some text');
    const { lastFrame } = render(
      <Minimap
        content={content}
        visibleRange={{ start: 10, end: 25 }}
        totalLines={50}
        width={8}
        height={10}
      />
    );
    const output = lastFrame();
    expect(output).toContain('11-25/50');
  });
});

// ============================================================
// Outliner
// ============================================================

describe('Outliner', () => {
  it('renders empty state with placeholder', () => {
    const { lastFrame } = render(
      <Outliner items={[]} />
    );
    const output = lastFrame();
    expect(output).toContain('New item...');
  });

  it('displays nested items with indentation', () => {
    const items = [
      { id: 'i1', text: 'Project Goals', level: 0 },
      { id: 'i2', text: 'Revenue Target', level: 1 },
      { id: 'i3', text: 'User Growth', level: 1 },
      { id: 'i4', text: 'Technical Roadmap', level: 0 },
    ];
    const { lastFrame } = render(
      <Outliner items={items} />
    );
    const output = lastFrame();
    expect(output).toContain('Project Goals');
    expect(output).toContain('Revenue Target');
    expect(output).toContain('User Growth');
    expect(output).toContain('Technical Roadmap');
  });

  it('shows collapse indicator for items with children', () => {
    const items = [
      { id: 'i1', text: 'Parent', level: 0 },
      { id: 'i2', text: 'Child', level: 1 },
    ];
    const { lastFrame } = render(
      <Outliner items={items} />
    );
    const output = lastFrame();
    // Parent has children, so it shows the expand triangle
    expect(output).toContain('\u25BC');
    expect(output).toContain('Parent');
    expect(output).toContain('Child');
  });
});

// ============================================================
// PluginDetailPage
// ============================================================

describe('PluginDetailPage', () => {
  it('renders plugin name, version, and author', () => {
    const { lastFrame } = render(
      <PluginDetailPage
        name="SyntaxHighlighter"
        version="2.1.0"
        author="DevTeam"
        description="Adds syntax highlighting support"
      />
    );
    const output = lastFrame();
    expect(output).toContain('SyntaxHighlighter');
    expect(output).toContain('@2.1.0');
    expect(output).toContain('DevTeam');
    expect(output).toContain('Adds syntax highlighting support');
  });

  it('shows Install button for uninstalled plugin', () => {
    const { lastFrame } = render(
      <PluginDetailPage
        name="TestPlugin"
        version="1.0.0"
        author="Author"
        description="A test plugin"
        installed={false}
      />
    );
    const output = lastFrame();
    expect(output).toContain('Install');
  });

  it('shows Uninstall and Enable/Disable for installed plugin', () => {
    const { lastFrame } = render(
      <PluginDetailPage
        name="ActivePlugin"
        version="3.0.0"
        author="Author"
        description="An active plugin"
        installed={true}
        enabled={true}
      />
    );
    const output = lastFrame();
    expect(output).toContain('Uninstall');
    expect(output).toContain('Disable');
    expect(output).toContain('\u2713 Enabled');
  });
});

// ============================================================
// PolicyEditor
// ============================================================

describe('PolicyEditor', () => {
  it('renders header and add button with no rules', () => {
    const { lastFrame } = render(
      <PolicyEditor rules={[]} />
    );
    const output = lastFrame();
    expect(output).toContain('Policy Rules');
    expect(output).toContain('(0 rules)');
    expect(output).toContain('[+ Add Rule]');
  });

  it('displays ALLOW and DENY rules with fields', () => {
    const rules = [
      { id: 'r1', subject: 'admin', action: 'write', resource: '/data', effect: 'ALLOW' as const },
      { id: 'r2', subject: 'guest', action: 'read', resource: '/public', effect: 'DENY' as const },
    ];
    const { lastFrame } = render(
      <PolicyEditor rules={rules} />
    );
    const output = lastFrame();
    expect(output).toContain('ALLOW');
    expect(output).toContain('admin');
    expect(output).toContain('write');
    expect(output).toContain('/data');
    expect(output).toContain('DENY');
    expect(output).toContain('guest');
  });

  it('shows rule count in header', () => {
    const rules = [
      { id: 'r1', subject: 'user', action: 'read', resource: '*', effect: 'ALLOW' as const },
      { id: 'r2', subject: 'user', action: 'delete', resource: '*', effect: 'DENY' as const },
      { id: 'r3', subject: 'admin', action: '*', resource: '*', effect: 'ALLOW' as const },
    ];
    const { lastFrame } = render(
      <PolicyEditor rules={rules} />
    );
    const output = lastFrame();
    expect(output).toContain('(3 rules)');
  });
});

// ============================================================
// SlashMenu
// ============================================================

describe('SlashMenu', () => {
  it('renders slash prefix and filter placeholder', () => {
    const items = [
      { id: 'heading', label: 'Heading' },
      { id: 'list', label: 'Bullet List' },
    ];
    const { lastFrame } = render(
      <SlashMenu items={items} />
    );
    const output = lastFrame();
    expect(output).toContain('/');
    expect(output).toContain('Filter...');
  });

  it('displays menu items with labels', () => {
    const items = [
      { id: 'h1', label: 'Heading 1', description: 'Large heading' },
      { id: 'quote', label: 'Quote', shortcut: '>' },
    ];
    const { lastFrame } = render(
      <SlashMenu items={items} />
    );
    const output = lastFrame();
    expect(output).toContain('Heading 1');
    expect(output).toContain('Large heading');
    expect(output).toContain('Quote');
    expect(output).toContain('[>]');
  });

  it('shows no-results message when items list is empty', () => {
    const { lastFrame } = render(
      <SlashMenu items={[]} />
    );
    const output = lastFrame();
    expect(output).toContain('No matching commands.');
  });
});

// ============================================================
// StateMachineDiagram
// ============================================================

describe('StateMachineDiagram', () => {
  it('renders states with initial/final markers', () => {
    const states = [
      { name: 'idle', initial: true },
      { name: 'running' },
      { name: 'done', final: true },
    ];
    const { lastFrame } = render(
      <StateMachineDiagram states={states} transitions={[]} />
    );
    const output = lastFrame();
    expect(output).toContain('(idle)');
    expect(output).toContain('(running)');
    expect(output).toContain('(done)');
    expect(output).toContain('\u25B8');
    expect(output).toContain('\u25A0');
  });

  it('displays transitions between states', () => {
    const states = [
      { name: 'off' },
      { name: 'on' },
    ];
    const transitions = [
      { from: 'off', to: 'on', event: 'toggle' },
      { from: 'on', to: 'off', event: 'toggle' },
    ];
    const { lastFrame } = render(
      <StateMachineDiagram states={states} transitions={transitions} />
    );
    const output = lastFrame();
    expect(output).toContain('Transitions:');
    expect(output).toContain('(off)');
    expect(output).toContain('(on)');
    expect(output).toContain('toggle');
  });

  it('highlights the current state', () => {
    const states = [
      { name: 'loading' },
      { name: 'ready' },
    ];
    const { lastFrame } = render(
      <StateMachineDiagram
        states={states}
        transitions={[]}
        currentState="loading"
      />
    );
    const output = lastFrame();
    expect(output).toContain('(loading)');
    // Legend line shows initial/final markers and current state label
    expect(output).toContain('initial');
    expect(output).toContain('final');
    expect(output).toContain('current state');
  });
});

// ============================================================
// StepIndicator
// ============================================================

describe('StepIndicator', () => {
  it('renders steps with status icons', () => {
    const steps = [
      { label: 'Setup', status: 'completed' as const },
      { label: 'Configure', status: 'current' as const },
      { label: 'Deploy', status: 'pending' as const },
    ];
    const { lastFrame } = render(
      <StepIndicator steps={steps} />
    );
    const output = lastFrame();
    expect(output).toContain('Setup');
    expect(output).toContain('Configure');
    expect(output).toContain('Deploy');
    expect(output).toContain('\u2713');
    expect(output).toContain('\u25CF');
  });

  it('derives status from currentStep index', () => {
    const steps = [
      { label: 'Step 1', status: 'pending' as const },
      { label: 'Step 2', status: 'pending' as const },
      { label: 'Step 3', status: 'pending' as const },
    ];
    const { lastFrame } = render(
      <StepIndicator steps={steps} currentStep={1} />
    );
    const output = lastFrame();
    // Step 1 should show completed check, Step 2 should be current
    expect(output).toContain('\u2713');
    expect(output).toContain('\u25CF');
    expect(output).toContain('Step 1');
    expect(output).toContain('Step 2');
    expect(output).toContain('Step 3');
  });

  it('renders in vertical orientation', () => {
    const steps = [
      { label: 'Start', status: 'completed' as const },
      { label: 'Middle', status: 'current' as const },
      { label: 'End', status: 'pending' as const },
    ];
    const { lastFrame } = render(
      <StepIndicator steps={steps} orientation="vertical" />
    );
    const output = lastFrame();
    expect(output).toContain('Start');
    expect(output).toContain('Middle');
    expect(output).toContain('End');
    // Vertical uses pipe connector
    expect(output).toContain('\u2502');
  });
});

// ============================================================
// TokenInput
// ============================================================

describe('TokenInput', () => {
  it('renders tokens as parenthesized pills', () => {
    const { lastFrame } = render(
      <TokenInput tokens={['React', 'TypeScript', 'Node']} />
    );
    const output = lastFrame();
    expect(output).toContain('(React)');
    expect(output).toContain('(TypeScript)');
    expect(output).toContain('(Node)');
  });

  it('renders empty input area with placeholder', () => {
    const { lastFrame } = render(
      <TokenInput tokens={[]} />
    );
    const output = lastFrame();
    expect(output).toContain('[');
    expect(output).toContain('...');
    expect(output).toContain(']');
  });

  it('shows cursor indicator when focused', () => {
    const { lastFrame } = render(
      <TokenInput tokens={['Tag1']} isFocused={true} />
    );
    const output = lastFrame();
    expect(output).toContain('(Tag1)');
    expect(output).toContain('\u2588');
  });
});

// ============================================================
// WorkflowEditor
// ============================================================

describe('WorkflowEditor', () => {
  it('renders empty workflow message', () => {
    const { lastFrame } = render(
      <WorkflowEditor nodes={[]} connections={[]} />
    );
    const output = lastFrame();
    expect(output).toContain('(empty workflow)');
    expect(output).toContain('Workflow');
    expect(output).toContain('0 nodes');
  });

  it('displays workflow nodes with type and label', () => {
    const nodes = [
      { id: 'n1', type: 'trigger', label: 'HTTP Request' },
      { id: 'n2', type: 'transform', label: 'Parse JSON' },
    ];
    const connections = [{ from: 'n1', to: 'n2' }];
    const { lastFrame } = render(
      <WorkflowEditor nodes={nodes} connections={connections} />
    );
    const output = lastFrame();
    expect(output).toContain('[trigger] HTTP Request');
    expect(output).toContain('[transform] Parse JSON');
    expect(output).toContain('2 nodes');
    expect(output).toContain('1 connections');
  });

  it('shows connection lines between nodes', () => {
    const nodes = [
      { id: 'a', type: 'start', label: 'Begin' },
      { id: 'b', type: 'end', label: 'Finish' },
    ];
    const connections = [{ from: 'a', to: 'b' }];
    const { lastFrame } = render(
      <WorkflowEditor nodes={nodes} connections={connections} />
    );
    const output = lastFrame();
    expect(output).toContain('Finish');
    expect(output).toContain('\u2514');
  });
});

// ============================================================
// WorkflowNode
// ============================================================

describe('WorkflowNode', () => {
  it('renders with required id, label, and type', () => {
    const { lastFrame } = render(
      <WorkflowNode id="wn1" label="Send Email" type="action" />
    );
    const output = lastFrame();
    expect(output).toContain('Send Email');
    expect(output).toContain('(action)');
    expect(output).toContain('Status: idle');
  });

  it('displays input and output ports', () => {
    const { lastFrame } = render(
      <WorkflowNode
        id="wn2"
        label="Transform"
        type="processor"
        inputs={['data', 'config']}
        outputs={['result']}
      />
    );
    const output = lastFrame();
    expect(output).toContain('Transform');
    expect(output).toContain('in:');
    expect(output).toContain('data');
    expect(output).toContain('config');
    expect(output).toContain('out:');
    expect(output).toContain('result');
  });

  it('shows different status states', () => {
    const statuses: Array<'idle' | 'running' | 'completed' | 'error'> = [
      'idle', 'running', 'completed', 'error',
    ];

    for (const status of statuses) {
      const { lastFrame } = render(
        <WorkflowNode id={`wn-${status}`} label="Node" type="task" status={status} />
      );
      const output = lastFrame();
      expect(output).toContain(`Status: ${status}`);
    }
  });
});
