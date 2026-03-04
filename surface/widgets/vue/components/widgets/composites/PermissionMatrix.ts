// ============================================================
// PermissionMatrix -- Vue 3 Component
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

export interface RoleDef {
  key: string;
  name: string;
  description?: string;
}

export interface ActionDef {
  key: string;
  name: string;
}

export interface ResourceDef {
  key: string;
  name: string;
  actions: ActionDef[];
}

export interface PermissionMatrixProps {
  roles: RoleDef[];
  resources: ResourceDef[];
  permissions: PermissionMap;
  disabled?: boolean;
  readOnly?: boolean;
  showBulkToggle?: boolean;
  showDescriptions?: boolean;
  collapsible?: boolean;
  onChange?: (resource: string, action: string, role: string, granted: boolean) => void;
  onSave?: () => void;
}

export const PermissionMatrix = defineComponent({
  name: 'PermissionMatrix',

  props: {
    roles: { type: Array as PropType<any[]>, required: true as const },
    resources: { type: Array as PropType<any[]>, required: true as const },
    permissions: { type: Object as PropType<any>, required: true as const },
    disabled: { type: Boolean, default: false },
    readOnly: { type: Boolean, default: false },
    showBulkToggle: { type: Boolean, default: false },
    showDescriptions: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: true },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
    onSave: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['change'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ collapsedGroups: new Set(), saving: 'idle', focusRow: 0, focusCol: 0, });
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('span', {
        'role': 'gridcell',
        'aria-colindex': ci + 2,
        'data-part': 'action-cell',
        'data-role': role.key,
        'data-action': action.key,
        'data-resource': resource.key,
      }, [
        h('input', {
          'type': 'checkbox',
          'data-part': 'action-checkbox',
          'aria-label': `${action.name} ${resource.name} for ${role.name}`,
          'aria-checked': granted ? 'true' : 'false',
          'checked': granted,
          'disabled': props.disabled || props.readOnly,
          'data-granted': granted ? 'true' : 'false',
          'tabindex': isFocused ? 0 : -1,
          'onChange': () => handleToggle(resource.key, action.key, role.key),
          'onKeyDown': (e) => handleKeyNavigation(e, rowIdx, ci),
        }),
      ]);
  },
});

export default PermissionMatrix;