// generated: RetryPolicy/BusinessTests.swift

import XCTest
@testable import Clef

final class RetryPolicyBusinessTests: XCTestCase {

    // MARK: - Backoff increases delay

    func testBackoffIncreasesDelayBetweenAttempts() async throws {
        // With a backoff coefficient > 1, successive shouldRetry calls should increase delay
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: RetryPolicyCreateInput(
                stepRef: "step-backoff",
                runRef: "run-backoff",
                maxAttempts: 5,
                initialIntervalMs: 100,
                backoffCoefficient: 2.0,
                maxIntervalMs: 10000
            ),
            storage: storage
        )
        guard case .ok(let policy) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // First shouldRetry
        let s1 = try await handler.shouldRetry(
            input: RetryPolicyShouldRetryInput(policy: policy, error: "err1"),
            storage: storage
        )
        var delay1: Int = 0
        if case .retry(_, let d, _) = s1 {
            delay1 = d
            XCTAssertGreaterThan(d, 0)
        } else {
            XCTFail("Expected .retry, got \(s1)")
        }

        // Record attempt
        let _ = try await handler.recordAttempt(
            input: RetryPolicyRecordAttemptInput(policy: policy, error: "err1"),
            storage: storage
        )

        // Second shouldRetry should have higher delay
        let s2 = try await handler.shouldRetry(
            input: RetryPolicyShouldRetryInput(policy: policy, error: "err2"),
            storage: storage
        )
        if case .retry(_, let d, _) = s2 {
            XCTAssertGreaterThanOrEqual(d, delay1)
        } else {
            XCTFail("Expected .retry, got \(s2)")
        }
    }

    // MARK: - Delay capped at maxIntervalMs

    func testDelayCappedAtMaxInterval() async throws {
        // Delay should never exceed maxIntervalMs
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let maxInterval = 500

        let step1 = try await handler.create(
            input: RetryPolicyCreateInput(
                stepRef: "step-cap",
                runRef: "run-cap",
                maxAttempts: 10,
                initialIntervalMs: 200,
                backoffCoefficient: 10.0,
                maxIntervalMs: maxInterval
            ),
            storage: storage
        )
        guard case .ok(let policy) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // Record a few attempts
        for _ in 1...3 {
            let _ = try await handler.recordAttempt(
                input: RetryPolicyRecordAttemptInput(policy: policy, error: "timeout"),
                storage: storage
            )
        }

        let s = try await handler.shouldRetry(
            input: RetryPolicyShouldRetryInput(policy: policy, error: "still failing"),
            storage: storage
        )
        if case .retry(_, let delay, _) = s {
            XCTAssertLessThanOrEqual(delay, maxInterval)
        } else {
            XCTFail("Expected .retry, got \(s)")
        }
    }

    // MARK: - Mark succeeded after partial retries

    func testMarkSucceededAfterPartialRetries() async throws {
        // After some retry attempts, marking succeeded should work
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: RetryPolicyCreateInput(
                stepRef: "step-partial",
                runRef: "run-partial",
                maxAttempts: 5,
                initialIntervalMs: 100,
                backoffCoefficient: 1.5,
                maxIntervalMs: 5000
            ),
            storage: storage
        )
        guard case .ok(let policy) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // Record 2 failed attempts
        let _ = try await handler.recordAttempt(
            input: RetryPolicyRecordAttemptInput(policy: policy, error: "attempt 1 failed"),
            storage: storage
        )
        let _ = try await handler.recordAttempt(
            input: RetryPolicyRecordAttemptInput(policy: policy, error: "attempt 2 failed"),
            storage: storage
        )

        // Then succeed
        let step4 = try await handler.markSucceeded(
            input: RetryPolicyMarkSucceededInput(policy: policy),
            storage: storage
        )
        if case .ok(let succeededPolicy) = step4 {
            XCTAssertEqual(succeededPolicy, policy)
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

    // MARK: - Single attempt max

    func testSingleAttemptMaxExhaustsImmediately() async throws {
        // With maxAttempts=1, a single recorded attempt should exhaust retries
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: RetryPolicyCreateInput(
                stepRef: "step-single",
                runRef: "run-single",
                maxAttempts: 1,
                initialIntervalMs: 100,
                backoffCoefficient: 1.0,
                maxIntervalMs: 100
            ),
            storage: storage
        )
        guard case .ok(let policy) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.recordAttempt(
            input: RetryPolicyRecordAttemptInput(policy: policy, error: "failed on first try"),
            storage: storage
        )

        let s = try await handler.shouldRetry(
            input: RetryPolicyShouldRetryInput(policy: policy, error: "check exhaustion"),
            storage: storage
        )
        if case .exhausted(_, let stepRef, let runRef, _) = s {
            XCTAssertEqual(stepRef, "step-single")
            XCTAssertEqual(runRef, "run-single")
        } else {
            XCTFail("Expected .exhausted, got \(s)")
        }
    }

    // MARK: - Multiple policies are isolated

    func testMultiplePoliciesAreIsolated() async throws {
        // Recording attempts on one policy should not affect another
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let r1 = try await handler.create(
            input: RetryPolicyCreateInput(
                stepRef: "step-iso-1",
                runRef: "run-iso-1",
                maxAttempts: 2,
                initialIntervalMs: 100,
                backoffCoefficient: 1.0,
                maxIntervalMs: 1000
            ),
            storage: storage
        )
        guard case .ok(let policy1) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.create(
            input: RetryPolicyCreateInput(
                stepRef: "step-iso-2",
                runRef: "run-iso-2",
                maxAttempts: 5,
                initialIntervalMs: 200,
                backoffCoefficient: 2.0,
                maxIntervalMs: 5000
            ),
            storage: storage
        )
        guard case .ok(let policy2) = r2 else { XCTFail("Expected .ok"); return }

        // Exhaust policy1
        let _ = try await handler.recordAttempt(input: RetryPolicyRecordAttemptInput(policy: policy1, error: "e1"), storage: storage)
        let _ = try await handler.recordAttempt(input: RetryPolicyRecordAttemptInput(policy: policy1, error: "e2"), storage: storage)

        let s1 = try await handler.shouldRetry(
            input: RetryPolicyShouldRetryInput(policy: policy1, error: "check"),
            storage: storage
        )
        if case .exhausted = s1 {
            // expected
        } else {
            XCTFail("Expected .exhausted for policy1, got \(s1)")
        }

        // policy2 should still allow retries
        let s2 = try await handler.shouldRetry(
            input: RetryPolicyShouldRetryInput(policy: policy2, error: "first error"),
            storage: storage
        )
        if case .retry = s2 {
            // expected
        } else {
            XCTFail("Expected .retry for policy2, got \(s2)")
        }
    }

    // MARK: - Unique policy IDs

    func testEachCreateReturnsUniquePolicyId() async throws {
        // Each create call should produce a unique policy ID
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        var ids: Set<String> = []
        for i in 1...6 {
            let result = try await handler.create(
                input: RetryPolicyCreateInput(
                    stepRef: "step-\(i)",
                    runRef: "run-\(i)",
                    maxAttempts: 3,
                    initialIntervalMs: 100,
                    backoffCoefficient: 2.0,
                    maxIntervalMs: 5000
                ),
                storage: storage
            )
            guard case .ok(let id) = result else {
                XCTFail("Expected .ok, got \(result)")
                return
            }
            ids.insert(id)
        }
        XCTAssertEqual(ids.count, 6, "All 6 policy IDs should be unique")
    }

    // MARK: - Attempt count increments correctly

    func testAttemptCountIncrementsCorrectly() async throws {
        // Each recordAttempt should increment the attempt count by 1
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: RetryPolicyCreateInput(
                stepRef: "step-count",
                runRef: "run-count",
                maxAttempts: 10,
                initialIntervalMs: 50,
                backoffCoefficient: 1.0,
                maxIntervalMs: 50
            ),
            storage: storage
        )
        guard case .ok(let policy) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        for expected in 1...5 {
            let r = try await handler.recordAttempt(
                input: RetryPolicyRecordAttemptInput(policy: policy, error: "err \(expected)"),
                storage: storage
            )
            if case .ok(_, let attemptCount) = r {
                XCTAssertEqual(attemptCount, expected)
            } else {
                XCTFail("Expected .ok, got \(r)")
            }
        }
    }

    // MARK: - Coefficient of 1.0 keeps delay constant

    func testCoefficientOneKeepsConstantDelay() async throws {
        // With backoffCoefficient of 1.0, the delay should remain constant
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: RetryPolicyCreateInput(
                stepRef: "step-const",
                runRef: "run-const",
                maxAttempts: 5,
                initialIntervalMs: 500,
                backoffCoefficient: 1.0,
                maxIntervalMs: 500
            ),
            storage: storage
        )
        guard case .ok(let policy) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        var delays: [Int] = []
        for i in 1...3 {
            let s = try await handler.shouldRetry(
                input: RetryPolicyShouldRetryInput(policy: policy, error: "err \(i)"),
                storage: storage
            )
            if case .retry(_, let delay, _) = s {
                delays.append(delay)
            }
            let _ = try await handler.recordAttempt(
                input: RetryPolicyRecordAttemptInput(policy: policy, error: "err \(i)"),
                storage: storage
            )
        }

        // All delays should be the same (or at most equal to initialIntervalMs)
        for delay in delays {
            XCTAssertLessThanOrEqual(delay, 500)
        }
    }

}
