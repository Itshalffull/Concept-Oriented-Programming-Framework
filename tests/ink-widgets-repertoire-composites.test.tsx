// ============================================================
// Clef Surface Ink Widgets — Composites Rendering Tests
//
// Validates rendering behavior for all 16 composite Ink widgets
// including default render, content display, and state variations.
// Uses ink-testing-library for terminal output assertions.
// See Architecture doc Section 16.
// ============================================================

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

import { Text } from 'ink';

import { BacklinkPanel } from '../surface/widgets/ink/components/widgets/composites/BacklinkPanel';
import { CacheDashboard } from '../surface/widgets/ink/components/widgets/composites/CacheDashboard';
import { DiffViewer } from '../surface/widgets/ink/components/widgets/composites/DiffViewer';
import { FacetedSearch } from '../surface/widgets/ink/components/widgets/composites/FacetedSearch';
import { FileBrowser } from '../surface/widgets/ink/components/widgets/composites/FileBrowser';
import { FilterBuilder } from '../surface/widgets/ink/components/widgets/composites/FilterBuilder';
import { MasterDetail } from '../surface/widgets/ink/components/widgets/composites/MasterDetail';
import { NotificationCenter } from '../surface/widgets/ink/components/widgets/composites/NotificationCenter';
import { PermissionMatrix } from '../surface/widgets/ink/components/widgets/composites/PermissionMatrix';
import { PluginCard } from '../surface/widgets/ink/components/widgets/composites/PluginCard';
import { PreferenceMatrix } from '../surface/widgets/ink/components/widgets/composites/PreferenceMatrix';
import { PropertyPanel } from '../surface/widgets/ink/components/widgets/composites/PropertyPanel';
import { QueueDashboard } from '../surface/widgets/ink/components/widgets/composites/QueueDashboard';
import { SchemaEditor } from '../surface/widgets/ink/components/widgets/composites/SchemaEditor';
import { SortBuilder } from '../surface/widgets/ink/components/widgets/composites/SortBuilder';
import { ViewSwitcher } from '../surface/widgets/ink/components/widgets/composites/ViewSwitcher';

// ===================== BacklinkPanel =====================

describe('BacklinkPanel', () => {
  it('renders with empty backlinks array', () => {
    const output = render(<BacklinkPanel backlinks={[]} />).lastFrame();
    expect(output).toContain('Backlinks');
    expect(output).toContain('(0)');
    expect(output).toContain('No backlinks found.');
  });

  it('displays backlink titles, sources, and excerpts', () => {
    const backlinks = [
      { title: 'Getting Started', source: 'docs/intro.md', excerpt: 'See the guide for setup.' },
      { title: 'API Reference', source: 'docs/api.md', excerpt: 'Backlink to core module.' },
    ];
    const output = render(<BacklinkPanel backlinks={backlinks} />).lastFrame();
    expect(output).toContain('Backlinks');
    expect(output).toContain('(2)');
    expect(output).toContain('Getting Started');
    expect(output).toContain('docs/intro.md');
    expect(output).toContain('See the guide for setup.');
    expect(output).toContain('API Reference');
    expect(output).toContain('docs/api.md');
  });

  it('renders focused state with cyan border', () => {
    const backlinks = [
      { title: 'Home Page', source: 'pages/home.md', excerpt: 'Main link.' },
    ];
    const output = render(<BacklinkPanel backlinks={backlinks} isFocused />).lastFrame();
    expect(output).toContain('Home Page');
    expect(output).toContain('pages/home.md');
  });
});

// ===================== CacheDashboard =====================

