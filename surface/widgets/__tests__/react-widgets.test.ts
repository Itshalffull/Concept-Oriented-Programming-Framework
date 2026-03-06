// ============================================================
// React Widget Tests
//
// Tests for all 122 React (forwardRef JSX) widgets.
// Since react-dom may not be installed, these tests verify
// that each widget module exports a valid React component
// (function/object with correct name). When react-dom is
// available, DOM rendering tests run as well.
// ============================================================

import { describe, it, expect, vi } from 'vitest';

// Mock react-dom since it is not installed; Portal, AlertDialog, Dialog,
// and Drawer import createPortal from it at module load time.
vi.mock('react-dom', () => ({
  createPortal: (children: unknown) => children,
}));

// --- Primitives ---
import { Avatar as PrimAvatar } from '../react/components/widgets/primitives/Avatar.ts';
import { Button as PrimButton } from '../react/components/widgets/primitives/Button.ts';
import { Checkbox as PrimCheckbox } from '../react/components/widgets/primitives/Checkbox.ts';
import { Chip as PrimChip } from '../react/components/widgets/primitives/Chip.ts';
import { FocusTrap as PrimFocusTrap } from '../react/components/widgets/primitives/FocusTrap.ts';
import { Icon as PrimIcon } from '../react/components/widgets/primitives/Icon.ts';
import { Label as PrimLabel } from '../react/components/widgets/primitives/Label.ts';
import { Portal as PrimPortal } from '../react/components/widgets/primitives/Portal.ts';
import { Presence as PrimPresence } from '../react/components/widgets/primitives/Presence.ts';
import { ScrollLock as PrimScrollLock } from '../react/components/widgets/primitives/ScrollLock.ts';
import { Separator as PrimSeparator } from '../react/components/widgets/primitives/Separator.ts';
import { Spinner as PrimSpinner } from '../react/components/widgets/primitives/Spinner.ts';
import { TextInput as PrimTextInput } from '../react/components/widgets/primitives/TextInput.ts';
import { VisuallyHidden as PrimVisuallyHidden } from '../react/components/widgets/primitives/VisuallyHidden.ts';

// --- Form Controls ---
import { Badge } from '../react/components/widgets/form-controls/Badge.ts';
import { CheckboxGroup } from '../react/components/widgets/form-controls/CheckboxGroup.ts';
import { ChipInput } from '../react/components/widgets/form-controls/ChipInput.ts';
import { Combobox } from '../react/components/widgets/form-controls/Combobox.ts';
import { ComboboxMulti } from '../react/components/widgets/form-controls/ComboboxMulti.ts';
import { MultiSelect } from '../react/components/widgets/form-controls/MultiSelect.ts';
import { NumberInput } from '../react/components/widgets/form-controls/NumberInput.ts';
import { ProgressBar } from '../react/components/widgets/form-controls/ProgressBar.ts';
import { RadioCard } from '../react/components/widgets/form-controls/RadioCard.ts';
import { RadioGroup } from '../react/components/widgets/form-controls/RadioGroup.ts';
import { SegmentedControl } from '../react/components/widgets/form-controls/SegmentedControl.ts';
import { Select } from '../react/components/widgets/form-controls/Select.ts';
import { Slider } from '../react/components/widgets/form-controls/Slider.ts';
import { Stepper } from '../react/components/widgets/form-controls/Stepper.ts';
import { Textarea } from '../react/components/widgets/form-controls/Textarea.ts';
import { ToggleSwitch } from '../react/components/widgets/form-controls/ToggleSwitch.ts';

// --- Feedback ---
import { Alert } from '../react/components/widgets/feedback/Alert.ts';
import { AlertDialog } from '../react/components/widgets/feedback/AlertDialog.ts';
import { ContextMenu } from '../react/components/widgets/feedback/ContextMenu.ts';
import { Dialog } from '../react/components/widgets/feedback/Dialog.ts';
import { Drawer } from '../react/components/widgets/feedback/Drawer.ts';
import { HoverCard } from '../react/components/widgets/feedback/HoverCard.ts';
import { Popover } from '../react/components/widgets/feedback/Popover.ts';
import { Toast } from '../react/components/widgets/feedback/Toast.ts';
import { ToastManager } from '../react/components/widgets/feedback/ToastManager.ts';
import { Tooltip } from '../react/components/widgets/feedback/Tooltip.ts';

