// ============================================================
// Clef Surface NativeScript Widget — WorkflowNode
//
// Single node in a workflow graph. Displays the node title,
// type, input/output ports, execution status badge, and
// configuration summary. Supports selection, configuration,
// and port connections.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface PortDef {
  name: string;
  type: string;
  required?: boolean;
  connected?: boolean;
}

export interface WorkflowNodeProps {
  id: string;
  title: string;
  nodeType: string;
  icon?: string;
  inputPortDefs?: PortDef[];
  outputPortDefs?: PortDef[];
  executionStatus?: 'pending' | 'running' | 'success' | 'error';
  configSummary?: string;
  selected?: boolean;
  disabled?: boolean;
  accentColor?: string;
  onSelect?: (id: string) => void;
  onConfigure?: (id: string) => void;
  onDelete?: (id: string) => void;
  onConnectStart?: (nodeId: string, portName: string, direction: 'input' | 'output') => void;
  onConnectEnd?: (nodeId: string, portName: string, direction: 'input' | 'output') => void;
}

// --------------- Helpers ---------------

const STATUS_ICONS: Record<string, string> = {
  pending: '\u25CB', running: '\u25D4', success: '\u2714', error: '\u2716',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#888888', running: '#eab308', success: '#22c55e', error: '#ef4444',
};

const PORT_TYPE_COLORS: Record<string, string> = {
  string: '#22c55e', number: '#3b82f6', boolean: '#f97316',
  any: '#888888', object: '#eab308', array: '#ec4899',
};

const NODE_TYPE_ICONS: Record<string, string> = {
  trigger: '\u26A1', action: '\u25B6', condition: '\u2753',
  delay: '\u23F1', webhook: '\uD83C\uDF10', transform: '\u2699',
  loop: '\u21BB', parallel: '\u2551', merge: '\u2A1F',
};

// --------------- Component ---------------

