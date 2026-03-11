// ============================================================
// FileBrowser -- Vue 3 Component
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

export interface FileDef {
  id: string;
  name: string;
  fileType: string;
  isFolder: boolean;
  path: string;
  size?: string;
  modifiedDate?: string;
}

export interface FileBrowserProps {
  files?: FileDef[];
  currentPath?: string;
  selectedIds?: string[];
  viewMode?: 'grid' | 'list';
  sortField?: string;
  sortDirection?: 'ascending' | 'descending';
  showSidebar?: boolean;
  showUpload?: boolean;
  showSearch?: boolean;
  allowMultiSelect?: boolean;
  allowRename?: boolean;
  allowDelete?: boolean;
  allowUpload?: boolean;
  allowNewFolder?: boolean;
  acceptTypes?: string;
  maxFileSize?: number;
  loading?: boolean;
  onNavigate?: (path: string) => void;
  onSelect?: (ids: string[]) => void;
  onUpload?: (files: FileList) => void;
  onDelete?: (ids: string[]) => void;
  onRename?: (id: string, name: string) => void;
  onOpen?: (id: string) => void;
  renderFileItem?: (file: FileDef) => VNode | string;
}

export const FileBrowser = defineComponent({
  name: 'FileBrowser',

  props: {
    files: { type: Array as PropType<any[]>, default: () => ([]) },
    currentPath: { type: String, default: '/' },
    selectedIds: { type: Array as PropType<any[]> },
    viewMode: { type: String, default: 'grid' },
    sortField: { type: String, default: 'name' },
    sortDirection: { type: String, default: 'ascending' },
    showSidebar: { type: Boolean, default: true },
    showUpload: { type: Boolean, default: true },
    showSearch: { type: Boolean, default: true },
    allowMultiSelect: { type: Boolean, default: true },
    allowRename: { type: Boolean, default: true },
    allowDelete: { type: Boolean, default: true },
    allowUpload: { type: Boolean, default: true },
    allowNewFolder: { type: Boolean, default: true },
    acceptTypes: { type: String },
    maxFileSize: { type: Number },
    loading: { type: Boolean, default: false },
    onNavigate: { type: Function as PropType<(...args: any[]) => any> },
    onSelect: { type: Array as PropType<any[]> },
    onUpload: { type: Function as PropType<(...args: any[]) => any> },
    onDelete: { type: Array as PropType<any[]> },
    onRename: { type: Function as PropType<(...args: any[]) => any> },
    onOpen: { type: Function as PropType<(...args: any[]) => any> },
    renderFileItem: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['select', 'navigate', 'open', 'upload', 'rename', 'delete'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ view: props.viewMode, selection: (props.selectedIds?.length ?? 0) > 1 ? 'multiple' : (props.selectedIds?.length ?? 0) === 1 ? 'single' : 'none', upload: 'idle', sidebar: 'hidden', loading: props.loading ? 'loading' : 'idle', rename: 'idle', selectedIds: props.selectedIds ?? [], renamingId: null, renameValue: '', searchQuery: '', });
    const send = (action: any) => { /* state machine dispatch */ };
    const effectiveSelectedIds = props.selectedIds ?? state.value.selectedIds;
    const selectedFile = props.files.find((f) => effectiveSelectedIds.includes(f.id));
    const breadcrumbParts = props.currentPath.split('/').filter(Boolean);

    return (): VNode =>
      h('span', {}, [
        h('span', { 'aria-hidden': 'true' }, '/'),
        h('button', { 'type': 'button', 'onClick': () => props.onNavigate?.(path) }, [
          part,
        ]),
      ]);
  },
});

export default FileBrowser;