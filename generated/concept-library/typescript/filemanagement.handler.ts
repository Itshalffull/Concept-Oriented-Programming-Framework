// generated: filemanagement.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./filemanagement.types";

export interface FileManagementHandler {
  upload(input: T.FileManagementUploadInput, storage: ConceptStorage):
    Promise<T.FileManagementUploadOutput>;
  addUsage(input: T.FileManagementAddUsageInput, storage: ConceptStorage):
    Promise<T.FileManagementAddUsageOutput>;
  removeUsage(input: T.FileManagementRemoveUsageInput, storage: ConceptStorage):
    Promise<T.FileManagementRemoveUsageOutput>;
  garbageCollect(input: T.FileManagementGarbageCollectInput, storage: ConceptStorage):
    Promise<T.FileManagementGarbageCollectOutput>;
  getFile(input: T.FileManagementGetFileInput, storage: ConceptStorage):
    Promise<T.FileManagementGetFileOutput>;
}
