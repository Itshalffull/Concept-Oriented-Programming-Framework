// ============================================================
// Solid Widget Tests
//
// Comprehensive tests for all 122 SolidJS (factory function)
// widgets. Each widget returns { element, dispose }. Tests
// verify creation, data attributes, and disposal for every
// widget across all 8 categories.
// ============================================================

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Primitives ---
import { Avatar } from '../solid/components/widgets/primitives/Avatar.ts';
import { Button } from '../solid/components/widgets/primitives/Button.ts';
import { Checkbox } from '../solid/components/widgets/primitives/Checkbox.ts';
import { Chip } from '../solid/components/widgets/primitives/Chip.ts';
import { FocusTrap } from '../solid/components/widgets/primitives/FocusTrap.ts';
import { Icon } from '../solid/components/widgets/primitives/Icon.ts';
import { Label } from '../solid/components/widgets/primitives/Label.ts';
import { Portal } from '../solid/components/widgets/primitives/Portal.ts';
import { Presence } from '../solid/components/widgets/primitives/Presence.ts';
import { ScrollLock } from '../solid/components/widgets/primitives/ScrollLock.ts';
import { Separator } from '../solid/components/widgets/primitives/Separator.ts';
import { Spinner } from '../solid/components/widgets/primitives/Spinner.ts';
import { TextInput } from '../solid/components/widgets/primitives/TextInput.ts';
import { VisuallyHidden } from '../solid/components/widgets/primitives/VisuallyHidden.ts';

// --- Form Controls ---
import { Badge } from '../solid/components/widgets/form-controls/Badge.ts';
import { CheckboxGroup } from '../solid/components/widgets/form-controls/CheckboxGroup.ts';
import { ChipInput } from '../solid/components/widgets/form-controls/ChipInput.ts';
import { Combobox } from '../solid/components/widgets/form-controls/Combobox.ts';
import { ComboboxMulti } from '../solid/components/widgets/form-controls/ComboboxMulti.ts';
import { MultiSelect } from '../solid/components/widgets/form-controls/MultiSelect.ts';
import { NumberInput } from '../solid/components/widgets/form-controls/NumberInput.ts';
import { ProgressBar } from '../solid/components/widgets/form-controls/ProgressBar.ts';
import { RadioCard } from '../solid/components/widgets/form-controls/RadioCard.ts';
import { RadioGroup } from '../solid/components/widgets/form-controls/RadioGroup.ts';
import { SegmentedControl } from '../solid/components/widgets/form-controls/SegmentedControl.ts';
import { Select } from '../solid/components/widgets/form-controls/Select.ts';
import { Slider } from '../solid/components/widgets/form-controls/Slider.ts';
import { Stepper } from '../solid/components/widgets/form-controls/Stepper.ts';
import { Textarea } from '../solid/components/widgets/form-controls/Textarea.ts';
import { ToggleSwitch } from '../solid/components/widgets/form-controls/ToggleSwitch.ts';

// --- Feedback ---
import { Alert } from '../solid/components/widgets/feedback/Alert.ts';
import { AlertDialog } from '../solid/components/widgets/feedback/AlertDialog.ts';
import { ContextMenu } from '../solid/components/widgets/feedback/ContextMenu.ts';
import { Dialog } from '../solid/components/widgets/feedback/Dialog.ts';
import { Drawer } from '../solid/components/widgets/feedback/Drawer.ts';
import { HoverCard } from '../solid/components/widgets/feedback/HoverCard.ts';
import { Popover } from '../solid/components/widgets/feedback/Popover.ts';
import { Toast } from '../solid/components/widgets/feedback/Toast.ts';
import { ToastManager } from '../solid/components/widgets/feedback/ToastManager.ts';
import { Tooltip } from '../solid/components/widgets/feedback/Tooltip.ts';

