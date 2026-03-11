// ============================================================
// Widget Coverage Meta-Test
//
// Verifies that all 122 widgets exist in every DOM-based
// provider by checking the file system. Ensures no widget is
// missing from any provider and that widget names are
// consistent across all providers.
// ============================================================

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';

// ============================================================
// Constants
// ============================================================

const WIDGET_ROOT = join(__dirname, '..');

const CATEGORIES = [
  'primitives',
  'form-controls',
  'feedback',
  'navigation',
  'data-display',
  'composites',
  'complex-inputs',
  'domain',
] as const;

/**
 * All 122 widgets organized by category.
 * Each entry is [WidgetFileName, kebab-case-widget-name].
 */
const WIDGETS_BY_CATEGORY: Record<string, Array<[string, string]>> = {
  'primitives': [
    ['Avatar', 'avatar'],
    ['Button', 'button'],
    ['Checkbox', 'checkbox'],
    ['Chip', 'chip'],
    ['FocusTrap', 'focus-trap'],
    ['Icon', 'icon'],
    ['Label', 'label'],
    ['Portal', 'portal'],
    ['Presence', 'presence'],
    ['ScrollLock', 'scroll-lock'],
    ['Separator', 'separator'],
    ['Spinner', 'spinner'],
    ['TextInput', 'text-input'],
    ['VisuallyHidden', 'visually-hidden'],
  ],
  'form-controls': [
    ['Badge', 'badge'],
    ['CheckboxGroup', 'checkbox-group'],
    ['ChipInput', 'chip-input'],
    ['Combobox', 'combobox'],
    ['ComboboxMulti', 'combobox-multi'],
    ['MultiSelect', 'multi-select'],
    ['NumberInput', 'number-input'],
    ['ProgressBar', 'progress-bar'],
    ['RadioCard', 'radio-card'],
    ['RadioGroup', 'radio-group'],
    ['SegmentedControl', 'segmented-control'],
    ['Select', 'select'],
    ['Slider', 'slider'],
    ['Stepper', 'stepper'],
    ['Textarea', 'textarea'],
    ['ToggleSwitch', 'toggle-switch'],
  ],
  'feedback': [
    ['Alert', 'alert'],
    ['AlertDialog', 'alert-dialog'],
    ['ContextMenu', 'context-menu'],
    ['Dialog', 'dialog'],
    ['Drawer', 'drawer'],
    ['HoverCard', 'hover-card'],
    ['Popover', 'popover'],
    ['Toast', 'toast'],
    ['ToastManager', 'toast-manager'],
    ['Tooltip', 'tooltip'],
  ],
  'navigation': [
    ['Accordion', 'accordion'],
    ['Breadcrumb', 'breadcrumb'],
    ['CommandPalette', 'command-palette'],
    ['Disclosure', 'disclosure'],
    ['Fieldset', 'fieldset'],
    ['FloatingToolbar', 'floating-toolbar'],
    ['Form', 'form'],
    ['Menu', 'menu'],
    ['NavigationMenu', 'navigation-menu'],
    ['Pagination', 'pagination'],
    ['Sidebar', 'sidebar'],
    ['Splitter', 'splitter'],
    ['Tabs', 'tabs'],
    ['Toolbar', 'toolbar'],
  ],
  'data-display': [
    ['CalendarView', 'calendar-view'],
    ['Card', 'card'],
    ['CardGrid', 'card-grid'],
    ['Chart', 'chart'],
    ['DataList', 'data-list'],
    ['DataTable', 'data-table'],
    ['EmptyState', 'empty-state'],
    ['Gauge', 'gauge'],
    ['KanbanBoard', 'kanban-board'],
    ['List', 'list'],
    ['NotificationItem', 'notification-item'],
    ['Skeleton', 'skeleton'],
    ['StatCard', 'stat-card'],
    ['Timeline', 'timeline'],
    ['ViewToggle', 'view-toggle'],
  ],
  'composites': [
    ['BacklinkPanel', 'backlink-panel'],
    ['CacheDashboard', 'cache-dashboard'],
    ['DiffViewer', 'diff-viewer'],
    ['FacetedSearch', 'faceted-search'],
    ['FileBrowser', 'file-browser'],
    ['FilterBuilder', 'filter-builder'],
    ['MasterDetail', 'master-detail'],
    ['NotificationCenter', 'notification-center'],
    ['PermissionMatrix', 'permission-matrix'],
    ['PluginCard', 'plugin-card'],
    ['PreferenceMatrix', 'preference-matrix'],
    ['PropertyPanel', 'property-panel'],
    ['QueueDashboard', 'queue-dashboard'],
    ['SchemaEditor', 'schema-editor'],
    ['SortBuilder', 'sort-builder'],
    ['ViewSwitcher', 'view-switcher'],
  ],
  'complex-inputs': [
    ['ColorPicker', 'color-picker'],
    ['DatePicker', 'date-picker'],
    ['DateRangePicker', 'date-range-picker'],
    ['FileUpload', 'file-upload'],
    ['FormulaEditor', 'formula-editor'],
    ['MentionInput', 'mention-input'],
    ['PinInput', 'pin-input'],
    ['RangeSlider', 'range-slider'],
    ['Rating', 'rating'],
    ['RichTextEditor', 'rich-text-editor'],
    ['SignaturePad', 'signature-pad'],
    ['TreeSelect', 'tree-select'],
  ],
  'domain': [
    ['AutomationBuilder', 'automation-builder'],
    ['BlockEditor', 'block-editor'],
    ['Canvas', 'canvas'],
    ['CanvasConnector', 'canvas-connector'],
    ['CanvasNode', 'canvas-node'],
    ['CodeBlock', 'code-block'],
    ['ColorLabelPicker', 'color-label-picker'],
    ['ConditionBuilder', 'condition-builder'],
    ['CronEditor', 'cron-editor'],
    ['DragHandle', 'drag-handle'],
    ['FieldMapper', 'field-mapper'],
    ['GraphView', 'graph-view'],
    ['ImageGallery', 'image-gallery'],
    ['InlineEdit', 'inline-edit'],
    ['MarkdownPreview', 'markdown-preview'],
    ['Minimap', 'minimap'],
    ['Outliner', 'outliner'],
    ['PluginDetailPage', 'plugin-detail-page'],
    ['PolicyEditor', 'policy-editor'],
    ['SlashMenu', 'slash-menu'],
    ['StateMachineDiagram', 'state-machine-diagram'],
    ['StepIndicator', 'step-indicator'],
    ['TokenInput', 'token-input'],
    ['WorkflowEditor', 'workflow-editor'],
    ['WorkflowNode', 'workflow-node'],
  ],
};

