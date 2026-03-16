// ============================================================
// Sidebar -- Vue 3 Component
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

export interface SidebarItem {
  label: string;
  icon?: VNode | string;
  badge?: VNode | string;
  href?: string;
  active?: boolean;
  onClick?: () => void;
}

export interface SidebarGroup {
  label?: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  groups: SidebarGroup[];
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  collapsible?: boolean;
  width?: string;
  miniWidth?: string;
  label?: string;
  header?: VNode | string;
  footer?: VNode | string;
  onCollapsedChange?: (collapsed: boolean) => void;
  onNavigate?: (href: string) => void;
  variant?: string;
  size?: string;
}

export const Sidebar = defineComponent({
  name: 'Sidebar',

  props: {
    groups: { type: Array as PropType<any[]>, required: true as const },
    collapsed: { type: Boolean },
    defaultCollapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: true },
    width: { type: String, default: '256px' },
    miniWidth: { type: String, default: '64px' },
    label: { type: String, default: 'Sidebar' },
    header: { type: null as unknown as PropType<any> },
    footer: { type: null as unknown as PropType<any> },
    onCollapsedChange: { type: Function as PropType<(...args: any[]) => any> },
    onNavigate: { type: Function as PropType<(...args: any[]) => any> },
    variant: { type: String },
    size: { type: String },
  },

  emits: ['collapsed-change', 'click', 'navigate'],

  setup(props, { slots, emit }) {
    const internalState = ref<any>(props.defaultCollapsed ? 'collapsed' : 'expanded');
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const handleToggle = () => {
      if (!props.collapsible) return;
      const newCollapsed = isExpanded;
      if (!isControlled) {
        dispatch({ type: newCollapsed ? 'COLLAPSE' : 'EXPAND' });
      }
      props.onCollapsedChange?.(newCollapsed);
    };
    const handleToggleKeyDown = (e: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      };
    const handleItemClick = (item: SidebarItem) => {
        item.onClick?.();
        if (item.href) props.onNavigate?.(item.href);
      };
    const isControlled = props.collapsed !== undefined;
    const isExpanded = currentState === 'expanded';
    const dataState = isExpanded ? 'expanded' : 'collapsed';
    const currentWidth = isExpanded ? width : props.miniWidth;

    return (): VNode =>
      h('aside', {
        'role': 'complementary',
        'aria-label': props.label,
        'data-surface-widget': '',
        'data-widget-name': 'sidebar',
        'data-part': 'root',
        'data-state': dataState,
        'data-collapsible': props.collapsible ? 'true' : 'false',
        'data-variant': props.variant,
        'data-size': props.size,
        'style': { width: currentWidth },
      }, [
        props.header ? h('div', { 'data-part': 'header', 'data-state': dataState }, [
            props.header,
          ]) : null,
        h('nav', {
          'role': 'navigation',
          'aria-label': 'Sidebar navigation',
          'data-part': 'content',
        }, [
          ...props.groups.map((group, gi) => h('div', {
              'role': 'group',
              'aria-labelledby': group.label ? `sidebar-group-${gi}` : undefined,
              'data-part': 'group',
              'data-state': dataState,
            }, [
              group.label ? h('span', {
              'id': `sidebar-group-${gi}`,
              'data-part': 'group-label',
              'aria-hidden': !isExpanded ? 'true' : 'false',
              'style': { display: isExpanded ? undefined : 'none' },
            }, [
              group.label,
            ]) : null,
            ])),
        ]),
        props.footer ? h('div', { 'data-part': 'footer', 'data-state': dataState }, [
            props.footer,
          ]) : null,
        props.collapsible ? h('button', {
            'type': 'button',
            'aria-label': isExpanded ? 'Collapse sidebar' : 'Expand sidebar',
            'aria-expanded': isExpanded,
            'data-part': 'toggle-button',
            'data-state': dataState,
            'tabindex': 0,
            'onClick': handleToggle,
            'onKeyDown': handleToggleKeyDown,
          }, [
            isExpanded ? 'Collapse' : 'Expand',
          ]) : null,
      ]);
  },
});

export default Sidebar;