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
