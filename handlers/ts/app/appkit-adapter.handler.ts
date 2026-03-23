// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// AppKitAdapter Handler
//
// Transforms framework-neutral props into macOS AppKit bindings:
// NSControl target/action, NSView subclassing patterns.
// Resolves Surface widgets to their AppKit NSView counterparts.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

// Widget-to-AppKit mapping structure
export interface WidgetMapping {
  viewClass: string;                       // Primary NSView subclass
  viewProperties: Record<string, unknown>; // Default property assignments
  eventMap: Record<string, string>;        // Widget event → AppKit selector
  accessibilityRole: string;               // NSAccessibility.Role
  anatomy: Record<string, string>;         // Part name → NSView subclass
}

const APPKIT_ACTION_MAP: Record<string, string> = {
  onclick: 'click:',
  ondoubleclick: 'doubleClick:',
  onchange: 'controlTextDidChange:',
  onsubmit: 'submitAction:',
  onselect: 'selectItem:',
  onfocus: 'becomeFirstResponder',
  onblur: 'resignFirstResponder',
};

// ============================================================
// AppKit Widget Map — 122 Surface widgets → NSView mappings
// ============================================================

export const APPKIT_WIDGET_MAP: Record<string, WidgetMapping> = {
  // ----------------------------------------------------------
  // Atomic Primitives
  // ----------------------------------------------------------
  button: {
    viewClass: 'NSButton',
    viewProperties: { bezelStyle: 'rounded', buttonType: 'momentaryPushIn' },
    eventMap: { click: 'click:', doubleClick: 'doubleClick:' },
    accessibilityRole: 'AXButton',
    anatomy: { root: 'NSButton', label: 'NSTextField' },
  },
  textinput: {
    viewClass: 'NSTextField',
    viewProperties: { isEditable: true, isBezeled: true, bezelStyle: 'squareBezel' },
    eventMap: { change: 'controlTextDidChange:', submit: 'insertNewline:', focus: 'becomeFirstResponder' },
    accessibilityRole: 'AXTextField',
    anatomy: { root: 'NSTextField' },
  },
  checkbox: {
    viewClass: 'NSButton',
    viewProperties: { buttonType: 'switch', allowsMixedState: false },
    eventMap: { change: 'click:' },
    accessibilityRole: 'AXCheckBox',
    anatomy: { root: 'NSButton', label: 'NSTextField' },
  },
  label: {
    viewClass: 'NSTextField',
    viewProperties: { isEditable: false, isBordered: false, drawsBackground: false },
    eventMap: {},
    accessibilityRole: 'AXStaticText',
    anatomy: { root: 'NSTextField' },
  },
  icon: {
    viewClass: 'NSImageView',
    viewProperties: { imageScaling: 'scaleProportionallyUpOrDown', isEditable: false },
    eventMap: {},
    accessibilityRole: 'AXImage',
    anatomy: { root: 'NSImageView' },
  },
  separator: {
    viewClass: 'NSBox',
    viewProperties: { boxType: 'separator' },
    eventMap: {},
    accessibilityRole: 'AXSplitter',
    anatomy: { root: 'NSBox' },
  },
  visuallyhidden: {
    viewClass: 'NSView',
    viewProperties: { isHidden: true, accessibilityElement: true },
    eventMap: {},
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSView' },
  },
  portal: {
    viewClass: 'NSView',
    viewProperties: {},
    eventMap: {},
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSView', container: 'NSWindow' },
  },
  focustrap: {
    viewClass: 'NSView',
    viewProperties: { acceptsFirstResponder: true },
    eventMap: { escape: 'cancelOperation:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSView' },
  },
  scrolllock: {
    viewClass: 'NSView',
    viewProperties: {},
    eventMap: {},
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSView' },
  },
  presence: {
    viewClass: 'NSView',
    viewProperties: { wantsLayer: true },
    eventMap: { enter: 'animationDidStart:', exit: 'animationDidStop:finished:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSView' },
  },
  avatar: {
    viewClass: 'NSImageView',
    viewProperties: { imageScaling: 'scaleProportionallyUpOrDown', wantsLayer: true, 'layer.cornerRadius': 'half' },
    eventMap: {},
    accessibilityRole: 'AXImage',
    anatomy: { root: 'NSImageView', fallback: 'NSTextField' },
  },
  spinner: {
    viewClass: 'NSProgressIndicator',
    viewProperties: { style: 'spinning', isIndeterminate: true, isDisplayedWhenStopped: false },
    eventMap: {},
    accessibilityRole: 'AXBusyIndicator',
    anatomy: { root: 'NSProgressIndicator' },
  },
  chip: {
    viewClass: 'NSButton',
    viewProperties: { bezelStyle: 'inline', buttonType: 'pushOnPushOff' },
    eventMap: { click: 'click:', dismiss: 'click:' },
    accessibilityRole: 'AXButton',
    anatomy: { root: 'NSButton', label: 'NSTextField', dismiss: 'NSButton' },
  },

  // ----------------------------------------------------------
  // Form Controls
  // ----------------------------------------------------------
  textarea: {
    viewClass: 'NSTextView',
    viewProperties: { isEditable: true, isRichText: false, isFieldEditor: false },
    eventMap: { change: 'textDidChange:', focus: 'becomeFirstResponder' },
    accessibilityRole: 'AXTextArea',
    anatomy: { root: 'NSScrollView', editor: 'NSTextView' },
  },
  numberinput: {
    viewClass: 'NSTextField',
    viewProperties: { isEditable: true, formatter: 'NSNumberFormatter' },
    eventMap: { change: 'controlTextDidChange:', increment: 'stepperAction:', decrement: 'stepperAction:' },
    accessibilityRole: 'AXTextField',
    anatomy: { root: 'NSStackView', input: 'NSTextField', stepper: 'NSStepper' },
  },
  slider: {
    viewClass: 'NSSlider',
    viewProperties: { sliderType: 'linear', allowsTickMarkValuesOnly: false },
    eventMap: { change: 'sliderAction:' },
    accessibilityRole: 'AXSlider',
    anatomy: { root: 'NSSlider', track: 'NSView', thumb: 'NSView' },
  },
  toggleswitch: {
    viewClass: 'NSSwitch',
    viewProperties: {},
    eventMap: { change: 'switchAction:' },
    accessibilityRole: 'AXCheckBox',
    anatomy: { root: 'NSSwitch' },
  },
  radiogroup: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'vertical' },
    eventMap: { change: 'radioAction:' },
    accessibilityRole: 'AXRadioGroup',
    anatomy: { root: 'NSStackView', option: 'NSButton' },
  },
  radiocard: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'vertical' },
    eventMap: { change: 'radioAction:' },
    accessibilityRole: 'AXRadioGroup',
    anatomy: { root: 'NSStackView', card: 'NSBox', radio: 'NSButton' },
  },
  select: {
    viewClass: 'NSPopUpButton',
    viewProperties: { pullsDown: false, autoenablesItems: true },
    eventMap: { change: 'selectItem:', open: 'willPopUp:', close: 'didDismiss:' },
    accessibilityRole: 'AXPopUpButton',
    anatomy: { root: 'NSPopUpButton', menu: 'NSMenu', item: 'NSMenuItem' },
  },
  combobox: {
    viewClass: 'NSComboBox',
    viewProperties: { completes: true, hasVerticalScroller: true },
    eventMap: { change: 'comboBoxSelectionDidChange:', input: 'controlTextDidChange:' },
    accessibilityRole: 'AXComboBox',
    anatomy: { root: 'NSComboBox', list: 'NSTableView' },
  },
  segmentedcontrol: {
    viewClass: 'NSSegmentedControl',
    viewProperties: { segmentStyle: 'rounded', trackingMode: 'selectOne' },
    eventMap: { change: 'segmentAction:' },
    accessibilityRole: 'AXRadioGroup',
    anatomy: { root: 'NSSegmentedControl', segment: 'NSView' },
  },
  checkboxgroup: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'vertical' },
    eventMap: { change: 'checkboxGroupAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSStackView', checkbox: 'NSButton' },
  },
  multiselect: {
    viewClass: 'NSTokenField',
    viewProperties: { isEditable: true },
    eventMap: { change: 'tokenFieldDidChange:', add: 'tokenField:addToken:', remove: 'tokenField:removeToken:' },
    accessibilityRole: 'AXComboBox',
    anatomy: { root: 'NSTokenField', token: 'NSView', dropdown: 'NSTableView' },
  },
  comboboxmulti: {
    viewClass: 'NSComboBox',
    viewProperties: { completes: true, hasVerticalScroller: true },
    eventMap: { change: 'comboBoxSelectionDidChange:', input: 'controlTextDidChange:', tokenChange: 'tokenFieldDidChange:' },
    accessibilityRole: 'AXComboBox',
    anatomy: { root: 'NSStackView', combobox: 'NSComboBox', tokens: 'NSTokenField' },
  },
  chipinput: {
    viewClass: 'NSTokenField',
    viewProperties: { isEditable: true, tokenStyle: 'rounded' },
    eventMap: { add: 'tokenField:addToken:', remove: 'tokenField:removeToken:', change: 'tokenFieldDidChange:' },
    accessibilityRole: 'AXTextField',
    anatomy: { root: 'NSTokenField', chip: 'NSView' },
  },
  stepper: {
    viewClass: 'NSStepper',
    viewProperties: { autorepeat: true, valueWraps: false },
    eventMap: { change: 'stepperAction:' },
    accessibilityRole: 'AXIncrementor',
    anatomy: { root: 'NSStepper', up: 'NSButton', down: 'NSButton' },
  },
  progressbar: {
    viewClass: 'NSProgressIndicator',
    viewProperties: { style: 'bar', isIndeterminate: false },
    eventMap: {},
    accessibilityRole: 'AXProgressIndicator',
    anatomy: { root: 'NSProgressIndicator', track: 'NSView', fill: 'NSView' },
  },
  badge: {
    viewClass: 'NSTextField',
    viewProperties: { isEditable: false, isBordered: false, drawsBackground: true, wantsLayer: true, 'layer.cornerRadius': 8 },
    eventMap: {},
    accessibilityRole: 'AXStaticText',
    anatomy: { root: 'NSTextField' },
  },

  // ----------------------------------------------------------
  // Feedback & Overlay
  // ----------------------------------------------------------
  dialog: {
    viewClass: 'NSPanel',
    viewProperties: { styleMask: 'titled|closable|resizable', isFloatingPanel: false, level: 'modalPanel' },
    eventMap: { close: 'close:', open: 'makeKeyAndOrderFront:' },
    accessibilityRole: 'AXSheet',
    anatomy: { root: 'NSPanel', content: 'NSView', header: 'NSView', footer: 'NSView' },
  },
  alertdialog: {
    viewClass: 'NSAlert',
    viewProperties: { alertStyle: 'warning' },
    eventMap: { confirm: 'buttonAction:', cancel: 'buttonAction:', dismiss: 'close:' },
    accessibilityRole: 'AXSheet',
    anatomy: { root: 'NSAlert', icon: 'NSImageView', message: 'NSTextField', buttons: 'NSStackView' },
  },
  popover: {
    viewClass: 'NSPopover',
    viewProperties: { behavior: 'transient', animates: true },
    eventMap: { open: 'showRelativeToRect:ofView:preferredEdge:', close: 'performClose:' },
    accessibilityRole: 'AXPopover',
    anatomy: { root: 'NSPopover', content: 'NSView', arrow: 'NSView' },
  },
  tooltip: {
    viewClass: 'NSPopover',
    viewProperties: { behavior: 'semitransient', animates: true },
    eventMap: { show: 'showRelativeToRect:ofView:preferredEdge:', hide: 'performClose:' },
    accessibilityRole: 'AXHelpTag',
    anatomy: { root: 'NSPopover', content: 'NSTextField' },
  },
  toast: {
    viewClass: 'NSPanel',
    viewProperties: { styleMask: 'borderless', isFloatingPanel: true, level: 'floating', hidesOnDeactivate: false },
    eventMap: { dismiss: 'close:', action: 'click:' },
    accessibilityRole: 'AXGrowArea',
    anatomy: { root: 'NSPanel', content: 'NSStackView', icon: 'NSImageView', message: 'NSTextField', action: 'NSButton' },
  },
  toastmanager: {
    viewClass: 'NSView',
    viewProperties: { wantsLayer: true },
    eventMap: { add: 'addToast:', remove: 'removeToast:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSView', stack: 'NSStackView' },
  },
  alert: {
    viewClass: 'NSAlert',
    viewProperties: { alertStyle: 'informational' },
    eventMap: { confirm: 'buttonAction:', dismiss: 'close:' },
    accessibilityRole: 'AXSheet',
    anatomy: { root: 'NSAlert', icon: 'NSImageView', message: 'NSTextField' },
  },
  drawer: {
    viewClass: 'NSPanel',
    viewProperties: { styleMask: 'titled|closable|resizable', isFloatingPanel: true, animates: true },
    eventMap: { open: 'makeKeyAndOrderFront:', close: 'close:' },
    accessibilityRole: 'AXSheet',
    anatomy: { root: 'NSPanel', content: 'NSView', handle: 'NSView' },
  },
  hovercard: {
    viewClass: 'NSPopover',
    viewProperties: { behavior: 'semitransient', animates: true },
    eventMap: { show: 'showRelativeToRect:ofView:preferredEdge:', hide: 'performClose:' },
    accessibilityRole: 'AXPopover',
    anatomy: { root: 'NSPopover', content: 'NSView' },
  },
  contextmenu: {
    viewClass: 'NSMenu',
    viewProperties: { autoenablesItems: true },
    eventMap: { select: 'menuItemAction:', open: 'menuWillOpen:', close: 'menuDidClose:' },
    accessibilityRole: 'AXMenu',
    anatomy: { root: 'NSMenu', item: 'NSMenuItem', separator: 'NSMenuItem' },
  },

  // ----------------------------------------------------------
  // Navigation & Layout
  // ----------------------------------------------------------
  tabs: {
    viewClass: 'NSTabView',
    viewProperties: { tabViewType: 'topTabsBezelBorder' },
    eventMap: { change: 'tabView:didSelectTabViewItem:', willChange: 'tabView:willSelectTabViewItem:' },
    accessibilityRole: 'AXTabGroup',
    anatomy: { root: 'NSTabView', tab: 'NSTabViewItem', panel: 'NSView' },
  },
  toolbar: {
    viewClass: 'NSToolbar',
    viewProperties: { displayMode: 'iconAndLabel', sizeMode: 'regular' },
    eventMap: { select: 'toolbarItemAction:' },
    accessibilityRole: 'AXToolbar',
    anatomy: { root: 'NSToolbar', item: 'NSToolbarItem', separator: 'NSToolbarItem' },
  },
  menu: {
    viewClass: 'NSMenu',
    viewProperties: { autoenablesItems: true },
    eventMap: { select: 'menuItemAction:', open: 'menuWillOpen:', close: 'menuDidClose:' },
    accessibilityRole: 'AXMenu',
    anatomy: { root: 'NSMenu', item: 'NSMenuItem', separator: 'NSMenuItem', submenu: 'NSMenu' },
  },
  breadcrumb: {
    viewClass: 'NSPathControl',
    viewProperties: { pathStyle: 'standard', isEditable: false },
    eventMap: { select: 'pathItemAction:', doubleClick: 'doubleClick:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSPathControl', item: 'NSPathControlItem', separator: 'NSView' },
  },
  accordion: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'vertical', detachesHiddenViews: true },
    eventMap: { toggle: 'disclosureAction:', expand: 'disclosureAction:', collapse: 'disclosureAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSStackView', section: 'NSView', header: 'NSButton', content: 'NSView' },
  },
  disclosure: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'vertical' },
    eventMap: { toggle: 'disclosureAction:' },
    accessibilityRole: 'AXDisclosureTriangle',
    anatomy: { root: 'NSStackView', trigger: 'NSButton', content: 'NSView' },
  },
  pagination: {
    viewClass: 'NSSegmentedControl',
    viewProperties: { segmentStyle: 'rounded', trackingMode: 'selectOne' },
    eventMap: { change: 'pageAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSSegmentedControl', page: 'NSView', prev: 'NSButton', next: 'NSButton' },
  },
  commandpalette: {
    viewClass: 'NSPanel',
    viewProperties: { styleMask: 'titled|closable', isFloatingPanel: true, level: 'floating' },
    eventMap: { select: 'commandAction:', input: 'controlTextDidChange:', dismiss: 'cancelOperation:' },
    accessibilityRole: 'AXSheet',
    anatomy: { root: 'NSPanel', search: 'NSTextField', results: 'NSTableView', item: 'NSTableCellView' },
  },
  sidebar: {
    viewClass: 'NSSplitViewItem',
    viewProperties: { behavior: 'sidebar', canCollapse: true, minimumThickness: 200 },
    eventMap: { collapse: 'toggleSidebar:', expand: 'toggleSidebar:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSSplitViewItem', content: 'NSView', header: 'NSView' },
  },
  splitter: {
    viewClass: 'NSSplitView',
    viewProperties: { isVertical: true, dividerStyle: 'thin' },
    eventMap: { resize: 'splitViewDidResizeSubviews:', doubleClick: 'splitView:shouldCollapseSubview:forDoubleClickOnDividerAtIndex:' },
    accessibilityRole: 'AXSplitGroup',
    anatomy: { root: 'NSSplitView', pane: 'NSView', divider: 'NSView' },
  },
  floatingtoolbar: {
    viewClass: 'NSPanel',
    viewProperties: { styleMask: 'borderless|utilityWindow', isFloatingPanel: true, level: 'floating', hidesOnDeactivate: true },
    eventMap: { select: 'toolbarItemAction:' },
    accessibilityRole: 'AXToolbar',
    anatomy: { root: 'NSPanel', content: 'NSStackView', item: 'NSButton' },
  },
  fieldset: {
    viewClass: 'NSBox',
    viewProperties: { boxType: 'primary', titlePosition: 'atTop' },
    eventMap: {},
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSBox', legend: 'NSTextField', content: 'NSView' },
  },
  form: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'vertical', alignment: 'leading' },
    eventMap: { submit: 'submitAction:', reset: 'resetAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSStackView', field: 'NSView', actions: 'NSStackView' },
  },
  navigationmenu: {
    viewClass: 'NSMenu',
    viewProperties: { autoenablesItems: true },
    eventMap: { select: 'menuItemAction:', open: 'menuWillOpen:', close: 'menuDidClose:' },
    accessibilityRole: 'AXMenuBar',
    anatomy: { root: 'NSMenu', item: 'NSMenuItem', submenu: 'NSMenu' },
  },

  // ----------------------------------------------------------
  // Data Display
  // ----------------------------------------------------------
  datatable: {
    viewClass: 'NSTableView',
    viewProperties: { usesAlternatingRowBackgroundColors: true, allowsColumnReordering: true, allowsColumnResizing: true, allowsMultipleSelection: false },
    eventMap: { select: 'tableViewSelectionDidChange:', sort: 'tableView:sortDescriptorsDidChange:', doubleClick: 'doubleClick:' },
    accessibilityRole: 'AXTable',
    anatomy: { root: 'NSScrollView', table: 'NSTableView', header: 'NSTableHeaderView', column: 'NSTableColumn', row: 'NSTableRowView', cell: 'NSTableCellView' },
  },
  card: {
    viewClass: 'NSBox',
    viewProperties: { boxType: 'custom', cornerRadius: 8, borderWidth: 1, wantsLayer: true },
    eventMap: { click: 'click:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSBox', header: 'NSView', content: 'NSView', footer: 'NSView' },
  },
  list: {
    viewClass: 'NSTableView',
    viewProperties: { usesAlternatingRowBackgroundColors: false, selectionHighlightStyle: 'regular' },
    eventMap: { select: 'tableViewSelectionDidChange:', doubleClick: 'doubleClick:' },
    accessibilityRole: 'AXList',
    anatomy: { root: 'NSScrollView', table: 'NSTableView', row: 'NSTableRowView', cell: 'NSTableCellView' },
  },
  cardgrid: {
    viewClass: 'NSCollectionView',
    viewProperties: { isSelectable: true, allowsMultipleSelection: false },
    eventMap: { select: 'collectionView:didSelectItemsAtIndexPaths:', doubleClick: 'doubleClick:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSScrollView', collection: 'NSCollectionView', item: 'NSCollectionViewItem' },
  },
  statcard: {
    viewClass: 'NSBox',
    viewProperties: { boxType: 'custom', cornerRadius: 8, wantsLayer: true },
    eventMap: { click: 'click:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSBox', value: 'NSTextField', label: 'NSTextField', trend: 'NSImageView' },
  },
  kanbanboard: {
    viewClass: 'NSCollectionView',
    viewProperties: { isSelectable: true, allowsMultipleSelection: false },
    eventMap: { move: 'collectionView:moveItemAtIndexPath:toIndexPath:', select: 'collectionView:didSelectItemsAtIndexPaths:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSScrollView', collection: 'NSCollectionView', column: 'NSStackView', card: 'NSBox' },
  },
  calendarview: {
    viewClass: 'NSDatePicker',
    viewProperties: { datePickerStyle: 'clockAndCalendar', datePickerMode: 'single', datePickerElements: 'yearMonthDay' },
    eventMap: { change: 'datePickerAction:', navigate: 'datePickerAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSDatePicker', header: 'NSView', grid: 'NSView', cell: 'NSView' },
  },
  timeline: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'vertical', alignment: 'leading' },
    eventMap: { select: 'timelineItemAction:' },
    accessibilityRole: 'AXList',
    anatomy: { root: 'NSScrollView', stack: 'NSStackView', item: 'NSView', connector: 'NSView', marker: 'NSView' },
  },
  emptystate: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'vertical', alignment: 'centerX' },
    eventMap: { action: 'click:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSStackView', icon: 'NSImageView', title: 'NSTextField', description: 'NSTextField', action: 'NSButton' },
  },
  datalist: {
    viewClass: 'NSTableView',
    viewProperties: { usesAlternatingRowBackgroundColors: true, selectionHighlightStyle: 'regular' },
    eventMap: { select: 'tableViewSelectionDidChange:' },
    accessibilityRole: 'AXList',
    anatomy: { root: 'NSScrollView', table: 'NSTableView', row: 'NSTableRowView', cell: 'NSTableCellView' },
  },
  chart: {
    viewClass: 'NSView',
    viewProperties: { wantsLayer: true },
    eventMap: { hover: 'chartHoverAction:', select: 'chartSelectAction:' },
    accessibilityRole: 'AXImage',
    anatomy: { root: 'NSView', canvas: 'CALayer', legend: 'NSStackView', tooltip: 'NSPopover' },
  },
  gauge: {
    viewClass: 'NSLevelIndicator',
    viewProperties: { levelIndicatorStyle: 'continuousCapacity' },
    eventMap: {},
    accessibilityRole: 'AXLevelIndicator',
    anatomy: { root: 'NSLevelIndicator', track: 'NSView', fill: 'NSView', label: 'NSTextField' },
  },
  notificationitem: {
    viewClass: 'NSBox',
    viewProperties: { boxType: 'custom', cornerRadius: 4, wantsLayer: true },
    eventMap: { click: 'click:', dismiss: 'dismissAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSBox', icon: 'NSImageView', title: 'NSTextField', body: 'NSTextField', timestamp: 'NSTextField' },
  },
  viewtoggle: {
    viewClass: 'NSSegmentedControl',
    viewProperties: { segmentStyle: 'rounded', trackingMode: 'selectOne' },
    eventMap: { change: 'segmentAction:' },
    accessibilityRole: 'AXRadioGroup',
    anatomy: { root: 'NSSegmentedControl' },
  },
  skeleton: {
    viewClass: 'NSView',
    viewProperties: { wantsLayer: true, 'layer.backgroundColor': 'systemGray5' },
    eventMap: {},
    accessibilityRole: 'AXBusyIndicator',
    anatomy: { root: 'NSView', shimmer: 'CAGradientLayer' },
  },

  // ----------------------------------------------------------
  // Complex Inputs
  // ----------------------------------------------------------
  datepicker: {
    viewClass: 'NSDatePicker',
    viewProperties: { datePickerStyle: 'textFieldAndStepper', datePickerElements: 'yearMonthDay' },
    eventMap: { change: 'datePickerAction:' },
    accessibilityRole: 'AXDateField',
    anatomy: { root: 'NSDatePicker' },
  },
  daterangepicker: {
    viewClass: 'NSDatePicker',
    viewProperties: { datePickerStyle: 'textFieldAndStepper', datePickerMode: 'range', datePickerElements: 'yearMonthDay' },
    eventMap: { change: 'datePickerAction:' },
    accessibilityRole: 'AXDateField',
    anatomy: { root: 'NSStackView', start: 'NSDatePicker', end: 'NSDatePicker' },
  },
  colorpicker: {
    viewClass: 'NSColorWell',
    viewProperties: { colorWellStyle: 'default' },
    eventMap: { change: 'colorWellAction:' },
    accessibilityRole: 'AXColorWell',
    anatomy: { root: 'NSColorWell', panel: 'NSColorPanel' },
  },
  fileupload: {
    viewClass: 'NSView',
    viewProperties: { wantsLayer: true },
    eventMap: { select: 'openPanelAction:', drop: 'performDragOperation:', cancel: 'cancelOperation:' },
    accessibilityRole: 'AXButton',
    anatomy: { root: 'NSView', trigger: 'NSButton', panel: 'NSOpenPanel', preview: 'NSStackView' },
  },
  richtexteditor: {
    viewClass: 'NSTextView',
    viewProperties: { isEditable: true, isRichText: true, allowsUndo: true, usesRuler: true },
    eventMap: { change: 'textDidChange:', selection: 'textViewDidChangeSelection:', focus: 'becomeFirstResponder' },
    accessibilityRole: 'AXTextArea',
    anatomy: { root: 'NSScrollView', editor: 'NSTextView', toolbar: 'NSStackView', ruler: 'NSRulerView' },
  },
  mentioninput: {
    viewClass: 'NSTextView',
    viewProperties: { isEditable: true, isRichText: false },
    eventMap: { change: 'textDidChange:', mention: 'mentionAction:', select: 'mentionSelectAction:' },
    accessibilityRole: 'AXTextArea',
    anatomy: { root: 'NSView', editor: 'NSTextView', popup: 'NSTableView' },
  },
  treeselect: {
    viewClass: 'NSOutlineView',
    viewProperties: { indentationPerLevel: 16, autoresizesOutlineColumn: true },
    eventMap: { select: 'outlineViewSelectionDidChange:', expand: 'outlineViewItemWillExpand:', collapse: 'outlineViewItemWillCollapse:' },
    accessibilityRole: 'AXOutline',
    anatomy: { root: 'NSScrollView', outline: 'NSOutlineView', row: 'NSTableRowView', cell: 'NSTableCellView' },
  },
  formulaeditor: {
    viewClass: 'NSTextView',
    viewProperties: { isEditable: true, isRichText: false, font: 'monospacedSystemFont' },
    eventMap: { change: 'textDidChange:', evaluate: 'evaluateAction:', error: 'formulaErrorAction:' },
    accessibilityRole: 'AXTextArea',
    anatomy: { root: 'NSView', editor: 'NSTextView', preview: 'NSTextField', autocomplete: 'NSTableView' },
  },
  rangeslider: {
    viewClass: 'NSSlider',
    viewProperties: { sliderType: 'linear', numberOfTickMarks: 0 },
    eventMap: { change: 'sliderAction:' },
    accessibilityRole: 'AXSlider',
    anatomy: { root: 'NSView', track: 'NSView', thumbLow: 'NSView', thumbHigh: 'NSView' },
  },
  rating: {
    viewClass: 'NSLevelIndicator',
    viewProperties: { levelIndicatorStyle: 'rating', isEditable: true },
    eventMap: { change: 'ratingAction:' },
    accessibilityRole: 'AXLevelIndicator',
    anatomy: { root: 'NSLevelIndicator' },
  },
  pininput: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'horizontal', spacing: 8 },
    eventMap: { change: 'pinInputAction:', complete: 'pinCompleteAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSStackView', digit: 'NSTextField' },
  },
  signaturepad: {
    viewClass: 'NSView',
    viewProperties: { wantsLayer: true, acceptsTouchEvents: true },
    eventMap: { change: 'signatureAction:', clear: 'clearAction:', complete: 'signatureCompleteAction:' },
    accessibilityRole: 'AXImage',
    anatomy: { root: 'NSView', canvas: 'CALayer', clear: 'NSButton' },
  },

  // ----------------------------------------------------------
  // Composite Patterns
  // ----------------------------------------------------------
  filterbuilder: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'vertical' },
    eventMap: { change: 'filterAction:', add: 'addFilterAction:', remove: 'removeFilterAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSStackView', row: 'NSStackView', field: 'NSPopUpButton', operator: 'NSPopUpButton', value: 'NSTextField', add: 'NSButton', remove: 'NSButton' },
  },
  sortbuilder: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'vertical' },
    eventMap: { change: 'sortAction:', add: 'addSortAction:', remove: 'removeSortAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSStackView', row: 'NSStackView', field: 'NSPopUpButton', direction: 'NSSegmentedControl', remove: 'NSButton' },
  },
  viewswitcher: {
    viewClass: 'NSSegmentedControl',
    viewProperties: { segmentStyle: 'rounded', trackingMode: 'selectOne' },
    eventMap: { change: 'segmentAction:' },
    accessibilityRole: 'AXRadioGroup',
    anatomy: { root: 'NSSegmentedControl' },
  },
  propertypanel: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'vertical', alignment: 'leading' },
    eventMap: { change: 'propertyAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSScrollView', stack: 'NSStackView', section: 'NSBox', field: 'NSView' },
  },
  schemaeditor: {
    viewClass: 'NSOutlineView',
    viewProperties: { indentationPerLevel: 16, autoresizesOutlineColumn: true },
    eventMap: { select: 'outlineViewSelectionDidChange:', add: 'addFieldAction:', remove: 'removeFieldAction:', change: 'fieldChangeAction:' },
    accessibilityRole: 'AXOutline',
    anatomy: { root: 'NSScrollView', outline: 'NSOutlineView', row: 'NSTableRowView', typePopup: 'NSPopUpButton' },
  },
  notificationcenter: {
    viewClass: 'NSPanel',
    viewProperties: { styleMask: 'titled|closable', isFloatingPanel: true, level: 'floating' },
    eventMap: { select: 'notificationAction:', dismiss: 'dismissNotificationAction:', clear: 'clearAllAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSPanel', list: 'NSTableView', item: 'NSTableCellView', header: 'NSView' },
  },
  preferencematrix: {
    viewClass: 'NSGridView',
    viewProperties: {},
    eventMap: { change: 'matrixAction:' },
    accessibilityRole: 'AXTable',
    anatomy: { root: 'NSScrollView', grid: 'NSGridView', rowHeader: 'NSTextField', colHeader: 'NSTextField', cell: 'NSButton' },
  },
  permissionmatrix: {
    viewClass: 'NSGridView',
    viewProperties: {},
    eventMap: { change: 'permissionAction:' },
    accessibilityRole: 'AXTable',
    anatomy: { root: 'NSScrollView', grid: 'NSGridView', rowHeader: 'NSTextField', colHeader: 'NSTextField', cell: 'NSButton' },
  },
  facetedsearch: {
    viewClass: 'NSSplitView',
    viewProperties: { isVertical: true, dividerStyle: 'thin' },
    eventMap: { search: 'searchAction:', filter: 'filterAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSSplitView', filters: 'NSStackView', results: 'NSTableView', search: 'NSSearchField' },
  },
  filebrowser: {
    viewClass: 'NSSplitView',
    viewProperties: { isVertical: true, dividerStyle: 'thin' },
    eventMap: { select: 'fileSelectAction:', navigate: 'fileNavigateAction:', open: 'fileOpenAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSSplitView', sidebar: 'NSOutlineView', content: 'NSTableView', toolbar: 'NSStackView', breadcrumb: 'NSPathControl' },
  },
  queuedashboard: {
    viewClass: 'NSSplitView',
    viewProperties: { isVertical: false, dividerStyle: 'thin' },
    eventMap: { select: 'queueSelectAction:', action: 'queueItemAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSSplitView', queues: 'NSTableView', detail: 'NSView', stats: 'NSStackView' },
  },
  diffviewer: {
    viewClass: 'NSSplitView',
    viewProperties: { isVertical: true, dividerStyle: 'thin' },
    eventMap: { navigate: 'diffNavigateAction:', accept: 'diffAcceptAction:', reject: 'diffRejectAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSSplitView', left: 'NSTextView', right: 'NSTextView', gutter: 'NSView' },
  },
  backlinkpanel: {
    viewClass: 'NSTableView',
    viewProperties: { usesAlternatingRowBackgroundColors: false, selectionHighlightStyle: 'regular' },
    eventMap: { select: 'backlinkSelectAction:', navigate: 'backlinkNavigateAction:' },
    accessibilityRole: 'AXList',
    anatomy: { root: 'NSScrollView', table: 'NSTableView', row: 'NSTableRowView', cell: 'NSTableCellView' },
  },
  plugincard: {
    viewClass: 'NSBox',
    viewProperties: { boxType: 'custom', cornerRadius: 8, wantsLayer: true },
    eventMap: { click: 'click:', install: 'installAction:', remove: 'removeAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSBox', icon: 'NSImageView', title: 'NSTextField', description: 'NSTextField', action: 'NSButton' },
  },
  cachedashboard: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'vertical' },
    eventMap: { refresh: 'refreshAction:', clear: 'clearCacheAction:', select: 'cacheSelectAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSStackView', stats: 'NSStackView', table: 'NSTableView', actions: 'NSStackView' },
  },
  masterdetail: {
    viewClass: 'NSSplitViewController',
    viewProperties: {},
    eventMap: { select: 'masterSelectionDidChange:' },
    accessibilityRole: 'AXSplitGroup',
    anatomy: { root: 'NSSplitViewController', master: 'NSSplitViewItem', detail: 'NSSplitViewItem', masterView: 'NSTableView', detailView: 'NSView' },
  },

  // ----------------------------------------------------------
  // Domain Composites
  // ----------------------------------------------------------
  blockeditor: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'vertical', alignment: 'leading' },
    eventMap: { change: 'blockChangeAction:', add: 'addBlockAction:', remove: 'removeBlockAction:', reorder: 'reorderBlockAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSScrollView', stack: 'NSStackView', block: 'NSView', handle: 'NSView', toolbar: 'NSStackView' },
  },
  slashmenu: {
    viewClass: 'NSMenu',
    viewProperties: { autoenablesItems: true },
    eventMap: { select: 'menuItemAction:', filter: 'controlTextDidChange:', dismiss: 'cancelOperation:' },
    accessibilityRole: 'AXMenu',
    anatomy: { root: 'NSMenu', item: 'NSMenuItem', category: 'NSMenuItem' },
  },
  outliner: {
    viewClass: 'NSOutlineView',
    viewProperties: { indentationPerLevel: 20, autoresizesOutlineColumn: true, allowsMultipleSelection: false },
    eventMap: { select: 'outlineViewSelectionDidChange:', expand: 'outlineViewItemWillExpand:', collapse: 'outlineViewItemWillCollapse:', reorder: 'outlineView:moveItem:' },
    accessibilityRole: 'AXOutline',
    anatomy: { root: 'NSScrollView', outline: 'NSOutlineView', row: 'NSTableRowView', cell: 'NSTableCellView', handle: 'NSView' },
  },
  canvas: {
    viewClass: 'NSView',
    viewProperties: { wantsLayer: true, acceptsTouchEvents: true },
    eventMap: { click: 'canvasClickAction:', drag: 'canvasDragAction:', zoom: 'magnifyWithEvent:', pan: 'scrollWheel:' },
    accessibilityRole: 'AXImage',
    anatomy: { root: 'NSView', layer: 'CALayer', selection: 'CAShapeLayer' },
  },
  canvasconnector: {
    viewClass: 'NSView',
    viewProperties: { wantsLayer: true },
    eventMap: { select: 'connectorSelectAction:', move: 'connectorMoveAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSView', path: 'CAShapeLayer', startHandle: 'NSView', endHandle: 'NSView' },
  },
  canvasnode: {
    viewClass: 'NSView',
    viewProperties: { wantsLayer: true },
    eventMap: { select: 'nodeSelectAction:', move: 'nodeMoveAction:', resize: 'nodeResizeAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSView', content: 'NSView', ports: 'NSView', handle: 'NSView' },
  },
  workfloweditor: {
    viewClass: 'NSView',
    viewProperties: { wantsLayer: true, acceptsTouchEvents: true },
    eventMap: { select: 'workflowSelectAction:', connect: 'workflowConnectAction:', zoom: 'magnifyWithEvent:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSView', canvas: 'CALayer', node: 'NSView', connector: 'CAShapeLayer', toolbar: 'NSStackView' },
  },
  workflownode: {
    viewClass: 'NSView',
    viewProperties: { wantsLayer: true },
    eventMap: { select: 'nodeSelectAction:', configure: 'nodeConfigureAction:', connect: 'nodeConnectAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSView', header: 'NSView', ports: 'NSStackView', content: 'NSView' },
  },
  statemachinediagram: {
    viewClass: 'NSView',
    viewProperties: { wantsLayer: true },
    eventMap: { select: 'stateSelectAction:', transition: 'transitionAction:', zoom: 'magnifyWithEvent:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSView', canvas: 'CALayer', state: 'NSView', transition: 'CAShapeLayer' },
  },
  automationbuilder: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'vertical', alignment: 'leading' },
    eventMap: { add: 'addStepAction:', remove: 'removeStepAction:', configure: 'configureStepAction:', reorder: 'reorderStepAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSScrollView', stack: 'NSStackView', step: 'NSBox', connector: 'NSView', trigger: 'NSBox', action: 'NSBox' },
  },
  graphview: {
    viewClass: 'NSView',
    viewProperties: { wantsLayer: true, acceptsTouchEvents: true },
    eventMap: { select: 'graphSelectAction:', zoom: 'magnifyWithEvent:', pan: 'scrollWheel:', hover: 'graphHoverAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSView', canvas: 'CALayer', node: 'NSView', edge: 'CAShapeLayer' },
  },
  conditionbuilder: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'vertical' },
    eventMap: { change: 'conditionAction:', addGroup: 'addGroupAction:', addCondition: 'addConditionAction:', remove: 'removeConditionAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSStackView', group: 'NSBox', row: 'NSStackView', field: 'NSPopUpButton', operator: 'NSPopUpButton', value: 'NSTextField' },
  },
  fieldmapper: {
    viewClass: 'NSSplitView',
    viewProperties: { isVertical: true, dividerStyle: 'thin' },
    eventMap: { map: 'mapFieldAction:', unmap: 'unmapFieldAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSSplitView', source: 'NSTableView', target: 'NSTableView', connectors: 'NSView' },
  },
  minimap: {
    viewClass: 'NSView',
    viewProperties: { wantsLayer: true },
    eventMap: { navigate: 'minimapNavigateAction:', resize: 'minimapResizeAction:' },
    accessibilityRole: 'AXImage',
    anatomy: { root: 'NSView', canvas: 'CALayer', viewport: 'CAShapeLayer' },
  },
  colorlabelpicker: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'horizontal', spacing: 4 },
    eventMap: { select: 'colorLabelAction:' },
    accessibilityRole: 'AXRadioGroup',
    anatomy: { root: 'NSStackView', swatch: 'NSColorWell', label: 'NSTextField' },
  },
  draghandle: {
    viewClass: 'NSView',
    viewProperties: { wantsLayer: true },
    eventMap: { dragStart: 'draggingSession:willBeginAtPoint:', dragEnd: 'draggingSession:endedAtPoint:operation:' },
    accessibilityRole: 'AXHandle',
    anatomy: { root: 'NSView', grip: 'NSImageView' },
  },
  inlineedit: {
    viewClass: 'NSTextField',
    viewProperties: { isEditable: true, isBordered: false, drawsBackground: false, focusRingType: 'none' },
    eventMap: { commit: 'controlTextDidEndEditing:', cancel: 'cancelOperation:', change: 'controlTextDidChange:' },
    accessibilityRole: 'AXTextField',
    anatomy: { root: 'NSTextField' },
  },
  stepindicator: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'horizontal', distribution: 'fillEqually' },
    eventMap: { select: 'stepAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSStackView', step: 'NSView', connector: 'NSView', label: 'NSTextField', indicator: 'NSView' },
  },
  imagegallery: {
    viewClass: 'NSCollectionView',
    viewProperties: { isSelectable: true, allowsMultipleSelection: true },
    eventMap: { select: 'collectionView:didSelectItemsAtIndexPaths:', preview: 'quickLookAction:', zoom: 'magnifyWithEvent:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSScrollView', collection: 'NSCollectionView', item: 'NSCollectionViewItem', preview: 'QLPreviewPanel' },
  },
  markdownpreview: {
    viewClass: 'NSTextView',
    viewProperties: { isEditable: false, isRichText: true, drawsBackground: true },
    eventMap: { linkClick: 'textView:clickedOnLink:atIndex:' },
    accessibilityRole: 'AXTextArea',
    anatomy: { root: 'NSScrollView', content: 'NSTextView' },
  },
  codeblock: {
    viewClass: 'NSTextView',
    viewProperties: { isEditable: false, isRichText: true, font: 'monospacedSystemFont', drawsBackground: true },
    eventMap: { copy: 'copy:' },
    accessibilityRole: 'AXTextArea',
    anatomy: { root: 'NSScrollView', editor: 'NSTextView', lineNumbers: 'NSRulerView', copyButton: 'NSButton' },
  },
  policyeditor: {
    viewClass: 'NSOutlineView',
    viewProperties: { indentationPerLevel: 16, autoresizesOutlineColumn: true },
    eventMap: { select: 'outlineViewSelectionDidChange:', add: 'addPolicyAction:', remove: 'removePolicyAction:', change: 'policyChangeAction:' },
    accessibilityRole: 'AXOutline',
    anatomy: { root: 'NSSplitView', outline: 'NSOutlineView', detail: 'NSStackView' },
  },
  plugindetailpage: {
    viewClass: 'NSScrollView',
    viewProperties: { hasVerticalScroller: true, autohidesScrollers: true },
    eventMap: { install: 'installAction:', remove: 'removeAction:', configure: 'configureAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSScrollView', content: 'NSStackView', header: 'NSView', description: 'NSTextView', actions: 'NSStackView' },
  },
  tokeninput: {
    viewClass: 'NSTokenField',
    viewProperties: { isEditable: true, tokenStyle: 'rounded' },
    eventMap: { add: 'tokenField:addToken:', remove: 'tokenField:removeToken:', change: 'tokenFieldDidChange:' },
    accessibilityRole: 'AXTextField',
    anatomy: { root: 'NSTokenField', token: 'NSView' },
  },
  croneditor: {
    viewClass: 'NSStackView',
    viewProperties: { orientation: 'horizontal', spacing: 4 },
    eventMap: { change: 'cronChangeAction:' },
    accessibilityRole: 'AXGroup',
    anatomy: { root: 'NSStackView', minute: 'NSPopUpButton', hour: 'NSPopUpButton', day: 'NSPopUpButton', month: 'NSPopUpButton', weekday: 'NSPopUpButton', preview: 'NSTextField' },
  },
};