/** Providers and their file extensions */
const PROVIDERS: Array<{ name: string; dir: string; ext: string }> = [
  { name: 'vanilla', dir: 'vanilla/components/widgets', ext: '.ts' },
  { name: 'solid', dir: 'solid/components/widgets', ext: '.ts' },
  { name: 'svelte', dir: 'svelte/components/widgets', ext: '.ts' },
  { name: 'react', dir: 'react/components/widgets', ext: '.tsx' },
  { name: 'vue', dir: 'vue/components/widgets', ext: '.ts' },
];

// ============================================================
// Tests
// ============================================================

describe('Widget Coverage', () => {
  // Count all widgets across categories
  const totalWidgets = Object.values(WIDGETS_BY_CATEGORY)
    .reduce((sum, widgets) => sum + widgets.length, 0);

  it('defines exactly 122 widgets across all categories', () => {
    expect(totalWidgets).toBe(122);
  });

  it('defines 8 categories', () => {
    expect(Object.keys(WIDGETS_BY_CATEGORY).length).toBe(8);
  });

  // ----------------------------------------------------------
  // Per-category widget count verification
  // ----------------------------------------------------------
  describe('category widget counts', () => {
    it('primitives has 14 widgets', () => {
      expect(WIDGETS_BY_CATEGORY['primitives'].length).toBe(14);
    });

    it('form-controls has 16 widgets', () => {
      expect(WIDGETS_BY_CATEGORY['form-controls'].length).toBe(16);
    });

    it('feedback has 10 widgets', () => {
      expect(WIDGETS_BY_CATEGORY['feedback'].length).toBe(10);
    });

    it('navigation has 14 widgets', () => {
      expect(WIDGETS_BY_CATEGORY['navigation'].length).toBe(14);
    });

    it('data-display has 15 widgets', () => {
      expect(WIDGETS_BY_CATEGORY['data-display'].length).toBe(15);
    });

    it('composites has 16 widgets', () => {
      expect(WIDGETS_BY_CATEGORY['composites'].length).toBe(16);
    });

    it('complex-inputs has 12 widgets', () => {
      expect(WIDGETS_BY_CATEGORY['complex-inputs'].length).toBe(12);
    });

    it('domain has 25 widgets', () => {
      expect(WIDGETS_BY_CATEGORY['domain'].length).toBe(25);
    });
  });

  // ----------------------------------------------------------
  // Per-provider: verify every widget file exists
  // ----------------------------------------------------------
  for (const provider of PROVIDERS) {
    describe(`${provider.name} provider`, () => {
      for (const category of CATEGORIES) {
        describe(category, () => {
          const widgets = WIDGETS_BY_CATEGORY[category];

          for (const [widgetFile, widgetName] of widgets) {
            it(`${widgetFile}${provider.ext} exists`, () => {
              const filePath = join(
                WIDGET_ROOT,
                provider.dir,
                category,
                `${widgetFile}${provider.ext}`,
              );
              expect(existsSync(filePath)).toBe(true);
            });
          }
        });
      }

      it(`has category index files`, () => {
        for (const category of CATEGORIES) {
          const indexPath = join(
            WIDGET_ROOT,
            provider.dir,
            category,
            'index.ts',
          );
          expect(existsSync(indexPath)).toBe(true);
        }
      });

      it(`has top-level index file`, () => {
        const indexPath = join(WIDGET_ROOT, provider.dir, 'index.ts');
        expect(existsSync(indexPath)).toBe(true);
      });
    });
  }

  // ----------------------------------------------------------
  // Cross-provider consistency
  // ----------------------------------------------------------
  describe('cross-provider consistency', () => {
    it('all providers have exactly 122 widget files', () => {
      for (const provider of PROVIDERS) {
        let count = 0;
        for (const category of CATEGORIES) {
          const widgets = WIDGETS_BY_CATEGORY[category];
          for (const [widgetFile] of widgets) {
            const filePath = join(
              WIDGET_ROOT,
              provider.dir,
              category,
              `${widgetFile}${provider.ext}`,
            );
            if (existsSync(filePath)) count++;
          }
        }
        expect(count).toBe(122);
      }
    });

    it('no widget is present in only some providers', () => {
      const missing: string[] = [];

      for (const category of CATEGORIES) {
        const widgets = WIDGETS_BY_CATEGORY[category];
        for (const [widgetFile] of widgets) {
          for (const provider of PROVIDERS) {
            const filePath = join(
              WIDGET_ROOT,
              provider.dir,
              category,
              `${widgetFile}${provider.ext}`,
            );
            if (!existsSync(filePath)) {
              missing.push(`${provider.name}/${category}/${widgetFile}${provider.ext}`);
            }
          }
        }
      }

      expect(missing).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // Widget naming convention validation
  // ----------------------------------------------------------
  describe('naming conventions', () => {
    it('all widget names are valid kebab-case', () => {
      const kebabPattern = /^[a-z]+(-[a-z]+)*$/;
      for (const category of CATEGORIES) {
        for (const [, widgetName] of WIDGETS_BY_CATEGORY[category]) {
          expect(
            kebabPattern.test(widgetName),
            `"${widgetName}" should be kebab-case`,
          ).toBe(true);
        }
      }
    });

    it('all file names are PascalCase', () => {
      const pascalPattern = /^[A-Z][a-zA-Z]*$/;
      for (const category of CATEGORIES) {
        for (const [fileName] of WIDGETS_BY_CATEGORY[category]) {
          expect(
            pascalPattern.test(fileName),
            `"${fileName}" should be PascalCase`,
          ).toBe(true);
        }
      }
    });

    it('widget-name derives correctly from PascalCase file name', () => {
      // PascalCase -> kebab-case conversion
      function toKebab(pascal: string): string {
        return pascal
          .replace(/([a-z])([A-Z])/g, '$1-$2')
          .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
          .toLowerCase();
      }

      for (const category of CATEGORIES) {
        for (const [fileName, widgetName] of WIDGETS_BY_CATEGORY[category]) {
          expect(toKebab(fileName)).toBe(widgetName);
        }
      }
    });
  });

  // ----------------------------------------------------------
  // Shared infrastructure
  // ----------------------------------------------------------
  describe('shared infrastructure', () => {
    it('surface-bridge.ts exists', () => {
      expect(existsSync(join(WIDGET_ROOT, 'shared', 'surface-bridge.ts'))).toBe(true);
    });

    it('types.ts exists', () => {
      expect(existsSync(join(WIDGET_ROOT, 'shared', 'types.ts'))).toBe(true);
    });

    it('test-helpers.ts exists', () => {
      expect(existsSync(join(WIDGET_ROOT, 'shared', 'test-helpers.ts'))).toBe(true);
    });

    it('index.ts exists at widget root', () => {
      expect(existsSync(join(WIDGET_ROOT, 'index.ts'))).toBe(true);
    });
  });
});