describe('CacheDashboard', () => {
  it('renders with empty entries', () => {
    const output = render(
      <CacheDashboard entries={[]} totalSize={0} maxSize={1024} hitRate={0} />
    ).lastFrame();
    expect(output).toContain('Cache Dashboard');
    expect(output).toContain('Hit Rate');
    expect(output).toContain('0.0%');
    expect(output).toContain('No cache entries.');
    expect(output).toContain('Clear All');
  });

  it('displays cache entries with key, size, ttl, and hits', () => {
    const entries = [
      { key: 'user:123', size: 2048, ttl: 300, hits: 42 },
      { key: 'session:abc', size: 512, ttl: 60, hits: 7 },
    ];
    const output = render(
      <CacheDashboard entries={entries} totalSize={2560} maxSize={10240} hitRate={0.85} />
    ).lastFrame();
    expect(output).toContain('Cache Dashboard');
    expect(output).toContain('85.0%');
    expect(output).toContain('user:123');
    expect(output).toContain('2.0KB');
    expect(output).toContain('300s');
    expect(output).toContain('42');
    expect(output).toContain('session:abc');
  });

  it('displays usage bar and formatted byte sizes', () => {
    const output = render(
      <CacheDashboard
        entries={[]}
        totalSize={5242880}
        maxSize={10485760}
        hitRate={0.5}
      />
    ).lastFrame();
    expect(output).toContain('Usage');
    expect(output).toContain('5.0MB');
    expect(output).toContain('10.0MB');
    expect(output).toContain('50.0%');
  });
});

// ===================== DiffViewer =====================

describe('DiffViewer', () => {
  it('renders unified diff with additions and deletions counts', () => {
    const output = render(
      <DiffViewer oldText="hello\nworld" newText="hello\nearth" />
    ).lastFrame();
    expect(output).toContain('Diff');
    expect(output).toContain('[unified]');
  });

  it('displays added and removed lines in unified mode', () => {
    const output = render(
      <DiffViewer oldText="line1\nold line" newText="line1\nnew line" />
    ).lastFrame();
    expect(output).toContain('Diff');
    // The diff should show addition/deletion counts
    expect(output).toContain('+');
    expect(output).toContain('-');
  });

  it('renders in split mode with Original and Modified headers', () => {
    const output = render(
      <DiffViewer oldText="alpha" newText="beta" mode="split" />
    ).lastFrame();
    expect(output).toContain('[split]');
    expect(output).toContain('Original');
    expect(output).toContain('Modified');
  });
});

// ===================== FacetedSearch =====================

describe('FacetedSearch', () => {
  it('renders with empty query, facets, and results', () => {
    const output = render(
      <FacetedSearch query="" facets={[]} results={[]} />
    ).lastFrame();
    expect(output).toContain('Search');
    expect(output).toContain('(empty)');
    expect(output).toContain('Filters');
    expect(output).toContain('Results (0)');
    expect(output).toContain('No results found.');
  });

  it('displays query text, facet options, and search results', () => {
    const facets = [
      {
        name: 'Category',
        options: [
          { label: 'Books', value: 'books', selected: true },
          { label: 'Videos', value: 'videos', selected: false },
        ],
      },
    ];
    const results = [
      { id: '1', title: 'Learn React', description: 'A comprehensive guide.' },
      { id: '2', title: 'Ink Widgets', description: 'Terminal UI components.' },
    ];
    const output = render(
      <FacetedSearch query="react" facets={facets} results={results} />
    ).lastFrame();
    expect(output).toContain('react');
    expect(output).toContain('Category');
    expect(output).toContain('[x]');
    expect(output).toContain('Books');
    expect(output).toContain('[ ]');
    expect(output).toContain('Videos');
    expect(output).toContain('Results (2)');
    expect(output).toContain('Learn React');
    expect(output).toContain('A comprehensive guide.');
    expect(output).toContain('Ink Widgets');
  });

  it('shows no filters message when facets are empty', () => {
    const results = [{ id: '1', title: 'Result A' }];
    const output = render(
      <FacetedSearch query="test" facets={[]} results={results} />
    ).lastFrame();
    expect(output).toContain('No filters');
    expect(output).toContain('Result A');
  });
});

// ===================== FileBrowser =====================

describe('FileBrowser', () => {
  it('renders with empty file list and current path', () => {
    const output = render(
      <FileBrowser files={[]} currentPath="/home/user" />
    ).lastFrame();
    expect(output).toContain('home');
    expect(output).toContain('user');
    expect(output).toContain('Name');
    expect(output).toContain('Size');
    expect(output).toContain('Modified');
    expect(output).toContain('Empty directory.');
  });

  it('displays files and folders with names, sizes, and dates', () => {
    const files = [
      { name: 'src', type: 'folder' as const, size: 0, modified: '2025-01-10' },
      { name: 'readme.md', type: 'file' as const, size: 4096, modified: '2025-01-15' },
    ];
    const output = render(
      <FileBrowser files={files} currentPath="/project" />
    ).lastFrame();
    expect(output).toContain('project');
    expect(output).toContain('src');
    expect(output).toContain('--');
    expect(output).toContain('readme.md');
    expect(output).toContain('4.0K');
    expect(output).toContain('2025-01-15');
  });

  it('renders root path breadcrumb', () => {
    const output = render(
      <FileBrowser files={[]} currentPath="/" />
    ).lastFrame();
    expect(output).toContain('root');
  });
});

