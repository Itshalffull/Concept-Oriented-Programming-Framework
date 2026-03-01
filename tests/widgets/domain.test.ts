import { describe, it, expect } from 'vitest';

import { abReducer, type ABState, type ABEvent } from '../../surface/widgets/nextjs/components/widgets/domain/AutomationBuilder.reducer.js';
import { blockEditorReducer, type BlockEditorState, type BlockEditorEvent } from '../../surface/widgets/nextjs/components/widgets/domain/BlockEditor.reducer.js';
import { canvasReducer, type CanvasState, type CanvasEvent } from '../../surface/widgets/nextjs/components/widgets/domain/Canvas.reducer.js';
import { connectorReducer, type ConnectorState, type ConnectorEvent } from '../../surface/widgets/nextjs/components/widgets/domain/CanvasConnector.reducer.js';
import { canvasNodeReducer, type CanvasNodeState, type CanvasNodeEvent } from '../../surface/widgets/nextjs/components/widgets/domain/CanvasNode.reducer.js';
import { codeBlockReducer, type CodeBlockState, type CodeBlockEvent } from '../../surface/widgets/nextjs/components/widgets/domain/CodeBlock.reducer.js';
import { pickerReducer, type PickerState, type PickerEvent } from '../../surface/widgets/nextjs/components/widgets/domain/ColorLabelPicker.reducer.js';
import { cbReducer, type CBState, type CBEvent } from '../../surface/widgets/nextjs/components/widgets/domain/ConditionBuilder.reducer.js';
import { cronReducer, type CronState, type CronEvent } from '../../surface/widgets/nextjs/components/widgets/domain/CronEditor.reducer.js';
import { dragHandleReducer, type DragHandleState, type DragHandleEvent } from '../../surface/widgets/nextjs/components/widgets/domain/DragHandle.reducer.js';
import { fmReducer, type FMState, type FMEvent } from '../../surface/widgets/nextjs/components/widgets/domain/FieldMapper.reducer.js';
import { gvReducer, type GVState, type GVEvent } from '../../surface/widgets/nextjs/components/widgets/domain/GraphView.reducer.js';
import { galleryReducer, type GalleryState, type GalleryEvent } from '../../surface/widgets/nextjs/components/widgets/domain/ImageGallery.reducer.js';
import { inlineEditReducer, type InlineEditState, type InlineEditEvent } from '../../surface/widgets/nextjs/components/widgets/domain/InlineEdit.reducer.js';
import { markdownReducer, type MarkdownState, type MarkdownEvent } from '../../surface/widgets/nextjs/components/widgets/domain/MarkdownPreview.reducer.js';
import { minimapReducer, type MinimapState, type MinimapEvent } from '../../surface/widgets/nextjs/components/widgets/domain/Minimap.reducer.js';
import { outlinerReducer, type OutlinerState, type OutlinerEvent } from '../../surface/widgets/nextjs/components/widgets/domain/Outliner.reducer.js';
import { pdpReducer, type PDPState, type PDPEvent } from '../../surface/widgets/nextjs/components/widgets/domain/PluginDetailPage.reducer.js';
import { peReducer, type PEState, type PEEvent } from '../../surface/widgets/nextjs/components/widgets/domain/PolicyEditor.reducer.js';
import { slashMenuReducer, type SlashMenuState, type SlashMenuEvent } from '../../surface/widgets/nextjs/components/widgets/domain/SlashMenu.reducer.js';
import { smdReducer, type SMDState, type SMDEvent } from '../../surface/widgets/nextjs/components/widgets/domain/StateMachineDiagram.reducer.js';
import { stepIndicatorReducer, type StepIndicatorState, type StepIndicatorEvent } from '../../surface/widgets/nextjs/components/widgets/domain/StepIndicator.reducer.js';
import { tokenReducer, type TokenState, type TokenEvent } from '../../surface/widgets/nextjs/components/widgets/domain/TokenInput.reducer.js';
import { workflowEditorReducer, type WorkflowEditorState, type WorkflowEditorEvent } from '../../surface/widgets/nextjs/components/widgets/domain/WorkflowEditor.reducer.js';
import { wfNodeReducer, type WFNodeInteraction, type WFNodeEvent } from '../../surface/widgets/nextjs/components/widgets/domain/WorkflowNode.reducer.js';

/* ===========================================================================
 * AutomationBuilder
 * ========================================================================= */

describe('AutomationBuilder', () => {
  describe('abReducer', () => {
    it('starts in idle', () => {
      const state: ABState = 'idle';
      expect(state).toBe('idle');
    });

    it('idle -> stepSelected on SELECT_STEP', () => {
      expect(abReducer('idle', { type: 'SELECT_STEP', index: 0 })).toBe('stepSelected');
    });

    it('idle -> addingStep on ADD_STEP', () => {
      expect(abReducer('idle', { type: 'ADD_STEP' })).toBe('addingStep');
    });

    it('idle -> testing on TEST_ALL', () => {
      expect(abReducer('idle', { type: 'TEST_ALL' })).toBe('testing');
    });

    it('idle ignores DESELECT', () => {
      expect(abReducer('idle', { type: 'DESELECT' })).toBe('idle');
    });

    it('idle ignores CONFIGURE', () => {
      expect(abReducer('idle', { type: 'CONFIGURE' })).toBe('idle');
    });

    it('stepSelected -> idle on DESELECT', () => {
      expect(abReducer('stepSelected', { type: 'DESELECT' })).toBe('idle');
    });

    it('stepSelected -> configuring on CONFIGURE', () => {
      expect(abReducer('stepSelected', { type: 'CONFIGURE' })).toBe('configuring');
    });

    it('stepSelected -> idle on DELETE', () => {
      expect(abReducer('stepSelected', { type: 'DELETE' })).toBe('idle');
    });

    it('stepSelected -> reordering on REORDER', () => {
      expect(abReducer('stepSelected', { type: 'REORDER' })).toBe('reordering');
    });

    it('stepSelected -> testingStep on TEST_STEP', () => {
      expect(abReducer('stepSelected', { type: 'TEST_STEP' })).toBe('testingStep');
    });

    it('stepSelected ignores ADD_STEP', () => {
      expect(abReducer('stepSelected', { type: 'ADD_STEP' })).toBe('stepSelected');
    });

    it('configuring -> stepSelected on SAVE', () => {
      expect(abReducer('configuring', { type: 'SAVE' })).toBe('stepSelected');
    });

    it('configuring -> stepSelected on CANCEL', () => {
      expect(abReducer('configuring', { type: 'CANCEL' })).toBe('stepSelected');
    });

    it('configuring -> stepSelected on ESCAPE', () => {
      expect(abReducer('configuring', { type: 'ESCAPE' })).toBe('stepSelected');
    });

    it('configuring ignores DELETE', () => {
      expect(abReducer('configuring', { type: 'DELETE' })).toBe('configuring');
    });

    it('addingStep -> configuring on SELECT_TYPE', () => {
      expect(abReducer('addingStep', { type: 'SELECT_TYPE' })).toBe('configuring');
    });

    it('addingStep -> idle on CANCEL', () => {
      expect(abReducer('addingStep', { type: 'CANCEL' })).toBe('idle');
    });

    it('addingStep -> idle on ESCAPE', () => {
      expect(abReducer('addingStep', { type: 'ESCAPE' })).toBe('idle');
    });

    it('reordering -> idle on DROP', () => {
      expect(abReducer('reordering', { type: 'DROP' })).toBe('idle');
    });

    it('reordering -> idle on ESCAPE', () => {
      expect(abReducer('reordering', { type: 'ESCAPE' })).toBe('idle');
    });

    it('testingStep -> stepSelected on TEST_COMPLETE', () => {
      expect(abReducer('testingStep', { type: 'TEST_COMPLETE' })).toBe('stepSelected');
    });

    it('testingStep -> stepSelected on TEST_ERROR', () => {
      expect(abReducer('testingStep', { type: 'TEST_ERROR' })).toBe('stepSelected');
    });

    it('testingStep -> stepSelected on CANCEL', () => {
      expect(abReducer('testingStep', { type: 'CANCEL' })).toBe('stepSelected');
    });

    it('testing -> idle on TEST_COMPLETE', () => {
      expect(abReducer('testing', { type: 'TEST_COMPLETE' })).toBe('idle');
    });

    it('testing -> idle on TEST_ERROR', () => {
      expect(abReducer('testing', { type: 'TEST_ERROR' })).toBe('idle');
    });

    it('testing -> idle on CANCEL', () => {
      expect(abReducer('testing', { type: 'CANCEL' })).toBe('idle');
    });
  });
});

