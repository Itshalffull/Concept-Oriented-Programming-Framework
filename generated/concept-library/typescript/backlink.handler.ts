// generated: backlink.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./backlink.types";

export interface BacklinkHandler {
  getBacklinks(input: T.BacklinkGetBacklinksInput, storage: ConceptStorage):
    Promise<T.BacklinkGetBacklinksOutput>;
  getUnlinkedMentions(input: T.BacklinkGetUnlinkedMentionsInput, storage: ConceptStorage):
    Promise<T.BacklinkGetUnlinkedMentionsOutput>;
  reindex(input: T.BacklinkReindexInput, storage: ConceptStorage):
    Promise<T.BacklinkReindexOutput>;
}
