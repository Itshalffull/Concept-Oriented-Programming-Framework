// ============================================================
// Tabs -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
  computed,
} from 'vue';

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface TabItem {
  value: string;
  trigger: VNode | string;
  content: VNode | string;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  orientation?: 'horizontal' | 'vertical';
  activationMode?: 'automatic' | 'manual';
  disabled?: boolean;
  loop?: boolean;
  onValueChange?: (value: string) => void;
  variant?: string;
  size?: string;
}

export const Tabs = defineComponent({
  name: 'Tabs',

  props: {
    items: { type: Array as PropType<any[]>, required: true as const },
    value: { type: String },
    defaultValue: { type: String },
    orientation: { type: String, default: 'horizontal' },
    activationMode: { type: String, default: 'automatic' },
    disabled: { type: Boolean, default: false },
    loop: { type: Boolean, default: true },
    onValueChange: { type: Function as PropType<(...args: any[]) => any> },
    variant: { type: String },
    size: { type: String },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const activeValueInternal = ref<any>(undefined);
    const activeValue = computed(() => props.activeValue !== undefined ? props.activeValue : activeValueInternal.value ?? initialValue);
    const setActiveValue = (v: any) => { activeValueInternal.value = v; props.onValueChange?.(v); };
    const handleSelect = (itemValue: string) => {
        if (props.disabled) return;
        setActiveValue(itemValue);
      };
    const initialValue = props.defaultValue ?? (props.items.length > 0 ? props.items[0].value : '');
    const rovingOrientation = props.orientation === 'horizontal' ? 'horizontal' : 'vertical';

    return (): VNode =>
      h('div', {
        'id': contentId,
        'role': 'tabpanel',
        'aria-labelledby': triggerId,
        'tabindex': 0,
        'data-part': 'content',
        'data-state': itemState,
        'data-orientation': props.orientation,
        'hidden': !isActive,
      }, [
        item.content,
      ]);
  },
});

export default Tabs;