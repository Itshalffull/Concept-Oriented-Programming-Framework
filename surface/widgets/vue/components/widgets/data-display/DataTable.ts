// ============================================================
// DataTable -- Vue 3 Component
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

export interface DataTableProps {
  columns: DataTableColumn<T>[];
  data: T[];
  sortable?: boolean;
  selectable?: boolean;
  stickyHeader?: boolean;
  sortColumn?: string;
  sortDirection?: 'ascending' | 'descending' | 'none';
  ariaLabel?: string;
  loading?: boolean;
  emptyMessage?: string;
  size?: 'sm' | 'md' | 'lg';
  onSort?: (column: string, direction: 'ascending' | 'descending') => void;
  onRowSelect?: (index: number) => void;
  onRowDeselect?: (index: number) => void;
  footer?: VNode | string;
  pagination?: VNode | string;
}

export const DataTable = defineComponent({
  name: 'DataTable',

  props: {
    columns: { type: Array as PropType<any[]>, required: true as const },
    data: { type: Array as PropType<any[]>, required: true as const },
    sortable: { type: Boolean, default: true },
    selectable: { type: Boolean, default: false },
    stickyHeader: { type: Boolean, default: false },
    sortColumn: { type: String },
    sortDirection: { type: String, default: 'none' },
    ariaLabel: { type: String },
    loading: { type: Boolean, default: false },
    emptyMessage: { type: String, default: 'No data available' },
    size: { type: String, default: 'md' },
    onSort: { type: Function as PropType<(...args: any[]) => any> },
    onRowSelect: { type: Function as PropType<(...args: any[]) => any> },
    onRowDeselect: { type: Function as PropType<(...args: any[]) => any> },
    footer: { type: null as unknown as PropType<any> },
    pagination: { type: null as unknown as PropType<any> },
  },

  emits: ['sort', 'row-deselect', 'row-select'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>({ current: props.loading ? 'loading' : props.data.length === 0 ? 'empty' : 'idle', sortColumn: props.sortColumn ?? null, sortDirection: props.sortDirection, selectedRows: new Set<number>(), });
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const handleSort = (columnKey: string) => {
        if (!props.sortable) return;
        dispatch({ type: 'SORT', column: columnKey });
        const nextDirection: 'ascending' | 'descending' =
          activeSortColumn === columnKey && activeSortDirection === 'ascending'
            ? 'descending'
            : 'ascending';
        props.onSort?.(columnKey, nextDirection);
        // Auto-complete sort for sync usage
        setTimeout(() => dispatch({ type: 'SORT_COMPLETE' }), 0);
      };
    const handleHeaderKeyDown = (e: any, columnKey: string) => {
        if (e.key === 'Enter' && props.sortable) {
          e.preventDefault();
          handleSort(columnKey);
        }
      };
    const handleRowClick = (index: number) => {
        if (!props.selectable) return;
        if (state.value.selectedRows.has(index)) {
          dispatch({ type: 'DESELECT_ROW', index });
          props.onRowDeselect?.(index);
        } else {
          dispatch({ type: 'SELECT_ROW', index });
          props.onRowSelect?.(index);
        }
      };

    const handleRowKeyDown = (e: any, index: number) => {
        if (e.key === ' ' && props.selectable) {
          e.preventDefault();
          handleRowClick(index);
        }
      };
    const activeSortColumn = props.sortColumn ?? state.value.sortColumn;
    const tableState = props.loading ? 'loading' : props.data.length === 0 ? 'empty' : 'idle';

    return (): VNode =>
      h('td', {
        'role': 'gridcell',
        'aria-colindex': colIndex + 1,
        'data-part': 'cell',
      }, [
        col.render ? col.render(cellValue, row) : String(cellValue ?? ''),
      ]);
  },
});

export default DataTable;