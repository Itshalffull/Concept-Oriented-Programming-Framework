// ============================================================
// Clef Surface Ink Widgets — Data Display Rendering Tests
//
// Rendering tests for all 15 data-display Ink widgets using
// ink-testing-library. Each widget is tested for default rendering,
// data display verification, and state variations.
// See widget specs: repertoire/widgets/data-display/*.widget
// ============================================================

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

import { CalendarView } from '../surface/widgets/ink/components/widgets/data-display/CalendarView';
import { Card } from '../surface/widgets/ink/components/widgets/data-display/Card';
import { CardGrid } from '../surface/widgets/ink/components/widgets/data-display/CardGrid';
import { Chart } from '../surface/widgets/ink/components/widgets/data-display/Chart';
import { DataList } from '../surface/widgets/ink/components/widgets/data-display/DataList';
import { DataTable } from '../surface/widgets/ink/components/widgets/data-display/DataTable';
import { EmptyState } from '../surface/widgets/ink/components/widgets/data-display/EmptyState';
import { Gauge } from '../surface/widgets/ink/components/widgets/data-display/Gauge';
import { KanbanBoard } from '../surface/widgets/ink/components/widgets/data-display/KanbanBoard';
import { List } from '../surface/widgets/ink/components/widgets/data-display/List';
import { NotificationItem } from '../surface/widgets/ink/components/widgets/data-display/NotificationItem';
import { Skeleton } from '../surface/widgets/ink/components/widgets/data-display/Skeleton';
import { StatCard } from '../surface/widgets/ink/components/widgets/data-display/StatCard';
import { Timeline } from '../surface/widgets/ink/components/widgets/data-display/Timeline';
import { ViewToggle } from '../surface/widgets/ink/components/widgets/data-display/ViewToggle';
import { Text } from 'ink';

// ============================================================
// CalendarView
// ============================================================
describe('CalendarView', () => {
  it('renders the month name and year header', () => {
    const output = render(
      <CalendarView month={0} year={2026} />,
    ).lastFrame();
    expect(output).toContain('January');
    expect(output).toContain('2026');
  });

  it('renders day-of-week column headers', () => {
    const output = render(
      <CalendarView month={5} year={2026} />,
    ).lastFrame();
    expect(output).toContain('Su');
    expect(output).toContain('Mo');
    expect(output).toContain('Tu');
    expect(output).toContain('We');
    expect(output).toContain('Th');
    expect(output).toContain('Fr');
    expect(output).toContain('Sa');
  });

  it('displays event indicators for days with events', () => {
    const events = [
      { date: new Date(2026, 2, 15), label: 'Team standup' },
    ];
    // When focused, events for cursor day are listed
    const output = render(
      <CalendarView
        month={2}
        year={2026}
        events={events}
        isFocused={true}
        selectedDate={new Date(2026, 2, 15)}
      />,
    ).lastFrame();
    expect(output).toContain('March');
    expect(output).toContain('2026');
    // The event marker asterisk appears next to days with events
    expect(output).toContain('*');
  });
});

// ============================================================
// Card
// ============================================================
describe('Card', () => {
  it('renders with a title', () => {
    const output = render(
      <Card title="Project Info" />,
    ).lastFrame();
    expect(output).toContain('Project Info');
  });

  it('renders title and description', () => {
    const output = render(
      <Card title="Settings" description="Configure your preferences" />,
    ).lastFrame();
    expect(output).toContain('Settings');
    expect(output).toContain('Configure your preferences');
  });

  it('renders children content inside the card body', () => {
    const output = render(
      <Card title="Details">
        <Text>Card body content here</Text>
      </Card>,
    ).lastFrame();
    expect(output).toContain('Details');
    expect(output).toContain('Card body content here');
  });
});

// ============================================================
// CardGrid
// ============================================================
describe('CardGrid', () => {
  it('renders children in a grid layout', () => {
    const output = render(
      <CardGrid columns={2}>
        <Text>Item A</Text>
        <Text>Item B</Text>
        <Text>Item C</Text>
      </CardGrid>,
    ).lastFrame();
    expect(output).toContain('Item A');
    expect(output).toContain('Item B');
    expect(output).toContain('Item C');
  });

  it('shows empty message when no children provided', () => {
    const output = render(
      <CardGrid />,
    ).lastFrame();
    expect(output).toContain('No items to display');
  });

  it('renders single child without errors', () => {
    const output = render(
      <CardGrid columns={3}>
        <Text>Only item</Text>
      </CardGrid>,
    ).lastFrame();
    expect(output).toContain('Only item');
  });
});

