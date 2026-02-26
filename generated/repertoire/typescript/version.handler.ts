// generated: version.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./version.types";

export interface VersionHandler {
  snapshot(input: T.VersionSnapshotInput, storage: ConceptStorage):
    Promise<T.VersionSnapshotOutput>;
  listVersions(input: T.VersionListVersionsInput, storage: ConceptStorage):
    Promise<T.VersionListVersionsOutput>;
  rollback(input: T.VersionRollbackInput, storage: ConceptStorage):
    Promise<T.VersionRollbackOutput>;
  diff(input: T.VersionDiffInput, storage: ConceptStorage):
    Promise<T.VersionDiffOutput>;
}
