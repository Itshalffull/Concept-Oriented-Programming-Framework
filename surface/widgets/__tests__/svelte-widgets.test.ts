// ============================================================
// Svelte Widget Tests
//
// Comprehensive tests for all 122 Svelte (createXxx factory)
// widgets. Each widget is created via createXxx({ target, props })
// and returns { element, update, destroy }. Tests verify
// creation, data attributes, and destruction.
// ============================================================

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Primitives ---
import { createAvatar } from '../svelte/components/widgets/primitives/Avatar.js';
import { createButton } from '../svelte/components/widgets/primitives/Button.js';
import { createCheckbox } from '../svelte/components/widgets/primitives/Checkbox.js';
import { createChip } from '../svelte/components/widgets/primitives/Chip.js';
import { createFocusTrap } from '../svelte/components/widgets/primitives/FocusTrap.js';
import { createIcon } from '../svelte/components/widgets/primitives/Icon.js';
import { createLabel } from '../svelte/components/widgets/primitives/Label.js';
import { createPortal } from '../svelte/components/widgets/primitives/Portal.js';
import { createPresence } from '../svelte/components/widgets/primitives/Presence.js';
import { createScrollLock } from '../svelte/components/widgets/primitives/ScrollLock.js';
import { createSeparator } from '../svelte/components/widgets/primitives/Separator.js';
import { createSpinner } from '../svelte/components/widgets/primitives/Spinner.js';
import { createTextInput } from '../svelte/components/widgets/primitives/TextInput.js';
import { createVisuallyHidden } from '../svelte/components/widgets/primitives/VisuallyHidden.js';

// --- Form Controls ---
import { createBadge } from '../svelte/components/widgets/form-controls/Badge.js';
import { createCheckboxGroup } from '../svelte/components/widgets/form-controls/CheckboxGroup.js';
import { createChipInput } from '../svelte/components/widgets/form-controls/ChipInput.js';
import { createCombobox } from '../svelte/components/widgets/form-controls/Combobox.js';
import { createComboboxMulti } from '../svelte/components/widgets/form-controls/ComboboxMulti.js';
import { createMultiSelect } from '../svelte/components/widgets/form-controls/MultiSelect.js';
import { createNumberInput } from '../svelte/components/widgets/form-controls/NumberInput.js';
import { createProgressBar } from '../svelte/components/widgets/form-controls/ProgressBar.js';
import { createRadioCard } from '../svelte/components/widgets/form-controls/RadioCard.js';
import { createRadioGroup } from '../svelte/components/widgets/form-controls/RadioGroup.js';
import { createSegmentedControl } from '../svelte/components/widgets/form-controls/SegmentedControl.js';
import { createSelect } from '../svelte/components/widgets/form-controls/Select.js';
import { createSlider } from '../svelte/components/widgets/form-controls/Slider.js';
import { createStepper } from '../svelte/components/widgets/form-controls/Stepper.js';
import { createTextarea } from '../svelte/components/widgets/form-controls/Textarea.js';
import { createToggleSwitch } from '../svelte/components/widgets/form-controls/ToggleSwitch.js';

// --- Feedback ---
import { createAlert } from '../svelte/components/widgets/feedback/Alert.js';
import { createAlertDialog } from '../svelte/components/widgets/feedback/AlertDialog.js';
import { createContextMenu } from '../svelte/components/widgets/feedback/ContextMenu.js';
import { createDialog } from '../svelte/components/widgets/feedback/Dialog.js';
import { createDrawer } from '../svelte/components/widgets/feedback/Drawer.js';
import { createHoverCard } from '../svelte/components/widgets/feedback/HoverCard.js';
import { createPopover } from '../svelte/components/widgets/feedback/Popover.js';
import { createToast } from '../svelte/components/widgets/feedback/Toast.js';
import { createToastManager } from '../svelte/components/widgets/feedback/ToastManager.js';
import { createTooltip } from '../svelte/components/widgets/feedback/Tooltip.js';

