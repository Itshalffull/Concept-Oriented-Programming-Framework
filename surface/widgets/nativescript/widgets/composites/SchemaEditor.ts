// ============================================================
// Clef Surface NativeScript Widget — SchemaEditor
//
// Schema field editing widget for defining and modifying data
// schema fields. Displays field name, type, required flag,
// and description with add/remove/reorder controls.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, GridLayout, Label, TextField, Button, Switch, ScrollView } from '@nativescript/core';

// --------------- Types ---------------

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'enum';

export interface SchemaField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  description?: string;
  defaultValue?: string;
}

// --------------- Props ---------------

export interface SchemaEditorProps {
  /** Schema name/title. */
  schemaName?: string;
  /** Fields in the schema. */
  fields?: SchemaField[];
  /** Whether the editor is in read-only mode. */
  readOnly?: boolean;
  /** Called when a field is added. */
  onAddField?: () => void;
  /** Called when a field is removed. */
  onRemoveField?: (fieldId: string) => void;
  /** Called when a field property is updated. */
  onUpdateField?: (fieldId: string, updates: Partial<SchemaField>) => void;
  /** Called when a field is moved up. */
  onMoveUp?: (fieldId: string) => void;
  /** Called when a field is moved down. */
  onMoveDown?: (fieldId: string) => void;
}

// --------------- Helpers ---------------

const TYPE_LABELS: Record<FieldType, string> = {
  string: 'Str',
  number: 'Num',
  boolean: 'Bool',
  date: 'Date',
  array: 'Arr',
  object: 'Obj',
  enum: 'Enum',
};

// --------------- Component ---------------