/* ===========================================================================
 * BlockEditor
 * ========================================================================= */

describe('BlockEditor', () => {
  describe('blockEditorReducer', () => {
    it('editing -> idle on BLUR', () => {
      expect(blockEditorReducer('editing', { type: 'BLUR' })).toBe('idle');
    });

    it('editing -> slashMenuOpen on SLASH', () => {
      expect(blockEditorReducer('editing', { type: 'SLASH' })).toBe('slashMenuOpen');
    });

    it('editing -> selectionActive on SELECT_TEXT', () => {
      expect(blockEditorReducer('editing', { type: 'SELECT_TEXT' })).toBe('selectionActive');
    });

    it('editing -> dragging on DRAG_START', () => {
      expect(blockEditorReducer('editing', { type: 'DRAG_START' })).toBe('dragging');
    });

    it('editing ignores FOCUS', () => {
      expect(blockEditorReducer('editing', { type: 'FOCUS' })).toBe('editing');
    });

    it('idle -> editing on FOCUS', () => {
      expect(blockEditorReducer('idle', { type: 'FOCUS' })).toBe('editing');
    });

    it('idle ignores SLASH', () => {
      expect(blockEditorReducer('idle', { type: 'SLASH' })).toBe('idle');
    });

    it('slashMenuOpen -> editing on SELECT_BLOCK_TYPE', () => {
      expect(blockEditorReducer('slashMenuOpen', { type: 'SELECT_BLOCK_TYPE' })).toBe('editing');
    });

    it('slashMenuOpen -> editing on ESCAPE', () => {
      expect(blockEditorReducer('slashMenuOpen', { type: 'ESCAPE' })).toBe('editing');
    });

    it('slashMenuOpen -> idle on BLUR', () => {
      expect(blockEditorReducer('slashMenuOpen', { type: 'BLUR' })).toBe('idle');
    });

    it('selectionActive -> editing on DESELECT', () => {
      expect(blockEditorReducer('selectionActive', { type: 'DESELECT' })).toBe('editing');
    });

    it('selectionActive stays on FORMAT', () => {
      expect(blockEditorReducer('selectionActive', { type: 'FORMAT' })).toBe('selectionActive');
    });

    it('selectionActive -> editing on ESCAPE', () => {
      expect(blockEditorReducer('selectionActive', { type: 'ESCAPE' })).toBe('editing');
    });

    it('dragging -> editing on DROP', () => {
      expect(blockEditorReducer('dragging', { type: 'DROP' })).toBe('editing');
    });

    it('dragging -> editing on ESCAPE', () => {
      expect(blockEditorReducer('dragging', { type: 'ESCAPE' })).toBe('editing');
    });
  });
});

/* ===========================================================================
 * Canvas
 * ========================================================================= */

describe('Canvas', () => {
  describe('canvasReducer', () => {
    const initial: CanvasState = { tool: 'select', interaction: 'idle' };

    it('SWITCH_TOOL changes tool and resets interaction', () => {
      const result = canvasReducer(initial, { type: 'SWITCH_TOOL', tool: 'draw' });
      expect(result).toEqual({ tool: 'draw', interaction: 'idle' });
    });

    it('SWITCH_TOOL from non-idle resets interaction', () => {
      const state: CanvasState = { tool: 'select', interaction: 'panning' };
      const result = canvasReducer(state, { type: 'SWITCH_TOOL', tool: 'hand' });
      expect(result).toEqual({ tool: 'hand', interaction: 'idle' });
    });

    it('CLICK_NODE sets nodeSelected', () => {
      const result = canvasReducer(initial, { type: 'CLICK_NODE' });
      expect(result.interaction).toBe('nodeSelected');
      expect(result.tool).toBe('select');
    });

    it('CLICK_EMPTY resets to idle', () => {
      const state: CanvasState = { tool: 'select', interaction: 'nodeSelected' };
      const result = canvasReducer(state, { type: 'CLICK_EMPTY' });
      expect(result.interaction).toBe('idle');
    });

    it('DRAG_NODE sets movingNode', () => {
      const result = canvasReducer(initial, { type: 'DRAG_NODE' });
      expect(result.interaction).toBe('movingNode');
    });

    it('DRAG_EMPTY with select tool sets marquee', () => {
      const result = canvasReducer(initial, { type: 'DRAG_EMPTY' });
      expect(result.interaction).toBe('marquee');
    });

    it('DRAG_EMPTY with non-select tool stays idle', () => {
      const state: CanvasState = { tool: 'draw', interaction: 'idle' };
      const result = canvasReducer(state, { type: 'DRAG_EMPTY' });
      expect(result.interaction).toBe('idle');
    });

    it('PAN_START sets panning', () => {
      const result = canvasReducer(initial, { type: 'PAN_START' });
      expect(result.interaction).toBe('panning');
    });

    it('PAN_END resets to idle', () => {
      const state: CanvasState = { tool: 'select', interaction: 'panning' };
      expect(canvasReducer(state, { type: 'PAN_END' }).interaction).toBe('idle');
    });

    it('DRAW_START sets drawing', () => {
      expect(canvasReducer(initial, { type: 'DRAW_START' }).interaction).toBe('drawing');
    });

    it('DRAW_END resets to idle', () => {
      const state: CanvasState = { tool: 'draw', interaction: 'drawing' };
      expect(canvasReducer(state, { type: 'DRAW_END' }).interaction).toBe('idle');
    });

    it('DROP resets to idle', () => {
      const state: CanvasState = { tool: 'select', interaction: 'movingNode' };
      expect(canvasReducer(state, { type: 'DROP' }).interaction).toBe('idle');
    });

    it('ESCAPE resets to idle', () => {
      const state: CanvasState = { tool: 'select', interaction: 'marquee' };
      expect(canvasReducer(state, { type: 'ESCAPE' }).interaction).toBe('idle');
    });

    it('DELETE resets to idle', () => {
      const state: CanvasState = { tool: 'select', interaction: 'nodeSelected' };
      expect(canvasReducer(state, { type: 'DELETE' }).interaction).toBe('idle');
    });
  });
});

/* ===========================================================================
 * CanvasConnector
 * ========================================================================= */

describe('CanvasConnector', () => {
  describe('connectorReducer', () => {
    it('idle -> selected on SELECT', () => {
      expect(connectorReducer('idle', { type: 'SELECT' })).toBe('selected');
    });

    it('idle -> hovered on HOVER', () => {
      expect(connectorReducer('idle', { type: 'HOVER' })).toBe('hovered');
    });

    it('idle ignores DROP', () => {
      expect(connectorReducer('idle', { type: 'DROP' })).toBe('idle');
    });

    it('hovered -> idle on UNHOVER', () => {
      expect(connectorReducer('hovered', { type: 'UNHOVER' })).toBe('idle');
    });

    it('hovered -> selected on SELECT', () => {
      expect(connectorReducer('hovered', { type: 'SELECT' })).toBe('selected');
    });

    it('selected -> idle on DESELECT', () => {
      expect(connectorReducer('selected', { type: 'DESELECT' })).toBe('idle');
    });

    it('selected -> draggingStart on DRAG_START_HANDLE', () => {
      expect(connectorReducer('selected', { type: 'DRAG_START_HANDLE' })).toBe('draggingStart');
    });

    it('selected -> draggingEnd on DRAG_END_HANDLE', () => {
      expect(connectorReducer('selected', { type: 'DRAG_END_HANDLE' })).toBe('draggingEnd');
    });

    it('selected -> idle on DELETE', () => {
      expect(connectorReducer('selected', { type: 'DELETE' })).toBe('idle');
    });

    it('selected -> editingLabel on EDIT_LABEL', () => {
      expect(connectorReducer('selected', { type: 'EDIT_LABEL' })).toBe('editingLabel');
    });

    it('draggingStart -> selected on DROP', () => {
      expect(connectorReducer('draggingStart', { type: 'DROP' })).toBe('selected');
    });

    it('draggingStart -> selected on CONNECT', () => {
      expect(connectorReducer('draggingStart', { type: 'CONNECT' })).toBe('selected');
    });

    it('draggingStart -> selected on ESCAPE', () => {
      expect(connectorReducer('draggingStart', { type: 'ESCAPE' })).toBe('selected');
    });

    it('draggingEnd -> selected on DROP', () => {
      expect(connectorReducer('draggingEnd', { type: 'DROP' })).toBe('selected');
    });

    it('editingLabel -> selected on CONFIRM', () => {
      expect(connectorReducer('editingLabel', { type: 'CONFIRM' })).toBe('selected');
    });

    it('editingLabel -> selected on ESCAPE', () => {
      expect(connectorReducer('editingLabel', { type: 'ESCAPE' })).toBe('selected');
    });

    it('editingLabel -> selected on BLUR', () => {
      expect(connectorReducer('editingLabel', { type: 'BLUR' })).toBe('selected');
    });
  });
});

