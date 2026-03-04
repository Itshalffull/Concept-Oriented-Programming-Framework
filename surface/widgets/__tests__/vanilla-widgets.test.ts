// ============================================================
// Vanilla DOM Widget Tests
//
// Comprehensive tests for all 122 Vanilla (class-based) widgets.
// Each widget is tested for: creation, data attributes on root
// element, proper data-widget-name, data-part="root", and
// destruction. Primitives get additional prop/ARIA/event tests.
// ============================================================

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Primitives ---
import { Avatar } from '../vanilla/components/widgets/primitives/Avatar.js';
import { Button } from '../vanilla/components/widgets/primitives/Button.js';
import { Checkbox } from '../vanilla/components/widgets/primitives/Checkbox.js';
import { Chip } from '../vanilla/components/widgets/primitives/Chip.js';
import { FocusTrap } from '../vanilla/components/widgets/primitives/FocusTrap.js';
import { Icon } from '../vanilla/components/widgets/primitives/Icon.js';
import { Label } from '../vanilla/components/widgets/primitives/Label.js';
import { Portal } from '../vanilla/components/widgets/primitives/Portal.js';
import { Presence } from '../vanilla/components/widgets/primitives/Presence.js';
import { ScrollLock } from '../vanilla/components/widgets/primitives/ScrollLock.js';
import { Separator } from '../vanilla/components/widgets/primitives/Separator.js';
import { Spinner } from '../vanilla/components/widgets/primitives/Spinner.js';
import { TextInput } from '../vanilla/components/widgets/primitives/TextInput.js';
import { VisuallyHidden } from '../vanilla/components/widgets/primitives/VisuallyHidden.js';

// --- Form Controls ---
import { Badge } from '../vanilla/components/widgets/form-controls/Badge.js';
import { CheckboxGroup } from '../vanilla/components/widgets/form-controls/CheckboxGroup.js';
import { ChipInput } from '../vanilla/components/widgets/form-controls/ChipInput.js';
import { Combobox } from '../vanilla/components/widgets/form-controls/Combobox.js';
import { ComboboxMulti } from '../vanilla/components/widgets/form-controls/ComboboxMulti.js';
import { MultiSelect } from '../vanilla/components/widgets/form-controls/MultiSelect.js';
import { NumberInput } from '../vanilla/components/widgets/form-controls/NumberInput.js';
import { ProgressBar } from '../vanilla/components/widgets/form-controls/ProgressBar.js';
import { RadioCard } from '../vanilla/components/widgets/form-controls/RadioCard.js';
import { RadioGroup } from '../vanilla/components/widgets/form-controls/RadioGroup.js';
import { SegmentedControl } from '../vanilla/components/widgets/form-controls/SegmentedControl.js';
import { Select } from '../vanilla/components/widgets/form-controls/Select.js';
import { Slider } from '../vanilla/components/widgets/form-controls/Slider.js';
import { Stepper } from '../vanilla/components/widgets/form-controls/Stepper.js';
import { Textarea } from '../vanilla/components/widgets/form-controls/Textarea.js';
import { ToggleSwitch } from '../vanilla/components/widgets/form-controls/ToggleSwitch.js';

// --- Feedback ---
import { Alert } from '../vanilla/components/widgets/feedback/Alert.js';
import { AlertDialog } from '../vanilla/components/widgets/feedback/AlertDialog.js';
import { ContextMenu } from '../vanilla/components/widgets/feedback/ContextMenu.js';
import { Dialog } from '../vanilla/components/widgets/feedback/Dialog.js';
import { Drawer } from '../vanilla/components/widgets/feedback/Drawer.js';
import { HoverCard } from '../vanilla/components/widgets/feedback/HoverCard.js';
import { Popover } from '../vanilla/components/widgets/feedback/Popover.js';
import { Toast } from '../vanilla/components/widgets/feedback/Toast.js';
import { ToastManager } from '../vanilla/components/widgets/feedback/ToastManager.js';
import { Tooltip } from '../vanilla/components/widgets/feedback/Tooltip.js';

// --- Navigation ---
import { Accordion } from '../vanilla/components/widgets/navigation/Accordion.js';
import { Breadcrumb } from '../vanilla/components/widgets/navigation/Breadcrumb.js';
import { CommandPalette } from '../vanilla/components/widgets/navigation/CommandPalette.js';
import { Disclosure } from '../vanilla/components/widgets/navigation/Disclosure.js';
import { Fieldset } from '../vanilla/components/widgets/navigation/Fieldset.js';
import { FloatingToolbar } from '../vanilla/components/widgets/navigation/FloatingToolbar.js';
import { Form } from '../vanilla/components/widgets/navigation/Form.js';
import { Menu } from '../vanilla/components/widgets/navigation/Menu.js';
import { NavigationMenu } from '../vanilla/components/widgets/navigation/NavigationMenu.js';
import { Pagination } from '../vanilla/components/widgets/navigation/Pagination.js';
import { Sidebar } from '../vanilla/components/widgets/navigation/Sidebar.js';
import { Splitter } from '../vanilla/components/widgets/navigation/Splitter.js';
import { Tabs } from '../vanilla/components/widgets/navigation/Tabs.js';
import { Toolbar } from '../vanilla/components/widgets/navigation/Toolbar.js';