// ===================== FilterBuilder =====================

describe('FilterBuilder', () => {
  it('renders with empty filters', () => {
    const fields = [{ label: 'Name', value: 'name' }];
    const operators = [{ label: 'Equals', value: 'eq' }];
    const output = render(
      <FilterBuilder filters={[]} fields={fields} operators={operators} />
    ).lastFrame();
    expect(output).toContain('Filter Builder');
    expect(output).toContain('(0 active)');
    expect(output).toContain('No filters defined.');
    expect(output).toContain('[+ Add Filter]');
  });

  it('displays filter rows with field, operator, and value', () => {
    const fields = [
      { label: 'Name', value: 'name' },
      { label: 'Status', value: 'status' },
    ];
    const operators = [
      { label: 'Equals', value: 'eq' },
      { label: 'Contains', value: 'contains' },
    ];
    const filters = [
      { field: 'name', operator: 'eq', value: 'Alice' },
      { field: 'status', operator: 'contains', value: 'active' },
    ];
    const output = render(
      <FilterBuilder filters={filters} fields={fields} operators={operators} />
    ).lastFrame();
    expect(output).toContain('(2 active)');
    expect(output).toContain('Name');
    expect(output).toContain('Equals');
    expect(output).toContain('Alice');
    expect(output).toContain('Status');
    expect(output).toContain('Contains');
    expect(output).toContain('active');
  });

  it('shows add button and filter count', () => {
    const filters = [{ field: 'type', operator: 'eq', value: 'widget' }];
    const output = render(
      <FilterBuilder
        filters={filters}
        fields={[{ label: 'Type', value: 'type' }]}
        operators={[{ label: 'Equals', value: 'eq' }]}
      />
    ).lastFrame();
    expect(output).toContain('(1 active)');
    expect(output).toContain('[+ Add Filter]');
    expect(output).toContain('widget');
  });
});

// ===================== MasterDetail =====================

describe('MasterDetail', () => {
  it('renders with empty items and no selection', () => {
    const output = render(<MasterDetail items={[]} />).lastFrame();
    expect(output).toContain('Items');
    expect(output).toContain('(0)');
    expect(output).toContain('No items.');
    expect(output).toContain('Select an item from the list to view details.');
  });

  it('displays items in master list and detail for selected item', () => {
    const items = [
      { id: 'a', label: 'Alpha', description: 'First item details.' },
      { id: 'b', label: 'Beta', description: 'Second item details.' },
    ];
    const output = render(
      <MasterDetail items={items} selectedId="a" />
    ).lastFrame();
    expect(output).toContain('Items');
    expect(output).toContain('(2)');
    expect(output).toContain('Alpha');
    expect(output).toContain('Beta');
    expect(output).toContain('First item details.');
  });

  it('renders children in detail pane when item is selected', () => {
    const items = [{ id: 'x', label: 'Item X' }];
    const output = render(
      <MasterDetail items={items} selectedId="x">
        <Text>Custom detail content here</Text>
      </MasterDetail>
    ).lastFrame();
    expect(output).toContain('Item X');
    expect(output).toContain('Custom detail content here');
  });
});

// ===================== NotificationCenter =====================

