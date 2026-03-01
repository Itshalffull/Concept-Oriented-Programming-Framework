/* ---------------------------------------------------------------------------
 * SchemaEditor reducer — extracted state machine
 * States: fieldCount, fieldConfig, drag, validation
 * ------------------------------------------------------------------------- */

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'url' | 'email' | 'relation' | 'formula';

export interface FieldDefinition {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  defaultValue?: string;
  options?: string[];
  config?: Record<string, unknown>;
}

export interface SchemaEditorState {
  fieldCount: 'empty' | 'hasFields';
  expandedFieldId: string | null;
  draggingFieldId: string | null;
  fields: FieldDefinition[];
}

export type SchemaEditorEvent =
  | { type: 'ADD_FIELD' }
  | { type: 'REMOVE_FIELD'; id: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'NAME_CHANGE'; id: string; name: string }
  | { type: 'TYPE_CHANGE'; id: string; fieldType: FieldType }
  | { type: 'TOGGLE_REQUIRED'; id: string }
  | { type: 'EXPAND_CONFIG'; id: string }
  | { type: 'COLLAPSE_CONFIG' }
  | { type: 'MOVE_UP'; id: string }
  | { type: 'MOVE_DOWN'; id: string }
  | { type: 'DRAG_START'; id: string }
  | { type: 'DRAG_END' }
  | { type: 'UPDATE_CONFIG'; id: string; config: Record<string, unknown> };

let fieldCounter = 0;
export function nextFieldId() {
  return `field-${++fieldCounter}`;
}

export function resetFieldCounter() {
  fieldCounter = 0;
}

export function schemaEditorReducer(
  state: SchemaEditorState,
  event: SchemaEditorEvent,
): SchemaEditorState {
  switch (event.type) {
    case 'ADD_FIELD': {
      const newField: FieldDefinition = {
        id: nextFieldId(),
        name: '',
        type: 'text',
        required: false,
      };
      const fields = [...state.fields, newField];
      return { ...state, fields, fieldCount: 'hasFields', expandedFieldId: newField.id };
    }
    case 'REMOVE_FIELD': {
      const fields = state.fields.filter((f) => f.id !== event.id);
      return {
        ...state,
        fields,
        fieldCount: fields.length === 0 ? 'empty' : 'hasFields',
        expandedFieldId: state.expandedFieldId === event.id ? null : state.expandedFieldId,
      };
    }
    case 'CLEAR_ALL':
      return { ...state, fields: [], fieldCount: 'empty', expandedFieldId: null, draggingFieldId: null };
    case 'NAME_CHANGE': {
      const fields = state.fields.map((f) =>
        f.id === event.id ? { ...f, name: event.name } : f,
      );
      return { ...state, fields };
    }
    case 'TYPE_CHANGE': {
      const fields = state.fields.map((f) =>
        f.id === event.id ? { ...f, type: event.fieldType, config: {}, options: undefined } : f,
      );
      return { ...state, fields, expandedFieldId: event.id };
    }
    case 'TOGGLE_REQUIRED': {
      const fields = state.fields.map((f) =>
        f.id === event.id ? { ...f, required: !f.required } : f,
      );
      return { ...state, fields };
    }
    case 'EXPAND_CONFIG':
      return { ...state, expandedFieldId: event.id };
    case 'COLLAPSE_CONFIG':
      return { ...state, expandedFieldId: null };
    case 'MOVE_UP': {
      const idx = state.fields.findIndex((f) => f.id === event.id);
      if (idx <= 0) return state;
      const fields = [...state.fields];
      [fields[idx - 1], fields[idx]] = [fields[idx], fields[idx - 1]];
      return { ...state, fields };
    }
    case 'MOVE_DOWN': {
      const idx = state.fields.findIndex((f) => f.id === event.id);
      if (idx < 0 || idx >= state.fields.length - 1) return state;
      const fields = [...state.fields];
      [fields[idx], fields[idx + 1]] = [fields[idx + 1], fields[idx]];
      return { ...state, fields };
    }
    case 'DRAG_START':
      return { ...state, draggingFieldId: event.id };
    case 'DRAG_END':
      return { ...state, draggingFieldId: null };
    case 'UPDATE_CONFIG': {
      const fields = state.fields.map((f) =>
        f.id === event.id ? { ...f, config: event.config } : f,
      );
      return { ...state, fields };
    }
    default:
      return state;
  }
}