// --- Navigation ---
import { Accordion } from '../solid/components/widgets/navigation/Accordion.ts';
import { Breadcrumb } from '../solid/components/widgets/navigation/Breadcrumb.ts';
import { CommandPalette } from '../solid/components/widgets/navigation/CommandPalette.ts';
import { Disclosure } from '../solid/components/widgets/navigation/Disclosure.ts';
import { Fieldset } from '../solid/components/widgets/navigation/Fieldset.ts';
import { FloatingToolbar } from '../solid/components/widgets/navigation/FloatingToolbar.ts';
import { Form } from '../solid/components/widgets/navigation/Form.ts';
import { Menu } from '../solid/components/widgets/navigation/Menu.ts';
import { NavigationMenu } from '../solid/components/widgets/navigation/NavigationMenu.ts';
import { Pagination } from '../solid/components/widgets/navigation/Pagination.ts';
import { Sidebar } from '../solid/components/widgets/navigation/Sidebar.ts';
import { Splitter } from '../solid/components/widgets/navigation/Splitter.ts';
import { Tabs } from '../solid/components/widgets/navigation/Tabs.ts';
import { Toolbar } from '../solid/components/widgets/navigation/Toolbar.ts';

// --- Data Display ---
import { CalendarView } from '../solid/components/widgets/data-display/CalendarView.ts';
import { Card } from '../solid/components/widgets/data-display/Card.ts';
import { CardGrid } from '../solid/components/widgets/data-display/CardGrid.ts';
import { Chart } from '../solid/components/widgets/data-display/Chart.ts';
import { DataList } from '../solid/components/widgets/data-display/DataList.ts';
import { DataTable } from '../solid/components/widgets/data-display/DataTable.ts';
import { EmptyState } from '../solid/components/widgets/data-display/EmptyState.ts';
import { Gauge } from '../solid/components/widgets/data-display/Gauge.ts';
import { KanbanBoard } from '../solid/components/widgets/data-display/KanbanBoard.ts';
import { List } from '../solid/components/widgets/data-display/List.ts';
import { NotificationItem } from '../solid/components/widgets/data-display/NotificationItem.ts';
import { Skeleton } from '../solid/components/widgets/data-display/Skeleton.ts';
import { StatCard } from '../solid/components/widgets/data-display/StatCard.ts';
import { Timeline } from '../solid/components/widgets/data-display/Timeline.ts';
import { ViewToggle } from '../solid/components/widgets/data-display/ViewToggle.ts';

// --- Composites ---
import { BacklinkPanel } from '../solid/components/widgets/composites/BacklinkPanel.ts';
import { CacheDashboard } from '../solid/components/widgets/composites/CacheDashboard.ts';
import { DiffViewer } from '../solid/components/widgets/composites/DiffViewer.ts';
import { FacetedSearch } from '../solid/components/widgets/composites/FacetedSearch.ts';
import { FileBrowser } from '../solid/components/widgets/composites/FileBrowser.ts';
import { FilterBuilder } from '../solid/components/widgets/composites/FilterBuilder.ts';
import { MasterDetail } from '../solid/components/widgets/composites/MasterDetail.ts';
import { NotificationCenter } from '../solid/components/widgets/composites/NotificationCenter.ts';
import { PermissionMatrix } from '../solid/components/widgets/composites/PermissionMatrix.ts';
import { PluginCard } from '../solid/components/widgets/composites/PluginCard.ts';
import { PreferenceMatrix } from '../solid/components/widgets/composites/PreferenceMatrix.ts';
import { PropertyPanel } from '../solid/components/widgets/composites/PropertyPanel.ts';
import { QueueDashboard } from '../solid/components/widgets/composites/QueueDashboard.ts';
import { SchemaEditor } from '../solid/components/widgets/composites/SchemaEditor.ts';
import { SortBuilder } from '../solid/components/widgets/composites/SortBuilder.ts';
import { ViewSwitcher } from '../solid/components/widgets/composites/ViewSwitcher.ts';