// ============================================================
// Chart
// ============================================================
describe('Chart', () => {
  it('renders a bar chart with data labels and values', () => {
    const data = [
      { label: 'Apples', value: 30 },
      { label: 'Bananas', value: 50 },
    ];
    const output = render(
      <Chart type="bar" data={data} title="Fruit Sales" />,
    ).lastFrame();
    expect(output).toContain('Fruit Sales');
    expect(output).toContain('Apples');
    expect(output).toContain('Bananas');
    expect(output).toContain('30');
    expect(output).toContain('50');
  });

  it('renders a pie chart with percentage breakdown', () => {
    const data = [
      { label: 'React', value: 60 },
      { label: 'Vue', value: 40 },
    ];
    const output = render(
      <Chart type="pie" data={data} />,
    ).lastFrame();
    expect(output).toContain('React');
    expect(output).toContain('Vue');
    expect(output).toContain('%');
    expect(output).toContain('Total: 100');
  });

  it('renders no-data message for empty dataset', () => {
    const output = render(
      <Chart type="bar" data={[]} />,
    ).lastFrame();
    expect(output).toContain('No data');
  });
});

// ============================================================
// DataList
// ============================================================
describe('DataList', () => {
  it('renders key-value pairs in vertical layout', () => {
    const items = [
      { label: 'Name', value: 'Alice' },
      { label: 'Role', value: 'Engineer' },
    ];
    const output = render(
      <DataList items={items} />,
    ).lastFrame();
    expect(output).toContain('Name');
    expect(output).toContain('Alice');
    expect(output).toContain('Role');
    expect(output).toContain('Engineer');
  });

  it('renders key-value pairs in horizontal layout', () => {
    const items = [
      { label: 'Status', value: 'Active' },
      { label: 'Region', value: 'US-West' },
    ];
    const output = render(
      <DataList items={items} orientation="horizontal" />,
    ).lastFrame();
    expect(output).toContain('Status');
    expect(output).toContain('Active');
    expect(output).toContain('Region');
    expect(output).toContain('US-West');
  });

  it('renders empty state when items array is empty', () => {
    const output = render(
      <DataList items={[]} />,
    ).lastFrame();
    expect(output).toContain('No data');
  });
});

// ============================================================
// DataTable
// ============================================================
describe('DataTable', () => {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'age', label: 'Age' },
  ];

  it('renders column headers and row data', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const output = render(
      <DataTable columns={columns} data={data} />,
    ).lastFrame();
    expect(output).toContain('Name');
    expect(output).toContain('Age');
    expect(output).toContain('Alice');
    expect(output).toContain('Bob');
    expect(output).toContain('30');
    expect(output).toContain('25');
  });

  it('renders loading state', () => {
    const output = render(
      <DataTable columns={columns} data={[]} loading={true} />,
    ).lastFrame();
    expect(output).toContain('Loading...');
  });

  it('renders custom empty message when data is empty', () => {
    const output = render(
      <DataTable
        columns={columns}
        data={[]}
        emptyMessage="No records found"
      />,
    ).lastFrame();
    expect(output).toContain('No records found');
  });
});

// ============================================================
// EmptyState
// ============================================================
describe('EmptyState', () => {
  it('renders the title text', () => {
    const output = render(
      <EmptyState title="Nothing here yet" />,
    ).lastFrame();
    expect(output).toContain('Nothing here yet');
  });

  it('renders title, description, and icon', () => {
    const output = render(
      <EmptyState
        title="No results"
        description="Try adjusting your search filters"
        icon="Q"
      />,
    ).lastFrame();
    expect(output).toContain('No results');
    expect(output).toContain('Try adjusting your search filters');
    expect(output).toContain('Q');
  });

  it('renders an action button when provided', () => {
    const output = render(
      <EmptyState
        title="No items"
        action={{ label: 'Create New', onPress: () => {} }}
      />,
    ).lastFrame();
    expect(output).toContain('No items');
    expect(output).toContain('Create New');
  });
});