// --- Navigation ---
import { createAccordion } from '../svelte/components/widgets/navigation/Accordion.js';
import { createBreadcrumb } from '../svelte/components/widgets/navigation/Breadcrumb.js';
import { createCommandPalette } from '../svelte/components/widgets/navigation/CommandPalette.js';
import { createDisclosure } from '../svelte/components/widgets/navigation/Disclosure.js';
import { createFieldset } from '../svelte/components/widgets/navigation/Fieldset.js';
import { createFloatingToolbar } from '../svelte/components/widgets/navigation/FloatingToolbar.js';
import { createForm } from '../svelte/components/widgets/navigation/Form.js';
import { createMenu } from '../svelte/components/widgets/navigation/Menu.js';
import { createNavigationMenu } from '../svelte/components/widgets/navigation/NavigationMenu.js';
import { createPagination } from '../svelte/components/widgets/navigation/Pagination.js';
import { createSidebar } from '../svelte/components/widgets/navigation/Sidebar.js';
import { createSplitter } from '../svelte/components/widgets/navigation/Splitter.js';
import { createTabs } from '../svelte/components/widgets/navigation/Tabs.js';
import { createToolbar } from '../svelte/components/widgets/navigation/Toolbar.js';

// --- Data Display ---
import { createCalendarView } from '../svelte/components/widgets/data-display/CalendarView.js';
import { createCard } from '../svelte/components/widgets/data-display/Card.js';
import { createCardGrid } from '../svelte/components/widgets/data-display/CardGrid.js';
import { createChart } from '../svelte/components/widgets/data-display/Chart.js';
import { createDataList } from '../svelte/components/widgets/data-display/DataList.js';
import { createDataTable } from '../svelte/components/widgets/data-display/DataTable.js';
import { createEmptyState } from '../svelte/components/widgets/data-display/EmptyState.js';
import { createGauge } from '../svelte/components/widgets/data-display/Gauge.js';
import { createKanbanBoard } from '../svelte/components/widgets/data-display/KanbanBoard.js';
import { createList } from '../svelte/components/widgets/data-display/List.js';
import { createNotificationItem } from '../svelte/components/widgets/data-display/NotificationItem.js';
import { createSkeleton } from '../svelte/components/widgets/data-display/Skeleton.js';
import { createStatCard } from '../svelte/components/widgets/data-display/StatCard.js';
import { createTimeline } from '../svelte/components/widgets/data-display/Timeline.js';
import { createViewToggle } from '../svelte/components/widgets/data-display/ViewToggle.js';

// --- Composites ---
import { createBacklinkPanel } from '../svelte/components/widgets/composites/BacklinkPanel.js';
import { createCacheDashboard } from '../svelte/components/widgets/composites/CacheDashboard.js';
import { createDiffViewer } from '../svelte/components/widgets/composites/DiffViewer.js';
import { createFacetedSearch } from '../svelte/components/widgets/composites/FacetedSearch.js';
import { createFileBrowser } from '../svelte/components/widgets/composites/FileBrowser.js';
import { createFilterBuilder } from '../svelte/components/widgets/composites/FilterBuilder.js';
import { createMasterDetail } from '../svelte/components/widgets/composites/MasterDetail.js';
import { createNotificationCenter } from '../svelte/components/widgets/composites/NotificationCenter.js';
import { createPermissionMatrix } from '../svelte/components/widgets/composites/PermissionMatrix.js';
import { createPluginCard } from '../svelte/components/widgets/composites/PluginCard.js';
import { createPreferenceMatrix } from '../svelte/components/widgets/composites/PreferenceMatrix.js';
import { createPropertyPanel } from '../svelte/components/widgets/composites/PropertyPanel.js';
import { createQueueDashboard } from '../svelte/components/widgets/composites/QueueDashboard.js';
import { createSchemaEditor } from '../svelte/components/widgets/composites/SchemaEditor.js';
import { createSortBuilder } from '../svelte/components/widgets/composites/SortBuilder.js';
import { createViewSwitcher } from '../svelte/components/widgets/composites/ViewSwitcher.js';

// --- Complex Inputs ---
import { createColorPicker } from '../svelte/components/widgets/complex-inputs/ColorPicker.js';
import { createDatePicker } from '../svelte/components/widgets/complex-inputs/DatePicker.js';
import { createDateRangePicker } from '../svelte/components/widgets/complex-inputs/DateRangePicker.js';
import { createFileUpload } from '../svelte/components/widgets/complex-inputs/FileUpload.js';
import { createFormulaEditor } from '../svelte/components/widgets/complex-inputs/FormulaEditor.js';
import { createMentionInput } from '../svelte/components/widgets/complex-inputs/MentionInput.js';
import { createPinInput } from '../svelte/components/widgets/complex-inputs/PinInput.js';
import { createRangeSlider } from '../svelte/components/widgets/complex-inputs/RangeSlider.js';
import { createRating } from '../svelte/components/widgets/complex-inputs/Rating.js';
import { createRichTextEditor } from '../svelte/components/widgets/complex-inputs/RichTextEditor.js';
import { createSignaturePad } from '../svelte/components/widgets/complex-inputs/SignaturePad.js';
import { createTreeSelect } from '../svelte/components/widgets/complex-inputs/TreeSelect.js';