/* ===========================================================================
 * CanvasNode
 * ========================================================================= */

describe('CanvasNode', () => {
  describe('canvasNodeReducer', () => {
    it('idle -> selected on SELECT', () => {
      expect(canvasNodeReducer('idle', { type: 'SELECT' })).toBe('selected');
    });

    it('idle -> dragging on DRAG_START', () => {
      expect(canvasNodeReducer('idle', { type: 'DRAG_START' })).toBe('dragging');
    });

    it('idle -> hovered on HOVER', () => {
      expect(canvasNodeReducer('idle', { type: 'HOVER' })).toBe('hovered');
    });

    it('idle ignores EDIT', () => {
      expect(canvasNodeReducer('idle', { type: 'EDIT' })).toBe('idle');
    });

    it('hovered -> idle on UNHOVER', () => {
      expect(canvasNodeReducer('hovered', { type: 'UNHOVER' })).toBe('idle');
    });

    it('hovered -> selected on SELECT', () => {
      expect(canvasNodeReducer('hovered', { type: 'SELECT' })).toBe('selected');
    });

    it('hovered -> dragging on DRAG_START', () => {
      expect(canvasNodeReducer('hovered', { type: 'DRAG_START' })).toBe('dragging');
    });

    it('selected -> idle on DESELECT', () => {
      expect(canvasNodeReducer('selected', { type: 'DESELECT' })).toBe('idle');
    });

    it('selected -> editing on EDIT', () => {
      expect(canvasNodeReducer('selected', { type: 'EDIT' })).toBe('editing');
    });

    it('selected -> dragging on DRAG_START', () => {
      expect(canvasNodeReducer('selected', { type: 'DRAG_START' })).toBe('dragging');
    });

    it('selected -> resizing on RESIZE_START', () => {
      expect(canvasNodeReducer('selected', { type: 'RESIZE_START' })).toBe('resizing');
    });

    it('selected -> idle on DELETE', () => {
      expect(canvasNodeReducer('selected', { type: 'DELETE' })).toBe('idle');
    });

    it('editing -> selected on CONFIRM', () => {
      expect(canvasNodeReducer('editing', { type: 'CONFIRM' })).toBe('selected');
    });

    it('editing -> selected on ESCAPE', () => {
      expect(canvasNodeReducer('editing', { type: 'ESCAPE' })).toBe('selected');
    });

    it('editing -> selected on BLUR', () => {
      expect(canvasNodeReducer('editing', { type: 'BLUR' })).toBe('selected');
    });

    it('dragging -> selected on DROP', () => {
      expect(canvasNodeReducer('dragging', { type: 'DROP' })).toBe('selected');
    });

    it('dragging -> idle on ESCAPE', () => {
      expect(canvasNodeReducer('dragging', { type: 'ESCAPE' })).toBe('idle');
    });

    it('resizing -> selected on RESIZE_END', () => {
      expect(canvasNodeReducer('resizing', { type: 'RESIZE_END' })).toBe('selected');
    });

    it('resizing -> selected on ESCAPE', () => {
      expect(canvasNodeReducer('resizing', { type: 'ESCAPE' })).toBe('selected');
    });
  });
});

/* ===========================================================================
 * CodeBlock
 * ========================================================================= */

describe('CodeBlock', () => {
  describe('codeBlockReducer', () => {
    it('idle -> copied on COPY', () => {
      expect(codeBlockReducer('idle', { type: 'COPY' })).toBe('copied');
    });

    it('idle -> hovered on HOVER', () => {
      expect(codeBlockReducer('idle', { type: 'HOVER' })).toBe('hovered');
    });

    it('idle -> focused on FOCUS', () => {
      expect(codeBlockReducer('idle', { type: 'FOCUS' })).toBe('focused');
    });

    it('idle ignores COPY_TIMEOUT', () => {
      expect(codeBlockReducer('idle', { type: 'COPY_TIMEOUT' })).toBe('idle');
    });

    it('hovered -> idle on UNHOVER', () => {
      expect(codeBlockReducer('hovered', { type: 'UNHOVER' })).toBe('idle');
    });

    it('hovered -> copied on COPY', () => {
      expect(codeBlockReducer('hovered', { type: 'COPY' })).toBe('copied');
    });

    it('hovered ignores FOCUS', () => {
      expect(codeBlockReducer('hovered', { type: 'FOCUS' })).toBe('hovered');
    });

    it('focused -> idle on BLUR', () => {
      expect(codeBlockReducer('focused', { type: 'BLUR' })).toBe('idle');
    });

    it('focused -> copied on COPY', () => {
      expect(codeBlockReducer('focused', { type: 'COPY' })).toBe('copied');
    });

    it('copied -> idle on COPY_TIMEOUT', () => {
      expect(codeBlockReducer('copied', { type: 'COPY_TIMEOUT' })).toBe('idle');
    });

    it('copied ignores HOVER', () => {
      expect(codeBlockReducer('copied', { type: 'HOVER' })).toBe('copied');
    });

    it('copied ignores COPY', () => {
      expect(codeBlockReducer('copied', { type: 'COPY' })).toBe('copied');
    });
  });
});

/* ===========================================================================
 * ColorLabelPicker
 * ========================================================================= */

describe('ColorLabelPicker', () => {
  describe('pickerReducer', () => {
    it('closed -> open on OPEN', () => {
      expect(pickerReducer('closed', { type: 'OPEN' })).toBe('open');
    });

    it('closed ignores SELECT', () => {
      expect(pickerReducer('closed', { type: 'SELECT', name: 'a' })).toBe('closed');
    });

    it('open -> closed on CLOSE', () => {
      expect(pickerReducer('open', { type: 'CLOSE' })).toBe('closed');
    });

    it('open -> closed on ESCAPE', () => {
      expect(pickerReducer('open', { type: 'ESCAPE' })).toBe('closed');
    });

    it('open -> closed on BLUR', () => {
      expect(pickerReducer('open', { type: 'BLUR' })).toBe('closed');
    });

    it('open stays open on SELECT', () => {
      expect(pickerReducer('open', { type: 'SELECT', name: 'bug' })).toBe('open');
    });

    it('open stays open on DESELECT', () => {
      expect(pickerReducer('open', { type: 'DESELECT', name: 'bug' })).toBe('open');
    });

    it('open -> empty on FILTER_EMPTY', () => {
      expect(pickerReducer('open', { type: 'FILTER_EMPTY' })).toBe('empty');
    });

    it('empty -> open on FILTER', () => {
      expect(pickerReducer('empty', { type: 'FILTER', value: 'a' })).toBe('open');
    });

    it('empty -> open on CREATE', () => {
      expect(pickerReducer('empty', { type: 'CREATE', name: 'new' })).toBe('open');
    });

    it('empty -> closed on ESCAPE', () => {
      expect(pickerReducer('empty', { type: 'ESCAPE' })).toBe('closed');
    });

    it('empty -> closed on BLUR', () => {
      expect(pickerReducer('empty', { type: 'BLUR' })).toBe('closed');
    });
  });
});