export function createWorkflowNode(props: WorkflowNodeProps): StackLayout {
  const {
    id,
    title,
    nodeType,
    icon,
    inputPortDefs = [],
    outputPortDefs = [],
    executionStatus = 'pending',
    configSummary,
    selected = false,
    disabled = false,
    accentColor = '#06b6d4',
    onSelect,
    onConfigure,
    onDelete,
    onConnectStart,
    onConnectEnd,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-workflow-node';
  container.width = 220;
  container.borderRadius = 8;
  container.borderWidth = selected ? 2 : 1;
  container.borderColor = new Color(selected ? accentColor : '#444444');
  container.backgroundColor = new Color(selected ? '#1a2a3a' : '#111122');
  container.opacity = disabled ? 0.5 : 1;

  // Header
  const header = new GridLayout();
  header.columns = 'auto, *, auto';
  header.padding = 8;
  header.backgroundColor = new Color('#1a1a2e');
  header.borderRadius = 8;

  // Icon
  const iconLabel = new Label();
  iconLabel.text = icon || NODE_TYPE_ICONS[nodeType] || '\u25A0';
  iconLabel.fontSize = 16;
  iconLabel.marginRight = 6;
  iconLabel.verticalAlignment = 'middle';
  GridLayout.setColumn(iconLabel, 0);
  header.addChild(iconLabel);

  // Title
  const titleStack = new StackLayout();

  const titleLabel = new Label();
  titleLabel.text = title;
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 12;
  titleLabel.color = new Color('#e0e0e0');
  titleStack.addChild(titleLabel);

  const typeLabel = new Label();
  typeLabel.text = nodeType;
  typeLabel.fontSize = 9;
  typeLabel.opacity = 0.5;
  titleStack.addChild(typeLabel);

  GridLayout.setColumn(titleStack, 1);
  header.addChild(titleStack);

  // Status badge
  const statusBadge = new Label();
  statusBadge.text = STATUS_ICONS[executionStatus];
  statusBadge.fontSize = 14;
  statusBadge.color = new Color(STATUS_COLORS[executionStatus]);
  statusBadge.verticalAlignment = 'middle';
  GridLayout.setColumn(statusBadge, 2);
  header.addChild(statusBadge);

  container.addChild(header);

  // Input ports
  if (inputPortDefs.length > 0) {
    const inputSection = new StackLayout();
    inputSection.padding = 4;
    inputSection.paddingLeft = 8;

    const inputHeader = new Label();
    inputHeader.text = 'Inputs';
    inputHeader.fontSize = 9;
    inputHeader.opacity = 0.4;
    inputHeader.marginBottom = 2;
    inputSection.addChild(inputHeader);

    inputPortDefs.forEach((port) => {
      const portRow = new StackLayout();
      portRow.orientation = 'horizontal';
      portRow.marginBottom = 2;

      const portDot = new Label();
      portDot.text = port.connected ? '\u25CF' : '\u25CB';
      portDot.fontSize = 10;
      portDot.color = new Color(PORT_TYPE_COLORS[port.type] || '#888888');
      portDot.marginRight = 4;
      portRow.addChild(portDot);

      const portName = new Label();
      portName.text = port.name;
      portName.fontSize = 10;
      portName.color = new Color('#c0c0c0');
      portRow.addChild(portName);

      const portType = new Label();
      portType.text = ` : ${port.type}`;
      portType.fontSize = 9;
      portType.color = new Color(PORT_TYPE_COLORS[port.type] || '#666666');
      portRow.addChild(portType);

      if (port.required) {
        const reqLabel = new Label();
        reqLabel.text = ' *';
        reqLabel.fontSize = 10;
        reqLabel.color = new Color('#ef4444');
        portRow.addChild(reqLabel);
      }

      portRow.on(GestureTypes.tap as any, () =>
        onConnectEnd?.(id, port.name, 'input')
      );

      inputSection.addChild(portRow);
    });

    container.addChild(inputSection);
  }

  // Config summary
  if (configSummary) {
    const configRow = new StackLayout();
    configRow.padding = 6;
    configRow.paddingLeft = 8;
    configRow.backgroundColor = new Color('#0d0d1a');

    const configLabel = new Label();
    configLabel.text = configSummary;
    configLabel.fontSize = 10;
    configLabel.opacity = 0.6;
    configLabel.textWrap = true;
    configRow.addChild(configLabel);

    container.addChild(configRow);
  }

  // Output ports
  if (outputPortDefs.length > 0) {
    const outputSection = new StackLayout();
    outputSection.padding = 4;
    outputSection.paddingLeft = 8;

    const outputHeader = new Label();
    outputHeader.text = 'Outputs';
    outputHeader.fontSize = 9;
    outputHeader.opacity = 0.4;
    outputHeader.marginBottom = 2;
    outputSection.addChild(outputHeader);

    outputPortDefs.forEach((port) => {
      const portRow = new StackLayout();
      portRow.orientation = 'horizontal';
      portRow.marginBottom = 2;
      portRow.horizontalAlignment = 'right';

      const portName = new Label();
      portName.text = port.name;
      portName.fontSize = 10;
      portName.color = new Color('#c0c0c0');
      portRow.addChild(portName);

      const portType = new Label();
      portType.text = ` : ${port.type}`;
      portType.fontSize = 9;
      portType.color = new Color(PORT_TYPE_COLORS[port.type] || '#666666');
      portRow.addChild(portType);

      const portDot = new Label();
      portDot.text = port.connected ? '\u25CF' : '\u25CB';
      portDot.fontSize = 10;
      portDot.color = new Color(PORT_TYPE_COLORS[port.type] || '#888888');
      portDot.marginLeft = 4;
      portRow.addChild(portDot);

      portRow.on(GestureTypes.tap as any, () =>
        onConnectStart?.(id, port.name, 'output')
      );

      outputSection.addChild(portRow);
    });

    container.addChild(outputSection);
  }

  // Actions (when selected)
  if (selected && !disabled) {
    const actionRow = new StackLayout();
    actionRow.orientation = 'horizontal';
    actionRow.horizontalAlignment = 'right';
    actionRow.padding = 4;

    const configBtn = new Button();
    configBtn.text = '\u2699 Config';
    configBtn.fontSize = 10;
    configBtn.marginRight = 4;
    configBtn.on('tap', () => onConfigure?.(id));
    actionRow.addChild(configBtn);

    const deleteBtn = new Button();
    deleteBtn.text = '\u2716 Delete';
    deleteBtn.fontSize = 10;
    deleteBtn.on('tap', () => onDelete?.(id));
    actionRow.addChild(deleteBtn);

    container.addChild(actionRow);
  }

  // Interactions
  if (!disabled) {
    container.on(GestureTypes.tap as any, () => onSelect?.(id));
    container.on(GestureTypes.doubleTap as any, () => onConfigure?.(id));
  }

  return container;
}

export default createWorkflowNode;