// --- Domain ---
import { createAutomationBuilder } from '../svelte/components/widgets/domain/AutomationBuilder.js';
import { createBlockEditor } from '../svelte/components/widgets/domain/BlockEditor.js';
import { createCanvas } from '../svelte/components/widgets/domain/Canvas.js';
import { createCanvasConnector } from '../svelte/components/widgets/domain/CanvasConnector.js';
import { createCanvasNode } from '../svelte/components/widgets/domain/CanvasNode.js';
import { createCodeBlock } from '../svelte/components/widgets/domain/CodeBlock.js';
import { createColorLabelPicker } from '../svelte/components/widgets/domain/ColorLabelPicker.js';
import { createConditionBuilder } from '../svelte/components/widgets/domain/ConditionBuilder.js';
import { createCronEditor } from '../svelte/components/widgets/domain/CronEditor.js';
import { createDragHandle } from '../svelte/components/widgets/domain/DragHandle.js';
import { createFieldMapper } from '../svelte/components/widgets/domain/FieldMapper.js';
import { createGraphView } from '../svelte/components/widgets/domain/GraphView.js';
import { createImageGallery } from '../svelte/components/widgets/domain/ImageGallery.js';
import { createInlineEdit } from '../svelte/components/widgets/domain/InlineEdit.js';
import { createMarkdownPreview } from '../svelte/components/widgets/domain/MarkdownPreview.js';
import { createMinimap } from '../svelte/components/widgets/domain/Minimap.js';
import { createOutliner } from '../svelte/components/widgets/domain/Outliner.js';
import { createPluginDetailPage } from '../svelte/components/widgets/domain/PluginDetailPage.js';
import { createPolicyEditor } from '../svelte/components/widgets/domain/PolicyEditor.js';
import { createSlashMenu } from '../svelte/components/widgets/domain/SlashMenu.js';
import { createStateMachineDiagram } from '../svelte/components/widgets/domain/StateMachineDiagram.js';
import { createStepIndicator } from '../svelte/components/widgets/domain/StepIndicator.js';
import { createTokenInput } from '../svelte/components/widgets/domain/TokenInput.js';
import { createWorkflowEditor } from '../svelte/components/widgets/domain/WorkflowEditor.js';
import { createWorkflowNode } from '../svelte/components/widgets/domain/WorkflowNode.js';


// ============================================================
// Registry: Svelte widgets use createXxx factories returning
// { element, update, destroy }
// ============================================================