/* ===========================================================================
 * ConditionBuilder
 * ========================================================================= */

describe('ConditionBuilder', () => {
  describe('cbReducer', () => {
    const idle: CBState = { current: 'idle' };
    const fieldChanged: CBState = { current: 'fieldChanged' };

    it('idle -> fieldChanged on CHANGE_FIELD', () => {
      expect(cbReducer(idle, { type: 'CHANGE_FIELD' })).toEqual({ current: 'fieldChanged' });
    });

    it('idle ignores ADD_ROW', () => {
      expect(cbReducer(idle, { type: 'ADD_ROW' })).toEqual(idle);
    });

    it('idle ignores REMOVE_ROW', () => {
      expect(cbReducer(idle, { type: 'REMOVE_ROW', index: 0 })).toEqual(idle);
    });

    it('idle ignores TOGGLE_LOGIC', () => {
      expect(cbReducer(idle, { type: 'TOGGLE_LOGIC' })).toEqual(idle);
    });

    it('idle ignores CHANGE_OPERATOR', () => {
      expect(cbReducer(idle, { type: 'CHANGE_OPERATOR' })).toEqual(idle);
    });

    it('idle ignores CHANGE_VALUE', () => {
      expect(cbReducer(idle, { type: 'CHANGE_VALUE' })).toEqual(idle);
    });

    it('fieldChanged -> idle on OPERATOR_RESET', () => {
      expect(cbReducer(fieldChanged, { type: 'OPERATOR_RESET' })).toEqual({ current: 'idle' });
    });

    it('fieldChanged ignores ADD_ROW', () => {
      expect(cbReducer(fieldChanged, { type: 'ADD_ROW' })).toEqual(fieldChanged);
    });

    it('fieldChanged ignores CHANGE_FIELD', () => {
      expect(cbReducer(fieldChanged, { type: 'CHANGE_FIELD' })).toEqual(fieldChanged);
    });
  });
});

/* ===========================================================================
 * CronEditor
 * ========================================================================= */

describe('CronEditor', () => {
  describe('cronReducer', () => {
    const initial: CronState = { mode: 'simple', validation: 'valid' };

    it('SWITCH_ADVANCED changes mode', () => {
      expect(cronReducer(initial, { type: 'SWITCH_ADVANCED' })).toEqual({ mode: 'advanced', validation: 'valid' });
    });

    it('SWITCH_SIMPLE changes mode', () => {
      const adv: CronState = { mode: 'advanced', validation: 'valid' };
      expect(cronReducer(adv, { type: 'SWITCH_SIMPLE' })).toEqual({ mode: 'simple', validation: 'valid' });
    });

    it('INVALIDATE sets validation to invalid', () => {
      expect(cronReducer(initial, { type: 'INVALIDATE' })).toEqual({ mode: 'simple', validation: 'invalid' });
    });

    it('REVALIDATE sets validation to valid', () => {
      const invalid: CronState = { mode: 'advanced', validation: 'invalid' };
      expect(cronReducer(invalid, { type: 'REVALIDATE' })).toEqual({ mode: 'advanced', validation: 'valid' });
    });

    it('CHANGE does not change state', () => {
      expect(cronReducer(initial, { type: 'CHANGE' })).toEqual(initial);
    });

    it('mode and validation are independent', () => {
      let state: CronState = { mode: 'simple', validation: 'valid' };
      state = cronReducer(state, { type: 'SWITCH_ADVANCED' });
      state = cronReducer(state, { type: 'INVALIDATE' });
      expect(state).toEqual({ mode: 'advanced', validation: 'invalid' });
      state = cronReducer(state, { type: 'SWITCH_SIMPLE' });
      expect(state).toEqual({ mode: 'simple', validation: 'invalid' });
    });
  });
});

/* ===========================================================================
 * DragHandle
 * ========================================================================= */

describe('DragHandle', () => {
  describe('dragHandleReducer', () => {
    it('idle -> grabbed on GRAB', () => {
      expect(dragHandleReducer('idle', { type: 'GRAB' })).toBe('grabbed');
    });

    it('idle -> hovered on HOVER', () => {
      expect(dragHandleReducer('idle', { type: 'HOVER' })).toBe('hovered');
    });

    it('idle -> focused on FOCUS', () => {
      expect(dragHandleReducer('idle', { type: 'FOCUS' })).toBe('focused');
    });

    it('idle ignores DROP', () => {
      expect(dragHandleReducer('idle', { type: 'DROP' })).toBe('idle');
    });

    it('hovered -> idle on UNHOVER', () => {
      expect(dragHandleReducer('hovered', { type: 'UNHOVER' })).toBe('idle');
    });

    it('hovered -> grabbed on GRAB', () => {
      expect(dragHandleReducer('hovered', { type: 'GRAB' })).toBe('grabbed');
    });

    it('focused -> idle on BLUR', () => {
      expect(dragHandleReducer('focused', { type: 'BLUR' })).toBe('idle');
    });

    it('focused -> grabbed on GRAB', () => {
      expect(dragHandleReducer('focused', { type: 'GRAB' })).toBe('grabbed');
    });

    it('grabbed -> idle on RELEASE', () => {
      expect(dragHandleReducer('grabbed', { type: 'RELEASE' })).toBe('idle');
    });

    it('grabbed -> dragging on MOVE', () => {
      expect(dragHandleReducer('grabbed', { type: 'MOVE' })).toBe('dragging');
    });

    it('grabbed -> idle on ESCAPE', () => {
      expect(dragHandleReducer('grabbed', { type: 'ESCAPE' })).toBe('idle');
    });

    it('dragging -> idle on DROP', () => {
      expect(dragHandleReducer('dragging', { type: 'DROP' })).toBe('idle');
    });

    it('dragging -> idle on ESCAPE', () => {
      expect(dragHandleReducer('dragging', { type: 'ESCAPE' })).toBe('idle');
    });

    it('dragging ignores MOVE', () => {
      expect(dragHandleReducer('dragging', { type: 'MOVE' })).toBe('dragging');
    });
  });
});

/* ===========================================================================
 * FieldMapper
 * ========================================================================= */

describe('FieldMapper', () => {
  describe('fmReducer', () => {
    it('idle -> editing on FOCUS_INPUT', () => {
      expect(fmReducer('idle', { type: 'FOCUS_INPUT', target: 'name' })).toBe('editing');
    });

    it('idle -> picking on OPEN_PICKER', () => {
      expect(fmReducer('idle', { type: 'OPEN_PICKER', target: 'name' })).toBe('picking');
    });

    it('idle ignores BLUR', () => {
      expect(fmReducer('idle', { type: 'BLUR' })).toBe('idle');
    });

    it('editing -> idle on BLUR', () => {
      expect(fmReducer('editing', { type: 'BLUR' })).toBe('idle');
    });

    it('editing -> picking on OPEN_PICKER', () => {
      expect(fmReducer('editing', { type: 'OPEN_PICKER', target: 'name' })).toBe('picking');
    });

    it('editing stays on INSERT_TOKEN', () => {
      expect(fmReducer('editing', { type: 'INSERT_TOKEN' })).toBe('editing');
    });

    it('picking -> editing on SELECT_FIELD', () => {
      expect(fmReducer('picking', { type: 'SELECT_FIELD' })).toBe('editing');
    });

    it('picking -> editing on CLOSE_PICKER', () => {
      expect(fmReducer('picking', { type: 'CLOSE_PICKER' })).toBe('editing');
    });

    it('picking -> editing on ESCAPE', () => {
      expect(fmReducer('picking', { type: 'ESCAPE' })).toBe('editing');
    });
  });
});

/* ===========================================================================
 * GraphView
 * ========================================================================= */

