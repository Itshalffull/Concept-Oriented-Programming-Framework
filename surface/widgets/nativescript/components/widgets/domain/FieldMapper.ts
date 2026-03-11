// ============================================================
// Clef Surface NativeScript Widget — FieldMapper
//
// Visual field mapping editor between source and target.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface TargetFieldDef { id: string; name: string; type: string; required?: boolean; }
export interface SourceFieldGroup { label: string; fields: { id: string; name: string; type: string; }[]; }
export interface MappingEntry { sourceId: string; targetId: string; transform?: string; }

export interface FieldMapperProps {
  targetFields?: TargetFieldDef[];
  sourceGroups?: SourceFieldGroup[];
  mappings?: MappingEntry[];
  readOnly?: boolean;
  onChange?: (mappings: MappingEntry[]) => void;
}

export function createFieldMapper(props: FieldMapperProps): StackLayout {
  const { targetFields = [], sourceGroups = [], mappings = [], readOnly = false, onChange } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-field-mapper';
  container.accessibilityLabel = 'Field mapper';

  for (const target of targetFields) {
    const row = new StackLayout();
    row.orientation = 'horizontal';
    row.padding = '4';
    const mapping = mappings.find(m => m.targetId === target.id);
    const targetLabel = new Label();
    targetLabel.text = target.name;
    targetLabel.fontWeight = 'bold';
    row.addChild(targetLabel);
    const arrow = new Label();
    arrow.text = ' \u2190 ';
    arrow.opacity = 0.5;
    row.addChild(arrow);
    const sourceLabel = new Label();
    sourceLabel.text = mapping?.sourceId || '(unmapped)';
    sourceLabel.opacity = mapping ? 1 : 0.4;
    row.addChild(sourceLabel);
    container.addChild(row);
  }
  return container;
}

export default createFieldMapper;