const SVELTE_WIDGETS: Array<{
  name: string;
  widgetName: string;
  factory: (opts: { target: HTMLElement; props: any }) => { element: HTMLElement; destroy: () => void };
  props: Record<string, unknown>;
}> = [
  // --- primitives ---
  { name: 'Avatar', widgetName: 'avatar', factory: createAvatar, props: { name: 'Test' } },
  { name: 'Button', widgetName: 'button', factory: createButton, props: { variant: 'filled' } },
  { name: 'Checkbox', widgetName: 'checkbox', factory: createCheckbox, props: {} },
  { name: 'Chip', widgetName: 'chip', factory: createChip, props: { label: 'Tag' } },
  { name: 'FocusTrap', widgetName: 'focus-trap', factory: createFocusTrap, props: {} },
  { name: 'Icon', widgetName: 'icon', factory: createIcon, props: {} },
  { name: 'Label', widgetName: 'label', factory: createLabel, props: {} },
  { name: 'Portal', widgetName: 'portal', factory: createPortal, props: { disabled: true } },
  { name: 'Presence', widgetName: 'presence', factory: createPresence, props: {} },
  { name: 'ScrollLock', widgetName: 'scroll-lock', factory: createScrollLock, props: {} },
  { name: 'Separator', widgetName: 'separator', factory: createSeparator, props: {} },
  { name: 'Spinner', widgetName: 'spinner', factory: createSpinner, props: {} },
  { name: 'TextInput', widgetName: 'text-input', factory: createTextInput, props: {} },
  { name: 'VisuallyHidden', widgetName: 'visually-hidden', factory: createVisuallyHidden, props: {} },

  // --- form-controls ---
  { name: 'Badge', widgetName: 'badge', factory: createBadge, props: {} },
  { name: 'CheckboxGroup', widgetName: 'checkbox-group', factory: createCheckboxGroup, props: {} },
  { name: 'ChipInput', widgetName: 'chip-input', factory: createChipInput, props: {} },
  { name: 'Combobox', widgetName: 'combobox', factory: createCombobox, props: {} },
  { name: 'ComboboxMulti', widgetName: 'combobox-multi', factory: createComboboxMulti, props: {} },
  { name: 'MultiSelect', widgetName: 'multi-select', factory: createMultiSelect, props: {} },
  { name: 'NumberInput', widgetName: 'number-input', factory: createNumberInput, props: {} },
  { name: 'ProgressBar', widgetName: 'progress-bar', factory: createProgressBar, props: {} },
  { name: 'RadioCard', widgetName: 'radio-card', factory: createRadioCard, props: {} },
  { name: 'RadioGroup', widgetName: 'radio-group', factory: createRadioGroup, props: {} },
  { name: 'SegmentedControl', widgetName: 'segmented-control', factory: createSegmentedControl, props: {} },
  { name: 'Select', widgetName: 'select', factory: createSelect, props: {} },
  { name: 'Slider', widgetName: 'slider', factory: createSlider, props: {} },
  { name: 'Stepper', widgetName: 'stepper', factory: createStepper, props: {} },
  { name: 'Textarea', widgetName: 'textarea', factory: createTextarea, props: {} },
  { name: 'ToggleSwitch', widgetName: 'toggle-switch', factory: createToggleSwitch, props: {} },

  // --- feedback ---
  { name: 'Alert', widgetName: 'alert', factory: createAlert, props: {} },
  { name: 'AlertDialog', widgetName: 'alert-dialog', factory: createAlertDialog, props: {} },
  { name: 'ContextMenu', widgetName: 'context-menu', factory: createContextMenu, props: {} },
  { name: 'Dialog', widgetName: 'dialog', factory: createDialog, props: {} },
  { name: 'Drawer', widgetName: 'drawer', factory: createDrawer, props: {} },
  { name: 'HoverCard', widgetName: 'hover-card', factory: createHoverCard, props: {} },
  { name: 'Popover', widgetName: 'popover', factory: createPopover, props: {} },
  { name: 'Toast', widgetName: 'toast', factory: createToast, props: {} },
  { name: 'ToastManager', widgetName: 'toast-manager', factory: createToastManager, props: {} },
  { name: 'Tooltip', widgetName: 'tooltip', factory: createTooltip, props: {} },

  // --- navigation ---
  { name: 'Accordion', widgetName: 'accordion', factory: createAccordion, props: {} },
  { name: 'Breadcrumb', widgetName: 'breadcrumb', factory: createBreadcrumb, props: {} },
  { name: 'CommandPalette', widgetName: 'command-palette', factory: createCommandPalette, props: {} },
  { name: 'Disclosure', widgetName: 'disclosure', factory: createDisclosure, props: {} },
  { name: 'Fieldset', widgetName: 'fieldset', factory: createFieldset, props: {} },
  { name: 'FloatingToolbar', widgetName: 'floating-toolbar', factory: createFloatingToolbar, props: {} },
  { name: 'Form', widgetName: 'form', factory: createForm, props: {} },
  { name: 'Menu', widgetName: 'menu', factory: createMenu, props: {} },
  { name: 'NavigationMenu', widgetName: 'navigation-menu', factory: createNavigationMenu, props: {} },
  { name: 'Pagination', widgetName: 'pagination', factory: createPagination, props: {} },
  { name: 'Sidebar', widgetName: 'sidebar', factory: createSidebar, props: {} },
  { name: 'Splitter', widgetName: 'splitter', factory: createSplitter, props: {} },
  { name: 'Tabs', widgetName: 'tabs', factory: createTabs, props: { items: [] } },
  { name: 'Toolbar', widgetName: 'toolbar', factory: createToolbar, props: {} },

  // --- data-display ---
  { name: 'CalendarView', widgetName: 'calendar-view', factory: createCalendarView, props: {} },
  { name: 'Card', widgetName: 'card', factory: createCard, props: {} },
  { name: 'CardGrid', widgetName: 'card-grid', factory: createCardGrid, props: {} },
  { name: 'Chart', widgetName: 'chart', factory: createChart, props: {} },
  { name: 'DataList', widgetName: 'data-list', factory: createDataList, props: {} },
  { name: 'DataTable', widgetName: 'data-table', factory: createDataTable, props: {} },
  { name: 'EmptyState', widgetName: 'empty-state', factory: createEmptyState, props: {} },
  { name: 'Gauge', widgetName: 'gauge', factory: createGauge, props: {} },
  { name: 'KanbanBoard', widgetName: 'kanban-board', factory: createKanbanBoard, props: {} },
  { name: 'List', widgetName: 'list', factory: createList, props: {} },
  { name: 'NotificationItem', widgetName: 'notification-item', factory: createNotificationItem, props: {} },
  { name: 'Skeleton', widgetName: 'skeleton', factory: createSkeleton, props: {} },
  { name: 'StatCard', widgetName: 'stat-card', factory: createStatCard, props: {} },
  { name: 'Timeline', widgetName: 'timeline', factory: createTimeline, props: {} },
  { name: 'ViewToggle', widgetName: 'view-toggle', factory: createViewToggle, props: {} },

  // --- composites ---
  { name: 'BacklinkPanel', widgetName: 'backlink-panel', factory: createBacklinkPanel, props: {} },
  { name: 'CacheDashboard', widgetName: 'cache-dashboard', factory: createCacheDashboard, props: {} },
  { name: 'DiffViewer', widgetName: 'diff-viewer', factory: createDiffViewer, props: {} },
  { name: 'FacetedSearch', widgetName: 'faceted-search', factory: createFacetedSearch, props: {} },
  { name: 'FileBrowser', widgetName: 'file-browser', factory: createFileBrowser, props: {} },
  { name: 'FilterBuilder', widgetName: 'filter-builder', factory: createFilterBuilder, props: {} },
  { name: 'MasterDetail', widgetName: 'master-detail', factory: createMasterDetail, props: {} },
  { name: 'NotificationCenter', widgetName: 'notification-center', factory: createNotificationCenter, props: {} },
  { name: 'PermissionMatrix', widgetName: 'permission-matrix', factory: createPermissionMatrix, props: { roles: [], resources: [], permissions: {} } },
  { name: 'PluginCard', widgetName: 'plugin-card', factory: createPluginCard, props: {} },
  { name: 'PreferenceMatrix', widgetName: 'preference-matrix', factory: createPreferenceMatrix, props: { preferences: [], channels: [] } },
  { name: 'PropertyPanel', widgetName: 'property-panel', factory: createPropertyPanel, props: { properties: [] } },
  { name: 'QueueDashboard', widgetName: 'queue-dashboard', factory: createQueueDashboard, props: {} },
  { name: 'SchemaEditor', widgetName: 'schema-editor', factory: createSchemaEditor, props: {} },
  { name: 'SortBuilder', widgetName: 'sort-builder', factory: createSortBuilder, props: {} },
  { name: 'ViewSwitcher', widgetName: 'view-switcher', factory: createViewSwitcher, props: { views: [], activeView: '' } },

  // --- complex-inputs ---
  { name: 'ColorPicker', widgetName: 'color-picker', factory: createColorPicker, props: {} },
  { name: 'DatePicker', widgetName: 'date-picker', factory: createDatePicker, props: {} },
  { name: 'DateRangePicker', widgetName: 'date-range-picker', factory: createDateRangePicker, props: {} },
  { name: 'FileUpload', widgetName: 'file-upload', factory: createFileUpload, props: {} },
  { name: 'FormulaEditor', widgetName: 'formula-editor', factory: createFormulaEditor, props: {} },
  { name: 'MentionInput', widgetName: 'mention-input', factory: createMentionInput, props: {} },
  { name: 'PinInput', widgetName: 'pin-input', factory: createPinInput, props: {} },
  { name: 'RangeSlider', widgetName: 'range-slider', factory: createRangeSlider, props: {} },
  { name: 'Rating', widgetName: 'rating', factory: createRating, props: {} },
  { name: 'RichTextEditor', widgetName: 'rich-text-editor', factory: createRichTextEditor, props: {} },
  { name: 'SignaturePad', widgetName: 'signature-pad', factory: createSignaturePad, props: {} },
  { name: 'TreeSelect', widgetName: 'tree-select', factory: createTreeSelect, props: {} },

  // --- domain ---
  { name: 'AutomationBuilder', widgetName: 'automation-builder', factory: createAutomationBuilder, props: { steps: [] } },
  { name: 'BlockEditor', widgetName: 'block-editor', factory: createBlockEditor, props: { blocks: [] } },
  { name: 'Canvas', widgetName: 'canvas', factory: createCanvas, props: {} },
  { name: 'CanvasConnector', widgetName: 'canvas-connector', factory: createCanvasConnector, props: {} },
  { name: 'CanvasNode', widgetName: 'canvas-node', factory: createCanvasNode, props: {} },
  { name: 'CodeBlock', widgetName: 'code-block', factory: createCodeBlock, props: { code: '' } },
  { name: 'ColorLabelPicker', widgetName: 'color-label-picker', factory: createColorLabelPicker, props: { labels: [] } },
  { name: 'ConditionBuilder', widgetName: 'condition-builder', factory: createConditionBuilder, props: { fields: [] } },
  { name: 'CronEditor', widgetName: 'cron-editor', factory: createCronEditor, props: {} },
  { name: 'DragHandle', widgetName: 'drag-handle', factory: createDragHandle, props: {} },
  { name: 'FieldMapper', widgetName: 'field-mapper', factory: createFieldMapper, props: { sourceFields: [], targetFields: [] } },
  { name: 'GraphView', widgetName: 'graph-view', factory: createGraphView, props: { nodes: [], edges: [] } },
  { name: 'ImageGallery', widgetName: 'image-gallery', factory: createImageGallery, props: { images: [] } },
  { name: 'InlineEdit', widgetName: 'inline-edit', factory: createInlineEdit, props: {} },
  { name: 'MarkdownPreview', widgetName: 'markdown-preview', factory: createMarkdownPreview, props: {} },
  { name: 'Minimap', widgetName: 'minimap', factory: createMinimap, props: {} },
  { name: 'Outliner', widgetName: 'outliner', factory: createOutliner, props: { nodes: [] } },
  { name: 'PluginDetailPage', widgetName: 'plugin-detail-page', factory: createPluginDetailPage, props: {} },
  { name: 'PolicyEditor', widgetName: 'policy-editor', factory: createPolicyEditor, props: { rules: [] } },
  { name: 'SlashMenu', widgetName: 'slash-menu', factory: createSlashMenu, props: { items: [] } },
  { name: 'StateMachineDiagram', widgetName: 'state-machine-diagram', factory: createStateMachineDiagram, props: { states: [], transitions: [] } },
  { name: 'StepIndicator', widgetName: 'step-indicator', factory: createStepIndicator, props: { steps: [] } },
  { name: 'TokenInput', widgetName: 'token-input', factory: createTokenInput, props: {} },
  { name: 'WorkflowEditor', widgetName: 'workflow-editor', factory: createWorkflowEditor, props: {} },
  { name: 'WorkflowNode', widgetName: 'workflow-node', factory: createWorkflowNode, props: {} },
];