// --- Data Display ---
import { CalendarView } from '../vanilla/components/widgets/data-display/CalendarView.js';
import { Card } from '../vanilla/components/widgets/data-display/Card.js';
import { CardGrid } from '../vanilla/components/widgets/data-display/CardGrid.js';
import { Chart } from '../vanilla/components/widgets/data-display/Chart.js';
import { DataList } from '../vanilla/components/widgets/data-display/DataList.js';
import { DataTable } from '../vanilla/components/widgets/data-display/DataTable.js';
import { EmptyState } from '../vanilla/components/widgets/data-display/EmptyState.js';
import { Gauge } from '../vanilla/components/widgets/data-display/Gauge.js';
import { KanbanBoard } from '../vanilla/components/widgets/data-display/KanbanBoard.js';
import { List } from '../vanilla/components/widgets/data-display/List.js';
import { NotificationItem } from '../vanilla/components/widgets/data-display/NotificationItem.js';
import { Skeleton } from '../vanilla/components/widgets/data-display/Skeleton.js';
import { StatCard } from '../vanilla/components/widgets/data-display/StatCard.js';
import { Timeline } from '../vanilla/components/widgets/data-display/Timeline.js';
import { ViewToggle } from '../vanilla/components/widgets/data-display/ViewToggle.js';

// --- Composites ---
import { BacklinkPanel } from '../vanilla/components/widgets/composites/BacklinkPanel.js';
import { CacheDashboard } from '../vanilla/components/widgets/composites/CacheDashboard.js';
import { DiffViewer } from '../vanilla/components/widgets/composites/DiffViewer.js';
import { FacetedSearch } from '../vanilla/components/widgets/composites/FacetedSearch.js';
import { FileBrowser } from '../vanilla/components/widgets/composites/FileBrowser.js';
import { FilterBuilder } from '../vanilla/components/widgets/composites/FilterBuilder.js';
import { MasterDetail } from '../vanilla/components/widgets/composites/MasterDetail.js';
import { NotificationCenter } from '../vanilla/components/widgets/composites/NotificationCenter.js';
import { PermissionMatrix } from '../vanilla/components/widgets/composites/PermissionMatrix.js';
import { PluginCard } from '../vanilla/components/widgets/composites/PluginCard.js';
import { PreferenceMatrix } from '../vanilla/components/widgets/composites/PreferenceMatrix.js';
import { PropertyPanel } from '../vanilla/components/widgets/composites/PropertyPanel.js';
import { QueueDashboard } from '../vanilla/components/widgets/composites/QueueDashboard.js';
import { SchemaEditor } from '../vanilla/components/widgets/composites/SchemaEditor.js';
import { SortBuilder } from '../vanilla/components/widgets/composites/SortBuilder.js';
import { ViewSwitcher } from '../vanilla/components/widgets/composites/ViewSwitcher.js';

// --- Complex Inputs ---
import { ColorPicker } from '../vanilla/components/widgets/complex-inputs/ColorPicker.js';
import { DatePicker } from '../vanilla/components/widgets/complex-inputs/DatePicker.js';
import { DateRangePicker } from '../vanilla/components/widgets/complex-inputs/DateRangePicker.js';
import { FileUpload } from '../vanilla/components/widgets/complex-inputs/FileUpload.js';
import { FormulaEditor } from '../vanilla/components/widgets/complex-inputs/FormulaEditor.js';
import { MentionInput } from '../vanilla/components/widgets/complex-inputs/MentionInput.js';
import { PinInput } from '../vanilla/components/widgets/complex-inputs/PinInput.js';
import { RangeSlider } from '../vanilla/components/widgets/complex-inputs/RangeSlider.js';
import { Rating } from '../vanilla/components/widgets/complex-inputs/Rating.js';
import { RichTextEditor } from '../vanilla/components/widgets/complex-inputs/RichTextEditor.js';
import { SignaturePad } from '../vanilla/components/widgets/complex-inputs/SignaturePad.js';
import { TreeSelect } from '../vanilla/components/widgets/complex-inputs/TreeSelect.js';

