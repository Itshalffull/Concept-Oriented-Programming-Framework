// ============================================================
// Clef Surface NativeScript Widget — WorkflowNode
//
// Individual workflow node with ports and status display.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface PortDef { id: string; type: 'input' | 'output'; label?: string; }

export interface WorkflowNodeProps {
  id?: string;
  title?: string;
  type?: string;
  status?: 'idle' | 'running' | 'success' | 'error';
  selected?: boolean;
  ports?: PortDef[];
  onSelect?: () => void;
  children?: View[];
}

export function createWorkflowNode(props: WorkflowNodeProps): StackLayout {
  const { id, title = 'Node', type = 'default', status = 'idle', selected = false, ports = [], onSelect, children = [] } = props;
  const container = new StackLayout();
  container.className = `clef-widget-workflow-node clef-type-${type} clef-status-${status}${selected ? ' clef-selected' : ''}`;
  container.padding = '8';

  const titleLabel = new Label();
  titleLabel.text = title;
  titleLabel.fontWeight = 'bold';
  container.addChild(titleLabel);

  if (status !== 'idle') {
    const statusLabel = new Label();
    statusLabel.text = status;
    statusLabel.fontSize = 10;
    statusLabel.opacity = 0.6;
    container.addChild(statusLabel);
  }

  for (const child of children) container.addChild(child);
  container.on('tap', () => onSelect?.());
  return container;
}

export default createWorkflowNode;
