// ============================================================
// Ink Widgets Structure Tests
//
// Verifies file structure and completeness of all 136 Ink
// widget implementations (14 framework + 122 repertoire).
// Ensures every component file exists, exports a component,
// and sets a displayName.
// ============================================================

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COMPONENTS_DIR = path.resolve(
  PROJECT_ROOT,
  'surface/widgets/ink/components',
);
const WIDGETS_DIR = path.resolve(COMPONENTS_DIR, 'widgets');

// --------------- Framework Components (14) ---------------

const FRAMEWORK_COMPONENTS = [
  'DesignTokenProvider',
  'ThemeSwitch',
  'TypographyText',
  'PalettePreview',
  'ElevationBox',
  'MotionBox',
  'LayoutContainer',
  'ViewportProvider',
  'ElementRenderer',
  'WidgetMachine',
  'SlotOutlet',
  'BindingProvider',
  'UISchemaForm',
  'SurfaceRoot',
] as const;

// --------------- Repertoire Categories and Widgets (122) ---------------

const REPERTOIRE_CATEGORIES: Record<string, string[]> = {
  primitives: [
    'Avatar',
    'Button',
    'Checkbox',
    'Chip',
    'FocusTrap',
    'Icon',
    'Label',
    'Portal',
    'Presence',
    'ScrollLock',
    'Separator',
    'Spinner',
    'TextInput',
    'VisuallyHidden',
  ],
  'form-controls': [
    'Badge',
    'CheckboxGroup',
    'ChipInput',
    'Combobox',
    'ComboboxMulti',
    'MultiSelect',
    'NumberInput',
    'ProgressBar',
    'RadioCard',
    'RadioGroup',
    'SegmentedControl',
    'Select',
    'Slider',
    'Stepper',
    'Textarea',
    'ToggleSwitch',
  ],
  feedback: [
    'Alert',
    'AlertDialog',
    'ContextMenu',
    'Dialog',
    'Drawer',
    'HoverCard',
    'Popover',
    'Toast',
    'ToastManager',
    'Tooltip',
  ],
  navigation: [
    'Accordion',
    'Breadcrumb',
    'CommandPalette',
    'Disclosure',
    'Fieldset',
    'FloatingToolbar',
    'Form',
    'Menu',
    'NavigationMenu',
    'Pagination',
    'Sidebar',
    'Splitter',
    'Tabs',
    'Toolbar',
  ],
  'data-display': [
    'CalendarView',
    'Card',
    'CardGrid',
    'Chart',
    'DataList',
    'DataTable',
    'EmptyState',
    'Gauge',
    'KanbanBoard',
    'List',
    'NotificationItem',
    'Skeleton',
    'StatCard',
    'Timeline',
    'ViewToggle',
  ],
  'complex-inputs': [
    'ColorPicker',
    'DatePicker',
    'DateRangePicker',
    'FileUpload',
    'FormulaEditor',
    'MentionInput',
    'PinInput',
    'RangeSlider',
    'Rating',
    'RichTextEditor',
    'SignaturePad',
    'TreeSelect',
  ],
  composites: [
    'BacklinkPanel',
    'CacheDashboard',
    'DiffViewer',
    'FacetedSearch',
    'FileBrowser',
    'FilterBuilder',
    'MasterDetail',
    'NotificationCenter',
    'PermissionMatrix',
    'PluginCard',
    'PreferenceMatrix',
    'PropertyPanel',
    'QueueDashboard',
    'SchemaEditor',
    'SortBuilder',
    'ViewSwitcher',
  ],
  domain: [
    'AutomationBuilder',
    'BlockEditor',
    'Canvas',
    'CanvasConnector',
    'CanvasNode',
    'CodeBlock',
    'ColorLabelPicker',
    'ConditionBuilder',
    'CronEditor',
    'DragHandle',
    'FieldMapper',
    'GraphView',
    'ImageGallery',
    'InlineEdit',
    'MarkdownPreview',
    'Minimap',
    'Outliner',
    'PluginDetailPage',
    'PolicyEditor',
    'SlashMenu',
    'StateMachineDiagram',
    'StepIndicator',
    'TokenInput',
    'WorkflowEditor',
    'WorkflowNode',
  ],
};

const CATEGORY_NAMES = Object.keys(REPERTOIRE_CATEGORIES);

const EXPECTED_REPERTOIRE_WIDGET_COUNT = Object.values(
  REPERTOIRE_CATEGORIES,
).reduce((sum, widgets) => sum + widgets.length, 0);

// --------------- Barrel Index Files ---------------

const BARREL_INDEX_FILES = [
  // Framework barrel
  path.join(COMPONENTS_DIR, 'index.tsx'),
  // Widgets root barrel
  path.join(WIDGETS_DIR, 'index.tsx'),
  // Category barrels
  ...CATEGORY_NAMES.map((cat) => path.join(WIDGETS_DIR, cat, 'index.tsx')),
];

// ============================================================
// Tests
// ============================================================