// --- Domain ---
import { AutomationBuilder } from '../vanilla/components/widgets/domain/AutomationBuilder.js';
import { BlockEditor } from '../vanilla/components/widgets/domain/BlockEditor.js';
import { Canvas } from '../vanilla/components/widgets/domain/Canvas.js';
import { CanvasConnector } from '../vanilla/components/widgets/domain/CanvasConnector.js';
import { CanvasNode } from '../vanilla/components/widgets/domain/CanvasNode.js';
import { CodeBlock } from '../vanilla/components/widgets/domain/CodeBlock.js';
import { ColorLabelPicker } from '../vanilla/components/widgets/domain/ColorLabelPicker.js';
import { ConditionBuilder } from '../vanilla/components/widgets/domain/ConditionBuilder.js';
import { CronEditor } from '../vanilla/components/widgets/domain/CronEditor.js';
import { DragHandle } from '../vanilla/components/widgets/domain/DragHandle.js';
import { FieldMapper } from '../vanilla/components/widgets/domain/FieldMapper.js';
import { GraphView } from '../vanilla/components/widgets/domain/GraphView.js';
import { ImageGallery } from '../vanilla/components/widgets/domain/ImageGallery.js';
import { InlineEdit } from '../vanilla/components/widgets/domain/InlineEdit.js';
import { MarkdownPreview } from '../vanilla/components/widgets/domain/MarkdownPreview.js';
import { Minimap } from '../vanilla/components/widgets/domain/Minimap.js';
import { Outliner } from '../vanilla/components/widgets/domain/Outliner.js';
import { PluginDetailPage } from '../vanilla/components/widgets/domain/PluginDetailPage.js';
import { PolicyEditor } from '../vanilla/components/widgets/domain/PolicyEditor.js';
import { SlashMenu } from '../vanilla/components/widgets/domain/SlashMenu.js';
import { StateMachineDiagram } from '../vanilla/components/widgets/domain/StateMachineDiagram.js';
import { StepIndicator } from '../vanilla/components/widgets/domain/StepIndicator.js';
import { TokenInput } from '../vanilla/components/widgets/domain/TokenInput.js';
import { WorkflowEditor } from '../vanilla/components/widgets/domain/WorkflowEditor.js';
import { WorkflowNode } from '../vanilla/components/widgets/domain/WorkflowNode.js';


// ============================================================
// Helper: assert standard Surface widget root attributes
// ============================================================
function assertWidgetRoot(el: HTMLElement, widgetName: string) {
  expect(el.getAttribute('data-surface-widget')).toBe('');
  expect(el.getAttribute('data-widget-name')).toBe(widgetName);
  expect(el.getAttribute('data-part')).toBe('root');
}

// ============================================================
// Vanilla Widget — class-based constructor pattern:
//   new WidgetClass({ target, props })
//   .getElement() / .destroy()
// ============================================================

/**
 * Registry of all 122 vanilla widgets with their constructors,
 * expected kebab-case widget-name, and minimal required props.
 */
