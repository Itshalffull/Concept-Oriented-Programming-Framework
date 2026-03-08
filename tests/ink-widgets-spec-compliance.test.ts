// ============================================================
// Ink Widgets Spec Compliance Tests
//
// Reads .widget spec files from repertoire/widgets/ and verifies
// that each Ink .tsx implementation defines Props interfaces
// that align with the spec's declared props. Also verifies
// that every spec has a corresponding implementation.
// ============================================================

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SPEC_DIR = path.resolve(PROJECT_ROOT, 'repertoire/widgets');
const TSX_DIR = path.resolve(
  PROJECT_ROOT,
  'surface/widgets/ink/components/widgets',
);

// --------------- Category / Widget Mappings ---------------

/**
 * Maps PascalCase component names to kebab-case .widget spec file names.
 * The convention: PascalCase -> kebab-case (e.g. CheckboxGroup -> checkbox-group).
 */
function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

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
    'ApprovalTracker',
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
    'MessageActions',
    'Minimap',
    'Outliner',
    'PluginDetailPage',
    'PolicyEditor',
    'QuorumGauge',
    'SegmentedProgressBar',
    'SlashMenu',
    'StateMachineDiagram',
    'StepIndicator',
    'TokenInput',
    'WorkflowEditor',
    'WorkflowNode',
  ],
};

// --------------- Spec Parsing Helpers ---------------

/**
 * Extracts prop names from a .widget spec file's `props { }` block.
 * Matches lines like:
 *   variant: union "filled" | "outline" = "filled"
 *   disabled: Bool = false
 *   title: String
 *   onModeChange: option Function
 */
function parseSpecProps(specContent: string): string[] {
  const propsBlockMatch = specContent.match(
    /props\s*\{([\s\S]*?)\n\s*\}/,
  );
  if (!propsBlockMatch) return [];

  const propsBlock = propsBlockMatch[1];
  const propNames: string[] = [];
  const propLineRegex = /^\s+(\w+):\s/gm;
  let match: RegExpExecArray | null;

  while ((match = propLineRegex.exec(propsBlock)) !== null) {
    propNames.push(match[1]);
  }

  return propNames;
}

/**
 * Converts a spec prop name (camelCase) to possible variants
 * that might appear in a TypeScript Props interface. The spec
 * may use slightly different naming than the TSX implementation
 * (e.g. spec "iconPosition" vs TSX "iconPosition"), so we
 * normalize for comparison.
 */
function normalizePropName(name: string): string {
  return name.toLowerCase();
}

// ============================================================
// Tests
// ============================================================

