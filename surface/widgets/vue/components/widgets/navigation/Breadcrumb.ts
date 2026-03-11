// ============================================================
// Breadcrumb -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
} from 'vue';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: VNode | string;
  onNavigate?: (href: string) => void;
  variant?: string;
  size?: string;
}

export const Breadcrumb = defineComponent({
  name: 'Breadcrumb',

  props: {
    items: { type: Array as PropType<any[]>, required: true as const },
    separator: { type: String, default: '/' },
    onNavigate: { type: Function as PropType<(...args: any[]) => any> },
    variant: { type: String },
    size: { type: String },
  },

  setup(props, { slots, emit }) {

    return (): VNode =>
      h('li', {
        'role': 'listitem',
        'data-part': 'item',
        'style': { display: 'flex', alignItems: 'center' },
      }, [
        isLast
          ? h('span', { 'aria-current': 'page', 'data-part': 'current-page' }, [
            item.label,
          ])
          : [
            h('a', {
              'href': item.href,
              'aria-current': 'false',
              'data-part': 'link',
              'onClick': (e) => {
                        if (props.onNavigate && item.href) {
                          e.preventDefault();
                          props.onNavigate(item.href);
                        }
                      },
            }, [
              item.label,
            ]),
            h('span', { 'aria-hidden': 'true', 'data-part': 'separator' }, [
              props.separator,
            ]),
          ],
      ]);
  },
});

export default Breadcrumb;