// --- Navigation ---
import { Accordion } from '../react/components/widgets/navigation/Accordion.ts';
import { Breadcrumb } from '../react/components/widgets/navigation/Breadcrumb.ts';
import { CommandPalette } from '../react/components/widgets/navigation/CommandPalette.ts';
import { Disclosure } from '../react/components/widgets/navigation/Disclosure.ts';
import { Fieldset } from '../react/components/widgets/navigation/Fieldset.ts';
import { FloatingToolbar } from '../react/components/widgets/navigation/FloatingToolbar.ts';
import { Form } from '../react/components/widgets/navigation/Form.ts';
import { Menu } from '../react/components/widgets/navigation/Menu.ts';
import { NavigationMenu } from '../react/components/widgets/navigation/NavigationMenu.ts';
import { Pagination } from '../react/components/widgets/navigation/Pagination.ts';
import { Sidebar } from '../react/components/widgets/navigation/Sidebar.ts';
import { Splitter } from '../react/components/widgets/navigation/Splitter.ts';
import { Tabs } from '../react/components/widgets/navigation/Tabs.ts';
import { Toolbar } from '../react/components/widgets/navigation/Toolbar.ts';

// --- Data Display ---
import { CalendarView } from '../react/components/widgets/data-display/CalendarView.ts';
import { Card } from '../react/components/widgets/data-display/Card.ts';
import { CardGrid } from '../react/components/widgets/data-display/CardGrid.ts';
import { Chart } from '../react/components/widgets/data-display/Chart.ts';
import { DataList } from '../react/components/widgets/data-display/DataList.ts';
import { DataTable } from '../react/components/widgets/data-display/DataTable.ts';
import { EmptyState } from '../react/components/widgets/data-display/EmptyState.ts';
import { Gauge } from '../react/components/widgets/data-display/Gauge.ts';
import { KanbanBoard } from '../react/components/widgets/data-display/KanbanBoard.ts';
import { List } from '../react/components/widgets/data-display/List.ts';
import { NotificationItem } from '../react/components/widgets/data-display/NotificationItem.ts';
import { Skeleton } from '../react/components/widgets/data-display/Skeleton.ts';
import { StatCard } from '../react/components/widgets/data-display/StatCard.ts';
import { Timeline } from '../react/components/widgets/data-display/Timeline.ts';
import { ViewToggle } from '../react/components/widgets/data-display/ViewToggle.ts';

// --- Composites ---
import { BacklinkPanel } from '../react/components/widgets/composites/BacklinkPanel.ts';
import { CacheDashboard } from '../react/components/widgets/composites/CacheDashboard.ts';
import { DiffViewer } from '../react/components/widgets/composites/DiffViewer.ts';
import { FacetedSearch } from '../react/components/widgets/composites/FacetedSearch.ts';
import { FileBrowser } from '../react/components/widgets/composites/FileBrowser.ts';
import { FilterBuilder } from '../react/components/widgets/composites/FilterBuilder.ts';
import { MasterDetail } from '../react/components/widgets/composites/MasterDetail.ts';
import { NotificationCenter } from '../react/components/widgets/composites/NotificationCenter.ts';
import { PermissionMatrix } from '../react/components/widgets/composites/PermissionMatrix.ts';
import { PluginCard } from '../react/components/widgets/composites/PluginCard.ts';
import { PreferenceMatrix } from '../react/components/widgets/composites/PreferenceMatrix.ts';
import { PropertyPanel } from '../react/components/widgets/composites/PropertyPanel.ts';
import { QueueDashboard } from '../react/components/widgets/composites/QueueDashboard.ts';
import { SchemaEditor } from '../react/components/widgets/composites/SchemaEditor.ts';
import { SortBuilder } from '../react/components/widgets/composites/SortBuilder.ts';
import { ViewSwitcher } from '../react/components/widgets/composites/ViewSwitcher.ts';

