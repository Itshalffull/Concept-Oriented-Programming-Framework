/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  state: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'rejected';
  progress: number;
  error?: string;
}

/* ---------------------------------------------------------------------------
 * State machine
 * Dropzone: idle (initial) -> dragOver
 * Upload: ready (initial) -> uploading -> complete / error
 * Events: DRAG_ENTER, DRAG_LEAVE, DROP, FILES_ADDED, REMOVE, etc.
 * ------------------------------------------------------------------------- */

export type DropzoneState = 'idle' | 'dragOver';
export type UploadState = 'ready' | 'uploading' | 'complete' | 'error';

export interface FileUploadMachine {
  dropzone: DropzoneState;
  upload: UploadState;
  files: UploadFile[];
}

export type FileUploadEvent =
  | { type: 'DRAG_ENTER' }
  | { type: 'DRAG_LEAVE' }
  | { type: 'DROP'; files: File[] }
  | { type: 'FILES_ADDED'; files: File[] }
  | { type: 'REMOVE'; fileId: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'SET_FILE_STATE'; fileId: string; state: UploadFile['state']; progress?: number; error?: string };

let fileIdCounter = 0;

export function resetFileIdCounter(): void {
  fileIdCounter = 0;
}

export function createUploadFile(file: File): UploadFile {
  return {
    id: `file-${++fileIdCounter}-${Date.now()}`,
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    state: 'pending',
    progress: 0,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function fileUploadReducer(state: FileUploadMachine, event: FileUploadEvent): FileUploadMachine {
  const s = { ...state, files: [...state.files] };

  switch (event.type) {
    case 'DRAG_ENTER':
      s.dropzone = 'dragOver';
      break;
    case 'DRAG_LEAVE':
      s.dropzone = 'idle';
      break;
    case 'DROP':
    case 'FILES_ADDED': {
      s.dropzone = 'idle';
      const newFiles = event.files.map(createUploadFile);
      s.files = [...s.files, ...newFiles];
      s.upload = 'uploading';
      break;
    }
    case 'REMOVE':
      s.files = s.files.filter((f) => f.id !== event.fileId);
      if (s.files.length === 0) s.upload = 'ready';
      break;
    case 'CLEAR_ALL':
      s.files = [];
      s.upload = 'ready';
      break;
    case 'SET_FILE_STATE': {
      const idx = s.files.findIndex((f) => f.id === event.fileId);
      if (idx !== -1) {
        s.files[idx] = {
          ...s.files[idx],
          state: event.state,
          progress: event.progress ?? s.files[idx].progress,
          error: event.error,
        };
      }
      break;
    }
  }

  return s;
}


import {
  forwardRef,
  useCallback,
  useId,
  useReducer,
  useRef,
  type DragEvent,
  type HTMLAttributes,
} from 'react';
import { fileUploadReducer, formatFileSize } from './FileUpload.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface FileUploadProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
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

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const FileUpload = forwardRef<HTMLDivElement, FileUploadProps>(function FileUpload(
  {
    accept,
    multiple = true,
    maxSize,
    maxFiles,
    disabled = false,
    name,
    size = 'md',
    onChange,
    onUpload,
    ...rest
  },
  ref,
) {
  const [machine, send] = useReducer(fileUploadReducer, {
    dropzone: 'idle',
    upload: 'ready',
    files: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const labelId = useId();

  const validateFile = useCallback(
    (file: File): string | null => {
      if (maxSize && file.size > maxSize) return `File exceeds maximum size of ${formatFileSize(maxSize)}`;
      if (accept) {
        const acceptList = accept.split(',').map((a) => a.trim());
        const matches = acceptList.some((pattern) => {
          if (pattern.startsWith('.')) return file.name.endsWith(pattern);
          if (pattern.endsWith('/*')) return file.type.startsWith(pattern.replace('/*', '/'));
          return file.type === pattern;
        });
        if (!matches) return `File type ${file.type || 'unknown'} is not accepted`;
      }
      return null;
    },
    [maxSize, accept],
  );

  const processFiles = useCallback(
    (fileList: File[]) => {
      if (disabled) return;
      let filesToAdd = fileList;
      if (!multiple) filesToAdd = filesToAdd.slice(0, 1);
      if (maxFiles) {
        const remaining = maxFiles - machine.files.length;
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
      onChange?.(filesToAdd);
    },
    [disabled, multiple, maxFiles, machine.files.length, validateFile, onChange],
  );

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      send({ type: 'DRAG_ENTER' });
    },
    [disabled],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      send({ type: 'DRAG_LEAVE' });
    },
    [],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    },
    [disabled, processFiles],
  );

  const handleClick = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const handleInputChange = useCallback(() => {
    const files = inputRef.current?.files;
    if (files) processFiles(Array.from(files));
    if (inputRef.current) inputRef.current.value = '';
  }, [processFiles]);

  const handleRemove = useCallback(
    (fileId: string) => {
      send({ type: 'REMOVE', fileId });
    },
    [],
  );

  const isDragOver = machine.dropzone === 'dragOver';

  return (
    <div
      ref={ref}
      role="group"
      aria-label="File upload"
      data-part="root"
      data-state={isDragOver ? 'drag-over' : 'idle'}
      data-disabled={disabled ? 'true' : 'false'}
      data-size={size}
      data-surface-widget=""
      data-widget-name="file-upload"
      {...rest}
    >
      {/* Dropzone */}
      <div
        role="button"
        aria-label="Drop files here or click to browse"
        aria-describedby={labelId}
        data-part="dropzone"
        data-state={isDragOver ? 'drag-over' : 'idle'}
        data-disabled={disabled ? 'true' : 'false'}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); }
        }}
      >
        <span data-part="dropzone-icon" data-state={isDragOver ? 'drag-over' : 'idle'} aria-hidden="true" />
        <span id={labelId} data-part="dropzone-label">
          {isDragOver ? 'Drop files to upload' : 'Drag and drop files here, or click to browse'}
        </span>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        name={name}
        onChange={handleInputChange}
        aria-hidden="true"
        tabIndex={-1}
        data-part="input"
      />

      {/* File list */}
      {machine.files.length > 0 && (
        <div role="list" aria-label="Uploaded files" aria-live="polite" data-part="file-list">
          {machine.files.map((file) => (
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

              {file.state === 'uploading' && (
                <div
                  role="progressbar"
                  aria-valuenow={file.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Uploading ${file.name}`}
                  data-part="file-progress"
                  data-visible="true"
                />
              )}

              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                data-part="file-remove"
                onClick={() => handleRemove(file.id)}
              >
                &#x2715;
              </button>

              {(file.state === 'failed' || file.state === 'rejected') && file.error && (
                <span
                  role="alert"
                  aria-live="assertive"
                  data-part="file-error"
                  data-visible="true"
                >
                  {file.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

FileUpload.displayName = 'FileUpload';
export { FileUpload };
export default FileUpload;