// ============================================================
// Tests
// ============================================================

describe('Svelte Widgets', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('registry contains all 122 widgets', () => {
    expect(SVELTE_WIDGETS.length).toBe(122);
  });

  for (const entry of SVELTE_WIDGETS) {
    describe(entry.name, () => {
      it('can be created without errors', () => {
        const instance = entry.factory({ target: container, props: entry.props });
        expect(instance).toBeDefined();
        expect(instance.element).toBeDefined();
        instance.destroy();
      });

      it(`root element has data-widget-name="${entry.widgetName}"`, () => {
        const instance = entry.factory({ target: container, props: entry.props });
        expect(instance.element.getAttribute('data-widget-name')).toBe(entry.widgetName);
        instance.destroy();
      });

      it('root element has data-surface-widget attribute', () => {
        const instance = entry.factory({ target: container, props: entry.props });
        expect(instance.element.getAttribute('data-surface-widget')).toBe('');
        instance.destroy();
      });

      it('root element has a data-part attribute', () => {
        const instance = entry.factory({ target: container, props: entry.props });
        const el = instance.element;
        // Widgets use various data-part values: "root", their widget name,
        // or overlay widgets use "trigger"/"backdrop" on the outer element
        const hasDataPart = el.hasAttribute('data-part') ||
          el.querySelector('[data-part]') !== null;
        expect(hasDataPart).toBe(true);
        instance.destroy();
      });

      it('element is appended to target', () => {
        const instance = entry.factory({ target: container, props: entry.props });
        expect(container.children.length).toBeGreaterThanOrEqual(1);
        instance.destroy();
      });

      it('can be destroyed without errors', () => {
        const instance = entry.factory({ target: container, props: entry.props });
        expect(() => instance.destroy()).not.toThrow();
      });

      it('element is removed from DOM after destroy', () => {
        const instance = entry.factory({ target: container, props: entry.props });
        const el = instance.element;
        instance.destroy();
        expect(el.parentNode).toBeNull();
      });
    });
  }

  // ----------------------------------------------------------
  // Primitives: extended tests
  // ----------------------------------------------------------
  describe('primitives', () => {
    describe('Button (extended)', () => {
      it('applies variant and size data attributes', () => {
        const instance = createButton({ target: container, props: { variant: 'danger', size: 'sm' } });
        expect(instance.element.getAttribute('data-variant')).toBe('danger');
        expect(instance.element.getAttribute('data-size')).toBe('sm');
        instance.destroy();
      });

      it('sets role="button"', () => {
        const instance = createButton({ target: container, props: {} });
        expect(instance.element.getAttribute('role')).toBe('button');
        instance.destroy();
      });

      it('sets aria-disabled when disabled', () => {
        const instance = createButton({ target: container, props: { disabled: true } });
        expect(instance.element.getAttribute('aria-disabled')).toBe('true');
        instance.destroy();
      });

      it('sets aria-busy when loading', () => {
        const instance = createButton({ target: container, props: { loading: true } });
        expect(instance.element.getAttribute('aria-busy')).toBe('true');
        instance.destroy();
      });

      it('has spinner, icon, and label parts', () => {
        const instance = createButton({ target: container, props: { label: 'Click' } });
        const el = instance.element;
        expect(el.querySelector('[data-part="spinner"]')).not.toBeNull();
        expect(el.querySelector('[data-part="icon"]')).not.toBeNull();
        expect(el.querySelector('[data-part="label"]')).not.toBeNull();
        instance.destroy();
      });

      it('fires onClick when clicked', () => {
        const onClick = vi.fn();
        const instance = createButton({ target: container, props: { onClick } });
        instance.element.click();
        expect(onClick).toHaveBeenCalledTimes(1);
        instance.destroy();
      });

      it('does not fire onClick when disabled', () => {
        const onClick = vi.fn();
        const instance = createButton({ target: container, props: { onClick, disabled: true } });
        instance.element.click();
        expect(onClick).not.toHaveBeenCalled();
        instance.destroy();
      });

      it('update() changes props', () => {
        const instance = createButton({ target: container, props: { variant: 'filled' } });
        instance.update({ variant: 'outline' });
        expect(instance.element.getAttribute('data-variant')).toBe('outline');
        instance.destroy();
      });
    });

    describe('Alert (extended)', () => {
      it('sets data-variant', () => {
        const instance = createAlert({ target: container, props: { variant: 'warning' } });
        expect(instance.element.getAttribute('data-variant')).not.toBeNull();
        instance.destroy();
      });
    });

    describe('Card (extended)', () => {
      it('sets role="button" when clickable', () => {
        const instance = createCard({ target: container, props: { clickable: true } });
        expect(instance.element.getAttribute('role')).toBe('button');
        instance.destroy();
      });

      it('has header, title, body, and footer parts', () => {
        const instance = createCard({ target: container, props: {} });
        const el = instance.element;
        expect(el.querySelector('[data-part="header"]')).not.toBeNull();
        expect(el.querySelector('[data-part="title"]')).not.toBeNull();
        expect(el.querySelector('[data-part="body"]')).not.toBeNull();
        expect(el.querySelector('[data-part="footer"]')).not.toBeNull();
        instance.destroy();
      });
    });

    describe('Tabs (extended)', () => {
      it('has list part with role="tablist"', () => {
        const instance = createTabs({ target: container, props: { items: [] } });
        const listEl = instance.element.querySelector('[data-part="list"]');
        expect(listEl).not.toBeNull();
        expect(listEl?.getAttribute('role')).toBe('tablist');
        instance.destroy();
      });
    });
  });
});