// --- Complex Inputs ---
import { ColorPicker } from '../solid/components/widgets/complex-inputs/ColorPicker.ts';
import { DatePicker } from '../solid/components/widgets/complex-inputs/DatePicker.ts';
import { DateRangePicker } from '../solid/components/widgets/complex-inputs/DateRangePicker.ts';
import { FileUpload } from '../solid/components/widgets/complex-inputs/FileUpload.ts';
import { FormulaEditor } from '../solid/components/widgets/complex-inputs/FormulaEditor.ts';
import { MentionInput } from '../solid/components/widgets/complex-inputs/MentionInput.ts';
import { PinInput } from '../solid/components/widgets/complex-inputs/PinInput.ts';
import { RangeSlider } from '../solid/components/widgets/complex-inputs/RangeSlider.ts';
import { Rating } from '../solid/components/widgets/complex-inputs/Rating.ts';
import { RichTextEditor } from '../solid/components/widgets/complex-inputs/RichTextEditor.ts';
import { SignaturePad } from '../solid/components/widgets/complex-inputs/SignaturePad.ts';
import { TreeSelect } from '../solid/components/widgets/complex-inputs/TreeSelect.ts';

// --- Domain ---
import { AutomationBuilder } from '../solid/components/widgets/domain/AutomationBuilder.ts';
import { BlockEditor } from '../solid/components/widgets/domain/BlockEditor.ts';
import { Canvas } from '../solid/components/widgets/domain/Canvas.ts';
import { CanvasConnector } from '../solid/components/widgets/domain/CanvasConnector.ts';
import { CanvasNode } from '../solid/components/widgets/domain/CanvasNode.ts';
import { CodeBlock } from '../solid/components/widgets/domain/CodeBlock.ts';
import { ColorLabelPicker } from '../solid/components/widgets/domain/ColorLabelPicker.ts';
import { ConditionBuilder } from '../solid/components/widgets/domain/ConditionBuilder.ts';
import { CronEditor } from '../solid/components/widgets/domain/CronEditor.ts';
import { DragHandle } from '../solid/components/widgets/domain/DragHandle.ts';
import { FieldMapper } from '../solid/components/widgets/domain/FieldMapper.ts';
import { GraphView } from '../solid/components/widgets/domain/GraphView.ts';
import { ImageGallery } from '../solid/components/widgets/domain/ImageGallery.ts';
import { InlineEdit } from '../solid/components/widgets/domain/InlineEdit.ts';
import { MarkdownPreview } from '../solid/components/widgets/domain/MarkdownPreview.ts';
import { Minimap } from '../solid/components/widgets/domain/Minimap.ts';
import { Outliner } from '../solid/components/widgets/domain/Outliner.ts';
import { PluginDetailPage } from '../solid/components/widgets/domain/PluginDetailPage.ts';
import { PolicyEditor } from '../solid/components/widgets/domain/PolicyEditor.ts';
import { SlashMenu } from '../solid/components/widgets/domain/SlashMenu.ts';
import { StateMachineDiagram } from '../solid/components/widgets/domain/StateMachineDiagram.ts';
import { StepIndicator } from '../solid/components/widgets/domain/StepIndicator.ts';
import { TokenInput } from '../solid/components/widgets/domain/TokenInput.ts';
import { WorkflowEditor } from '../solid/components/widgets/domain/WorkflowEditor.ts';
import { WorkflowNode } from '../solid/components/widgets/domain/WorkflowNode.ts';


// ============================================================
// Registry: Solid widgets use factory functions returning
// { element: HTMLElement, dispose: () => void }
// ============================================================