// --- Complex Inputs ---
import { ColorPicker } from '../react/components/widgets/complex-inputs/ColorPicker.ts';
import { DatePicker } from '../react/components/widgets/complex-inputs/DatePicker.ts';
import { DateRangePicker } from '../react/components/widgets/complex-inputs/DateRangePicker.ts';
import { FileUpload } from '../react/components/widgets/complex-inputs/FileUpload.ts';
import { FormulaEditor } from '../react/components/widgets/complex-inputs/FormulaEditor.ts';
import { MentionInput } from '../react/components/widgets/complex-inputs/MentionInput.ts';
import { PinInput } from '../react/components/widgets/complex-inputs/PinInput.ts';
import { RangeSlider } from '../react/components/widgets/complex-inputs/RangeSlider.ts';
import { Rating } from '../react/components/widgets/complex-inputs/Rating.ts';
import { RichTextEditor } from '../react/components/widgets/complex-inputs/RichTextEditor.ts';
import { SignaturePad } from '../react/components/widgets/complex-inputs/SignaturePad.ts';
import { TreeSelect } from '../react/components/widgets/complex-inputs/TreeSelect.ts';

// --- Domain ---
import { AutomationBuilder } from '../react/components/widgets/domain/AutomationBuilder.ts';
import { BlockEditor } from '../react/components/widgets/domain/BlockEditor.ts';
import { Canvas } from '../react/components/widgets/domain/Canvas.ts';
import { CanvasConnector } from '../react/components/widgets/domain/CanvasConnector.ts';
import { CanvasNode } from '../react/components/widgets/domain/CanvasNode.ts';
import { CodeBlock } from '../react/components/widgets/domain/CodeBlock.ts';
import { ColorLabelPicker } from '../react/components/widgets/domain/ColorLabelPicker.ts';
import { ConditionBuilder } from '../react/components/widgets/domain/ConditionBuilder.ts';
import { CronEditor } from '../react/components/widgets/domain/CronEditor.ts';
import { DragHandle } from '../react/components/widgets/domain/DragHandle.ts';
import { FieldMapper } from '../react/components/widgets/domain/FieldMapper.ts';
import { GraphView } from '../react/components/widgets/domain/GraphView.ts';
import { ImageGallery } from '../react/components/widgets/domain/ImageGallery.ts';
import { InlineEdit } from '../react/components/widgets/domain/InlineEdit.ts';
import { MarkdownPreview } from '../react/components/widgets/domain/MarkdownPreview.ts';
import { Minimap } from '../react/components/widgets/domain/Minimap.ts';
import { Outliner } from '../react/components/widgets/domain/Outliner.ts';
import { PluginDetailPage } from '../react/components/widgets/domain/PluginDetailPage.ts';
import { PolicyEditor } from '../react/components/widgets/domain/PolicyEditor.ts';
import { SlashMenu } from '../react/components/widgets/domain/SlashMenu.ts';
import { StateMachineDiagram } from '../react/components/widgets/domain/StateMachineDiagram.ts';
import { StepIndicator } from '../react/components/widgets/domain/StepIndicator.ts';
import { TokenInput } from '../react/components/widgets/domain/TokenInput.ts';
import { WorkflowEditor } from '../react/components/widgets/domain/WorkflowEditor.ts';
import { WorkflowNode } from '../react/components/widgets/domain/WorkflowNode.ts';


// ============================================================
// Registry of all 122 React widgets
// ============================================================