const VANILLA_WIDGETS: Array<{
  name: string;
  widgetName: string;
  Ctor: new (opts: { target: HTMLElement; props: any }) => { getElement(): HTMLElement; destroy(): void };
  props: Record<string, unknown>;
}> = [
  // --- primitives ---
  { name: 'Avatar', widgetName: 'avatar', Ctor: Avatar as any, props: { name: 'Test User' } },
  { name: 'Button', widgetName: 'button', Ctor: Button as any, props: { variant: 'filled', size: 'md' } },
  { name: 'Checkbox', widgetName: 'checkbox', Ctor: Checkbox as any, props: { label: 'Check me' } },
  { name: 'Chip', widgetName: 'chip', Ctor: Chip as any, props: { label: 'Tag' } },
  { name: 'FocusTrap', widgetName: 'focus-trap', Ctor: FocusTrap as any, props: {} },
  { name: 'Icon', widgetName: 'icon', Ctor: Icon as any, props: {} },
  { name: 'Label', widgetName: 'label', Ctor: Label as any, props: {} },
  { name: 'Portal', widgetName: 'portal', Ctor: Portal as any, props: { disabled: true } },
  { name: 'Presence', widgetName: 'presence', Ctor: Presence as any, props: {} },
  { name: 'ScrollLock', widgetName: 'scroll-lock', Ctor: ScrollLock as any, props: {} },
  { name: 'Separator', widgetName: 'separator', Ctor: Separator as any, props: {} },
  { name: 'Spinner', widgetName: 'spinner', Ctor: Spinner as any, props: {} },
  { name: 'TextInput', widgetName: 'text-input', Ctor: TextInput as any, props: {} },
  { name: 'VisuallyHidden', widgetName: 'visually-hidden', Ctor: VisuallyHidden as any, props: {} },

  // --- form-controls ---
  { name: 'Badge', widgetName: 'badge', Ctor: Badge as any, props: {} },
  { name: 'CheckboxGroup', widgetName: 'checkbox-group', Ctor: CheckboxGroup as any, props: { options: [], label: 'Group' } },
  { name: 'ChipInput', widgetName: 'chip-input', Ctor: ChipInput as any, props: {} },
  { name: 'Combobox', widgetName: 'combobox', Ctor: Combobox as any, props: {} },
  { name: 'ComboboxMulti', widgetName: 'combobox-multi', Ctor: ComboboxMulti as any, props: {} },
  { name: 'MultiSelect', widgetName: 'multi-select', Ctor: MultiSelect as any, props: {} },
  { name: 'NumberInput', widgetName: 'number-input', Ctor: NumberInput as any, props: {} },
  { name: 'ProgressBar', widgetName: 'progress-bar', Ctor: ProgressBar as any, props: {} },
  { name: 'RadioCard', widgetName: 'radio-card', Ctor: RadioCard as any, props: {} },
  { name: 'RadioGroup', widgetName: 'radio-group', Ctor: RadioGroup as any, props: {} },
  { name: 'SegmentedControl', widgetName: 'segmented-control', Ctor: SegmentedControl as any, props: {} },
  { name: 'Select', widgetName: 'select', Ctor: Select as any, props: { options: [], label: 'Pick' } },
  { name: 'Slider', widgetName: 'slider', Ctor: Slider as any, props: {} },
  { name: 'Stepper', widgetName: 'stepper', Ctor: Stepper as any, props: {} },
  { name: 'Textarea', widgetName: 'textarea', Ctor: Textarea as any, props: {} },
  { name: 'ToggleSwitch', widgetName: 'toggle-switch', Ctor: ToggleSwitch as any, props: { label: 'Toggle' } },

  // --- feedback ---
  { name: 'Alert', widgetName: 'alert', Ctor: Alert as any, props: {} },
  { name: 'AlertDialog', widgetName: 'alert-dialog', Ctor: AlertDialog as any, props: {} },
  { name: 'ContextMenu', widgetName: 'context-menu', Ctor: ContextMenu as any, props: {} },
  { name: 'Dialog', widgetName: 'dialog', Ctor: Dialog as any, props: {} },
  { name: 'Drawer', widgetName: 'drawer', Ctor: Drawer as any, props: {} },
  { name: 'HoverCard', widgetName: 'hover-card', Ctor: HoverCard as any, props: {} },
  { name: 'Popover', widgetName: 'popover', Ctor: Popover as any, props: {} },
  { name: 'Toast', widgetName: 'toast', Ctor: Toast as any, props: {} },
  { name: 'ToastManager', widgetName: 'toast-manager', Ctor: ToastManager as any, props: {} },
  { name: 'Tooltip', widgetName: 'tooltip', Ctor: Tooltip as any, props: {} },

  // --- navigation ---
  { name: 'Accordion', widgetName: 'accordion', Ctor: Accordion as any, props: {} },
  { name: 'Breadcrumb', widgetName: 'breadcrumb', Ctor: Breadcrumb as any, props: {} },
  { name: 'CommandPalette', widgetName: 'command-palette', Ctor: CommandPalette as any, props: {} },
  { name: 'Disclosure', widgetName: 'disclosure', Ctor: Disclosure as any, props: {} },
  { name: 'Fieldset', widgetName: 'fieldset', Ctor: Fieldset as any, props: {} },
  { name: 'FloatingToolbar', widgetName: 'floating-toolbar', Ctor: FloatingToolbar as any, props: {} },
  { name: 'Form', widgetName: 'form', Ctor: Form as any, props: {} },
  { name: 'Menu', widgetName: 'menu', Ctor: Menu as any, props: {} },
  { name: 'NavigationMenu', widgetName: 'navigation-menu', Ctor: NavigationMenu as any, props: {} },
  { name: 'Pagination', widgetName: 'pagination', Ctor: Pagination as any, props: {} },
  { name: 'Sidebar', widgetName: 'sidebar', Ctor: Sidebar as any, props: {} },
  { name: 'Splitter', widgetName: 'splitter', Ctor: Splitter as any, props: {} },
  { name: 'Tabs', widgetName: 'tabs', Ctor: Tabs as any, props: { items: [] } },
  { name: 'Toolbar', widgetName: 'toolbar', Ctor: Toolbar as any, props: {} },

  // --- data-display ---
  { name: 'CalendarView', widgetName: 'calendar-view', Ctor: CalendarView as any, props: {} },
  { name: 'Card', widgetName: 'card', Ctor: Card as any, props: {} },
  { name: 'CardGrid', widgetName: 'card-grid', Ctor: CardGrid as any, props: {} },
  { name: 'Chart', widgetName: 'chart', Ctor: Chart as any, props: {} },
  { name: 'DataList', widgetName: 'data-list', Ctor: DataList as any, props: {} },
  { name: 'DataTable', widgetName: 'data-table', Ctor: DataTable as any, props: {} },
  { name: 'EmptyState', widgetName: 'empty-state', Ctor: EmptyState as any, props: {} },
  { name: 'Gauge', widgetName: 'gauge', Ctor: Gauge as any, props: {} },
  { name: 'KanbanBoard', widgetName: 'kanban-board', Ctor: KanbanBoard as any, props: {} },
  { name: 'List', widgetName: 'list', Ctor: List as any, props: {} },
  { name: 'NotificationItem', widgetName: 'notification-item', Ctor: NotificationItem as any, props: {} },
  { name: 'Skeleton', widgetName: 'skeleton', Ctor: Skeleton as any, props: {} },
  { name: 'StatCard', widgetName: 'stat-card', Ctor: StatCard as any, props: {} },
  { name: 'Timeline', widgetName: 'timeline', Ctor: Timeline as any, props: {} },
  { name: 'ViewToggle', widgetName: 'view-toggle', Ctor: ViewToggle as any, props: {} },

  // --- composites ---
  { name: 'BacklinkPanel', widgetName: 'backlink-panel', Ctor: BacklinkPanel as any, props: {} },
  { name: 'CacheDashboard', widgetName: 'cache-dashboard', Ctor: CacheDashboard as any, props: {} },
  { name: 'DiffViewer', widgetName: 'diff-viewer', Ctor: DiffViewer as any, props: {} },
  { name: 'FacetedSearch', widgetName: 'faceted-search', Ctor: FacetedSearch as any, props: {} },
  { name: 'FileBrowser', widgetName: 'file-browser', Ctor: FileBrowser as any, props: {} },
  { name: 'FilterBuilder', widgetName: 'filter-builder', Ctor: FilterBuilder as any, props: {} },
  { name: 'MasterDetail', widgetName: 'master-detail', Ctor: MasterDetail as any, props: {} },
  { name: 'NotificationCenter', widgetName: 'notification-center', Ctor: NotificationCenter as any, props: {} },
  { name: 'PermissionMatrix', widgetName: 'permission-matrix', Ctor: PermissionMatrix as any, props: {} },
  { name: 'PluginCard', widgetName: 'plugin-card', Ctor: PluginCard as any, props: {} },
  { name: 'PreferenceMatrix', widgetName: 'preference-matrix', Ctor: PreferenceMatrix as any, props: {} },
  { name: 'PropertyPanel', widgetName: 'property-panel', Ctor: PropertyPanel as any, props: {} },
  { name: 'QueueDashboard', widgetName: 'queue-dashboard', Ctor: QueueDashboard as any, props: {} },
  { name: 'SchemaEditor', widgetName: 'schema-editor', Ctor: SchemaEditor as any, props: {} },
  { name: 'SortBuilder', widgetName: 'sort-builder', Ctor: SortBuilder as any, props: {} },
  { name: 'ViewSwitcher', widgetName: 'view-switcher', Ctor: ViewSwitcher as any, props: {} },

  // --- complex-inputs ---
  { name: 'ColorPicker', widgetName: 'color-picker', Ctor: ColorPicker as any, props: {} },
  { name: 'DatePicker', widgetName: 'date-picker', Ctor: DatePicker as any, props: {} },
  { name: 'DateRangePicker', widgetName: 'date-range-picker', Ctor: DateRangePicker as any, props: {} },
  { name: 'FileUpload', widgetName: 'file-upload', Ctor: FileUpload as any, props: {} },
  { name: 'FormulaEditor', widgetName: 'formula-editor', Ctor: FormulaEditor as any, props: {} },
  { name: 'MentionInput', widgetName: 'mention-input', Ctor: MentionInput as any, props: {} },
  { name: 'PinInput', widgetName: 'pin-input', Ctor: PinInput as any, props: {} },
  { name: 'RangeSlider', widgetName: 'range-slider', Ctor: RangeSlider as any, props: {} },
  { name: 'Rating', widgetName: 'rating', Ctor: Rating as any, props: {} },
  { name: 'RichTextEditor', widgetName: 'rich-text-editor', Ctor: RichTextEditor as any, props: {} },
  { name: 'SignaturePad', widgetName: 'signature-pad', Ctor: SignaturePad as any, props: {} },
  { name: 'TreeSelect', widgetName: 'tree-select', Ctor: TreeSelect as any, props: {} },

  // --- domain ---
  { name: 'AutomationBuilder', widgetName: 'automation-builder', Ctor: AutomationBuilder as any, props: {} },
  { name: 'BlockEditor', widgetName: 'block-editor', Ctor: BlockEditor as any, props: {} },
  { name: 'Canvas', widgetName: 'canvas', Ctor: Canvas as any, props: {} },
  { name: 'CanvasConnector', widgetName: 'canvas-connector', Ctor: CanvasConnector as any, props: {} },
  { name: 'CanvasNode', widgetName: 'canvas-node', Ctor: CanvasNode as any, props: {} },
  { name: 'CodeBlock', widgetName: 'code-block', Ctor: CodeBlock as any, props: {} },
  { name: 'ColorLabelPicker', widgetName: 'color-label-picker', Ctor: ColorLabelPicker as any, props: {} },
  { name: 'ConditionBuilder', widgetName: 'condition-builder', Ctor: ConditionBuilder as any, props: {} },
  { name: 'CronEditor', widgetName: 'cron-editor', Ctor: CronEditor as any, props: {} },
  { name: 'DragHandle', widgetName: 'drag-handle', Ctor: DragHandle as any, props: {} },
  { name: 'FieldMapper', widgetName: 'field-mapper', Ctor: FieldMapper as any, props: {} },
  { name: 'GraphView', widgetName: 'graph-view', Ctor: GraphView as any, props: {} },
  { name: 'ImageGallery', widgetName: 'image-gallery', Ctor: ImageGallery as any, props: {} },
  { name: 'InlineEdit', widgetName: 'inline-edit', Ctor: InlineEdit as any, props: {} },
  { name: 'MarkdownPreview', widgetName: 'markdown-preview', Ctor: MarkdownPreview as any, props: {} },
  { name: 'Minimap', widgetName: 'minimap', Ctor: Minimap as any, props: {} },
  { name: 'Outliner', widgetName: 'outliner', Ctor: Outliner as any, props: {} },
  { name: 'PluginDetailPage', widgetName: 'plugin-detail-page', Ctor: PluginDetailPage as any, props: {} },
  { name: 'PolicyEditor', widgetName: 'policy-editor', Ctor: PolicyEditor as any, props: {} },
  { name: 'SlashMenu', widgetName: 'slash-menu', Ctor: SlashMenu as any, props: {} },
  { name: 'StateMachineDiagram', widgetName: 'state-machine-diagram', Ctor: StateMachineDiagram as any, props: {} },
  { name: 'StepIndicator', widgetName: 'step-indicator', Ctor: StepIndicator as any, props: {} },
  { name: 'TokenInput', widgetName: 'token-input', Ctor: TokenInput as any, props: {} },
  { name: 'WorkflowEditor', widgetName: 'workflow-editor', Ctor: WorkflowEditor as any, props: { nodes: [], edges: [] } },
  { name: 'WorkflowNode', widgetName: 'workflow-node', Ctor: WorkflowNode as any, props: {} },
];