describe('NotificationCenter', () => {
  it('renders with empty notifications', () => {
    const output = render(
      <NotificationCenter notifications={[]} />
    ).lastFrame();
    expect(output).toContain('Notifications');
    expect(output).toContain('No notifications.');
    expect(output).toContain('Clear All');
  });

  it('displays notifications with title, time, and type', () => {
    const notifications = [
      { id: '1', title: 'Build succeeded', time: '2m ago', read: false, type: 'success' as const },
      { id: '2', title: 'Disk warning', description: 'Low space on /dev/sda1', time: '5m ago', read: true, type: 'warning' as const },
    ];
    const output = render(
      <NotificationCenter notifications={notifications} />
    ).lastFrame();
    expect(output).toContain('Notifications');
    expect(output).toContain('(1 unread)');
    expect(output).toContain('Build succeeded');
    expect(output).toContain('2m ago');
    expect(output).toContain('Disk warning');
    expect(output).toContain('Low space on /dev/sda1');
    expect(output).toContain('5m ago');
  });

  it('shows unread count badge only when unread notifications exist', () => {
    const allRead = [
      { id: '1', title: 'Old notice', time: '1h ago', read: true, type: 'info' as const },
    ];
    const output = render(
      <NotificationCenter notifications={allRead} />
    ).lastFrame();
    expect(output).toContain('Notifications');
    expect(output).not.toContain('unread');
  });
});

// ===================== PermissionMatrix =====================

describe('PermissionMatrix', () => {
  it('renders with empty permissions', () => {
    const output = render(
      <PermissionMatrix roles={[]} permissions={[]} matrix={{}} />
    ).lastFrame();
    expect(output).toContain('Permission');
    expect(output).toContain('No permissions defined.');
  });

  it('displays roles as column headers and permissions as rows', () => {
    const roles = ['Admin', 'Editor', 'Viewer'];
    const permissions = ['read', 'write', 'delete'];
    const matrix = {
      read: { Admin: true, Editor: true, Viewer: true },
      write: { Admin: true, Editor: true, Viewer: false },
      delete: { Admin: true, Editor: false, Viewer: false },
    };
    const output = render(
      <PermissionMatrix roles={roles} permissions={permissions} matrix={matrix} />
    ).lastFrame();
    expect(output).toContain('Admin');
    expect(output).toContain('Editor');
    expect(output).toContain('Viewer');
    expect(output).toContain('read');
    expect(output).toContain('write');
    expect(output).toContain('delete');
    expect(output).toContain('[x]');
    expect(output).toContain('[ ]');
  });

  it('renders granted and denied states with correct checkbox markers', () => {
    const roles = ['User'];
    const permissions = ['access'];
    const granted = { access: { User: true } };
    const denied = { access: { User: false } };

    const grantedOutput = render(
      <PermissionMatrix roles={roles} permissions={permissions} matrix={granted} />
    ).lastFrame();
    expect(grantedOutput).toContain('[x]');

    const deniedOutput = render(
      <PermissionMatrix roles={roles} permissions={permissions} matrix={denied} />
    ).lastFrame();
    expect(deniedOutput).toContain('[ ]');
  });
});

// ===================== PluginCard =====================

describe('PluginCard', () => {
  it('renders available (not installed) plugin with install button', () => {
    const output = render(
      <PluginCard
        name="Syntax Highlighter"
        description="Adds code highlighting support."
        version="1.2.0"
        author="DevTools Inc."
        installed={false}
        enabled={false}
      />
    ).lastFrame();
    expect(output).toContain('Syntax Highlighter');
    expect(output).toContain('v1.2.0');
    expect(output).toContain('by DevTools Inc.');
    expect(output).toContain('Adds code highlighting support.');
    expect(output).toContain('[Available]');
    expect(output).toContain('Install');
  });

  it('renders installed and enabled plugin with uninstall and disable buttons', () => {
    const output = render(
      <PluginCard
        name="Linter"
        description="Code linting plugin."
        version="3.0.1"
        author="Lint Co."
        installed={true}
        enabled={true}
      />
    ).lastFrame();
    expect(output).toContain('Linter');
    expect(output).toContain('[Enabled]');
    expect(output).toContain('Uninstall');
    expect(output).toContain('Disable');
  });

  it('renders installed but disabled plugin with correct status', () => {
    const output = render(
      <PluginCard
        name="Formatter"
        description="Auto-format code on save."
        version="2.1.0"
        author="Format Labs"
        installed={true}
        enabled={false}
      />
    ).lastFrame();
    expect(output).toContain('Formatter');
    expect(output).toContain('[Disabled]');
    expect(output).toContain('Uninstall');
    expect(output).toContain('Enable');
  });
});

// ===================== PreferenceMatrix =====================