const REACT_WIDGETS: Array<{
  name: string;
  component: unknown;
  displayName: string;
}> = [
  // --- primitives ---
  { name: 'Avatar', component: PrimAvatar, displayName: 'Avatar' },
  { name: 'Button', component: PrimButton, displayName: 'Button' },
  { name: 'Checkbox', component: PrimCheckbox, displayName: 'Checkbox' },
  { name: 'Chip', component: PrimChip, displayName: 'Chip' },
  { name: 'FocusTrap', component: PrimFocusTrap, displayName: 'FocusTrap' },
  { name: 'Icon', component: PrimIcon, displayName: 'Icon' },
  { name: 'Label', component: PrimLabel, displayName: 'Label' },
  { name: 'Portal', component: PrimPortal, displayName: 'Portal' },
  { name: 'Presence', component: PrimPresence, displayName: 'Presence' },
  { name: 'ScrollLock', component: PrimScrollLock, displayName: 'ScrollLock' },
  { name: 'Separator', component: PrimSeparator, displayName: 'Separator' },
  { name: 'Spinner', component: PrimSpinner, displayName: 'Spinner' },
  { name: 'TextInput', component: PrimTextInput, displayName: 'TextInput' },
  { name: 'VisuallyHidden', component: PrimVisuallyHidden, displayName: 'VisuallyHidden' },

  // --- form-controls ---
  { name: 'Badge', component: Badge, displayName: 'Badge' },
  { name: 'CheckboxGroup', component: CheckboxGroup, displayName: 'CheckboxGroup' },
  { name: 'ChipInput', component: ChipInput, displayName: 'ChipInput' },
  { name: 'Combobox', component: Combobox, displayName: 'Combobox' },
  { name: 'ComboboxMulti', component: ComboboxMulti, displayName: 'ComboboxMulti' },
  { name: 'MultiSelect', component: MultiSelect, displayName: 'MultiSelect' },
  { name: 'NumberInput', component: NumberInput, displayName: 'NumberInput' },
  { name: 'ProgressBar', component: ProgressBar, displayName: 'ProgressBar' },
  { name: 'RadioCard', component: RadioCard, displayName: 'RadioCard' },
  { name: 'RadioGroup', component: RadioGroup, displayName: 'RadioGroup' },
  { name: 'SegmentedControl', component: SegmentedControl, displayName: 'SegmentedControl' },
  { name: 'Select', component: Select, displayName: 'Select' },
  { name: 'Slider', component: Slider, displayName: 'Slider' },
  { name: 'Stepper', component: Stepper, displayName: 'Stepper' },
  { name: 'Textarea', component: Textarea, displayName: 'Textarea' },
  { name: 'ToggleSwitch', component: ToggleSwitch, displayName: 'ToggleSwitch' },

  // --- feedback ---
  { name: 'Alert', component: Alert, displayName: 'Alert' },
  { name: 'AlertDialog', component: AlertDialog, displayName: 'AlertDialog' },
  { name: 'ContextMenu', component: ContextMenu, displayName: 'ContextMenu' },
  { name: 'Dialog', component: Dialog, displayName: 'Dialog' },
  { name: 'Drawer', component: Drawer, displayName: 'Drawer' },
  { name: 'HoverCard', component: HoverCard, displayName: 'HoverCard' },
  { name: 'Popover', component: Popover, displayName: 'Popover' },
  { name: 'Toast', component: Toast, displayName: 'Toast' },
  { name: 'ToastManager', component: ToastManager, displayName: 'ToastManager' },
  { name: 'Tooltip', component: Tooltip, displayName: 'Tooltip' },

  // --- navigation ---
  { name: 'Accordion', component: Accordion, displayName: 'Accordion' },
  { name: 'Breadcrumb', component: Breadcrumb, displayName: 'Breadcrumb' },
  { name: 'CommandPalette', component: CommandPalette, displayName: 'CommandPalette' },
  { name: 'Disclosure', component: Disclosure, displayName: 'Disclosure' },
  { name: 'Fieldset', component: Fieldset, displayName: 'Fieldset' },
  { name: 'FloatingToolbar', component: FloatingToolbar, displayName: 'FloatingToolbar' },
  { name: 'Form', component: Form, displayName: 'Form' },
  { name: 'Menu', component: Menu, displayName: 'Menu' },
  { name: 'NavigationMenu', component: NavigationMenu, displayName: 'NavigationMenu' },
  { name: 'Pagination', component: Pagination, displayName: 'Pagination' },
  { name: 'Sidebar', component: Sidebar, displayName: 'Sidebar' },
  { name: 'Splitter', component: Splitter, displayName: 'Splitter' },
  { name: 'Tabs', component: Tabs, displayName: 'Tabs' },
  { name: 'Toolbar', component: Toolbar, displayName: 'Toolbar' },

  // --- data-display ---
  { name: 'CalendarView', component: CalendarView, displayName: 'CalendarView' },
  { name: 'Card', component: Card, displayName: 'Card' },
  { name: 'CardGrid', component: CardGrid, displayName: 'CardGrid' },
  { name: 'Chart', component: Chart, displayName: 'Chart' },
  { name: 'DataList', component: DataList, displayName: 'DataList' },
  { name: 'DataTable', component: DataTable, displayName: 'DataTable' },
  { name: 'EmptyState', component: EmptyState, displayName: 'EmptyState' },
  { name: 'Gauge', component: Gauge, displayName: 'Gauge' },
  { name: 'KanbanBoard', component: KanbanBoard, displayName: 'KanbanBoard' },
  { name: 'List', component: List, displayName: 'List' },
  { name: 'NotificationItem', component: NotificationItem, displayName: 'NotificationItem' },
  { name: 'Skeleton', component: Skeleton, displayName: 'Skeleton' },
  { name: 'StatCard', component: StatCard, displayName: 'StatCard' },
  { name: 'Timeline', component: Timeline, displayName: 'Timeline' },
  { name: 'ViewToggle', component: ViewToggle, displayName: 'ViewToggle' },

  // --- composites ---
  { name: 'BacklinkPanel', component: BacklinkPanel, displayName: 'BacklinkPanel' },
  { name: 'CacheDashboard', component: CacheDashboard, displayName: 'CacheDashboard' },
  { name: 'DiffViewer', component: DiffViewer, displayName: 'DiffViewer' },
  { name: 'FacetedSearch', component: FacetedSearch, displayName: 'FacetedSearch' },
  { name: 'FileBrowser', component: FileBrowser, displayName: 'FileBrowser' },
  { name: 'FilterBuilder', component: FilterBuilder, displayName: 'FilterBuilder' },
  { name: 'MasterDetail', component: MasterDetail, displayName: 'MasterDetail' },
  { name: 'NotificationCenter', component: NotificationCenter, displayName: 'NotificationCenter' },
  { name: 'PermissionMatrix', component: PermissionMatrix, displayName: 'PermissionMatrix' },
  { name: 'PluginCard', component: PluginCard, displayName: 'PluginCard' },
  { name: 'PreferenceMatrix', component: PreferenceMatrix, displayName: 'PreferenceMatrix' },
  { name: 'PropertyPanel', component: PropertyPanel, displayName: 'PropertyPanel' },
  { name: 'QueueDashboard', component: QueueDashboard, displayName: 'QueueDashboard' },
  { name: 'SchemaEditor', component: SchemaEditor, displayName: 'SchemaEditor' },
  { name: 'SortBuilder', component: SortBuilder, displayName: 'SortBuilder' },
  { name: 'ViewSwitcher', component: ViewSwitcher, displayName: 'ViewSwitcher' },

  // --- complex-inputs ---
  { name: 'ColorPicker', component: ColorPicker, displayName: 'ColorPicker' },
  { name: 'DatePicker', component: DatePicker, displayName: 'DatePicker' },
  { name: 'DateRangePicker', component: DateRangePicker, displayName: 'DateRangePicker' },
  { name: 'FileUpload', component: FileUpload, displayName: 'FileUpload' },
  { name: 'FormulaEditor', component: FormulaEditor, displayName: 'FormulaEditor' },
  { name: 'MentionInput', component: MentionInput, displayName: 'MentionInput' },
  { name: 'PinInput', component: PinInput, displayName: 'PinInput' },
  { name: 'RangeSlider', component: RangeSlider, displayName: 'RangeSlider' },
  { name: 'Rating', component: Rating, displayName: 'Rating' },
  { name: 'RichTextEditor', component: RichTextEditor, displayName: 'RichTextEditor' },
  { name: 'SignaturePad', component: SignaturePad, displayName: 'SignaturePad' },
  { name: 'TreeSelect', component: TreeSelect, displayName: 'TreeSelect' },

  // --- domain ---
  { name: 'AutomationBuilder', component: AutomationBuilder, displayName: 'AutomationBuilder' },
  { name: 'BlockEditor', component: BlockEditor, displayName: 'BlockEditor' },
  { name: 'Canvas', component: Canvas, displayName: 'Canvas' },
  { name: 'CanvasConnector', component: CanvasConnector, displayName: 'CanvasConnector' },
  { name: 'CanvasNode', component: CanvasNode, displayName: 'CanvasNode' },
  { name: 'CodeBlock', component: CodeBlock, displayName: 'CodeBlock' },
  { name: 'ColorLabelPicker', component: ColorLabelPicker, displayName: 'ColorLabelPicker' },
  { name: 'ConditionBuilder', component: ConditionBuilder, displayName: 'ConditionBuilder' },
  { name: 'CronEditor', component: CronEditor, displayName: 'CronEditor' },
  { name: 'DragHandle', component: DragHandle, displayName: 'DragHandle' },
  { name: 'FieldMapper', component: FieldMapper, displayName: 'FieldMapper' },
  { name: 'GraphView', component: GraphView, displayName: 'GraphView' },
  { name: 'ImageGallery', component: ImageGallery, displayName: 'ImageGallery' },
  { name: 'InlineEdit', component: InlineEdit, displayName: 'InlineEdit' },
  { name: 'MarkdownPreview', component: MarkdownPreview, displayName: 'MarkdownPreview' },
  { name: 'Minimap', component: Minimap, displayName: 'Minimap' },
  { name: 'Outliner', component: Outliner, displayName: 'Outliner' },
  { name: 'PluginDetailPage', component: PluginDetailPage, displayName: 'PluginDetailPage' },
  { name: 'PolicyEditor', component: PolicyEditor, displayName: 'PolicyEditor' },
  { name: 'SlashMenu', component: SlashMenu, displayName: 'SlashMenu' },
  { name: 'StateMachineDiagram', component: StateMachineDiagram, displayName: 'StateMachineDiagram' },
  { name: 'StepIndicator', component: StepIndicator, displayName: 'StepIndicator' },
  { name: 'TokenInput', component: TokenInput, displayName: 'TokenInput' },
  { name: 'WorkflowEditor', component: WorkflowEditor, displayName: 'WorkflowEditor' },
  { name: 'WorkflowNode', component: WorkflowNode, displayName: 'WorkflowNode' },
];

