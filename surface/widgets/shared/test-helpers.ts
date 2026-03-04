// ============================================================
// Clef Surface Widget Test Helpers
//
// Shared utilities for testing widget components across all
// providers. Provides DOM assertions, mock signals, and
// accessibility verification helpers.
// ============================================================

import type { Signal, WritableSignal, BindingConfig, WidgetSpec } from './types.js';

// --- Mock Signal ---

export function createMockSignal<T>(initial: T): WritableSignal<T> {
  let value = initial;
  const listeners = new Set<(v: T) => void>();

  return {
    id: `mock-signal-${Math.random().toString(36).slice(2, 8)}`,
    get: () => value,
    set: (v: T) => {
      value = v;
      for (const fn of listeners) fn(v);
    },
    update: (fn: (prev: T) => T) => {
      value = fn(value);
      for (const fn of listeners) fn(value);
    },
    subscribe: (listener: (v: T) => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

// --- Mock Binding Config ---

export function createMockBindingConfig(overrides?: Partial<BindingConfig>): BindingConfig {
  return {
    concept: 'test-concept',
    mode: 'static',
    signalMap: {},
    ...overrides,
  };
}

// --- Mock Widget Spec ---

export function createMockWidgetSpec(name: string, overrides?: Partial<WidgetSpec>): WidgetSpec {
  return {
    name,
    anatomy: { parts: ['root'] },
    machineSpec: {
      initial: 'idle',
      states: {
        idle: { on: { ACTIVATE: 'active' } },
        active: { on: { DEACTIVATE: 'idle' } },
      },
    },
    a11ySpec: {},
    ...overrides,
  };
}

// --- DOM Assertions ---

export function assertDataAttributes(
  el: Element,
  expected: Record<string, string>,
): void {
  for (const [attr, value] of Object.entries(expected)) {
    const actual = el.getAttribute(attr);
    if (actual !== value) {
      throw new Error(
        `Expected ${attr}="${value}" but got ${attr}="${actual}" on <${el.tagName.toLowerCase()}>`,
      );
    }
  }
}

export function assertAriaAttributes(
  el: Element,
  expected: Record<string, string>,
): void {
  for (const [attr, value] of Object.entries(expected)) {
    const actual = el.getAttribute(attr);
    if (actual !== value) {
      throw new Error(
        `Expected ${attr}="${value}" but got ${attr}="${actual}" on <${el.tagName.toLowerCase()}>`,
      );
    }
  }
}

export function assertPartExists(root: Element, partName: string): Element {
  const el = root.querySelector(`[data-part="${partName}"]`);
  if (!el) {
    throw new Error(`Expected part "${partName}" to exist within ${root.tagName.toLowerCase()}`);
  }
  return el;
}

export function assertWidgetRoot(
  el: Element,
  widgetName: string,
): void {
  assertDataAttributes(el, {
    'data-surface-widget': '',
    'data-widget-name': widgetName,
    'data-part': 'root',
  });
}

// --- Event Simulation ---

export function simulateClick(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

export function simulateKeyDown(el: Element, key: string, opts?: Partial<KeyboardEvent>): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
}

export function simulateKeyUp(el: Element, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
}

export function simulateInput(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function simulateFocus(el: Element): void {
  el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
}

export function simulateBlur(el: Element): void {
  el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
}

export function simulateMouseEnter(el: Element): void {
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
}

export function simulateMouseLeave(el: Element): void {
  el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
}

// --- Provider-specific Container ---

export function createTestContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.id = `test-container-${Math.random().toString(36).slice(2, 8)}`;
  document.body.appendChild(container);
  return container;
}

export function cleanupTestContainer(container: HTMLDivElement): void {
  container.remove();
}

// --- Widget List by Category ---

export const WIDGET_CATEGORIES = {
  primitives: [
    'Avatar', 'Button', 'Checkbox', 'Chip', 'FocusTrap', 'Icon', 'Label',
    'Portal', 'Presence', 'ScrollLock', 'Separator', 'Spinner', 'TextInput', 'VisuallyHidden',
  ],
  'form-controls': [
    'Badge', 'CheckboxGroup', 'ChipInput', 'Combobox', 'ComboboxMulti', 'MultiSelect',
    'NumberInput', 'ProgressBar', 'RadioCard', 'RadioGroup', 'SegmentedControl', 'Select',
    'Slider', 'Stepper', 'Textarea', 'ToggleSwitch',
  ],
  feedback: [
    'Alert', 'AlertDialog', 'ContextMenu', 'Dialog', 'Drawer',
    'HoverCard', 'Popover', 'Toast', 'ToastManager', 'Tooltip',
  ],
  navigation: [
    'Accordion', 'Breadcrumb', 'CommandPalette', 'Disclosure', 'Fieldset',
    'FloatingToolbar', 'Form', 'Menu', 'NavigationMenu', 'Pagination',
    'Sidebar', 'Splitter', 'Tabs', 'Toolbar',
  ],
  'data-display': [
    'CalendarView', 'Card', 'CardGrid', 'Chart', 'DataList', 'DataTable',
    'EmptyState', 'Gauge', 'KanbanBoard', 'List', 'NotificationItem',
    'Skeleton', 'StatCard', 'Timeline', 'ViewToggle',
  ],
  'complex-inputs': [
    'ColorPicker', 'DatePicker', 'DateRangePicker', 'FileUpload', 'FormulaEditor',
    'MentionInput', 'PinInput', 'RangeSlider', 'Rating', 'RichTextEditor',
    'SignaturePad', 'TreeSelect',
  ],
  composites: [
    'BacklinkPanel', 'CacheDashboard', 'DiffViewer', 'FacetedSearch', 'FileBrowser',
    'FilterBuilder', 'MasterDetail', 'NotificationCenter', 'PermissionMatrix', 'PluginCard',
    'PreferenceMatrix', 'PropertyPanel', 'QueueDashboard', 'SchemaEditor', 'SortBuilder', 'ViewSwitcher',
  ],
  domain: [
    'AutomationBuilder', 'BlockEditor', 'Canvas', 'CanvasConnector', 'CanvasNode',
    'CodeBlock', 'ColorLabelPicker', 'ConditionBuilder', 'CronEditor', 'DragHandle',
    'FieldMapper', 'GraphView', 'ImageGallery', 'InlineEdit', 'MarkdownPreview',
    'Minimap', 'Outliner', 'PluginDetailPage', 'PolicyEditor', 'SlashMenu',
    'StateMachineDiagram', 'StepIndicator', 'TokenInput', 'WorkflowEditor', 'WorkflowNode',
  ],
} as const;

export type WidgetCategory = keyof typeof WIDGET_CATEGORIES;

export const ALL_PROVIDERS = ['react', 'vue', 'svelte', 'solid', 'vanilla', 'ink', 'nextjs', 'nativescript', 'compose'] as const;
export type ProviderName = (typeof ALL_PROVIDERS)[number];