// ============================================================
// Gauge
// ============================================================
describe('Gauge', () => {
  it('renders a gauge with percentage value', () => {
    const output = render(
      <Gauge value={75} />,
    ).lastFrame();
    expect(output).toContain('75%');
    expect(output).toContain('75 of 100');
    // Should contain the bracket delimiters
    expect(output).toContain('[');
    expect(output).toContain(']');
  });

  it('renders with a custom label', () => {
    const output = render(
      <Gauge value={50} label="CPU Usage" />,
    ).lastFrame();
    expect(output).toContain('CPU Usage');
    expect(output).toContain('50%');
  });

  it('clamps values to the min/max range', () => {
    const output = render(
      <Gauge value={150} min={0} max={100} />,
    ).lastFrame();
    // Value is clamped to 100, so percentage is 100%
    expect(output).toContain('100%');
    expect(output).toContain('100 of 100');
  });
});

// ============================================================
// KanbanBoard
// ============================================================
describe('KanbanBoard', () => {
  const sampleColumns = [
    {
      id: 'todo',
      title: 'To Do',
      items: [
        { id: '1', title: 'Write tests' },
        { id: '2', title: 'Fix bug' },
      ],
    },
    {
      id: 'doing',
      title: 'In Progress',
      items: [
        { id: '3', title: 'Code review' },
      ],
    },
    {
      id: 'done',
      title: 'Done',
      items: [],
    },
  ];

  it('renders column titles and item counts', () => {
    const output = render(
      <KanbanBoard columns={sampleColumns} />,
    ).lastFrame();
    expect(output).toContain('To Do');
    expect(output).toContain('(2)');
    expect(output).toContain('In Progress');
    expect(output).toContain('(1)');
    expect(output).toContain('Done');
    expect(output).toContain('(0)');
  });

  it('renders item titles within their columns', () => {
    const output = render(
      <KanbanBoard columns={sampleColumns} />,
    ).lastFrame();
    expect(output).toContain('Write tests');
    expect(output).toContain('Fix bug');
    expect(output).toContain('Code review');
  });

  it('renders empty column placeholder for columns with no items', () => {
    const output = render(
      <KanbanBoard columns={sampleColumns} />,
    ).lastFrame();
    expect(output).toContain('(empty)');
  });
});

// ============================================================
// List
// ============================================================
describe('List', () => {
  const sampleItems = [
    { id: '1', label: 'First item', description: 'Description A' },
    { id: '2', label: 'Second item', icon: '>' },
    { id: '3', label: 'Third item' },
  ];

  it('renders all item labels', () => {
    const output = render(
      <List items={sampleItems} />,
    ).lastFrame();
    expect(output).toContain('First item');
    expect(output).toContain('Second item');
    expect(output).toContain('Third item');
  });

  it('renders item descriptions and icons', () => {
    const output = render(
      <List items={sampleItems} />,
    ).lastFrame();
    expect(output).toContain('Description A');
    expect(output).toContain('>');
  });

  it('renders empty state when items array is empty', () => {
    const output = render(
      <List items={[]} />,
    ).lastFrame();
    expect(output).toContain('No items');
  });
});

// ============================================================
// NotificationItem
// ============================================================
describe('NotificationItem', () => {
  it('renders unread notification with title', () => {
    const output = render(
      <NotificationItem title="New message from Bob" />,
    ).lastFrame();
    expect(output).toContain('New message from Bob');
    // Unread indicator is a filled circle
    expect(output).toContain('\u25CF');
  });

  it('renders read notification with different indicator', () => {
    const output = render(
      <NotificationItem title="Old notification" read={true} />,
    ).lastFrame();
    expect(output).toContain('Old notification');
    // Read indicator is an empty circle
    expect(output).toContain('\u25CB');
  });

  it('renders description, timestamp, and icon when provided', () => {
    const output = render(
      <NotificationItem
        title="Deployment complete"
        description="Production build finished successfully"
        timestamp="2m ago"
        icon="R"
      />,
    ).lastFrame();
    expect(output).toContain('Deployment complete');
    expect(output).toContain('Production build finished successfully');
    expect(output).toContain('2m ago');
    expect(output).toContain('R');
  });
});