const SOLID_WIDGETS: Array<{
  name: string;
  widgetName: string;
  factory: (props: any) => { element: HTMLElement; dispose: () => void };
  props: Record<string, unknown>;
}> = [
  // --- primitives ---
  { name: 'Avatar', widgetName: 'avatar', factory: Avatar, props: { name: 'Test User' } },
  { name: 'Button', widgetName: 'button', factory: Button, props: { variant: 'filled', size: 'md' } },
  { name: 'Checkbox', widgetName: 'checkbox', factory: Checkbox, props: {} },
  { name: 'Chip', widgetName: 'chip', factory: Chip, props: { label: 'Tag' } },
  { name: 'FocusTrap', widgetName: 'focus-trap', factory: FocusTrap, props: {} },
  { name: 'Icon', widgetName: 'icon', factory: Icon, props: {} },
  { name: 'Label', widgetName: 'label', factory: Label, props: {} },
  { name: 'Portal', widgetName: 'portal', factory: Portal, props: {} },
  { name: 'Presence', widgetName: 'presence', factory: Presence, props: {} },
  { name: 'ScrollLock', widgetName: 'scroll-lock', factory: ScrollLock, props: {} },
  { name: 'Separator', widgetName: 'separator', factory: Separator, props: {} },
  { name: 'Spinner', widgetName: 'spinner', factory: Spinner, props: {} },
  { name: 'TextInput', widgetName: 'text-input', factory: TextInput, props: {} },
  { name: 'VisuallyHidden', widgetName: 'visually-hidden', factory: VisuallyHidden, props: {} },

  // --- form-controls ---
  { name: 'Badge', widgetName: 'badge', factory: Badge, props: {} },
  { name: 'CheckboxGroup', widgetName: 'checkbox-group', factory: CheckboxGroup, props: { options: [], label: 'Group' } },
  { name: 'ChipInput', widgetName: 'chip-input', factory: ChipInput, props: {} },
  { name: 'Combobox', widgetName: 'combobox', factory: Combobox, props: {} },
  { name: 'ComboboxMulti', widgetName: 'combobox-multi', factory: ComboboxMulti, props: {} },
  { name: 'MultiSelect', widgetName: 'multi-select', factory: MultiSelect, props: {} },
  { name: 'NumberInput', widgetName: 'number-input', factory: NumberInput, props: {} },
  { name: 'ProgressBar', widgetName: 'progress-bar', factory: ProgressBar, props: {} },
  { name: 'RadioCard', widgetName: 'radio-card', factory: RadioCard, props: {} },
  { name: 'RadioGroup', widgetName: 'radio-group', factory: RadioGroup, props: {} },
  { name: 'SegmentedControl', widgetName: 'segmented-control', factory: SegmentedControl, props: {} },
  { name: 'Select', widgetName: 'select', factory: Select, props: {} },
  { name: 'Slider', widgetName: 'slider', factory: Slider, props: {} },
  { name: 'Stepper', widgetName: 'stepper', factory: Stepper, props: {} },
  { name: 'Textarea', widgetName: 'textarea', factory: Textarea, props: {} },
  { name: 'ToggleSwitch', widgetName: 'toggle-switch', factory: ToggleSwitch, props: {} },

  // --- feedback ---
  { name: 'Alert', widgetName: 'alert', factory: Alert, props: {} },
  { name: 'AlertDialog', widgetName: 'alert-dialog', factory: AlertDialog, props: {} },
  { name: 'ContextMenu', widgetName: 'context-menu', factory: ContextMenu, props: {} },
  { name: 'Dialog', widgetName: 'dialog', factory: Dialog, props: {} },
  { name: 'Drawer', widgetName: 'drawer', factory: Drawer, props: {} },
  { name: 'HoverCard', widgetName: 'hover-card', factory: HoverCard, props: {} },
  { name: 'Popover', widgetName: 'popover', factory: Popover, props: {} },
  { name: 'Toast', widgetName: 'toast', factory: Toast, props: {} },
  { name: 'ToastManager', widgetName: 'toast-manager', factory: ToastManager, props: {} },
  { name: 'Tooltip', widgetName: 'tooltip', factory: Tooltip, props: {} },

  // --- navigation ---
  { name: 'Accordion', widgetName: 'accordion', factory: Accordion, props: {} },
  { name: 'Breadcrumb', widgetName: 'breadcrumb', factory: Breadcrumb, props: {} },
  { name: 'CommandPalette', widgetName: 'command-palette', factory: CommandPalette, props: {} },
  { name: 'Disclosure', widgetName: 'disclosure', factory: Disclosure, props: {} },
  { name: 'Fieldset', widgetName: 'fieldset', factory: Fieldset, props: {} },
  { name: 'FloatingToolbar', widgetName: 'floating-toolbar', factory: FloatingToolbar, props: {} },
  { name: 'Form', widgetName: 'form', factory: Form, props: {} },
  { name: 'Menu', widgetName: 'menu', factory: Menu, props: {} },
  { name: 'NavigationMenu', widgetName: 'navigation-menu', factory: NavigationMenu, props: {} },
  { name: 'Pagination', widgetName: 'pagination', factory: Pagination, props: {} },
  { name: 'Sidebar', widgetName: 'sidebar', factory: Sidebar, props: {} },
  { name: 'Splitter', widgetName: 'splitter', factory: Splitter, props: {} },
  { name: 'Tabs', widgetName: 'tabs', factory: Tabs, props: {} },
  { name: 'Toolbar', widgetName: 'toolbar', factory: Toolbar, props: {} },

  // --- data-display ---
  { name: 'CalendarView', widgetName: 'calendar-view', factory: CalendarView, props: {} },
  { name: 'Card', widgetName: 'card', factory: Card, props: {} },
  { name: 'CardGrid', widgetName: 'card-grid', factory: CardGrid, props: {} },
  { name: 'Chart', widgetName: 'chart', factory: Chart, props: {} },
  { name: 'DataList', widgetName: 'data-list', factory: DataList, props: {} },
  { name: 'DataTable', widgetName: 'data-table', factory: DataTable, props: {} },
  { name: 'EmptyState', widgetName: 'empty-state', factory: EmptyState, props: {} },
  { name: 'Gauge', widgetName: 'gauge', factory: Gauge, props: {} },
  { name: 'KanbanBoard', widgetName: 'kanban-board', factory: KanbanBoard, props: {} },
  { name: 'List', widgetName: 'list', factory: List, props: {} },
  { name: 'NotificationItem', widgetName: 'notification-item', factory: NotificationItem, props: {} },
  { name: 'Skeleton', widgetName: 'skeleton', factory: Skeleton, props: {} },
  { name: 'StatCard', widgetName: 'stat-card', factory: StatCard, props: {} },
  { name: 'Timeline', widgetName: 'timeline', factory: Timeline, props: {} },
  { name: 'ViewToggle', widgetName: 'view-toggle', factory: ViewToggle, props: {} },

  // --- composites ---
  { name: 'BacklinkPanel', widgetName: 'backlink-panel', factory: BacklinkPanel, props: {} },
  { name: 'CacheDashboard', widgetName: 'cache-dashboard', factory: CacheDashboard, props: {} },
  { name: 'DiffViewer', widgetName: 'diff-viewer', factory: DiffViewer, props: {} },
  { name: 'FacetedSearch', widgetName: 'faceted-search', factory: FacetedSearch, props: {} },
  { name: 'FileBrowser', widgetName: 'file-browser', factory: FileBrowser, props: {} },
  { name: 'FilterBuilder', widgetName: 'filter-builder', factory: FilterBuilder, props: {} },
  { name: 'MasterDetail', widgetName: 'master-detail', factory: MasterDetail, props: {} },
  { name: 'NotificationCenter', widgetName: 'notification-center', factory: NotificationCenter, props: {} },
  { name: 'PermissionMatrix', widgetName: 'permission-matrix', factory: PermissionMatrix, props: {} },
  { name: 'PluginCard', widgetName: 'plugin-card', factory: PluginCard, props: {} },
  { name: 'PreferenceMatrix', widgetName: 'preference-matrix', factory: PreferenceMatrix, props: {} },
  { name: 'PropertyPanel', widgetName: 'property-panel', factory: PropertyPanel, props: {} },
  { name: 'QueueDashboard', widgetName: 'queue-dashboard', factory: QueueDashboard, props: {} },
  { name: 'SchemaEditor', widgetName: 'schema-editor', factory: SchemaEditor, props: {} },
  { name: 'SortBuilder', widgetName: 'sort-builder', factory: SortBuilder, props: {} },
  { name: 'ViewSwitcher', widgetName: 'view-switcher', factory: ViewSwitcher, props: {} },

  // --- complex-inputs ---
  { name: 'ColorPicker', widgetName: 'color-picker', factory: ColorPicker, props: {} },
  { name: 'DatePicker', widgetName: 'date-picker', factory: DatePicker, props: {} },
  { name: 'DateRangePicker', widgetName: 'date-range-picker', factory: DateRangePicker, props: {} },
  { name: 'FileUpload', widgetName: 'file-upload', factory: FileUpload, props: {} },
  { name: 'FormulaEditor', widgetName: 'formula-editor', factory: FormulaEditor, props: {} },
  { name: 'MentionInput', widgetName: 'mention-input', factory: MentionInput, props: {} },
  { name: 'PinInput', widgetName: 'pin-input', factory: PinInput, props: {} },
  { name: 'RangeSlider', widgetName: 'range-slider', factory: RangeSlider, props: {} },
  { name: 'Rating', widgetName: 'rating', factory: Rating, props: {} },
  { name: 'RichTextEditor', widgetName: 'rich-text-editor', factory: RichTextEditor, props: {} },
  { name: 'SignaturePad', widgetName: 'signature-pad', factory: SignaturePad, props: {} },
  { name: 'TreeSelect', widgetName: 'tree-select', factory: TreeSelect, props: {} },

  // --- domain ---
  { name: 'AutomationBuilder', widgetName: 'automation-builder', factory: AutomationBuilder, props: {} },
  { name: 'BlockEditor', widgetName: 'block-editor', factory: BlockEditor, props: {} },
  { name: 'Canvas', widgetName: 'canvas', factory: Canvas, props: {} },
  { name: 'CanvasConnector', widgetName: 'canvas-connector', factory: CanvasConnector, props: {} },
  { name: 'CanvasNode', widgetName: 'canvas-node', factory: CanvasNode, props: {} },
  { name: 'CodeBlock', widgetName: 'code-block', factory: CodeBlock, props: {} },
  { name: 'ColorLabelPicker', widgetName: 'color-label-picker', factory: ColorLabelPicker, props: {} },
  { name: 'ConditionBuilder', widgetName: 'condition-builder', factory: ConditionBuilder, props: {} },
  { name: 'CronEditor', widgetName: 'cron-editor', factory: CronEditor, props: {} },
  { name: 'DragHandle', widgetName: 'drag-handle', factory: DragHandle, props: {} },
  { name: 'FieldMapper', widgetName: 'field-mapper', factory: FieldMapper, props: {} },
  { name: 'GraphView', widgetName: 'graph-view', factory: GraphView, props: {} },
  { name: 'ImageGallery', widgetName: 'image-gallery', factory: ImageGallery, props: {} },
  { name: 'InlineEdit', widgetName: 'inline-edit', factory: InlineEdit, props: {} },
  { name: 'MarkdownPreview', widgetName: 'markdown-preview', factory: MarkdownPreview, props: {} },
  { name: 'Minimap', widgetName: 'minimap', factory: Minimap, props: {} },
  { name: 'Outliner', widgetName: 'outliner', factory: Outliner, props: {} },
  { name: 'PluginDetailPage', widgetName: 'plugin-detail-page', factory: PluginDetailPage, props: {} },
  { name: 'PolicyEditor', widgetName: 'policy-editor', factory: PolicyEditor, props: {} },
  { name: 'SlashMenu', widgetName: 'slash-menu', factory: SlashMenu, props: {} },
  { name: 'StateMachineDiagram', widgetName: 'state-machine-diagram', factory: StateMachineDiagram, props: {} },
  { name: 'StepIndicator', widgetName: 'step-indicator', factory: StepIndicator, props: {} },
  { name: 'TokenInput', widgetName: 'token-input', factory: TokenInput, props: {} },
  { name: 'WorkflowEditor', widgetName: 'workflow-editor', factory: WorkflowEditor, props: {} },
  { name: 'WorkflowNode', widgetName: 'workflow-node', factory: WorkflowNode, props: {} },
];

