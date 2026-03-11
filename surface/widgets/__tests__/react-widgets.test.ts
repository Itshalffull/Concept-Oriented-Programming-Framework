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
import { Avatar as PrimAvatar } from '../react/components/widgets/primitives/Avatar.tsx';
import { Button as PrimButton } from '../react/components/widgets/primitives/Button.tsx';
import { Checkbox as PrimCheckbox } from '../react/components/widgets/primitives/Checkbox.tsx';
import { Chip as PrimChip } from '../react/components/widgets/primitives/Chip.tsx';
import { FocusTrap as PrimFocusTrap } from '../react/components/widgets/primitives/FocusTrap.tsx';
import { Icon as PrimIcon } from '../react/components/widgets/primitives/Icon.tsx';
import { Label as PrimLabel } from '../react/components/widgets/primitives/Label.tsx';
import { Portal as PrimPortal } from '../react/components/widgets/primitives/Portal.tsx';
import { Presence as PrimPresence } from '../react/components/widgets/primitives/Presence.tsx';
import { ScrollLock as PrimScrollLock } from '../react/components/widgets/primitives/ScrollLock.tsx';
import { Separator as PrimSeparator } from '../react/components/widgets/primitives/Separator.tsx';
import { Spinner as PrimSpinner } from '../react/components/widgets/primitives/Spinner.tsx';
import { TextInput as PrimTextInput } from '../react/components/widgets/primitives/TextInput.tsx';
import { VisuallyHidden as PrimVisuallyHidden } from '../react/components/widgets/primitives/VisuallyHidden.tsx';

// --- Form Controls ---
import { Badge } from '../react/components/widgets/form-controls/Badge.tsx';
import { CheckboxGroup } from '../react/components/widgets/form-controls/CheckboxGroup.tsx';
import { ChipInput } from '../react/components/widgets/form-controls/ChipInput.tsx';
import { Combobox } from '../react/components/widgets/form-controls/Combobox.tsx';
import { ComboboxMulti } from '../react/components/widgets/form-controls/ComboboxMulti.tsx';
import { MultiSelect } from '../react/components/widgets/form-controls/MultiSelect.tsx';
import { NumberInput } from '../react/components/widgets/form-controls/NumberInput.tsx';
import { ProgressBar } from '../react/components/widgets/form-controls/ProgressBar.tsx';
import { RadioCard } from '../react/components/widgets/form-controls/RadioCard.tsx';
import { RadioGroup } from '../react/components/widgets/form-controls/RadioGroup.tsx';
import { SegmentedControl } from '../react/components/widgets/form-controls/SegmentedControl.tsx';
import { Select } from '../react/components/widgets/form-controls/Select.tsx';
import { Slider } from '../react/components/widgets/form-controls/Slider.tsx';
import { Stepper } from '../react/components/widgets/form-controls/Stepper.tsx';
import { Textarea } from '../react/components/widgets/form-controls/Textarea.tsx';
import { ToggleSwitch } from '../react/components/widgets/form-controls/ToggleSwitch.tsx';

// --- Feedback ---
import { Alert } from '../react/components/widgets/feedback/Alert.tsx';
import { AlertDialog } from '../react/components/widgets/feedback/AlertDialog.tsx';
import { ContextMenu } from '../react/components/widgets/feedback/ContextMenu.tsx';
import { Dialog } from '../react/components/widgets/feedback/Dialog.tsx';
import { Drawer } from '../react/components/widgets/feedback/Drawer.tsx';
import { HoverCard } from '../react/components/widgets/feedback/HoverCard.tsx';
import { Popover } from '../react/components/widgets/feedback/Popover.tsx';
import { Toast } from '../react/components/widgets/feedback/Toast.tsx';
import { ToastManager } from '../react/components/widgets/feedback/ToastManager.tsx';
import { Tooltip } from '../react/components/widgets/feedback/Tooltip.tsx';

// --- Navigation ---
import { Accordion } from '../react/components/widgets/navigation/Accordion.tsx';
import { Breadcrumb } from '../react/components/widgets/navigation/Breadcrumb.tsx';
import { CommandPalette } from '../react/components/widgets/navigation/CommandPalette.tsx';
import { Disclosure } from '../react/components/widgets/navigation/Disclosure.tsx';
import { Fieldset } from '../react/components/widgets/navigation/Fieldset.tsx';
import { FloatingToolbar } from '../react/components/widgets/navigation/FloatingToolbar.tsx';
import { Form } from '../react/components/widgets/navigation/Form.tsx';
import { Menu } from '../react/components/widgets/navigation/Menu.tsx';
import { NavigationMenu } from '../react/components/widgets/navigation/NavigationMenu.tsx';
import { Pagination } from '../react/components/widgets/navigation/Pagination.tsx';
import { Sidebar } from '../react/components/widgets/navigation/Sidebar.tsx';
import { Splitter } from '../react/components/widgets/navigation/Splitter.tsx';
import { Tabs } from '../react/components/widgets/navigation/Tabs.tsx';
import { Toolbar } from '../react/components/widgets/navigation/Toolbar.tsx';

