// generated: filemanagement.types.ts

export interface FileManagementUploadInput {
  file: string;
  data: string;
  mimeType: string;
}

export type FileManagementUploadOutput =
  { variant: "ok"; file: string }
  | { variant: "error"; message: string };

export interface FileManagementAddUsageInput {
  file: string;
  entity: string;
}

export type FileManagementAddUsageOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface FileManagementRemoveUsageInput {
  file: string;
  entity: string;
}

export type FileManagementRemoveUsageOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface FileManagementGarbageCollectInput {
}

export type FileManagementGarbageCollectOutput =
  { variant: "ok"; removed: number };

export interface FileManagementGetFileInput {
  file: string;
}

export type FileManagementGetFileOutput =
  { variant: "ok"; data: string; mimeType: string }
  | { variant: "notfound"; message: string };

