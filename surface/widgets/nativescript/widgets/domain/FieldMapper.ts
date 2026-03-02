// ============================================================
// Clef Surface NativeScript Widget — FieldMapper
//
// Field mapping between schemas. Renders source and target
// field columns with visual connections between mapped pairs.
// Supports adding, removing, and editing mappings with type
// indicators and transform function labels.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  Color,
  ScrollView,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface TargetFieldDef {
  name: string;
  type: string;
  required?: boolean;
}

export interface SourceFieldGroup {
  groupName: string;
  fields: Array<{ name: string; type: string }>;
}

export interface MappingEntry {
  sourceField: string;
  targetField: string;
  transform?: string;
}

export interface FieldMapperProps {
  sourceGroups?: SourceFieldGroup[];
  targetFields?: TargetFieldDef[];
  mappings?: MappingEntry[];
  readOnly?: boolean;
  showTypes?: boolean;
  accentColor?: string;
  onMappingAdd?: (sourceField: string, targetField: string) => void;
  onMappingRemove?: (index: number) => void;
  onMappingChange?: (index: number, mapping: MappingEntry) => void;
  onSourceFieldSelect?: (field: string) => void;
  onTargetFieldSelect?: (field: string) => void;
}

// --------------- Helpers ---------------

const TYPE_COLORS: Record<string, string> = {
  string: '#22c55e', number: '#3b82f6', boolean: '#f97316',
  date: '#8b5cf6', array: '#ec4899', object: '#eab308',
  enum: '#14b8a6', any: '#6b7280',
};

// --------------- Component ---------------