// ============================================================
// Universal tests for every vanilla widget
// ============================================================

describe('Vanilla Widgets', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  // Verify we registered all 122 widgets
  it('registry contains all 122 widgets', () => {
    expect(VANILLA_WIDGETS.length).toBe(122);
  });

  // ----------------------------------------------------------
  // Generate tests for every widget
  // ----------------------------------------------------------
  for (const entry of VANILLA_WIDGETS) {
    describe(entry.name, () => {
      it('can be created without errors', () => {
        const instance = new entry.Ctor({ target: container, props: entry.props });
        expect(instance).toBeDefined();
        instance.destroy();
      });

      it(`root element has data-widget-name="${entry.widgetName}"`, () => {
        const instance = new entry.Ctor({ target: container, props: entry.props });
        const el = instance.getElement();
        expect(el.getAttribute('data-widget-name')).toBe(entry.widgetName);
        instance.destroy();
      });

      it('root element has data-surface-widget attribute', () => {
        const instance = new entry.Ctor({ target: container, props: entry.props });
        const el = instance.getElement();
        expect(el.getAttribute('data-surface-widget')).toBe('');
        instance.destroy();
      });

      it('root element has data-part="root"', () => {
        const instance = new entry.Ctor({ target: container, props: entry.props });
        const el = instance.getElement();
        expect(el.getAttribute('data-part')).toBe('root');
        instance.destroy();
      });

      it('is appended to target container', () => {
        const instance = new entry.Ctor({ target: container, props: entry.props });
        expect(container.children.length).toBeGreaterThanOrEqual(1);
        instance.destroy();
      });

      it('can be destroyed without errors', () => {
        const instance = new entry.Ctor({ target: container, props: entry.props });
        expect(() => instance.destroy()).not.toThrow();
      });

      it('is removed from DOM after destroy', () => {
        const instance = new entry.Ctor({ target: container, props: entry.props });
        const el = instance.getElement();
        instance.destroy();
        expect(el.parentNode).toBeNull();
      });
    });
  }

  // ----------------------------------------------------------
  // Primitives: extended prop, ARIA, and event tests
  // ----------------------------------------------------------
  describe('primitives', () => {
    describe('Button (extended)', () => {
      it('applies variant and size data attributes', () => {
        const btn = new Button({ target: container, props: { variant: 'outline', size: 'lg' } });
        const el = btn.getElement();
        expect(el.getAttribute('data-variant')).toBe('outline');
        expect(el.getAttribute('data-size')).toBe('lg');
        btn.destroy();
      });

      it('sets role="button"', () => {
        const btn = new Button({ target: container, props: {} });
        expect(btn.getElement().getAttribute('role')).toBe('button');
        btn.destroy();
      });

      it('sets aria-disabled when disabled', () => {
        const btn = new Button({ target: container, props: { disabled: true } });
        expect(btn.getElement().getAttribute('aria-disabled')).toBe('true');
        btn.destroy();
      });

      it('sets aria-busy when loading', () => {
        const btn = new Button({ target: container, props: { loading: true } });
        expect(btn.getElement().getAttribute('aria-busy')).toBe('true');
        btn.destroy();
      });

      it('fires onClick handler', () => {
        const onClick = vi.fn();
        const btn = new Button({ target: container, props: { onClick } });
        btn.getElement().click();
        expect(onClick).toHaveBeenCalledTimes(1);
        btn.destroy();
      });

      it('does not fire onClick when disabled', () => {
        const onClick = vi.fn();
        const btn = new Button({ target: container, props: { onClick, disabled: true } });
        btn.getElement().click();
        expect(onClick).not.toHaveBeenCalled();
        btn.destroy();
      });

      it('does not fire onClick when loading', () => {
        const onClick = vi.fn();
        const btn = new Button({ target: container, props: { onClick, loading: true } });
        btn.getElement().click();
        expect(onClick).not.toHaveBeenCalled();
        btn.destroy();
      });

      it('has spinner, icon, and label parts', () => {
        const btn = new Button({ target: container, props: { label: 'Click me' } });
        const el = btn.getElement();
        expect(el.querySelector('[data-part="spinner"]')).not.toBeNull();
        expect(el.querySelector('[data-part="icon"]')).not.toBeNull();
        expect(el.querySelector('[data-part="label"]')).not.toBeNull();
        btn.destroy();
      });

      it('sets label text content', () => {
        const btn = new Button({ target: container, props: { label: 'Submit' } });
        const labelEl = btn.getElement().querySelector('[data-part="label"]');
        expect(labelEl?.textContent).toBe('Submit');
        btn.destroy();
      });

      it('defaults to variant=filled and size=md', () => {
        const btn = new Button({ target: container, props: {} });
        const el = btn.getElement();
        expect(el.getAttribute('data-variant')).toBe('filled');
        expect(el.getAttribute('data-size')).toBe('md');
        btn.destroy();
      });

      it('update() changes props', () => {
        const btn = new Button({ target: container, props: { label: 'Old' } });
        btn.update({ label: 'New' });
        const labelEl = btn.getElement().querySelector('[data-part="label"]');
        expect(labelEl?.textContent).toBe('New');
        btn.destroy();
      });
    });

    describe('Avatar (extended)', () => {
      it('sets role="img"', () => {
        const av = new Avatar({ target: container, props: { name: 'Jane Doe' } });
        expect(av.getElement().getAttribute('role')).toBe('img');
        av.destroy();
      });

      it('sets aria-label from name', () => {
        const av = new Avatar({ target: container, props: { name: 'Jane Doe' } });
        expect(av.getElement().getAttribute('aria-label')).toBe('Jane Doe');
        av.destroy();
      });

      it('renders initials in fallback', () => {
        const av = new Avatar({ target: container, props: { name: 'Jane Doe' } });
        const fb = av.getElement().querySelector('[data-part="fallback"]');
        expect(fb?.textContent).toBe('JD');
        av.destroy();
      });

      it('applies data-size', () => {
        const av = new Avatar({ target: container, props: { size: 'lg' } });
        expect(av.getElement().getAttribute('data-size')).toBe('lg');
        av.destroy();
      });
    });

    describe('Checkbox (extended)', () => {
      it('has a hidden input with role="checkbox"', () => {
        const cb = new Checkbox({ target: container, props: {} });
        const input = cb.getElement().querySelector('[data-part="input"]') as HTMLInputElement;
        expect(input).not.toBeNull();
        expect(input.getAttribute('role')).toBe('checkbox');
        cb.destroy();
      });

      it('toggles checked state on click', () => {
        const onChange = vi.fn();
        const cb = new Checkbox({ target: container, props: { onChange } });
        cb.getElement().click();
        expect(onChange).toHaveBeenCalledWith(true);
        cb.destroy();
      });

      it('does not toggle when disabled', () => {
        const onChange = vi.fn();
        const cb = new Checkbox({ target: container, props: { disabled: true, onChange } });
        cb.getElement().click();
        expect(onChange).not.toHaveBeenCalled();
        cb.destroy();
      });

      it('sets indeterminate data-state', () => {
        const cb = new Checkbox({ target: container, props: { indeterminate: true } });
        expect(cb.getElement().getAttribute('data-state')).toBe('indeterminate');
        cb.destroy();
      });

      it('has control and indicator parts', () => {
        const cb = new Checkbox({ target: container, props: {} });
        const el = cb.getElement();
        expect(el.querySelector('[data-part="control"]')).not.toBeNull();
        expect(el.querySelector('[data-part="indicator"]')).not.toBeNull();
        cb.destroy();
      });
    });

    describe('Chip (extended)', () => {
      it('sets role="option"', () => {
        const chip = new Chip({ target: container, props: { label: 'Tag' } });
        expect(chip.getElement().getAttribute('role')).toBe('option');
        chip.destroy();
      });

      it('toggles selection on click', () => {
        const onSelect = vi.fn();
        const chip = new Chip({ target: container, props: { label: 'Tag', onSelect } });
        chip.getElement().click();
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(chip.getElement().getAttribute('data-state')).toBe('selected');
        chip.destroy();
      });

      it('renders delete button when deletable', () => {
        const chip = new Chip({ target: container, props: { label: 'Tag', deletable: true } });
        const delBtn = chip.getElement().querySelector('[data-part="delete-button"]');
        expect(delBtn).not.toBeNull();
        chip.destroy();
      });

      it('sets aria-disabled when disabled', () => {
        const chip = new Chip({ target: container, props: { disabled: true } });
        expect(chip.getElement().getAttribute('aria-disabled')).toBe('true');
        chip.destroy();
      });
    });

    describe('TextInput (extended)', () => {
      it('has an input element with role="textbox"', () => {
        const ti = new TextInput({ target: container, props: {} });
        const input = ti.getElement().querySelector('[data-part="input"]') as HTMLInputElement;
        expect(input).not.toBeNull();
        expect(input.getAttribute('role')).toBe('textbox');
        ti.destroy();
      });

      it('renders label part when label prop provided', () => {
        const ti = new TextInput({ target: container, props: { label: 'Name' } });
        const labelEl = ti.getElement().querySelector('[data-part="label"]');
        expect(labelEl).not.toBeNull();
        expect(labelEl?.textContent).toBe('Name');
        ti.destroy();
      });

      it('renders clear-button part', () => {
        const ti = new TextInput({ target: container, props: {} });
        const clearBtn = ti.getElement().querySelector('[data-part="clear-button"]');
        expect(clearBtn).not.toBeNull();
        ti.destroy();
      });

      it('sets aria-invalid when error provided', () => {
        const ti = new TextInput({ target: container, props: { error: 'Required' } });
        const input = ti.getElement().querySelector('[data-part="input"]') as HTMLInputElement;
        expect(input.getAttribute('aria-invalid')).toBe('true');
        ti.destroy();
      });

      it('sets data-state to disabled when disabled', () => {
        const ti = new TextInput({ target: container, props: { disabled: true } });
        expect(ti.getElement().getAttribute('data-state')).toBe('disabled');
        ti.destroy();
      });
    });

    describe('Separator (extended)', () => {
      it('creates element with correct widget name', () => {
        const sep = new Separator({ target: container, props: {} });
        assertWidgetRoot(sep.getElement(), 'separator');
        sep.destroy();
      });
    });

    describe('Spinner (extended)', () => {
      it('creates element with correct widget name', () => {
        const sp = new Spinner({ target: container, props: {} });
        assertWidgetRoot(sp.getElement(), 'spinner');
        sp.destroy();
      });
    });

    describe('Icon (extended)', () => {
      it('creates element with correct widget name', () => {
        const ic = new Icon({ target: container, props: {} });
        assertWidgetRoot(ic.getElement(), 'icon');
        ic.destroy();
      });
    });

    describe('Label (extended)', () => {
      it('creates element with correct widget name', () => {
        const lb = new Label({ target: container, props: {} });
        assertWidgetRoot(lb.getElement(), 'label');
        lb.destroy();
      });
    });
  });
});