export function createSchemaEditor(props: SchemaEditorProps = {}): StackLayout {
  const {
    schemaName = 'Schema',
    fields = [],
    readOnly = false,
    onAddField,
    onRemoveField,
    onUpdateField,
    onMoveUp,
    onMoveDown,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-schema-editor';
  container.padding = 12;

  // Header
  const header = new GridLayout();
  header.columns = '*, auto';
  header.marginBottom = 12;

  const titleLabel = new Label();
  titleLabel.text = schemaName;
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 16;
  GridLayout.setColumn(titleLabel, 0);
  header.addChild(titleLabel);

  if (!readOnly && onAddField) {
    const addBtn = new Button();
    addBtn.text = '+ Add Field';
    addBtn.fontSize = 11;
    addBtn.padding = 4;
    GridLayout.setColumn(addBtn, 1);
    addBtn.on('tap', () => onAddField());
    header.addChild(addBtn);
  }

  container.addChild(header);

  // Field count
  const countLabel = new Label();
  countLabel.text = `${fields.length} field${fields.length !== 1 ? 's' : ''}`;
  countLabel.opacity = 0.5;
  countLabel.fontSize = 12;
  countLabel.marginBottom = 8;
  container.addChild(countLabel);

  if (fields.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No fields defined. Add a field to get started.';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 12;
    container.addChild(emptyLabel);
    return container;
  }

  // Field list
  const scrollView = new ScrollView();
  const list = new StackLayout();

  fields.forEach((field, index) => {
    const fieldCard = new StackLayout();
    fieldCard.padding = 8;
    fieldCard.marginBottom = 6;
    fieldCard.borderRadius = 4;
    fieldCard.borderWidth = 1;
    fieldCard.borderColor = '#E0E0E0';
    fieldCard.backgroundColor = '#FAFAFA' as any;

    // Top row: name + type badge + required + actions
    const topRow = new GridLayout();
    topRow.columns = '*, auto, auto, auto';
    topRow.marginBottom = 4;

    if (readOnly) {
      const nameLabel = new Label();
      nameLabel.text = field.name;
      nameLabel.fontWeight = 'bold';
      nameLabel.fontSize = 13;
      nameLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(nameLabel, 0);
      topRow.addChild(nameLabel);
    } else {
      const nameField = new TextField();
      nameField.text = field.name;
      nameField.hint = 'Field name';
      nameField.fontSize = 13;
      nameField.fontWeight = 'bold';
      GridLayout.setColumn(nameField, 0);
      if (onUpdateField) {
        nameField.on('textChange', () => onUpdateField(field.id, { name: nameField.text }));
      }
      topRow.addChild(nameField);
    }

    // Type badge
    const typeBadge = new Label();
    typeBadge.text = TYPE_LABELS[field.type] || field.type;
    typeBadge.fontSize = 10;
    typeBadge.padding = 2;
    typeBadge.borderRadius = 3;
    typeBadge.backgroundColor = '#E3F2FD' as any;
    typeBadge.verticalAlignment = 'middle';
    typeBadge.marginRight = 4;
    GridLayout.setColumn(typeBadge, 1);
    topRow.addChild(typeBadge);

    // Required indicator
    if (field.required) {
      const reqLabel = new Label();
      reqLabel.text = '*';
      reqLabel.color = '#F44336' as any;
      reqLabel.fontWeight = 'bold';
      reqLabel.fontSize = 14;
      reqLabel.verticalAlignment = 'middle';
      reqLabel.marginRight = 4;
      GridLayout.setColumn(reqLabel, 2);
      topRow.addChild(reqLabel);
    }

    // Actions
    if (!readOnly) {
      const actionsRow = new StackLayout();
      actionsRow.orientation = 'horizontal' as any;
      actionsRow.verticalAlignment = 'middle';
      GridLayout.setColumn(actionsRow, 3);

      if (onMoveUp && index > 0) {
        const upBtn = new Button();
        upBtn.text = '\u25B2';
        upBtn.fontSize = 9;
        upBtn.padding = 1;
        upBtn.marginRight = 2;
        upBtn.on('tap', () => onMoveUp(field.id));
        actionsRow.addChild(upBtn);
      }

      if (onMoveDown && index < fields.length - 1) {
        const downBtn = new Button();
        downBtn.text = '\u25BC';
        downBtn.fontSize = 9;
        downBtn.padding = 1;
        downBtn.marginRight = 2;
        downBtn.on('tap', () => onMoveDown(field.id));
        actionsRow.addChild(downBtn);
      }

      if (onRemoveField) {
        const removeBtn = new Button();
        removeBtn.text = '\u2715';
        removeBtn.fontSize = 10;
        removeBtn.padding = 1;
        removeBtn.on('tap', () => onRemoveField(field.id));
        actionsRow.addChild(removeBtn);
      }

      topRow.addChild(actionsRow);
    }

    fieldCard.addChild(topRow);

    // Required toggle (editable mode)
    if (!readOnly) {
      const reqRow = new GridLayout();
      reqRow.columns = 'auto, *';
      reqRow.marginBottom = 2;

      const reqSwitch = new Switch();
      reqSwitch.checked = field.required;
      GridLayout.setColumn(reqSwitch, 0);
      if (onUpdateField) {
        reqSwitch.on('checkedChange', () => onUpdateField(field.id, { required: reqSwitch.checked }));
      }
      reqRow.addChild(reqSwitch);

      const reqLabel = new Label();
      reqLabel.text = 'Required';
      reqLabel.fontSize = 11;
      reqLabel.verticalAlignment = 'middle';
      reqLabel.marginLeft = 4;
      GridLayout.setColumn(reqLabel, 1);
      reqRow.addChild(reqLabel);

      fieldCard.addChild(reqRow);
    }

    // Description
    if (field.description) {
      const descLabel = new Label();
      descLabel.text = field.description;
      descLabel.textWrap = true;
      descLabel.opacity = 0.5;
      descLabel.fontSize = 11;
      fieldCard.addChild(descLabel);
    }

    // Default value
    if (field.defaultValue !== undefined) {
      const defaultLabel = new Label();
      defaultLabel.text = `Default: ${field.defaultValue}`;
      defaultLabel.opacity = 0.4;
      defaultLabel.fontSize = 10;
      defaultLabel.marginTop = 2;
      fieldCard.addChild(defaultLabel);
    }

    list.addChild(fieldCard);
  });

  scrollView.content = list;
  container.addChild(scrollView);
  return container;
}

createSchemaEditor.displayName = 'SchemaEditor';
export default createSchemaEditor;