describe('GraphView', () => {
  describe('gvReducer', () => {
    const initial: GVState = { view: 'globalView', simulation: 'running' };

    it('SWITCH_GLOBAL sets view to globalView', () => {
      const state: GVState = { view: 'nodeSelected', simulation: 'running' };
      expect(gvReducer(state, { type: 'SWITCH_GLOBAL' }).view).toBe('globalView');
    });

    it('SWITCH_LOCAL sets view to localView', () => {
      expect(gvReducer(initial, { type: 'SWITCH_LOCAL' }).view).toBe('localView');
    });

    it('SELECT_NODE sets view to nodeSelected', () => {
      expect(gvReducer(initial, { type: 'SELECT_NODE' }).view).toBe('nodeSelected');
    });

    it('DESELECT returns to globalView', () => {
      const state: GVState = { view: 'nodeSelected', simulation: 'running' };
      expect(gvReducer(state, { type: 'DESELECT' }).view).toBe('globalView');
    });

    it('SEARCH sets view to searching', () => {
      expect(gvReducer(initial, { type: 'SEARCH' }).view).toBe('searching');
    });

    it('CLEAR_SEARCH returns to globalView', () => {
      const state: GVState = { view: 'searching', simulation: 'running' };
      expect(gvReducer(state, { type: 'CLEAR_SEARCH' }).view).toBe('globalView');
    });

    it('PAN_START sets view to panning', () => {
      expect(gvReducer(initial, { type: 'PAN_START' }).view).toBe('panning');
    });

    it('PAN_END returns to globalView', () => {
      const state: GVState = { view: 'panning', simulation: 'running' };
      expect(gvReducer(state, { type: 'PAN_END' }).view).toBe('globalView');
    });

    it('STABILIZE sets simulation to stabilized', () => {
      expect(gvReducer(initial, { type: 'STABILIZE' }).simulation).toBe('stabilized');
    });

    it('REHEAT sets simulation to running', () => {
      const state: GVState = { view: 'globalView', simulation: 'stabilized' };
      expect(gvReducer(state, { type: 'REHEAT' }).simulation).toBe('running');
    });

    it('PAUSE sets simulation to paused', () => {
      expect(gvReducer(initial, { type: 'PAUSE' }).simulation).toBe('paused');
    });

    it('RESUME sets simulation to running', () => {
      const state: GVState = { view: 'globalView', simulation: 'paused' };
      expect(gvReducer(state, { type: 'RESUME' }).simulation).toBe('running');
    });

    it('view and simulation are independent', () => {
      let state = initial;
      state = gvReducer(state, { type: 'SELECT_NODE' });
      state = gvReducer(state, { type: 'PAUSE' });
      expect(state).toEqual({ view: 'nodeSelected', simulation: 'paused' });
    });
  });
});

/* ===========================================================================
 * ImageGallery
 * ========================================================================= */

describe('ImageGallery', () => {
  describe('galleryReducer', () => {
    const gridState: GalleryState = { mode: 'grid', currentIndex: 0 };

    it('grid -> lightbox on OPEN_LIGHTBOX', () => {
      const result = galleryReducer(gridState, { type: 'OPEN_LIGHTBOX', index: 3 });
      expect(result).toEqual({ mode: 'lightbox', currentIndex: 3 });
    });

    it('grid ignores NEXT', () => {
      expect(galleryReducer(gridState, { type: 'NEXT' })).toEqual(gridState);
    });

    it('grid ignores PREV', () => {
      expect(galleryReducer(gridState, { type: 'PREV' })).toEqual(gridState);
    });

    it('grid ignores CLOSE', () => {
      expect(galleryReducer(gridState, { type: 'CLOSE' })).toEqual(gridState);
    });

    it('lightbox -> grid on CLOSE', () => {
      const lb: GalleryState = { mode: 'lightbox', currentIndex: 2 };
      expect(galleryReducer(lb, { type: 'CLOSE' }).mode).toBe('grid');
    });

    it('lightbox -> grid on ESCAPE', () => {
      const lb: GalleryState = { mode: 'lightbox', currentIndex: 2 };
      expect(galleryReducer(lb, { type: 'ESCAPE' }).mode).toBe('grid');
    });

    it('lightbox NEXT increments index', () => {
      const lb: GalleryState = { mode: 'lightbox', currentIndex: 2 };
      const result = galleryReducer(lb, { type: 'NEXT' });
      expect(result).toEqual({ mode: 'lightbox', currentIndex: 3 });
    });

    it('lightbox PREV decrements index', () => {
      const lb: GalleryState = { mode: 'lightbox', currentIndex: 2 };
      const result = galleryReducer(lb, { type: 'PREV' });
      expect(result).toEqual({ mode: 'lightbox', currentIndex: 1 });
    });

    it('lightbox CLOSE preserves currentIndex', () => {
      const lb: GalleryState = { mode: 'lightbox', currentIndex: 5 };
      const result = galleryReducer(lb, { type: 'CLOSE' });
      expect(result.currentIndex).toBe(5);
    });
  });
});

/* ===========================================================================
 * InlineEdit
 * ========================================================================= */

describe('InlineEdit', () => {
  describe('inlineEditReducer', () => {
    it('displaying -> editing on ACTIVATE', () => {
      expect(inlineEditReducer('displaying', { type: 'ACTIVATE' })).toBe('editing');
    });

    it('displaying -> focused on FOCUS', () => {
      expect(inlineEditReducer('displaying', { type: 'FOCUS' })).toBe('focused');
    });

    it('displaying ignores CONFIRM', () => {
      expect(inlineEditReducer('displaying', { type: 'CONFIRM' })).toBe('displaying');
    });

    it('displaying ignores BLUR', () => {
      expect(inlineEditReducer('displaying', { type: 'BLUR' })).toBe('displaying');
    });

    it('focused -> editing on ACTIVATE', () => {
      expect(inlineEditReducer('focused', { type: 'ACTIVATE' })).toBe('editing');
    });

    it('focused -> displaying on BLUR', () => {
      expect(inlineEditReducer('focused', { type: 'BLUR' })).toBe('displaying');
    });

    it('focused ignores CONFIRM', () => {
      expect(inlineEditReducer('focused', { type: 'CONFIRM' })).toBe('focused');
    });

    it('editing -> displaying on CONFIRM', () => {
      expect(inlineEditReducer('editing', { type: 'CONFIRM' })).toBe('displaying');
    });

    it('editing -> displaying on CANCEL', () => {
      expect(inlineEditReducer('editing', { type: 'CANCEL' })).toBe('displaying');
    });

    it('editing -> displaying on ESCAPE', () => {
      expect(inlineEditReducer('editing', { type: 'ESCAPE' })).toBe('displaying');
    });

    it('editing -> displaying on BLUR', () => {
      expect(inlineEditReducer('editing', { type: 'BLUR' })).toBe('displaying');
    });

    it('editing ignores ACTIVATE', () => {
      expect(inlineEditReducer('editing', { type: 'ACTIVATE' })).toBe('editing');
    });
  });
});

/* ===========================================================================
 * MarkdownPreview
 * ========================================================================= */

describe('MarkdownPreview', () => {
  describe('markdownReducer', () => {
    it('static -> rendering on SOURCE_CHANGE', () => {
      expect(markdownReducer('static', { type: 'SOURCE_CHANGE' })).toBe('rendering');
    });

    it('static ignores RENDER_COMPLETE', () => {
      expect(markdownReducer('static', { type: 'RENDER_COMPLETE' })).toBe('static');
    });

    it('rendering -> static on RENDER_COMPLETE', () => {
      expect(markdownReducer('rendering', { type: 'RENDER_COMPLETE' })).toBe('static');
    });

    it('rendering ignores SOURCE_CHANGE', () => {
      expect(markdownReducer('rendering', { type: 'SOURCE_CHANGE' })).toBe('rendering');
    });
  });
});

/* ===========================================================================
 * Minimap
 * ========================================================================= */

describe('Minimap', () => {
  describe('minimapReducer', () => {
    it('idle -> panning on PAN_START', () => {
      expect(minimapReducer('idle', { type: 'PAN_START' })).toBe('panning');
    });

    it('idle ignores PAN_END', () => {
      expect(minimapReducer('idle', { type: 'PAN_END' })).toBe('idle');
    });

    it('idle ignores ZOOM_IN', () => {
      expect(minimapReducer('idle', { type: 'ZOOM_IN' })).toBe('idle');
    });

    it('idle ignores ZOOM_OUT', () => {
      expect(minimapReducer('idle', { type: 'ZOOM_OUT' })).toBe('idle');
    });

    it('idle ignores ZOOM_FIT', () => {
      expect(minimapReducer('idle', { type: 'ZOOM_FIT' })).toBe('idle');
    });

    it('panning -> idle on PAN_END', () => {
      expect(minimapReducer('panning', { type: 'PAN_END' })).toBe('idle');
    });

    it('panning -> idle on ESCAPE', () => {
      expect(minimapReducer('panning', { type: 'ESCAPE' })).toBe('idle');
    });

    it('panning ignores PAN_START', () => {
      expect(minimapReducer('panning', { type: 'PAN_START' })).toBe('panning');
    });
  });
});

