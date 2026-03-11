// ============================================================
// PropertyPanel -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
} from 'vue';

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface PropertyDef {
  key: string;
  label: string;
  type: PropertyType;
  value: unknown;
  displayValue?: string;
  options?: string[];
}

export type PropertyType = 'text' | 'select' | 'date' | 'person' | 'tags' | 'checkbox' | 'number' | 'url';

export interface PropertyPanelProps {
  properties: PropertyDef[];
  title?: string;
  collapsed?: boolean;
  editable?: boolean;
  reorderable?: boolean;
  showAddButton?: boolean;
  disabled?: boolean;
  onChange?: (key: string, value: unknown) => void;
  onAdd?: () => void;
  onReorder?: (properties: PropertyDef[]) => void;
  renderEditor?: (property: PropertyDef, onCommit: (value: unknown) => void) => VNode | string;
}

export const PropertyPanel = defineComponent({
  name: 'PropertyPanel',

  props: {
    properties: { type: Array as PropType<any[]>, required: true as const },
    title: { type: String, default: 'Properties' },
    collapsed: { type: Boolean, default: false },
    editable: { type: Boolean, default: true },
    reorderable: { type: Boolean, default: false },
    showAddButton: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
    onAdd: { type: Function as PropType<(...args: any[]) => any> },
    onReorder: { type: Array as PropType<any[]> },
    renderEditor: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['change', 'reorder'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>({ panel: props.collapsed ? 'collapsed' : 'expanded', editingKey: null, editValue: null, draggingKey: null, });
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('div', {
        'role': 'listitem',
        'aria-label': prop.label,
        'data-part': 'property-row',
        'data-type': prop.type,
        'data-state': isEditing ? 'editing' : 'displaying',
        'data-dragging': state.value.draggingKey === prop.key ? 'true' : 'false',
      }, [
        props.reorderable ? h('button', {
            'type': 'button',
            'data-part': 'drag-handle',
            'role': 'button',
            'aria-roledescription': 'sortable',
            'aria-label': `Reorder property ${prop.label}`,
            'hidden': !props.reorderable,
            'disabled': props.disabled,
            'tabindex': 0,
            'onPointerDown': () => send({ type: 'DRAG_START', key: prop.key }),
            'onPointerUp': () => send({ type: 'DROP' }),
            'onKeyDown': (e) => {
                      if (e.key === 'ArrowUp') handleMoveUp(prop.key);
                      if (e.key === 'ArrowDown') handleMoveDown(prop.key);
                    },
          }, '&#x2630;') : null,
        h('span', {
          'data-part': 'property-icon',
          'data-type': prop.type,
          'aria-hidden': 'true',
        }),
        h('span', {
          'data-part': 'property-label',
          'data-type': prop.type,
          'id': `prop-label-${prop.key}`,
        }, [
          prop.label,
        ]),
        h('div', {
          'data-part': 'property-value',
          'data-state': isEditing ? 'editing' : 'displaying',
          'data-type': prop.type,
          'data-empty': !prop.value ? 'true' : 'false',
          'role': isEditing ? undefined : 'button',
          'aria-label': isEditing ? undefined : `Edit ${prop.label}: ${prop.displayValue ?? String(prop.value ?? '')}`,
          'aria-labelledby': `prop-label-${prop.key}`,
          'tabindex': 0,
          'onClick': () => handleClickValue(prop),
          'onKeyDown': (e) => {
                    if (e.key === 'Enter') handleClickValue(prop);
                  },
        }, [
          isEditing
                    ? renderValueEditor(prop)
                    : (prop.displayValue ?? String(prop.value ?? 'Empty')),
        ]),
      ]);
  },
});

export default PropertyPanel;