// ============================================================
// Clef Surface NativeScript Domain Widgets
//
// Barrel export for all 25 domain-specific NativeScript widgets.
// Each widget is a factory function returning a NativeScript View.
// ============================================================

export { createAutomationBuilder } from './AutomationBuilder.js';
export type { AutomationBuilderProps, AutomationStep } from './AutomationBuilder.js';

export { createBlockEditor } from './BlockEditor.js';
export type { BlockEditorProps, BlockDef } from './BlockEditor.js';

export { createCanvas } from './Canvas.js';
export type { CanvasProps, CanvasViewport, CanvasTool } from './Canvas.js';

export { createCanvasConnector } from './CanvasConnector.js';
export type { CanvasConnectorProps, ConnectorEndpoint } from './CanvasConnector.js';

export { createCanvasNode } from './CanvasNode.js';
export type { CanvasNodeProps, CanvasNodeType } from './CanvasNode.js';

export { createCodeBlock } from './CodeBlock.js';
export type { CodeBlockProps } from './CodeBlock.js';

export { createColorLabelPicker } from './ColorLabelPicker.js';
export type { ColorLabelPickerProps, LabelDef } from './ColorLabelPicker.js';

export { createConditionBuilder } from './ConditionBuilder.js';
export type { ConditionBuilderProps, ConditionRow, FieldDef, ConditionGroup } from './ConditionBuilder.js';

export { createCronEditor } from './CronEditor.js';
export type { CronEditorProps } from './CronEditor.js';

export { createDragHandle } from './DragHandle.js';
export type { DragHandleProps, DragHandleState } from './DragHandle.js';

export { createFieldMapper } from './FieldMapper.js';
export type { FieldMapperProps, TargetFieldDef, SourceFieldGroup, MappingEntry } from './FieldMapper.js';

export { createGraphView } from './GraphView.js';
export type { GraphViewProps, GraphNode, GraphEdge } from './GraphView.js';

export { createImageGallery } from './ImageGallery.js';
export type { ImageGalleryProps, GalleryImage } from './ImageGallery.js';

export { createInlineEdit } from './InlineEdit.js';
export type { InlineEditProps } from './InlineEdit.js';

export { createMarkdownPreview } from './MarkdownPreview.js';
export type { MarkdownPreviewProps } from './MarkdownPreview.js';

export { createMinimap } from './Minimap.js';
export type { MinimapProps, MinimapSection } from './Minimap.js';

export { createOutliner } from './Outliner.js';
export type { OutlinerProps, OutlineItem } from './Outliner.js';

export { createPluginDetailPage } from './PluginDetailPage.js';
export type { PluginDetailPageProps, PluginScreenshot, PluginReview, ChangelogEntry } from './PluginDetailPage.js';

export { createPolicyEditor } from './PolicyEditor.js';
export type { PolicyEditorProps, PolicyRule, ServiceDef, ValidationError } from './PolicyEditor.js';

export { createSlashMenu } from './SlashMenu.js';
export type { SlashMenuProps, BlockTypeDef } from './SlashMenu.js';

export { createStateMachineDiagram } from './StateMachineDiagram.js';
export type { StateMachineDiagramProps, StateDef, TransitionDef } from './StateMachineDiagram.js';

export { createStepIndicator } from './StepIndicator.js';
export type { StepIndicatorProps, StepDef, StepStatus } from './StepIndicator.js';

export { createTokenInput } from './TokenInput.js';
export type { TokenInputProps, TokenDef } from './TokenInput.js';

export { createWorkflowEditor } from './WorkflowEditor.js';
export type { WorkflowEditorProps, WorkflowNodeDef, WorkflowEdgeDef } from './WorkflowEditor.js';

export { createWorkflowNode } from './WorkflowNode.js';
export type { WorkflowNodeProps, PortDef } from './WorkflowNode.js';