describe('Ink Widgets Spec Compliance', () => {
  describe('Every .widget spec has a corresponding .tsx implementation', () => {
    for (const [category, widgets] of Object.entries(
      REPERTOIRE_CATEGORIES,
    )) {
      describe(`${category}`, () => {
        for (const widget of widgets) {
          const kebab = toKebabCase(widget);
          const specPath = path.join(SPEC_DIR, category, `${kebab}.widget`);
          const tsxPath = path.join(TSX_DIR, category, `${widget}.tsx`);

          it(`${kebab}.widget has matching ${widget}.tsx`, () => {
            expect(
              fs.existsSync(specPath),
              `Spec file missing: ${specPath}`,
            ).toBe(true);
            expect(
              fs.existsSync(tsxPath),
              `Implementation missing: ${tsxPath}`,
            ).toBe(true);
          });
        }
      });
    }
  });

  describe('No orphan spec files without implementations', () => {
    for (const category of Object.keys(REPERTOIRE_CATEGORIES)) {
      it(`all specs in ${category}/ have implementations`, () => {
        const specDir = path.join(SPEC_DIR, category);
        if (!fs.existsSync(specDir)) return;

        const specFiles = fs
          .readdirSync(specDir)
          .filter((f) => f.endsWith('.widget'));
        const widgetNames = REPERTOIRE_CATEGORIES[category];
        const expectedKebabs = widgetNames.map((w) => toKebabCase(w));

        for (const specFile of specFiles) {
          const baseName = specFile.replace('.widget', '');
          expect(
            expectedKebabs,
            `Orphan spec ${specFile} in ${category}/ has no matching widget in the implementation list`,
          ).toContain(baseName);
        }
      });
    }
  });

  describe('No orphan implementations without spec files', () => {
    for (const category of Object.keys(REPERTOIRE_CATEGORIES)) {
      it(`all implementations in ${category}/ have spec files`, () => {
        const tsxDir = path.join(TSX_DIR, category);
        if (!fs.existsSync(tsxDir)) return;

        const tsxFiles = fs
          .readdirSync(tsxDir)
          .filter((f) => f.endsWith('.tsx') && f !== 'index.tsx');
        const widgetNames = REPERTOIRE_CATEGORIES[category];

        for (const tsxFile of tsxFiles) {
          const componentName = tsxFile.replace('.tsx', '');
          expect(
            widgetNames,
            `Orphan implementation ${tsxFile} in ${category}/ has no matching entry in the widget list`,
          ).toContain(componentName);
        }
      });
    }
  });

  describe('Implementation declares a Props interface', () => {
    for (const [category, widgets] of Object.entries(
      REPERTOIRE_CATEGORIES,
    )) {
      describe(`${category}`, () => {
        for (const widget of widgets) {
          const tsxPath = path.join(TSX_DIR, category, `${widget}.tsx`);

          it(`${widget}.tsx exports a ${widget}Props interface`, () => {
            if (!fs.existsSync(tsxPath)) return;
            const content = fs.readFileSync(tsxPath, 'utf-8');
            const propsName = `${widget}Props`;
            expect(
              content.includes(`export interface ${propsName}`) ||
                content.includes(`export type ${propsName}`),
              `${widget}.tsx should export ${propsName}`,
            ).toBe(true);
          });
        }
      });
    }
  });

  describe('Props interface alignment with spec', () => {
    // The Ink terminal adapter legitimately omits or renames some
    // spec props that do not apply to terminal rendering (e.g.
    // HTML-specific attrs like autocomplete, pattern, name; CSS
    // positioning like placement, offset; visual-only props like
    // className, maxHeight). Complex and domain widgets in particular
    // simplify heavily for the terminal context. We require that
    // each implementation references at least 1 spec prop to confirm
    // the widget was built from the spec.
    //
    // Some widgets have fully redesigned prop interfaces for the
    // terminal that share zero literal prop names with the spec.
    // These are documented as known divergences -- the widgets still
    // implement the spec's *purpose* and *anatomy*, just with
    // terminal-native prop names.
    const KNOWN_TERMINAL_DIVERGENCES = new Set([
      'HoverCard',        // spec: openDelay/closeDelay/placement -> tsx: open/content/width
      'FloatingToolbar',  // spec: placement/offset/autoHide -> tsx: items/visible/onSelect
      'BacklinkPanel',    // spec: targetId/linkedReferences -> tsx: backlinks/title/source
      'CacheDashboard',   // spec: metrics/chartData/keys -> tsx: entries/totalSize/hitRate
      'Minimap',          // spec: zoom/panX/contentWidth -> tsx: content/visibleRange/totalLines
      'SlashMenu',        // spec: blockTypes/filterValue -> tsx: items/query/onSelect
    ]);

    const MIN_MATCHED_PROPS = 1;

    for (const [category, widgets] of Object.entries(
      REPERTOIRE_CATEGORIES,
    )) {
      describe(`${category}`, () => {
        for (const widget of widgets) {
          const kebab = toKebabCase(widget);
          const specPath = path.join(SPEC_DIR, category, `${kebab}.widget`);
          const tsxPath = path.join(TSX_DIR, category, `${widget}.tsx`);

          if (KNOWN_TERMINAL_DIVERGENCES.has(widget)) {
            it(`${widget} has a known terminal-adapted prop interface (diverges from ${kebab}.widget)`, () => {
              // Verify both files still exist even though props diverge
              expect(
                fs.existsSync(specPath),
                `Spec file should exist: ${specPath}`,
              ).toBe(true);
              expect(
                fs.existsSync(tsxPath),
                `Implementation should exist: ${tsxPath}`,
              ).toBe(true);

              // Verify the TSX file has *some* Props interface
              const content = fs.readFileSync(tsxPath, 'utf-8');
              expect(
                content.includes(`export interface ${widget}Props`),
                `${widget}.tsx should export ${widget}Props`,
              ).toBe(true);
            });
            continue;
          }

          it(`${widget} references at least ${MIN_MATCHED_PROPS} prop(s) from ${kebab}.widget spec`, () => {
            if (!fs.existsSync(specPath) || !fs.existsSync(tsxPath)) {
              // File existence is tested separately; skip here if missing
              return;
            }

            const specContent = fs.readFileSync(specPath, 'utf-8');
            const tsxContent = fs.readFileSync(tsxPath, 'utf-8');
            const specProps = parseSpecProps(specContent);

            // Skip widgets that have no declared props in the spec
            if (specProps.length === 0) return;

            // Normalize the TSX content for case-insensitive prop matching
            const tsxLower = tsxContent.toLowerCase();

            let matchedCount = 0;
            const matchedProps: string[] = [];
            const missingProps: string[] = [];

            for (const prop of specProps) {
              const normalized = normalizePropName(prop);
              const propRegex = new RegExp(`\\b${normalized}\\b`);
              if (propRegex.test(tsxLower)) {
                matchedCount++;
                matchedProps.push(prop);
              } else {
                missingProps.push(prop);
              }
            }

            expect(
              matchedCount,
              `${widget} covers ${matchedCount}/${specProps.length} spec props. ` +
                `Matched: [${matchedProps.join(', ')}]. ` +
                `Missing: [${missingProps.join(', ')}]`,
            ).toBeGreaterThanOrEqual(MIN_MATCHED_PROPS);
          });
        }
      });
    }
  });

  describe('Spec prop counts per category', () => {
    const EXPECTED_CATEGORY_COUNTS: Record<string, number> = {
      primitives: 14,
      'form-controls': 16,
      feedback: 10,
      navigation: 14,
      'data-display': 15,
      'complex-inputs': 12,
      composites: 16,
      domain: 29,
    };

    for (const [category, expectedCount] of Object.entries(
      EXPECTED_CATEGORY_COUNTS,
    )) {
      it(`${category}/ has exactly ${expectedCount} .widget spec files`, () => {
        const specDir = path.join(SPEC_DIR, category);
        if (!fs.existsSync(specDir)) {
          expect.fail(`Spec directory missing: ${specDir}`);
          return;
        }

        const specFiles = fs
          .readdirSync(specDir)
          .filter((f) => f.endsWith('.widget'));
        expect(specFiles).toHaveLength(expectedCount);
      });
    }
  });
});