// ============================================================
// Handler actions
// ============================================================

const _appKitAdapterHandler: FunctionalConceptHandler = {
  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const props = input.props as string;

    if (!props || props.trim() === '') {
      let p = createProgram();
      return complete(p, 'error', { message: 'Props cannot be empty' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(props);
    } catch {
      let p = createProgram();
      return complete(p, 'error', { message: 'Props must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(parsed)) {
      // ARIA and data-* pass through as accessibility properties
      if (key.startsWith('aria-')) {
        const accessibilityProp = key.replace('aria-', 'accessibility');
        normalized[accessibilityProp] = value;
        continue;
      }

      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> NSView class hierarchy
      if (key === 'class') {
        normalized['__viewClass'] = value;
        continue;
      }

      // Event handlers -> target/action pattern
      if (key.startsWith('on')) {
        const action = APPKIT_ACTION_MAP[key.toLowerCase()];
        if (action) {
          normalized[`__action:${action}`] = { target: value, action };
        } else {
          const eventName = key.slice(2).toLowerCase();
          normalized[`__action:${eventName}:`] = { target: value, action: `${eventName}:` };
        }
        continue;
      }

      // style -> NSView property assignments
      if (key === 'style') {
        normalized['__viewProperties'] = value;
        continue;
      }

      // Layout -> AppKit NSStackView/NSGridView/NSSplitView containers
      if (key === 'layout') {
        let layoutConfig: Record<string, unknown>;
        try {
          layoutConfig = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>;
        } catch {
          layoutConfig = { kind: value };
        }
        const kind = (layoutConfig.kind as string) || 'stack';
        const direction = (layoutConfig.direction as string) || 'column';
        const gap = layoutConfig.gap as string | undefined;
        const columns = layoutConfig.columns as string | undefined;
        const layout: Record<string, unknown> = {};
        switch (kind) {
          case 'grid':
            layout.container = 'NSGridView';
            if (columns) layout.columns = columns;
            break;
          case 'split':
            layout.container = 'NSSplitView';
            break;
          case 'overlay':
            layout.container = 'NSView';
            layout.subviewLayout = 'stacked';
            break;
          case 'flow':
            layout.container = 'NSCollectionView';
            layout.collectionLayout = 'flowLayout';
            break;
          case 'sidebar':
            layout.container = 'NSSplitView';
            break;
          case 'center':
            layout.container = 'NSView';
            layout.constraints = 'centered';
            break;
          case 'stack':
          default:
            layout.container = 'NSStackView';
            layout.orientation = direction === 'row' ? '.horizontal' : '.vertical';
            break;
        }
        if (gap) layout.spacing = gap;
        normalized['__layout'] = layout;
        continue;
      }

      // Theme -> AppKit type references (NSColor, NSFont)
      if (key === 'theme') {
        let theme: Record<string, unknown>;
        try {
          theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>;
        } catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>;
        const appkitTokens: Record<string, string> = {};
        for (const [tokenName, tokenValue] of Object.entries(tokens)) {
          if (tokenName.startsWith('color-')) {
            appkitTokens[`NSColor:${tokenName.replace('color-', '')}`] = tokenValue;
          } else if (tokenName.startsWith('font-')) {
            appkitTokens[`NSFont:${tokenName.replace('font-', '')}`] = tokenValue;
          } else {
            appkitTokens[tokenName] = tokenValue;
          }
        }
        normalized['__themeTokens'] = appkitTokens;
        continue;
      }

      // All other props -> NSView configuration
      normalized[key] = value;
    }

    // Auto-enrich with widget mapping when __widget is present
    if (parsed['__widget']) {
      const widgetKey = String(parsed['__widget']).replace(/[-_\s]/g, '').toLowerCase();
      const mapping = APPKIT_WIDGET_MAP[widgetKey];
      if (mapping) {
        normalized['__viewClass'] = normalized['__viewClass'] ?? mapping.viewClass;
        normalized['__accessibilityRole'] = mapping.accessibilityRole;
      }
    }

    let p = createProgram();
    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolveWidget(input: Record<string, unknown>) {
    const widget = input.widget as string;

    if (!widget || widget.trim() === '') {
      let p = createProgram();
      return complete(p, 'error', { message: 'Widget name is required' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    // Normalize: 'TextInput' | 'text-input' | 'textinput' → 'textinput'
    const key = widget.replace(/[-_\s]/g, '').toLowerCase();

    const mapping = APPKIT_WIDGET_MAP[key];
    if (!mapping) {
      let p = createProgram();
      return complete(p, 'unknown', {
        widget,
        message: `No AppKit mapping found for widget "${widget}"`,
        availableWidgets: Object.keys(APPKIT_WIDGET_MAP),
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    return complete(p, 'ok', {
      widget,
      viewClass: mapping.viewClass,
      viewProperties: mapping.viewProperties,
      eventMap: mapping.eventMap,
      accessibilityRole: mapping.accessibilityRole,
      anatomy: mapping.anatomy,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const appKitAdapterHandler = autoInterpret(_appKitAdapterHandler);

