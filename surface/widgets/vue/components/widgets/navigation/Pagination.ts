// ============================================================
// Pagination -- Vue 3 Component
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

export interface PaginationProps {
  page?: number;
  defaultPage?: number;
  totalPages: number;
  siblingCount?: number;
  boundaryCount?: number;
  disabled?: boolean;
  onPageChange?: (page: number) => void;
  variant?: string;
  size?: string;
}

export const Pagination = defineComponent({
  name: 'Pagination',

  props: {
    page: { type: Number },
    defaultPage: { type: Number, default: 1 },
    totalPages: { type: Number, required: true as const },
    siblingCount: { type: Number, default: 1 },
    boundaryCount: { type: Number, default: 1 },
    disabled: { type: Boolean, default: false },
    onPageChange: { type: Function as PropType<(...args: any[]) => any> },
    variant: { type: String },
    size: { type: String },
  },

  emits: ['page-change'],

  setup(props, { slots, emit }) {
    const internalState = ref<any>({ page: props.defaultPage, });
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const goToPage = (target: number) => {
        if (props.disabled) return;
        if (!isControlled) {
          dispatch({ type: 'NAVIGATE_TO', page: target, props.totalPages });
        }
        props.onPageChange?.(target);
      };
    const handlePrev = () => {
      if (isAtFirst || props.disabled) return;
      goToPage(currentPage - 1);
    };
    const handleNext = () => {
      if (isAtLast || props.disabled) return;
      goToPage(currentPage + 1);
    };
    const pages = computed(() => computePageRange(currentPage, props.totalPages, props.siblingCount, props.boundaryCount));
    const isControlled = props.page !== undefined;
    const currentPage = isControlled ? controlledPage : internalState.value.page;
    const isAtFirst = currentPage <= 1;
    const isAtLast = currentPage >= props.totalPages;

    return (): VNode =>
      h('button', {
        'type': 'button',
        'aria-label': `Page ${pageNum}`,
        'aria-current': isCurrent ? 'page' : 'false',
        'data-part': 'item',
        'data-selected': isCurrent ? 'true' : 'false',
        'tabindex': 0,
        'onClick': () => goToPage(pageNum),
        'disabled': props.disabled,
      }, [
        pageNum,
      ]);
  },
});

export default Pagination;