// ============================================================
// Skeleton
// ============================================================
describe('Skeleton', () => {
  it('renders text skeleton with shimmer characters', () => {
    const output = render(
      <Skeleton variant="text" width={10} lines={1} />,
    ).lastFrame();
    // Output should contain one of the shimmer characters
    const hasShimmer =
      output!.includes('\u2591') ||
      output!.includes('\u2592') ||
      output!.includes('\u2593');
    expect(hasShimmer).toBe(true);
  });

  it('renders rect skeleton with multiple rows', () => {
    const output = render(
      <Skeleton variant="rect" width={8} height={3} />,
    ).lastFrame();
    // Should have shimmer content across multiple lines
    const lines = output!.split('\n').filter((line) => line.trim().length > 0);
    expect(lines.length).toBe(3);
  });

  it('renders circle skeleton variant', () => {
    const output = render(
      <Skeleton variant="circle" width={5} />,
    ).lastFrame();
    const hasShimmer =
      output!.includes('\u2591') ||
      output!.includes('\u2592') ||
      output!.includes('\u2593');
    expect(hasShimmer).toBe(true);
  });
});

// ============================================================
// StatCard
// ============================================================
describe('StatCard', () => {
  it('renders label and value', () => {
    const output = render(
      <StatCard label="Revenue" value="$12,345" />,
    ).lastFrame();
    expect(output).toContain('Revenue');
    expect(output).toContain('$12,345');
  });

  it('renders change indicator for increase', () => {
    const output = render(
      <StatCard
        label="Users"
        value="1,200"
        change="+15%"
        changeType="increase"
      />,
    ).lastFrame();
    expect(output).toContain('Users');
    expect(output).toContain('1,200');
    expect(output).toContain('+15%');
    // Increase triangle indicator
    expect(output).toContain('\u25B2');
  });

  it('renders change indicator for decrease', () => {
    const output = render(
      <StatCard
        label="Errors"
        value="42"
        change="-8%"
        changeType="decrease"
      />,
    ).lastFrame();
    expect(output).toContain('Errors');
    expect(output).toContain('42');
    expect(output).toContain('-8%');
    // Decrease triangle indicator
    expect(output).toContain('\u25BC');
  });
});

// ============================================================
// Timeline
// ============================================================
describe('Timeline', () => {
  const sampleItems = [
    {
      id: '1',
      title: 'Project started',
      timestamp: '2026-01-01',
      status: 'completed' as const,
    },
    {
      id: '2',
      title: 'Design review',
      timestamp: '2026-01-15',
      status: 'active' as const,
      description: 'Reviewing wireframes',
    },
    {
      id: '3',
      title: 'Launch',
      timestamp: '2026-02-01',
      status: 'pending' as const,
    },
  ];

  it('renders all timeline items with titles and timestamps', () => {
    const output = render(
      <Timeline items={sampleItems} />,
    ).lastFrame();
    expect(output).toContain('Project started');
    expect(output).toContain('2026-01-01');
    expect(output).toContain('Design review');
    expect(output).toContain('2026-01-15');
    expect(output).toContain('Launch');
    expect(output).toContain('2026-02-01');
  });

  it('renders status markers for completed, active, and pending items', () => {
    const output = render(
      <Timeline items={sampleItems} />,
    ).lastFrame();
    // completed = filled circle, active = double circle, pending = empty circle
    expect(output).toContain('\u25CF');
    expect(output).toContain('\u25CE');
    expect(output).toContain('\u25CB');
  });

  it('renders empty state when no items provided', () => {
    const output = render(
      <Timeline items={[]} />,
    ).lastFrame();
    expect(output).toContain('No timeline items');
  });
});

// ============================================================
// ViewToggle
// ============================================================
describe('ViewToggle', () => {
  const views = [
    { id: 'grid', label: 'Grid' },
    { id: 'list', label: 'List' },
    { id: 'table', label: 'Table' },
  ];

  it('renders all view options with bracket delimiters', () => {
    const output = render(
      <ViewToggle views={views} activeView="grid" />,
    ).lastFrame();
    expect(output).toContain('[');
    expect(output).toContain(']');
    expect(output).toContain('Grid');
    expect(output).toContain('List');
    expect(output).toContain('Table');
  });

  it('renders pipe separators between options', () => {
    const output = render(
      <ViewToggle views={views} activeView="list" />,
    ).lastFrame();
    expect(output).toContain('|');
  });

  it('renders empty state when no views provided', () => {
    const output = render(
      <ViewToggle views={[]} activeView="" />,
    ).lastFrame();
    expect(output).toContain('No views');
  });
});