export function createFieldMapper(props: FieldMapperProps = {}): StackLayout {
  const {
    sourceGroups = [],
    targetFields = [],
    mappings = [],
    readOnly = false,
    showTypes = true,
    accentColor = '#06b6d4',
    onMappingAdd,
    onMappingRemove,
    onMappingChange,
    onSourceFieldSelect,
    onTargetFieldSelect,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-field-mapper';
  container.padding = 8;

  // Header
  const header = new GridLayout();
  header.columns = '*, auto, *';
  header.marginBottom = 8;

  const srcHeader = new Label();
  srcHeader.text = 'Source';
  srcHeader.fontWeight = 'bold';
  srcHeader.fontSize = 12;
  srcHeader.color = new Color(accentColor);
  GridLayout.setColumn(srcHeader, 0);
  header.addChild(srcHeader);

  const arrowHeader = new Label();
  arrowHeader.text = '\u2192';
  arrowHeader.fontSize = 14;
  arrowHeader.horizontalAlignment = 'center';
  arrowHeader.opacity = 0.5;
  GridLayout.setColumn(arrowHeader, 1);
  header.addChild(arrowHeader);

  const tgtHeader = new Label();
  tgtHeader.text = 'Target';
  tgtHeader.fontWeight = 'bold';
  tgtHeader.fontSize = 12;
  tgtHeader.color = new Color(accentColor);
  tgtHeader.textAlignment = 'right';
  GridLayout.setColumn(tgtHeader, 2);
  header.addChild(tgtHeader);

  container.addChild(header);

  // Mappings
  const mappingsList = new ScrollView();
  const mappingsStack = new StackLayout();

  // Mapped connections
  mappings.forEach((mapping, index) => {
    const row = new GridLayout();
    row.columns = '*, auto, *, auto';
    row.padding = 6;
    row.marginBottom = 4;
    row.backgroundColor = new Color('#1a1a2e');
    row.borderRadius = 4;
    row.borderWidth = 1;
    row.borderColor = new Color('#333333');

    // Source field
    const srcStack = new StackLayout();
    const srcLabel = new Label();
    srcLabel.text = mapping.sourceField;
    srcLabel.color = new Color('#e0e0e0');
    srcLabel.fontSize = 12;
    srcStack.addChild(srcLabel);

    // Find source type
    if (showTypes) {
      let srcType = '';
      for (const group of sourceGroups) {
        const found = group.fields.find((f) => f.name === mapping.sourceField);
        if (found) { srcType = found.type; break; }
      }
      if (srcType) {
        const srcTypeLabel = new Label();
        srcTypeLabel.text = srcType;
        srcTypeLabel.fontSize = 9;
        srcTypeLabel.color = new Color(TYPE_COLORS[srcType] || '#888888');
        srcStack.addChild(srcTypeLabel);
      }
    }

    GridLayout.setColumn(srcStack, 0);
    row.addChild(srcStack);

    // Arrow with optional transform
    const arrowStack = new StackLayout();
    arrowStack.horizontalAlignment = 'center';

    const arrowLabel = new Label();
    arrowLabel.text = '\u2192';
    arrowLabel.horizontalAlignment = 'center';
    arrowLabel.color = new Color(accentColor);
    arrowStack.addChild(arrowLabel);

    if (mapping.transform) {
      const transformLabel = new Label();
      transformLabel.text = `\u0192(${mapping.transform})`;
      transformLabel.fontSize = 9;
      transformLabel.horizontalAlignment = 'center';
      transformLabel.color = new Color('#eab308');
      arrowStack.addChild(transformLabel);
    }

    GridLayout.setColumn(arrowStack, 1);
    row.addChild(arrowStack);

    // Target field
    const tgtStack = new StackLayout();
    tgtStack.horizontalAlignment = 'right';

    const tgtLabel = new Label();
    tgtLabel.text = mapping.targetField;
    tgtLabel.color = new Color('#e0e0e0');
    tgtLabel.fontSize = 12;
    tgtLabel.textAlignment = 'right';
    tgtStack.addChild(tgtLabel);

    const tgtField = targetFields.find((f) => f.name === mapping.targetField);
    if (showTypes && tgtField) {
      const tgtTypeLabel = new Label();
      tgtTypeLabel.text = `${tgtField.type}${tgtField.required ? ' *' : ''}`;
      tgtTypeLabel.fontSize = 9;
      tgtTypeLabel.textAlignment = 'right';
      tgtTypeLabel.color = new Color(TYPE_COLORS[tgtField.type] || '#888888');
      tgtStack.addChild(tgtTypeLabel);
    }

    GridLayout.setColumn(tgtStack, 2);
    row.addChild(tgtStack);

    // Remove button
    if (!readOnly) {
      const removeBtn = new Button();
      removeBtn.text = '\u2716';
      removeBtn.fontSize = 10;
      removeBtn.width = 24;
      removeBtn.height = 24;
      removeBtn.on('tap', () => onMappingRemove?.(index));
      GridLayout.setColumn(removeBtn, 3);
      row.addChild(removeBtn);
    }

    mappingsStack.addChild(row);
  });

  // Unmapped target fields
  const mappedTargets = new Set(mappings.map((m) => m.targetField));
  const unmappedTargets = targetFields.filter((f) => !mappedTargets.has(f.name));

  if (unmappedTargets.length > 0) {
    const unmappedHeader = new Label();
    unmappedHeader.text = 'Unmapped targets:';
    unmappedHeader.fontSize = 10;
    unmappedHeader.opacity = 0.5;
    unmappedHeader.marginTop = 8;
    unmappedHeader.marginBottom = 4;
    mappingsStack.addChild(unmappedHeader);

    unmappedTargets.forEach((field) => {
      const row = new StackLayout();
      row.orientation = 'horizontal';
      row.marginBottom = 2;
      row.opacity = 0.5;

      const indicator = new Label();
      indicator.text = field.required ? '\u2022' : '\u25CB';
      indicator.color = new Color(field.required ? '#ef4444' : '#888888');
      indicator.marginRight = 4;
      row.addChild(indicator);

      const nameLabel = new Label();
      nameLabel.text = `${field.name} (${field.type})`;
      nameLabel.fontSize = 11;
      row.addChild(nameLabel);

      row.on(GestureTypes.tap as any, () => onTargetFieldSelect?.(field.name));
      mappingsStack.addChild(row);
    });
  }

  // Summary
  const summaryLabel = new Label();
  summaryLabel.text = `${mappings.length} mapped, ${unmappedTargets.length} unmapped`;
  summaryLabel.fontSize = 10;
  summaryLabel.opacity = 0.3;
  summaryLabel.marginTop = 8;
  mappingsStack.addChild(summaryLabel);

  mappingsList.content = mappingsStack;
  container.addChild(mappingsList);

  return container;
}

export default createFieldMapper;