/* ===========================================================================
 * Outliner
 * ========================================================================= */

describe('Outliner', () => {
  describe('outlinerReducer', () => {
    const initial: OutlinerState = { drag: 'idle', focusedId: null };

    it('DRAG_START sets drag to dragging', () => {
      const result = outlinerReducer(initial, { type: 'DRAG_START', id: 'item-1' });
      expect(result.drag).toBe('dragging');
    });

    it('DROP resets drag to idle', () => {
      const dragging: OutlinerState = { drag: 'dragging', focusedId: null };
      expect(outlinerReducer(dragging, { type: 'DROP' }).drag).toBe('idle');
    });

    it('ESCAPE resets drag to idle', () => {
      const dragging: OutlinerState = { drag: 'dragging', focusedId: null };
      expect(outlinerReducer(dragging, { type: 'ESCAPE' }).drag).toBe('idle');
    });

    it('FOCUS sets focusedId', () => {
      const result = outlinerReducer(initial, { type: 'FOCUS', id: 'item-3' });
      expect(result.focusedId).toBe('item-3');
    });

    it('FOCUS updates focusedId', () => {
      const state: OutlinerState = { drag: 'idle', focusedId: 'item-1' };
      const result = outlinerReducer(state, { type: 'FOCUS', id: 'item-2' });
      expect(result.focusedId).toBe('item-2');
    });

    it('drag and focusedId are independent', () => {
      let state = initial;
      state = outlinerReducer(state, { type: 'FOCUS', id: 'item-1' });
      state = outlinerReducer(state, { type: 'DRAG_START', id: 'item-1' });
      expect(state).toEqual({ drag: 'dragging', focusedId: 'item-1' });
      state = outlinerReducer(state, { type: 'DROP' });
      expect(state).toEqual({ drag: 'idle', focusedId: 'item-1' });
    });
  });
});

/* ===========================================================================
 * PluginDetailPage
 * ========================================================================= */

describe('PluginDetailPage', () => {
  describe('pdpReducer', () => {
    const initial: PDPState = { install: 'idle', tab: 'description' };

    it('INSTALL sets install to installing', () => {
      expect(pdpReducer(initial, { type: 'INSTALL' }).install).toBe('installing');
    });

    it('INSTALL_COMPLETE sets install to installed', () => {
      const state: PDPState = { install: 'installing', tab: 'description' };
      expect(pdpReducer(state, { type: 'INSTALL_COMPLETE' }).install).toBe('installed');
    });

    it('INSTALL_ERROR resets install to idle', () => {
      const state: PDPState = { install: 'installing', tab: 'description' };
      expect(pdpReducer(state, { type: 'INSTALL_ERROR' }).install).toBe('idle');
    });

    it('UNINSTALL sets install to uninstalling', () => {
      const state: PDPState = { install: 'installed', tab: 'description' };
      expect(pdpReducer(state, { type: 'UNINSTALL' }).install).toBe('uninstalling');
    });

    it('UNINSTALL_COMPLETE resets to idle', () => {
      const state: PDPState = { install: 'uninstalling', tab: 'description' };
      expect(pdpReducer(state, { type: 'UNINSTALL_COMPLETE' }).install).toBe('idle');
    });

    it('UNINSTALL_ERROR returns to installed', () => {
      const state: PDPState = { install: 'uninstalling', tab: 'description' };
      expect(pdpReducer(state, { type: 'UNINSTALL_ERROR' }).install).toBe('installed');
    });

    it('UPDATE sets install to updating', () => {
      const state: PDPState = { install: 'installed', tab: 'description' };
      expect(pdpReducer(state, { type: 'UPDATE' }).install).toBe('updating');
    });

    it('UPDATE_COMPLETE returns to installed', () => {
      const state: PDPState = { install: 'updating', tab: 'description' };
      expect(pdpReducer(state, { type: 'UPDATE_COMPLETE' }).install).toBe('installed');
    });

    it('UPDATE_ERROR returns to installed', () => {
      const state: PDPState = { install: 'updating', tab: 'description' };
      expect(pdpReducer(state, { type: 'UPDATE_ERROR' }).install).toBe('installed');
    });

    it('SWITCH_TAB changes tab', () => {
      expect(pdpReducer(initial, { type: 'SWITCH_TAB', tab: 'reviews' }).tab).toBe('reviews');
    });

    it('SWITCH_TAB to screenshots', () => {
      expect(pdpReducer(initial, { type: 'SWITCH_TAB', tab: 'screenshots' }).tab).toBe('screenshots');
    });

    it('SWITCH_TAB to changelog', () => {
      expect(pdpReducer(initial, { type: 'SWITCH_TAB', tab: 'changelog' }).tab).toBe('changelog');
    });

    it('tab and install are independent', () => {
      let state = initial;
      state = pdpReducer(state, { type: 'SWITCH_TAB', tab: 'reviews' });
      state = pdpReducer(state, { type: 'INSTALL' });
      expect(state).toEqual({ install: 'installing', tab: 'reviews' });
    });
  });
});

/* ===========================================================================
 * PolicyEditor
 * ========================================================================= */

describe('PolicyEditor', () => {
  describe('peReducer', () => {
    it('visual -> json on SWITCH_JSON', () => {
      expect(peReducer('visual', { type: 'SWITCH_JSON' })).toBe('json');
    });

    it('visual -> validating on VALIDATE', () => {
      expect(peReducer('visual', { type: 'VALIDATE' })).toBe('validating');
    });

    it('visual -> simulating on SIMULATE', () => {
      expect(peReducer('visual', { type: 'SIMULATE' })).toBe('simulating');
    });

    it('visual ignores DISMISS', () => {
      expect(peReducer('visual', { type: 'DISMISS' })).toBe('visual');
    });

    it('json -> visual on SWITCH_VISUAL', () => {
      expect(peReducer('json', { type: 'SWITCH_VISUAL' })).toBe('visual');
    });

    it('json -> validating on VALIDATE', () => {
      expect(peReducer('json', { type: 'VALIDATE' })).toBe('validating');
    });

    it('json -> simulating on SIMULATE', () => {
      expect(peReducer('json', { type: 'SIMULATE' })).toBe('simulating');
    });

    it('validating -> validated on VALID', () => {
      expect(peReducer('validating', { type: 'VALID' })).toBe('validated');
    });

    it('validating -> validationError on INVALID', () => {
      expect(peReducer('validating', { type: 'INVALID' })).toBe('validationError');
    });

    it('validating -> visual on CANCEL', () => {
      expect(peReducer('validating', { type: 'CANCEL' })).toBe('visual');
    });

    it('validated -> visual on DISMISS', () => {
      expect(peReducer('validated', { type: 'DISMISS' })).toBe('visual');
    });

    it('validated -> json on SWITCH_JSON', () => {
      expect(peReducer('validated', { type: 'SWITCH_JSON' })).toBe('json');
    });

    it('validated -> visual on CHANGE', () => {
      expect(peReducer('validated', { type: 'CHANGE' })).toBe('visual');
    });

    it('validationError -> visual on DISMISS', () => {
      expect(peReducer('validationError', { type: 'DISMISS' })).toBe('visual');
    });

    it('validationError -> json on SWITCH_JSON', () => {
      expect(peReducer('validationError', { type: 'SWITCH_JSON' })).toBe('json');
    });

    it('validationError -> visual on FIX', () => {
      expect(peReducer('validationError', { type: 'FIX' })).toBe('visual');
    });

    it('simulating -> simulationResult on SIMULATION_COMPLETE', () => {
      expect(peReducer('simulating', { type: 'SIMULATION_COMPLETE' })).toBe('simulationResult');
    });

    it('simulating -> visual on CANCEL', () => {
      expect(peReducer('simulating', { type: 'CANCEL' })).toBe('visual');
    });

    it('simulationResult -> visual on DISMISS', () => {
      expect(peReducer('simulationResult', { type: 'DISMISS' })).toBe('visual');
    });

    it('simulationResult -> simulating on SIMULATE', () => {
      expect(peReducer('simulationResult', { type: 'SIMULATE' })).toBe('simulating');
    });
  });
});

