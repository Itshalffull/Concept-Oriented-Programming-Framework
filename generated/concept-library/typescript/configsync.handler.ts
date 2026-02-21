// generated: configsync.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./configsync.types";

export interface ConfigSyncHandler {
  export(input: T.ConfigSyncExportInput, storage: ConceptStorage):
    Promise<T.ConfigSyncExportOutput>;
  import(input: T.ConfigSyncImportInput, storage: ConceptStorage):
    Promise<T.ConfigSyncImportOutput>;
  override(input: T.ConfigSyncOverrideInput, storage: ConceptStorage):
    Promise<T.ConfigSyncOverrideOutput>;
  diff(input: T.ConfigSyncDiffInput, storage: ConceptStorage):
    Promise<T.ConfigSyncDiffOutput>;
}
