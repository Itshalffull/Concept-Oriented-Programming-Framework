// ============================================================
// PreferenceMatrix -- Vue 3 Component
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

export interface PreferenceDef {
  eventKey: string;
  eventLabel: string;
  description?: string;
  group?: string;
  channels: Record<string, boolean>;
  locked?: Record<string, boolean>;
}

export interface ChannelDef {
  key: string;
  label: string;
}

export interface PreferenceGroupDef {
  key: string;
  name: string;
}

export interface PreferenceMatrixProps {
  preferences: PreferenceDef[];
  channels?: ChannelDef[] | string[];
  groups?: PreferenceGroupDef[];
  showSelectAll?: boolean;
  showDescriptions?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onChange?: (eventKey: string, channel: string, enabled: boolean) => void;
  onToggleAll?: (channel: string, enabled: boolean) => void;
}

export const PreferenceMatrix = defineComponent({
  name: 'PreferenceMatrix',

  props: {
    preferences: { type: Array as PropType<any[]>, required: true as const },
    channels: { type: Array as PropType<any[]>, default: () => (['email', 'push', 'in-app']) },
    groups: { type: Array as PropType<any[]>, default: () => ([]) },
    showSelectAll: { type: Boolean, default: true },
    showDescriptions: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
    onToggleAll: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['change', 'toggle-all'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ loading: props.loading ? 'loading' : 'idle', saving: 'idle', focusRow: 0, focusCol: 0, });
    const send = (action: any) => { /* state machine dispatch */ };
    const grouped = props.groups.length > 0;

    return (): VNode =>
      h('span', {
        'role': 'gridcell',
        'aria-colindex': ci + 2,
        'data-part': 'cell',
        'data-channel': ch.key,
        'data-event': pref.eventKey,
      }, [
        h('input', {
          'type': 'checkbox',
          'data-part': 'toggle',
          'aria-label': `${pref.eventLabel} via ${ch.label}`,
          'aria-checked': pref.channels[ch.key] ? 'true' : 'false',
          'aria-describedby': props.showDescriptions && pref.description
                                ? `row-desc-${pref.eventKey}`
                                : undefined,
          'checked': pref.channels[ch.key] ?? false,
          'disabled': props.disabled || Boolean(isLocked),
          'data-channel': ch.key,
          'data-event': pref.eventKey,
          'tabindex': isFocused ? 0 : -1,
          'onChange': () => handleToggle(pref.eventKey, ch.key),
          'onKeyDown': (e) => handleKeyNavigation(e, rowIdx, ci),
        }),
      ]);
  },
});

export default PreferenceMatrix;