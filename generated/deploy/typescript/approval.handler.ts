// generated: approval.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./approval.types";

export interface ApprovalHandler {
  request(input: T.ApprovalRequestInput, storage: ConceptStorage):
    Promise<T.ApprovalRequestOutput>;
  approve(input: T.ApprovalApproveInput, storage: ConceptStorage):
    Promise<T.ApprovalApproveOutput>;
  deny(input: T.ApprovalDenyInput, storage: ConceptStorage):
    Promise<T.ApprovalDenyOutput>;
  requestChanges(input: T.ApprovalRequestChangesInput, storage: ConceptStorage):
    Promise<T.ApprovalRequestChangesOutput>;
  timeout(input: T.ApprovalTimeoutInput, storage: ConceptStorage):
    Promise<T.ApprovalTimeoutOutput>;
  getStatus(input: T.ApprovalGetStatusInput, storage: ConceptStorage):
    Promise<T.ApprovalGetStatusOutput>;
}