// ============================================================
// Tests
// ============================================================

describe('Solid Widgets', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('registry contains all 122 widgets', () => {
    expect(SOLID_WIDGETS.length).toBe(122);
  });

  for (const entry of SOLID_WIDGETS) {
    describe(entry.name, () => {
      it('can be created without errors', () => {
        const result = entry.factory(entry.props);
        expect(result).toBeDefined();
        expect(result.element).toBeDefined();
        expect(typeof result.dispose).toBe('function');
        result.dispose();
      });

      it(`root element has data-widget-name="${entry.widgetName}"`, () => {
        const result = entry.factory(entry.props);
        expect(result.element.getAttribute('data-widget-name')).toBe(entry.widgetName);
        result.dispose();
      });

      it('root element has data-surface-widget attribute', () => {
        const result = entry.factory(entry.props);
        expect(result.element.getAttribute('data-surface-widget')).toBe('');
        result.dispose();
      });

      it('root element has data-part="root"', () => {
        const result = entry.factory(entry.props);
        expect(result.element.getAttribute('data-part')).toBe('root');
        result.dispose();
      });

      it('element is an HTMLElement', () => {
        const result = entry.factory(entry.props);
        expect(result.element).toBeInstanceOf(HTMLElement);
        result.dispose();
      });

      it('can be disposed without errors', () => {
        const result = entry.factory(entry.props);
        expect(() => result.dispose()).not.toThrow();
      });
    });
  }

  // ----------------------------------------------------------
  // Primitives: extended prop and ARIA tests
  // ----------------------------------------------------------
  describe('primitives', () => {
    describe('Button (extended)', () => {
      it('applies variant and size data attributes', () => {
        const result = Button({ variant: 'outline', size: 'lg' });
        expect(result.element.getAttribute('data-variant')).toBe('outline');
        expect(result.element.getAttribute('data-size')).toBe('lg');
        result.dispose();
      });

      it('sets role="button"', () => {
        const result = Button({ variant: 'filled' });
        expect(result.element.getAttribute('role')).toBe('button');
        result.dispose();
      });

      it('sets aria-disabled when disabled', () => {
        const result = Button({ disabled: true });
        expect(result.element.getAttribute('aria-disabled')).toBe('true');
        result.dispose();
      });

      it('sets aria-busy when loading', () => {
        const result = Button({ loading: true });
        expect(result.element.getAttribute('aria-busy')).toBe('true');
        result.dispose();
      });

      it('fires onClick handler', () => {
        const onClick = vi.fn();
        const result = Button({ onClick });
        result.element.click();
        expect(onClick).toHaveBeenCalledTimes(1);
        result.dispose();
      });

      it('does not fire onClick when disabled', () => {
        const onClick = vi.fn();
        const result = Button({ onClick, disabled: true });
        result.element.click();
        expect(onClick).not.toHaveBeenCalled();
        result.dispose();
      });

      it('has spinner, icon, and label parts', () => {
        const result = Button({ label: 'Click me' });
        expect(result.element.querySelector('[data-part="spinner"]')).not.toBeNull();
        expect(result.element.querySelector('[data-part="icon"]')).not.toBeNull();
        expect(result.element.querySelector('[data-part="label"]')).not.toBeNull();
        result.dispose();
      });

      it('sets label text content', () => {
        const result = Button({ label: 'Submit' });
        const labelEl = result.element.querySelector('[data-part="label"]');
        expect(labelEl?.textContent).toBe('Submit');
        result.dispose();
      });

      it('defaults to variant=filled and size=md', () => {
        const result = Button({});
        expect(result.element.getAttribute('data-variant')).toBe('filled');
        expect(result.element.getAttribute('data-size')).toBe('md');
        result.dispose();
      });
    });

    describe('Alert (extended)', () => {
      it('applies variant data attribute', () => {
        const result = Alert({ variant: 'error' });
        expect(result.element.getAttribute('data-variant')).toBe('error');
        result.dispose();
      });

      it('sets ARIA role based on variant', () => {
        const info = Alert({ variant: 'info' });
        expect(info.element.getAttribute('role')).toBe('status');
        info.dispose();

        const error = Alert({ variant: 'error' });
        expect(error.element.getAttribute('role')).toBe('alert');
        error.dispose();
      });

      it('renders title when provided', () => {
        const result = Alert({ title: 'Warning!' });
        const titleEl = result.element.querySelector('[data-part="title"]');
        expect(titleEl).not.toBeNull();
        expect(titleEl?.textContent).toBe('Warning!');
        result.dispose();
      });
    });

    describe('Card (extended)', () => {
      it('applies variant data attribute', () => {
        const result = Card({ variant: 'elevated' });
        expect(result.element.getAttribute('data-variant')).toBe('elevated');
        result.dispose();
      });

      it('sets clickable data attribute', () => {
        const result = Card({ clickable: true });
        expect(result.element.getAttribute('data-clickable')).toBe('true');
        result.dispose();
      });
    });
  });
});