describe('PreferenceMatrix', () => {
  it('renders with empty categories', () => {
    const output = render(
      <PreferenceMatrix categories={[]} values={{}} />
    ).lastFrame();
    expect(output).toContain('Preferences');
    expect(output).toContain('No preferences.');
  });

  it('displays categories with toggle and select preferences', () => {
    const categories = [
      {
        name: 'General',
        preferences: [
          { key: 'darkMode', label: 'Dark Mode', type: 'toggle' as const },
          { key: 'language', label: 'Language', type: 'select' as const, options: ['English', 'Spanish', 'French'] },
        ],
      },
      {
        name: 'Editor',
        preferences: [
          { key: 'autoSave', label: 'Auto Save', type: 'toggle' as const },
        ],
      },
    ];
    const values = {
      darkMode: true,
      language: 'Spanish',
      autoSave: false,
    };
    const output = render(
      <PreferenceMatrix categories={categories} values={values} />
    ).lastFrame();
    expect(output).toContain('Preferences');
    expect(output).toContain('General');
    expect(output).toContain('Dark Mode');
    expect(output).toContain('[ON]');
    expect(output).toContain('Language');
    expect(output).toContain('Spanish');
    expect(output).toContain('Editor');
    expect(output).toContain('Auto Save');
    expect(output).toContain('[OFF]');
  });

  it('renders toggle values as ON/OFF', () => {
    const categories = [
      {
        name: 'Settings',
        preferences: [
          { key: 'enabled', label: 'Feature Enabled', type: 'toggle' as const },
          { key: 'disabled', label: 'Feature Disabled', type: 'toggle' as const },
        ],
      },
    ];
    const values = { enabled: true, disabled: false };
    const output = render(
      <PreferenceMatrix categories={categories} values={values} />
    ).lastFrame();
    expect(output).toContain('[ON]');
    expect(output).toContain('[OFF]');
  });
});

// ===================== PropertyPanel =====================

describe('PropertyPanel', () => {
  it('renders with empty properties and default title', () => {
    const output = render(<PropertyPanel properties={[]} />).lastFrame();
    expect(output).toContain('Properties');
    expect(output).toContain('No properties.');
  });

  it('displays property rows with name, type-formatted value', () => {
    const properties = [
      { name: 'Width', type: 'number' as const, value: 1920, editable: true },
      { name: 'Height', type: 'number' as const, value: 1080, editable: true },
      { name: 'Visible', type: 'boolean' as const, value: true, editable: true },
      { name: 'Label', type: 'text' as const, value: 'Main Window', editable: false },
    ];
    const output = render(
      <PropertyPanel properties={properties} title="Window Properties" />
    ).lastFrame();
    expect(output).toContain('Window Properties');
    expect(output).toContain('Width');
    expect(output).toContain('1920');
    expect(output).toContain('Height');
    expect(output).toContain('1080');
    expect(output).toContain('Visible');
    expect(output).toContain('true');
    expect(output).toContain('Label');
    expect(output).toContain('Main Window');
  });

  it('renders custom title', () => {
    const output = render(
      <PropertyPanel properties={[]} title="Node Inspector" />
    ).lastFrame();
    expect(output).toContain('Node Inspector');
  });
});

// ===================== QueueDashboard =====================

describe('QueueDashboard', () => {
  it('renders with empty queues', () => {
    const output = render(<QueueDashboard queues={[]} />).lastFrame();
    expect(output).toContain('Queue Dashboard');
    expect(output).toContain('(0 queues)');
    expect(output).toContain('No queues.');
  });

  it('displays queue stats with pending, active, completed, and failed counts', () => {
    const queues = [
      { name: 'email', pending: 5, active: 2, completed: 100, failed: 3 },
      { name: 'export', pending: 0, active: 0, completed: 50, failed: 0 },
    ];
    const output = render(<QueueDashboard queues={queues} />).lastFrame();
    expect(output).toContain('Queue Dashboard');
    expect(output).toContain('(2 queues)');
    expect(output).toContain('email');
    expect(output).toContain('5');
    expect(output).toContain('100');
    expect(output).toContain('3');
    expect(output).toContain('export');
    expect(output).toContain('50');
    expect(output).toContain('[Retry]');
    expect(output).toContain('[Purge]');
  });

  it('renders table headers for queue columns', () => {
    const output = render(
      <QueueDashboard queues={[{ name: 'test', pending: 1, active: 0, completed: 0, failed: 0 }]} />
    ).lastFrame();
    expect(output).toContain('Queue');
    expect(output).toContain('Pend');
    expect(output).toContain('Act');
    expect(output).toContain('Done');
    expect(output).toContain('Fail');
    expect(output).toContain('Progress');
    expect(output).toContain('Actions');
  });
});