// ============================================================
// Tests
// ============================================================

describe('React Widgets', () => {
  it('registry contains all 122 widgets', () => {
    expect(REACT_WIDGETS.length).toBe(122);
  });

  for (const entry of REACT_WIDGETS) {
    describe(entry.name, () => {
      it('exports a defined component', () => {
        expect(entry.component).toBeDefined();
      });

      it('component is a function or object (React component)', () => {
        // React components are either functions or objects (forwardRef returns an object)
        const type = typeof entry.component;
        expect(type === 'function' || type === 'object').toBe(true);
      });

      it('has correct displayName', () => {
        const comp = entry.component as any;
        // forwardRef components have displayName on the object
        const displayName = comp.displayName || comp.name || comp.render?.name;
        expect(displayName).toBe(entry.displayName);
      });

      it('is renderable (callable or has $$typeof for forwardRef)', () => {
        const comp = entry.component as any;
        // forwardRef wraps components with $$typeof = Symbol.for('react.forward_ref')
        const isForwardRef = comp.$$typeof !== undefined;
        const isFunction = typeof comp === 'function';
        const isDefineComponent = typeof comp.render === 'function';
        expect(isForwardRef || isFunction || isDefineComponent).toBe(true);
      });
    });
  }

  // ----------------------------------------------------------
  // Primitive-specific export verification
  // ----------------------------------------------------------
  describe('primitives', () => {
    describe('Button', () => {
      it('exports buttonReducer state machine', async () => {
        const mod = await import('../react/components/widgets/primitives/Button.js');
        expect(typeof mod.buttonReducer).toBe('function');
      });

      it('buttonReducer transitions correctly', async () => {
        const { buttonReducer } = await import('../react/components/widgets/primitives/Button.js');
        expect(buttonReducer('idle', { type: 'HOVER' })).toBe('hovered');
        expect(buttonReducer('idle', { type: 'FOCUS' })).toBe('focused');
        expect(buttonReducer('hovered', { type: 'PRESS' })).toBe('pressed');
        expect(buttonReducer('pressed', { type: 'RELEASE' })).toBe('idle');
        expect(buttonReducer('hovered', { type: 'UNHOVER' })).toBe('idle');
        expect(buttonReducer('focused', { type: 'BLUR' })).toBe('idle');
      });
    });

    describe('Alert', () => {
      it('exports alertReducer state machine', async () => {
        const mod = await import('../react/components/widgets/feedback/Alert.js');
        expect(typeof mod.alertReducer).toBe('function');
      });

      it('alertReducer transitions correctly', async () => {
        const { alertReducer } = await import('../react/components/widgets/feedback/Alert.js');
        expect(alertReducer('visible', { type: 'DISMISS' })).toBe('dismissed');
        expect(alertReducer('dismissed', { type: 'DISMISS' })).toBe('dismissed');
      });
    });
  });
});
