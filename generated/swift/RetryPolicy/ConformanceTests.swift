// generated: RetryPolicy/ConformanceTests.swift

import XCTest
@testable import Clef

final class RetryPolicyConformanceTests: XCTestCase {

    func testRetryPolicyCreateAndShouldRetry() async throws {
        // invariant: after create, shouldRetry with a retryable error returns retry with delay
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        // --- AFTER clause ---
        let step1 = try await handler.create(
            input: RetryPolicyCreateInput(
                stepRef: "step-kyc",
                runRef: "run-001",
                maxAttempts: 3,
                initialIntervalMs: 1000,
                backoffCoefficient: 2.0,
                maxIntervalMs: 10000
            ),
            storage: storage
        )
        guard case .ok(let policy) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }
        XCTAssertFalse(policy.isEmpty)

        // --- THEN clause ---
        let step2 = try await handler.shouldRetry(
            input: RetryPolicyShouldRetryInput(policy: policy, error: "connection timeout"),
            storage: storage
        )
        if case .retry(let retryPolicy, let delayMs, let attempt) = step2 {
            XCTAssertEqual(retryPolicy, policy)
            XCTAssertGreaterThan(delayMs, 0)
            XCTAssertGreaterThanOrEqual(attempt, 1)
        } else {
            XCTFail("Expected .retry, got \(step2)")
        }
    }

    func testRetryPolicyRecordAttemptAndExhaust() async throws {
        // invariant: after recording maxAttempts failures, shouldRetry returns exhausted
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.create(
            input: RetryPolicyCreateInput(
                stepRef: "step-pay",
                runRef: "run-002",
                maxAttempts: 2,
                initialIntervalMs: 500,
                backoffCoefficient: 1.5,
                maxIntervalMs: 5000
            ),
            storage: storage
        )
        guard case .ok(let policy) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // Record first attempt
        let step2 = try await handler.recordAttempt(
            input: RetryPolicyRecordAttemptInput(policy: policy, error: "connection refused"),
            storage: storage
        )
        if case .ok(_, let attemptCount) = step2 {
            XCTAssertEqual(attemptCount, 1)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // Record second attempt
        let step3 = try await handler.recordAttempt(
            input: RetryPolicyRecordAttemptInput(policy: policy, error: "connection refused again"),
            storage: storage
        )
        if case .ok(_, let attemptCount) = step3 {
            XCTAssertEqual(attemptCount, 2)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }

        // --- THEN clause ---
        let step4 = try await handler.shouldRetry(
            input: RetryPolicyShouldRetryInput(policy: policy, error: "connection refused yet again"),
            storage: storage
        )
        if case .exhausted(_, let stepRef, let runRef, let lastError) = step4 {
            XCTAssertEqual(stepRef, "step-pay")
            XCTAssertEqual(runRef, "run-002")
            XCTAssertFalse(lastError.isEmpty)
        } else {
            XCTFail("Expected .exhausted, got \(step4)")
        }
    }

    func testRetryPolicyMarkSucceeded() async throws {
        // invariant: markSucceeded transitions policy to succeeded
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.create(
            input: RetryPolicyCreateInput(
                stepRef: "step-send",
                runRef: "run-003",
                maxAttempts: 5,
                initialIntervalMs: 100,
                backoffCoefficient: 2.0,
                maxIntervalMs: 30000
            ),
            storage: storage
        )
        guard case .ok(let policy) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        let step2 = try await handler.markSucceeded(
            input: RetryPolicyMarkSucceededInput(policy: policy),
            storage: storage
        )
        if case .ok(let succeededPolicy) = step2 {
            XCTAssertEqual(succeededPolicy, policy)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