/* ===========================================================================
 * SlashMenu
 * ========================================================================= */

describe('SlashMenu', () => {
  describe('slashMenuReducer', () => {
    it('closed -> open on OPEN', () => {
      expect(slashMenuReducer('closed', { type: 'OPEN' })).toBe('open');
    });

    it('closed ignores SELECT', () => {
      expect(slashMenuReducer('closed', { type: 'SELECT' })).toBe('closed');
    });

    it('closed ignores ESCAPE', () => {
      expect(slashMenuReducer('closed', { type: 'ESCAPE' })).toBe('closed');
    });

    it('open -> closed on SELECT', () => {
      expect(slashMenuReducer('open', { type: 'SELECT' })).toBe('closed');
    });

    it('open -> closed on ESCAPE', () => {
      expect(slashMenuReducer('open', { type: 'ESCAPE' })).toBe('closed');
    });

    it('open -> closed on BLUR', () => {
      expect(slashMenuReducer('open', { type: 'BLUR' })).toBe('closed');
    });

    it('open -> empty on FILTER_EMPTY', () => {
      expect(slashMenuReducer('open', { type: 'FILTER_EMPTY' })).toBe('empty');
    });

    it('open ignores INPUT', () => {
      expect(slashMenuReducer('open', { type: 'INPUT' })).toBe('open');
    });

    it('empty -> open on INPUT', () => {
      expect(slashMenuReducer('empty', { type: 'INPUT' })).toBe('open');
    });

    it('empty -> closed on ESCAPE', () => {
      expect(slashMenuReducer('empty', { type: 'ESCAPE' })).toBe('closed');
    });

    it('empty -> closed on BLUR', () => {
      expect(slashMenuReducer('empty', { type: 'BLUR' })).toBe('closed');
    });

    it('empty ignores SELECT', () => {
      expect(slashMenuReducer('empty', { type: 'SELECT' })).toBe('empty');
    });
  });
});

/* ===========================================================================
 * StateMachineDiagram
 * ========================================================================= */

describe('StateMachineDiagram', () => {
  describe('smdReducer', () => {
    it('viewing -> addingState on ADD_STATE', () => {
      expect(smdReducer('viewing', { type: 'ADD_STATE' })).toBe('addingState');
    });

    it('viewing -> addingTransition on ADD_TRANSITION', () => {
      expect(smdReducer('viewing', { type: 'ADD_TRANSITION' })).toBe('addingTransition');
    });

    it('viewing -> editingState on EDIT_STATE', () => {
      expect(smdReducer('viewing', { type: 'EDIT_STATE', name: 'draft' })).toBe('editingState');
    });

    it('viewing -> editingTransition on EDIT_TRANSITION', () => {
      expect(smdReducer('viewing', { type: 'EDIT_TRANSITION', id: 't1' })).toBe('editingTransition');
    });

    it('viewing -> confirmingDeleteState on DELETE_STATE', () => {
      expect(smdReducer('viewing', { type: 'DELETE_STATE', name: 'draft' })).toBe('confirmingDeleteState');
    });

    it('viewing -> confirmingDeleteTransition on DELETE_TRANSITION', () => {
      expect(smdReducer('viewing', { type: 'DELETE_TRANSITION', id: 't1' })).toBe('confirmingDeleteTransition');
    });

    it('viewing ignores SAVE', () => {
      expect(smdReducer('viewing', { type: 'SAVE' })).toBe('viewing');
    });

    it('addingState -> viewing on SAVE', () => {
      expect(smdReducer('addingState', { type: 'SAVE' })).toBe('viewing');
    });

    it('addingState -> viewing on CANCEL', () => {
      expect(smdReducer('addingState', { type: 'CANCEL' })).toBe('viewing');
    });

    it('addingState -> viewing on ESCAPE', () => {
      expect(smdReducer('addingState', { type: 'ESCAPE' })).toBe('viewing');
    });

    it('editingState -> viewing on SAVE', () => {
      expect(smdReducer('editingState', { type: 'SAVE' })).toBe('viewing');
    });

    it('addingTransition -> viewing on SAVE', () => {
      expect(smdReducer('addingTransition', { type: 'SAVE' })).toBe('viewing');
    });

    it('editingTransition -> viewing on CANCEL', () => {
      expect(smdReducer('editingTransition', { type: 'CANCEL' })).toBe('viewing');
    });

    it('confirmingDeleteState -> viewing on CONFIRM', () => {
      expect(smdReducer('confirmingDeleteState', { type: 'CONFIRM' })).toBe('viewing');
    });

    it('confirmingDeleteState -> viewing on CANCEL', () => {
      expect(smdReducer('confirmingDeleteState', { type: 'CANCEL' })).toBe('viewing');
    });

    it('confirmingDeleteState -> viewing on ESCAPE', () => {
      expect(smdReducer('confirmingDeleteState', { type: 'ESCAPE' })).toBe('viewing');
    });

    it('confirmingDeleteTransition -> viewing on CONFIRM', () => {
      expect(smdReducer('confirmingDeleteTransition', { type: 'CONFIRM' })).toBe('viewing');
    });

    it('confirmingDeleteTransition -> viewing on CANCEL', () => {
      expect(smdReducer('confirmingDeleteTransition', { type: 'CANCEL' })).toBe('viewing');
    });
  });
});

/* ===========================================================================
 * StepIndicator
 * ========================================================================= */

describe('StepIndicator', () => {
  describe('stepIndicatorReducer', () => {
    const initial: StepIndicatorState = { currentStep: 0 };

    it('GO_TO_STEP sets currentStep', () => {
      expect(stepIndicatorReducer(initial, { type: 'GO_TO_STEP', index: 3 })).toEqual({ currentStep: 3 });
    });

    it('NEXT increments currentStep', () => {
      expect(stepIndicatorReducer(initial, { type: 'NEXT' })).toEqual({ currentStep: 1 });
    });

    it('NEXT from step 2 goes to 3', () => {
      expect(stepIndicatorReducer({ currentStep: 2 }, { type: 'NEXT' })).toEqual({ currentStep: 3 });
    });

    it('PREV decrements currentStep', () => {
      expect(stepIndicatorReducer({ currentStep: 3 }, { type: 'PREV' })).toEqual({ currentStep: 2 });
    });

    it('PREV at 0 stays at 0', () => {
      expect(stepIndicatorReducer(initial, { type: 'PREV' })).toEqual({ currentStep: 0 });
    });

    it('GO_TO_STEP to 0', () => {
      expect(stepIndicatorReducer({ currentStep: 5 }, { type: 'GO_TO_STEP', index: 0 })).toEqual({ currentStep: 0 });
    });

    it('multiple NEXT transitions', () => {
      let state = initial;
      state = stepIndicatorReducer(state, { type: 'NEXT' });
      state = stepIndicatorReducer(state, { type: 'NEXT' });
      state = stepIndicatorReducer(state, { type: 'NEXT' });
      expect(state).toEqual({ currentStep: 3 });
    });
  });
});

/* ===========================================================================
 * TokenInput
 * ========================================================================= */

