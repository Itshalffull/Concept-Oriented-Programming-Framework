// ============================================================
// FileUpload -- Vue 3 Component
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

export interface FileUploadProps {
  /** Accepted file types (MIME pattern or extensions). */
  accept?: string;
  /** Allow multiple file selection. */
  multiple?: boolean;
  /** Maximum file size in bytes. */
  maxSize?: number;
  /** Maximum number of files. */
  maxFiles?: number;
  /** Disabled state. */
  disabled?: boolean;
  /** Form field name. */
  name?: string;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when files change. */
  onChange?: (files: File[]) => void;
  /** Callback to upload a file. Return a promise that resolves when done. */
  onUpload?: (file: File, onProgress: (pct: number) => void) => Promise<void>;
}

export const FileUpload = defineComponent({
  name: 'FileUpload',

  props: {
    accept: { type: String },
    multiple: { type: Boolean, default: true },
    maxSize: { type: Number },
    maxFiles: { type: Number },
    disabled: { type: Boolean, default: false },
    name: { type: String },
    size: { type: String, default: 'md' },
    onChange: { type: Array as PropType<any[]> },
    onUpload: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['change'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const machine = ref<any>({ dropzone: 'idle', upload: 'ready', files: [], });
    const send = (action: any) => { /* state machine dispatch */ };
    const inputRef = ref<any>(null);
    const validateFile = (file: File): string | null => {
      if (props.maxSize && file.size > props.maxSize) return `File exceeds maximum size of ${formatFileSize(maxSize)}`;
      if (props.accept) {
        const acceptList = props.accept.split(',').map((a) => a.trim());
        const matches = acceptList.some((pattern) => {
          if (pattern.startsWith('.')) return file.name.endsWith(pattern);
          if (pattern.endsWith('/*')) return file.type.startsWith(pattern.replace('/*', '/'));
          return file.type === pattern;
        });
        if (!matches) return `File type ${file.type || 'unknown'} is not accepted`;
      }
      return null;
    };

  const processFiles = (fileList: File[]) => {
      if (props.disabled) return;
      let filesToAdd = fileList;
      if (!props.multiple) filesToAdd = filesToAdd.slice(0, 1);
      if (props.maxFiles) {
        const remaining = props.maxFiles - machine.value.files.length;
        filesToAdd = filesToAdd.slice(0, Math.max(0, remaining));
      }

      // Validate
      for (const file of filesToAdd) {
        const error = validateFile(file);
        if (error) {
          // Still add but mark as rejected
          send({ type: 'FILES_ADDED', files: [file] });
          // Find and mark rejected
          return;
        }
      }

      send({ type: 'FILES_ADDED', files: filesToAdd });
      props.onChange?.(filesToAdd);
    };

  const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (props.disabled) return;
      send({ type: 'DRAG_ENTER' });
    };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      send({ type: 'DRAG_LEAVE' });
    };

  const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (props.disabled) return;
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    };

  const handleClick = () => {
    if (props.disabled) return;
    inputRef.value?.click();
  };
    const handleInputChange = () => {
    const files = inputRef.value?.files;
    if (files) processFiles(Array.from(files));
    if (inputRef.value) inputRef.value = '';
  };
    const files = inputRef.value?.files;

    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': 'File upload',
        'data-part': 'root',
        'data-state': isDragOver ? 'drag-over' : 'idle',
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-size': props.size,
        'data-surface-widget': '',
        'data-widget-name': 'file-upload',
      }, [
        h('div', {
          'role': 'button',
          'aria-label': 'Drop files here or click to browse',
          'aria-describedby': labelId,
          'data-part': 'dropzone',
          'data-state': isDragOver ? 'drag-over' : 'idle',
          'data-disabled': props.disabled ? 'true' : 'false',
          'tabindex': props.disabled ? -1 : 0,
          'onClick': handleClick,
          'onDragEnter': handleDragEnter,
          'onDragOver': handleDragOver,
          'onDragLeave': handleDragLeave,
          'onDrop': handleDrop,
          'onKeyDown': (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); }
        },
        }, [
          h('span', {
            'data-part': 'dropzone-icon',
            'data-state': isDragOver ? 'drag-over' : 'idle',
            'aria-hidden': 'true',
          }),
          h('span', { 'id': labelId, 'data-part': 'dropzone-label' }, [
            isDragOver ? 'Drop files to upload' : 'Drag and drop files here, or click to browse',
          ]),
        ]),
        h('input', {
          'ref': inputRef,
          'type': 'file',
          'accept': props.accept,
          'multiple': props.multiple,
          'disabled': props.disabled,
          'name': props.name,
          'onChange': handleInputChange,
          'aria-hidden': 'true',
          'tabindex': -1,
          'data-part': 'input',
        }),
        machine.value.files.length > 0 ? h('div', {
            'role': 'list',
            'aria-label': 'Uploaded files',
            'aria-live': 'polite',
            'data-part': 'file-list',
          }, [
            machine.value.files.map((file) => (
            <div
              key={file.id}
              role="listitem"
              aria-label={`${file.name} - ${file.state}`}
              data-part="file-item"
              data-state={file.state}
            >
              <span data-part="file-icon" data-type={file.type} aria-hidden="true" />
              <span data-part="file-name">{file.name}</span>
              <span data-part="file-size">{formatFileSize(file.size)}</span>

              {file.state === 'uploading' ? h('div', {
                'role': 'progressbar',
                'aria-valuenow': file.progress,
                'aria-valuemin': 0,
                'aria-valuemax': 100,
                'aria-label': `Uploading ${file.name}`,
                'data-part': 'file-progress',
                'data-visible': 'true',
              }) : null,
          ]) : null,
      ]);
  },
});
});)

export default FileUpload;