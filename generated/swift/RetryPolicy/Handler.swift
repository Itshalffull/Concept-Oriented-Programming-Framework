// generated: RetryPolicy/Handler.swift

import Foundation

protocol RetryPolicyHandler {
    func create(
        input: RetryPolicyCreateInput,
        storage: ConceptStorage
    ) async throws -> RetryPolicyCreateOutput

    func shouldRetry(
        input: RetryPolicyShouldRetryInput,
        storage: ConceptStorage
    ) async throws -> RetryPolicyShouldRetryOutput

    func recordAttempt(
        input: RetryPolicyRecordAttemptInput,
        storage: ConceptStorage
    ) async throws -> RetryPolicyRecordAttemptOutput

    func markSucceeded(
        input: RetryPolicyMarkSucceededInput,
        storage: ConceptStorage
    ) async throws -> RetryPolicyMarkSucceededOutput

}