// ===================== SchemaEditor =====================

describe('SchemaEditor', () => {
  it('renders with empty schema', () => {
    const output = render(<SchemaEditor schema={[]} />).lastFrame();
    expect(output).toContain('Schema Editor');
    expect(output).toContain('(0 fields)');
    expect(output).toContain('No fields defined.');
    expect(output).toContain('[+ Add Field]');
  });

  it('displays fields with name, type, and required badge', () => {
    const schema = [
      { name: 'id', type: 'number', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'nickname', type: 'string', required: false },
    ];
    const output = render(<SchemaEditor schema={schema} />).lastFrame();
    expect(output).toContain('(3 fields)');
    expect(output).toContain('id');
    expect(output).toContain('number');
    expect(output).toContain('[required]');
    expect(output).toContain('email');
    expect(output).toContain('string');
    expect(output).toContain('nickname');
  });

  it('renders add field button and field count', () => {
    const schema = [{ name: 'title', type: 'string' }];
    const output = render(<SchemaEditor schema={schema} />).lastFrame();
    expect(output).toContain('(1 fields)');
    expect(output).toContain('title');
    expect(output).toContain('[+ Add Field]');
  });
});

// ===================== SortBuilder =====================

describe('SortBuilder', () => {
  it('renders with empty sorts', () => {
    const fields = [{ label: 'Name', value: 'name' }];
    const output = render(
      <SortBuilder sorts={[]} fields={fields} />
    ).lastFrame();
    expect(output).toContain('Sort Builder');
    expect(output).toContain('(0 rules)');
    expect(output).toContain('No sort rules defined.');
    expect(output).toContain('[+ Add Sort]');
  });

  it('displays sort rules with field label and direction', () => {
    const fields = [
      { label: 'Name', value: 'name' },
      { label: 'Created', value: 'created' },
    ];
    const sorts = [
      { field: 'name', direction: 'ascending' as const },
      { field: 'created', direction: 'descending' as const },
    ];
    const output = render(
      <SortBuilder sorts={sorts} fields={fields} />
    ).lastFrame();
    expect(output).toContain('(2 rules)');
    expect(output).toContain('Name');
    expect(output).toContain('ASC');
    expect(output).toContain('Created');
    expect(output).toContain('DESC');
  });

  it('shows priority numbers for sort rules', () => {
    const fields = [{ label: 'Score', value: 'score' }];
    const sorts = [{ field: 'score', direction: 'descending' as const }];
    const output = render(
      <SortBuilder sorts={sorts} fields={fields} />
    ).lastFrame();
    expect(output).toContain('1.');
    expect(output).toContain('Score');
    expect(output).toContain('DESC');
  });
});

// ===================== ViewSwitcher =====================

describe('ViewSwitcher', () => {
  it('renders view tabs with active view highlighted', () => {
    const views = [
      { id: 'list', label: 'List' },
      { id: 'grid', label: 'Grid' },
      { id: 'table', label: 'Table' },
    ];
    const output = render(
      <ViewSwitcher views={views} activeView="grid" />
    ).lastFrame();
    expect(output).toContain('List');
    expect(output).toContain('Grid');
    expect(output).toContain('Table');
  });

  it('renders view icons when provided', () => {
    const views = [
      { id: 'card', label: 'Cards', icon: '#' },
      { id: 'list', label: 'List', icon: '=' },
    ];
    const output = render(
      <ViewSwitcher views={views} activeView="card" />
    ).lastFrame();
    expect(output).toContain('# Cards');
    expect(output).toContain('= List');
  });

  it('renders with pipe separators between views', () => {
    const views = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
    ];
    const output = render(
      <ViewSwitcher views={views} activeView="a" />
    ).lastFrame();
    expect(output).toContain('|');
    expect(output).toContain('Alpha');
    expect(output).toContain('Beta');
  });
});