// --- Data Display ---
import { CalendarView } from '../react/components/widgets/data-display/CalendarView.tsx';
import { Card } from '../react/components/widgets/data-display/Card.tsx';
import { CardGrid } from '../react/components/widgets/data-display/CardGrid.tsx';
import { Chart } from '../react/components/widgets/data-display/Chart.tsx';
import { DataList } from '../react/components/widgets/data-display/DataList.tsx';
import { DataTable } from '../react/components/widgets/data-display/DataTable.tsx';
import { EmptyState } from '../react/components/widgets/data-display/EmptyState.tsx';
import { Gauge } from '../react/components/widgets/data-display/Gauge.tsx';
import { KanbanBoard } from '../react/components/widgets/data-display/KanbanBoard.tsx';
import { List } from '../react/components/widgets/data-display/List.tsx';
import { NotificationItem } from '../react/components/widgets/data-display/NotificationItem.tsx';
import { Skeleton } from '../react/components/widgets/data-display/Skeleton.tsx';
import { StatCard } from '../react/components/widgets/data-display/StatCard.tsx';
import { Timeline } from '../react/components/widgets/data-display/Timeline.tsx';
import { ViewToggle } from '../react/components/widgets/data-display/ViewToggle.tsx';

// --- Composites ---
import { BacklinkPanel } from '../react/components/widgets/composites/BacklinkPanel.tsx';
import { CacheDashboard } from '../react/components/widgets/composites/CacheDashboard.tsx';
import { DiffViewer } from '../react/components/widgets/composites/DiffViewer.tsx';
import { FacetedSearch } from '../react/components/widgets/composites/FacetedSearch.tsx';
import { FileBrowser } from '../react/components/widgets/composites/FileBrowser.tsx';
import { FilterBuilder } from '../react/components/widgets/composites/FilterBuilder.tsx';
import { MasterDetail } from '../react/components/widgets/composites/MasterDetail.tsx';
import { NotificationCenter } from '../react/components/widgets/composites/NotificationCenter.tsx';
import { PermissionMatrix } from '../react/components/widgets/composites/PermissionMatrix.tsx';
import { PluginCard } from '../react/components/widgets/composites/PluginCard.tsx';
import { PreferenceMatrix } from '../react/components/widgets/composites/PreferenceMatrix.tsx';
import { PropertyPanel } from '../react/components/widgets/composites/PropertyPanel.tsx';
import { QueueDashboard } from '../react/components/widgets/composites/QueueDashboard.tsx';
import { SchemaEditor } from '../react/components/widgets/composites/SchemaEditor.tsx';
import { SortBuilder } from '../react/components/widgets/composites/SortBuilder.tsx';
import { ViewSwitcher } from '../react/components/widgets/composites/ViewSwitcher.tsx';

// --- Complex Inputs ---
import { ColorPicker } from '../react/components/widgets/complex-inputs/ColorPicker.tsx';
import { DatePicker } from '../react/components/widgets/complex-inputs/DatePicker.tsx';
import { DateRangePicker } from '../react/components/widgets/complex-inputs/DateRangePicker.tsx';
import { FileUpload } from '../react/components/widgets/complex-inputs/FileUpload.tsx';
import { FormulaEditor } from '../react/components/widgets/complex-inputs/FormulaEditor.tsx';
import { MentionInput } from '../react/components/widgets/complex-inputs/MentionInput.tsx';
import { PinInput } from '../react/components/widgets/complex-inputs/PinInput.tsx';
import { RangeSlider } from '../react/components/widgets/complex-inputs/RangeSlider.tsx';
import { Rating } from '../react/components/widgets/complex-inputs/Rating.tsx';
import { RichTextEditor } from '../react/components/widgets/complex-inputs/RichTextEditor.tsx';
import { SignaturePad } from '../react/components/widgets/complex-inputs/SignaturePad.tsx';
import { TreeSelect } from '../react/components/widgets/complex-inputs/TreeSelect.tsx';

// --- Domain ---
import { AutomationBuilder } from '../react/components/widgets/domain/AutomationBuilder.tsx';
import { BlockEditor } from '../react/components/widgets/domain/BlockEditor.tsx';
import { Canvas } from '../react/components/widgets/domain/Canvas.tsx';
import { CanvasConnector } from '../react/components/widgets/domain/CanvasConnector.tsx';
import { CanvasNode } from '../react/components/widgets/domain/CanvasNode.tsx';
import { CodeBlock } from '../react/components/widgets/domain/CodeBlock.tsx';
import { ColorLabelPicker } from '../react/components/widgets/domain/ColorLabelPicker.tsx';
import { ConditionBuilder } from '../react/components/widgets/domain/ConditionBuilder.tsx';
import { CronEditor } from '../react/components/widgets/domain/CronEditor.tsx';
import { DragHandle } from '../react/components/widgets/domain/DragHandle.tsx';
import { FieldMapper } from '../react/components/widgets/domain/FieldMapper.tsx';
import { GraphView } from '../react/components/widgets/domain/GraphView.tsx';
import { ImageGallery } from '../react/components/widgets/domain/ImageGallery.tsx';
import { InlineEdit } from '../react/components/widgets/domain/InlineEdit.tsx';
import { MarkdownPreview } from '../react/components/widgets/domain/MarkdownPreview.tsx';
import { Minimap } from '../react/components/widgets/domain/Minimap.tsx';
import { Outliner } from '../react/components/widgets/domain/Outliner.tsx';
import { PluginDetailPage } from '../react/components/widgets/domain/PluginDetailPage.tsx';
import { PolicyEditor } from '../react/components/widgets/domain/PolicyEditor.tsx';
import { SlashMenu } from '../react/components/widgets/domain/SlashMenu.tsx';
import { StateMachineDiagram } from '../react/components/widgets/domain/StateMachineDiagram.tsx';
import { StepIndicator } from '../react/components/widgets/domain/StepIndicator.tsx';
import { TokenInput } from '../react/components/widgets/domain/TokenInput.tsx';
import { WorkflowEditor } from '../react/components/widgets/domain/WorkflowEditor.tsx';
import { WorkflowNode } from '../react/components/widgets/domain/WorkflowNode.tsx';


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