describe('Ink Widgets File Structure', () => {
  describe('Total widget count', () => {
    it('has exactly 122 repertoire widgets across 8 categories', () => {
      expect(EXPECTED_REPERTOIRE_WIDGET_COUNT).toBe(122);
    });

    it('has exactly 8 repertoire categories', () => {
      expect(CATEGORY_NAMES).toHaveLength(8);
    });

    it('has exactly 14 framework components', () => {
      expect(FRAMEWORK_COMPONENTS).toHaveLength(14);
    });
  });

  describe('Framework component .tsx files', () => {
    for (const name of FRAMEWORK_COMPONENTS) {
      it(`${name}.tsx exists`, () => {
        const filePath = path.join(COMPONENTS_DIR, `${name}.tsx`);
        expect(
          fs.existsSync(filePath),
          `Missing framework component: ${filePath}`,
        ).toBe(true);
      });
    }
  });

  describe('Repertoire category directories', () => {
    for (const category of CATEGORY_NAMES) {
      it(`${category}/ directory exists`, () => {
        const dirPath = path.join(WIDGETS_DIR, category);
        expect(
          fs.existsSync(dirPath),
          `Missing category directory: ${dirPath}`,
        ).toBe(true);
        expect(
          fs.statSync(dirPath).isDirectory(),
          `Expected directory: ${dirPath}`,
        ).toBe(true);
      });
    }
  });

  describe('Repertoire widget .tsx files', () => {
    for (const [category, widgets] of Object.entries(REPERTOIRE_CATEGORIES)) {
      describe(`${category} (${widgets.length} widgets)`, () => {
        for (const widget of widgets) {
          it(`${widget}.tsx exists`, () => {
            const filePath = path.join(
              WIDGETS_DIR,
              category,
              `${widget}.tsx`,
            );
            expect(
              fs.existsSync(filePath),
              `Missing widget: ${filePath}`,
            ).toBe(true);
          });
        }
      });
    }
  });

  describe('Barrel index.tsx files', () => {
    it('framework barrel index.tsx exists', () => {
      const filePath = path.join(COMPONENTS_DIR, 'index.tsx');
      expect(
        fs.existsSync(filePath),
        `Missing framework barrel: ${filePath}`,
      ).toBe(true);
    });

    it('widgets root barrel index.tsx exists', () => {
      const filePath = path.join(WIDGETS_DIR, 'index.tsx');
      expect(
        fs.existsSync(filePath),
        `Missing widgets root barrel: ${filePath}`,
      ).toBe(true);
    });

    for (const category of CATEGORY_NAMES) {
      it(`${category}/index.tsx barrel exists`, () => {
        const filePath = path.join(WIDGETS_DIR, category, 'index.tsx');
        expect(
          fs.existsSync(filePath),
          `Missing category barrel: ${filePath}`,
        ).toBe(true);
      });
    }

    it('has exactly 10 barrel index files (1 framework + 1 widgets root + 8 categories)', () => {
      const existing = BARREL_INDEX_FILES.filter((f) => fs.existsSync(f));
      expect(existing).toHaveLength(10);
    });
  });

  describe('Component exports', () => {
    describe('Framework components export correctly', () => {
      for (const name of FRAMEWORK_COMPONENTS) {
        it(`${name}.tsx exports a component`, () => {
          const filePath = path.join(COMPONENTS_DIR, `${name}.tsx`);
          const content = fs.readFileSync(filePath, 'utf-8');
          const hasNamedExport =
            content.includes(`export const ${name}`) ||
            content.includes(`export { ${name}`) ||
            content.includes(`export function ${name}`);
          expect(
            hasNamedExport,
            `${name}.tsx does not export a component named ${name}`,
          ).toBe(true);
        });
      }
    });

    describe('Repertoire widgets export correctly', () => {
      for (const [category, widgets] of Object.entries(
        REPERTOIRE_CATEGORIES,
      )) {
        for (const widget of widgets) {
          it(`${category}/${widget}.tsx exports a component`, () => {
            const filePath = path.join(
              WIDGETS_DIR,
              category,
              `${widget}.tsx`,
            );
            const content = fs.readFileSync(filePath, 'utf-8');
            const hasNamedExport =
              content.includes(`export const ${widget}`) ||
              content.includes(`export { ${widget}`) ||
              content.includes(`export function ${widget}`);
            expect(
              hasNamedExport,
              `${widget}.tsx does not export a component named ${widget}`,
            ).toBe(true);
          });
        }
      }
    });
  });

  describe('displayName', () => {
    describe('Framework components set displayName', () => {
      for (const name of FRAMEWORK_COMPONENTS) {
        it(`${name}.tsx sets displayName`, () => {
          const filePath = path.join(COMPONENTS_DIR, `${name}.tsx`);
          const content = fs.readFileSync(filePath, 'utf-8');
          expect(
            content.includes('.displayName ='),
            `${name}.tsx does not set displayName`,
          ).toBe(true);
        });
      }
    });

    describe('Repertoire widgets set displayName', () => {
      for (const [category, widgets] of Object.entries(
        REPERTOIRE_CATEGORIES,
      )) {
        for (const widget of widgets) {
          it(`${category}/${widget}.tsx sets displayName`, () => {
            const filePath = path.join(
              WIDGETS_DIR,
              category,
              `${widget}.tsx`,
            );
            const content = fs.readFileSync(filePath, 'utf-8');
            expect(
              content.includes('.displayName ='),
              `${widget}.tsx does not set displayName`,
            ).toBe(true);
          });
        }
      }
    });
  });
});
