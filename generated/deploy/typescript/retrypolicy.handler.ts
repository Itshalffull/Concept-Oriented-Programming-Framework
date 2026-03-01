// generated: retrypolicy.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./retrypolicy.types";

export interface RetryPolicyHandler {
  create(input: T.RetryPolicyCreateInput, storage: ConceptStorage):
    Promise<T.RetryPolicyCreateOutput>;
  shouldRetry(input: T.RetryPolicyShouldRetryInput, storage: ConceptStorage):
    Promise<T.RetryPolicyShouldRetryOutput>;
  recordAttempt(input: T.RetryPolicyRecordAttemptInput, storage: ConceptStorage):
    Promise<T.RetryPolicyRecordAttemptOutput>;
  markSucceeded(input: T.RetryPolicyMarkSucceededInput, storage: ConceptStorage):
    Promise<T.RetryPolicyMarkSucceededOutput>;
}
