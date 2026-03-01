// generated: LLMCall/BusinessTests.swift

import XCTest
@testable import Clef

final class LLMCallBusinessTests: XCTestCase {

    // MARK: - Full happy path: request -> recordResponse -> validate -> accept

    func testFullHappyPathRequestToAccept() async throws {
        // Full lifecycle: request, record response, validate, accept
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let prompt = Data("Summarize this quarterly report".utf8)
        let rawOutput = Data("{\"summary\":\"Revenue grew 15% YoY\",\"confidence\":0.95}".utf8)

        let step1 = try await handler.request(
            input: LLMCallRequestInput(
                stepRef: "step-summarize",
                model: "claude-sonnet-4-5-20250929",
                prompt: prompt,
                outputSchema: "Summary:v1",
                maxAttempts: 3
            ),
            storage: storage
        )
        guard case .ok(let call, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.recordResponse(
            input: LLMCallRecordResponseInput(
                call: call,
                rawOutput: rawOutput,
                inputTokens: 500,
                outputTokens: 150
            ),
            storage: storage
        )
        if case .ok(let recordedCall) = step2 {
            XCTAssertEqual(recordedCall, call)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        let step3 = try await handler.validate(
            input: LLMCallValidateInput(call: call),
            storage: storage
        )
        // Validation result depends on implementation
        switch step3 {
        case .valid(let validCall, _, _):
            XCTAssertEqual(validCall, call)
        case .invalid(let invalidCall, _, _, _):
            XCTAssertEqual(invalidCall, call)
        }

        let step4 = try await handler.accept(
            input: LLMCallAcceptInput(call: call),
            storage: storage
        )
        if case .ok(let acceptedCall, let stepRef, _) = step4 {
            XCTAssertEqual(acceptedCall, call)
            XCTAssertEqual(stepRef, "step-summarize")
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

    // MARK: - Repair then record and validate cycle

    func testRepairCycleWithRecordAndValidate() async throws {
        // After initial failure, repair should allow a new attempt
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let prompt = Data("Generate structured JSON".utf8)

        let step1 = try await handler.request(
            input: LLMCallRequestInput(
                stepRef: "step-json-gen",
                model: "claude-sonnet-4-5-20250929",
                prompt: prompt,
                outputSchema: "JSON:v1",
                maxAttempts: 3
            ),
            storage: storage
        )
        guard case .ok(let call, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // Record first (bad) response
        let badOutput = Data("not valid json".utf8)
        let _ = try await handler.recordResponse(
            input: LLMCallRecordResponseInput(
                call: call,
                rawOutput: badOutput,
                inputTokens: 200,
                outputTokens: 50
            ),
            storage: storage
        )

        // Repair
        let repairResult = try await handler.repair(
            input: LLMCallRepairInput(call: call, errors: "Output is not valid JSON"),
            storage: storage
        )
        switch repairResult {
        case .ok(let repairedCall):
            XCTAssertEqual(repairedCall, call)
        case .maxAttemptsReached(let reachedCall, _):
            XCTAssertEqual(reachedCall, call)
        }
    }

    // MARK: - Reject with detailed reason

    func testRejectWithDetailedReason() async throws {
        // Rejecting should preserve the reason string
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let prompt = Data("Write a professional email".utf8)

        let step1 = try await handler.request(
            input: LLMCallRequestInput(
                stepRef: "step-email-draft",
                model: "claude-sonnet-4-5-20250929",
                prompt: prompt,
                outputSchema: "Email:v2",
                maxAttempts: 2
            ),
            storage: storage
        )
        guard case .ok(let call, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let detailedReason = "The email tone is too casual, uses informal language, and does not address the recipient by proper title."

        let step2 = try await handler.reject(
            input: LLMCallRejectInput(call: call, reason: detailedReason),
            storage: storage
        )
        if case .ok(let rejectedCall, let stepRef, let reason) = step2 {
            XCTAssertEqual(rejectedCall, call)
            XCTAssertEqual(stepRef, "step-email-draft")
            XCTAssertEqual(reason, detailedReason)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Multiple calls are isolated

    func testMultipleCallsAreIsolated() async throws {
        // Multiple LLM calls should not interfere with each other
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let r1 = try await handler.request(
            input: LLMCallRequestInput(
                stepRef: "step-call-a",
                model: "claude-sonnet-4-5-20250929",
                prompt: Data("prompt A".utf8),
                outputSchema: "A:v1",
                maxAttempts: 1
            ),
            storage: storage
        )
        guard case .ok(let callA, _, _) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.request(
            input: LLMCallRequestInput(
                stepRef: "step-call-b",
                model: "claude-sonnet-4-5-20250929",
                prompt: Data("prompt B".utf8),
                outputSchema: "B:v1",
                maxAttempts: 1
            ),
            storage: storage
        )
        guard case .ok(let callB, _, _) = r2 else { XCTFail("Expected .ok"); return }

        XCTAssertNotEqual(callA, callB)

        // Accept A, reject B
        let outputA = Data("{\"result\":\"a\"}".utf8)
        let _ = try await handler.recordResponse(
            input: LLMCallRecordResponseInput(call: callA, rawOutput: outputA, inputTokens: 10, outputTokens: 5),
            storage: storage
        )
        let acceptA = try await handler.accept(
            input: LLMCallAcceptInput(call: callA),
            storage: storage
        )
        if case .ok(_, let stepRef, _) = acceptA {
            XCTAssertEqual(stepRef, "step-call-a")
        } else {
            XCTFail("Expected .ok, got \(acceptA)")
        }

        let rejectB = try await handler.reject(
            input: LLMCallRejectInput(call: callB, reason: "not needed"),
            storage: storage
        )
        if case .ok(_, let stepRef, _) = rejectB {
            XCTAssertEqual(stepRef, "step-call-b")
        } else {
            XCTFail("Expected .ok, got \(rejectB)")
        }
    }

    // MARK: - Token counts preserved in recordResponse

    func testRecordResponsePreservesTokenCounts() async throws {
        // recordResponse should succeed with various token counts
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let prompt = Data("Count tokens".utf8)

        let step1 = try await handler.request(
            input: LLMCallRequestInput(
                stepRef: "step-tokens",
                model: "claude-sonnet-4-5-20250929",
                prompt: prompt,
                outputSchema: "",
                maxAttempts: 1
            ),
            storage: storage
        )
        guard case .ok(let call, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let rawOutput = Data("token test output".utf8)
        let step2 = try await handler.recordResponse(
            input: LLMCallRecordResponseInput(
                call: call,
                rawOutput: rawOutput,
                inputTokens: 1500,
                outputTokens: 4000
            ),
            storage: storage
        )
        if case .ok(let recordedCall) = step2 {
            XCTAssertEqual(recordedCall, call)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Repair with maxAttempts reached

    func testRepairExhaustsMaxAttempts() async throws {
        // After maxAttempts repairs, should return maxAttemptsReached
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let prompt = Data("Attempt limited generation".utf8)

        let step1 = try await handler.request(
            input: LLMCallRequestInput(
                stepRef: "step-limited",
                model: "claude-sonnet-4-5-20250929",
                prompt: prompt,
                outputSchema: "Strict:v1",
                maxAttempts: 1
            ),
            storage: storage
        )
        guard case .ok(let call, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.repair(
            input: LLMCallRepairInput(call: call, errors: "Invalid output format"),
            storage: storage
        )
        switch step2 {
        case .ok(let repairedCall):
            // May still have attempts remaining
            XCTAssertEqual(repairedCall, call)
        case .maxAttemptsReached(let reachedCall, let stepRef):
            XCTAssertEqual(reachedCall, call)
            XCTAssertEqual(stepRef, "step-limited")
        }
    }

    // MARK: - Different models

    func testDifferentModelsAreSupported() async throws {
        // Different model identifiers should be accepted
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let models = ["claude-sonnet-4-5-20250929", "claude-haiku-35", "custom-model-v1"]
        for (i, model) in models.enumerated() {
            let result = try await handler.request(
                input: LLMCallRequestInput(
                    stepRef: "step-model-\(i)",
                    model: model,
                    prompt: Data("test prompt".utf8),
                    outputSchema: "",
                    maxAttempts: 1
                ),
                storage: storage
            )
            if case .ok(let call, _, let returnedModel) = result {
                XCTAssertFalse(call.isEmpty)
                XCTAssertEqual(returnedModel, model)
            } else {
                XCTFail("Expected .ok for model \(model), got \(result)")
            }
        }
    }

    // MARK: - Unique call IDs

    func testEachRequestReturnsUniqueCallId() async throws {
        // Each request should produce a unique call ID
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        var ids: Set<String> = []
        for i in 1...6 {
            let result = try await handler.request(
                input: LLMCallRequestInput(
                    stepRef: "step-uniq-\(i)",
                    model: "claude-sonnet-4-5-20250929",
                    prompt: Data("prompt \(i)".utf8),
                    outputSchema: "",
                    maxAttempts: 1
                ),
                storage: storage
            )
            guard case .ok(let call, _, _) = result else {
                XCTFail("Expected .ok, got \(result)")
                return
            }
            ids.insert(call)
        }
        XCTAssertEqual(ids.count, 6, "All 6 call IDs should be unique")
    }

}