describe('TokenInput', () => {
  describe('tokenReducer', () => {
    it('static -> hovered on HOVER', () => {
      expect(tokenReducer('static', { type: 'HOVER' })).toBe('hovered');
    });

    it('static -> focused on FOCUS', () => {
      expect(tokenReducer('static', { type: 'FOCUS' })).toBe('focused');
    });

    it('static -> selected on SELECT', () => {
      expect(tokenReducer('static', { type: 'SELECT' })).toBe('selected');
    });

    it('static ignores DESELECT', () => {
      expect(tokenReducer('static', { type: 'DESELECT' })).toBe('static');
    });

    it('static ignores REMOVE', () => {
      expect(tokenReducer('static', { type: 'REMOVE' })).toBe('static');
    });

    it('hovered -> static on UNHOVER', () => {
      expect(tokenReducer('hovered', { type: 'UNHOVER' })).toBe('static');
    });

    it('hovered -> focused on FOCUS', () => {
      expect(tokenReducer('hovered', { type: 'FOCUS' })).toBe('focused');
    });

    it('hovered -> selected on SELECT', () => {
      expect(tokenReducer('hovered', { type: 'SELECT' })).toBe('selected');
    });

    it('focused -> static on BLUR', () => {
      expect(tokenReducer('focused', { type: 'BLUR' })).toBe('static');
    });

    it('focused -> selected on SELECT', () => {
      expect(tokenReducer('focused', { type: 'SELECT' })).toBe('selected');
    });

    it('focused ignores HOVER', () => {
      expect(tokenReducer('focused', { type: 'HOVER' })).toBe('focused');
    });

    it('selected -> static on DESELECT', () => {
      expect(tokenReducer('selected', { type: 'DESELECT' })).toBe('static');
    });

    it('selected -> static on BLUR', () => {
      expect(tokenReducer('selected', { type: 'BLUR' })).toBe('static');
    });

    it('selected ignores HOVER', () => {
      expect(tokenReducer('selected', { type: 'HOVER' })).toBe('selected');
    });

    it('selected ignores REMOVE', () => {
      expect(tokenReducer('selected', { type: 'REMOVE' })).toBe('selected');
    });
  });
});

/* ===========================================================================
 * WorkflowEditor
 * ========================================================================= */

describe('WorkflowEditor', () => {
  describe('workflowEditorReducer', () => {
    it('idle -> nodeSelected on SELECT_NODE', () => {
      expect(workflowEditorReducer('idle', { type: 'SELECT_NODE' })).toBe('nodeSelected');
    });

    it('idle -> placing on ADD_NODE', () => {
      expect(workflowEditorReducer('idle', { type: 'ADD_NODE' })).toBe('placing');
    });

    it('idle -> executing on EXECUTE', () => {
      expect(workflowEditorReducer('idle', { type: 'EXECUTE' })).toBe('executing');
    });

    it('idle -> draggingNew on DRAG_PALETTE_NODE', () => {
      expect(workflowEditorReducer('idle', { type: 'DRAG_PALETTE_NODE' })).toBe('draggingNew');
    });

    it('idle ignores DESELECT', () => {
      expect(workflowEditorReducer('idle', { type: 'DESELECT' })).toBe('idle');
    });

    it('nodeSelected -> idle on DESELECT', () => {
      expect(workflowEditorReducer('nodeSelected', { type: 'DESELECT' })).toBe('idle');
    });

    it('nodeSelected -> configuring on CONFIGURE', () => {
      expect(workflowEditorReducer('nodeSelected', { type: 'CONFIGURE' })).toBe('configuring');
    });

    it('nodeSelected -> idle on DELETE', () => {
      expect(workflowEditorReducer('nodeSelected', { type: 'DELETE' })).toBe('idle');
    });

    it('nodeSelected -> executing on EXECUTE', () => {
      expect(workflowEditorReducer('nodeSelected', { type: 'EXECUTE' })).toBe('executing');
    });

    it('configuring -> nodeSelected on CLOSE_CONFIG', () => {
      expect(workflowEditorReducer('configuring', { type: 'CLOSE_CONFIG' })).toBe('nodeSelected');
    });

    it('configuring -> nodeSelected on SAVE_CONFIG', () => {
      expect(workflowEditorReducer('configuring', { type: 'SAVE_CONFIG' })).toBe('nodeSelected');
    });

    it('configuring -> nodeSelected on ESCAPE', () => {
      expect(workflowEditorReducer('configuring', { type: 'ESCAPE' })).toBe('nodeSelected');
    });

    it('placing -> idle on PLACE', () => {
      expect(workflowEditorReducer('placing', { type: 'PLACE' })).toBe('idle');
    });

    it('placing -> idle on ESCAPE', () => {
      expect(workflowEditorReducer('placing', { type: 'ESCAPE' })).toBe('idle');
    });

    it('draggingNew -> idle on DROP_ON_CANVAS', () => {
      expect(workflowEditorReducer('draggingNew', { type: 'DROP_ON_CANVAS' })).toBe('idle');
    });

    it('draggingNew -> idle on ESCAPE', () => {
      expect(workflowEditorReducer('draggingNew', { type: 'ESCAPE' })).toBe('idle');
    });

    it('executing -> executionResult on EXECUTION_COMPLETE', () => {
      expect(workflowEditorReducer('executing', { type: 'EXECUTION_COMPLETE' })).toBe('executionResult');
    });

    it('executing -> executionResult on EXECUTION_ERROR', () => {
      expect(workflowEditorReducer('executing', { type: 'EXECUTION_ERROR' })).toBe('executionResult');
    });

    it('executing -> idle on CANCEL', () => {
      expect(workflowEditorReducer('executing', { type: 'CANCEL' })).toBe('idle');
    });

    it('executionResult -> idle on DISMISS', () => {
      expect(workflowEditorReducer('executionResult', { type: 'DISMISS' })).toBe('idle');
    });

    it('executionResult -> nodeSelected on SELECT_NODE', () => {
      expect(workflowEditorReducer('executionResult', { type: 'SELECT_NODE' })).toBe('nodeSelected');
    });
  });
});

/* ===========================================================================
 * WorkflowNode
 * ========================================================================= */

describe('WorkflowNode', () => {
  describe('wfNodeReducer', () => {
    it('idle -> selected on SELECT', () => {
      expect(wfNodeReducer('idle', { type: 'SELECT' })).toBe('selected');
    });

    it('idle -> hovered on HOVER', () => {
      expect(wfNodeReducer('idle', { type: 'HOVER' })).toBe('hovered');
    });

    it('idle ignores CONFIGURE', () => {
      expect(wfNodeReducer('idle', { type: 'CONFIGURE' })).toBe('idle');
    });

    it('hovered -> idle on UNHOVER', () => {
      expect(wfNodeReducer('hovered', { type: 'UNHOVER' })).toBe('idle');
    });

    it('hovered -> selected on SELECT', () => {
      expect(wfNodeReducer('hovered', { type: 'SELECT' })).toBe('selected');
    });

    it('hovered ignores CONFIGURE', () => {
      expect(wfNodeReducer('hovered', { type: 'CONFIGURE' })).toBe('hovered');
    });

    it('selected -> idle on DESELECT', () => {
      expect(wfNodeReducer('selected', { type: 'DESELECT' })).toBe('idle');
    });

    it('selected -> configuring on CONFIGURE', () => {
      expect(wfNodeReducer('selected', { type: 'CONFIGURE' })).toBe('configuring');
    });

    it('selected -> idle on DELETE', () => {
      expect(wfNodeReducer('selected', { type: 'DELETE' })).toBe('idle');
    });

    it('selected -> dragging on DRAG_START', () => {
      expect(wfNodeReducer('selected', { type: 'DRAG_START' })).toBe('dragging');
    });

    it('configuring -> selected on CLOSE_CONFIG', () => {
      expect(wfNodeReducer('configuring', { type: 'CLOSE_CONFIG' })).toBe('selected');
    });

    it('configuring -> selected on SAVE_CONFIG', () => {
      expect(wfNodeReducer('configuring', { type: 'SAVE_CONFIG' })).toBe('selected');
    });

    it('configuring -> selected on ESCAPE', () => {
      expect(wfNodeReducer('configuring', { type: 'ESCAPE' })).toBe('selected');
    });

    it('dragging -> selected on DROP', () => {
      expect(wfNodeReducer('dragging', { type: 'DROP' })).toBe('selected');
    });

    it('dragging -> selected on ESCAPE', () => {
      expect(wfNodeReducer('dragging', { type: 'ESCAPE' })).toBe('selected');
    });

    it('dragging ignores CONFIGURE', () => {
      expect(wfNodeReducer('dragging', { type: 'CONFIGURE' })).toBe('dragging');
    });
  });
});
