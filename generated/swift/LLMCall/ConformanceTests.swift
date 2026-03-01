// generated: LLMCall/ConformanceTests.swift

import XCTest
@testable import Clef

final class LLMCallConformanceTests: XCTestCase {

    func testLLMCallRequestRecordResponseAndValidate() async throws {
        // invariant: after request then recordResponse, validate checks output against schema
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let prompt = Data("Summarize this document".utf8)
        let rawOutput = Data("{\"summary\":\"A brief overview\"}".utf8)

        // --- AFTER clause ---
        let step1 = try await handler.request(
            input: LLMCallRequestInput(
                stepRef: "step-draft",
                model: "claude-sonnet-4-5-20250929",
                prompt: prompt,
                outputSchema: "Email:v1",
                maxAttempts: 3
            ),
            storage: storage
        )
        guard case .ok(let call, let stepRef, let model) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }
        XCTAssertFalse(call.isEmpty)
        XCTAssertEqual(stepRef, "step-draft")
        XCTAssertEqual(model, "claude-sonnet-4-5-20250929")

        let step2 = try await handler.recordResponse(
            input: LLMCallRecordResponseInput(
                call: call,
                rawOutput: rawOutput,
                inputTokens: 100,
                outputTokens: 200
            ),
            storage: storage
        )
        if case .ok(let recordedCall) = step2 {
            XCTAssertEqual(recordedCall, call)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        let step3 = try await handler.validate(
            input: LLMCallValidateInput(call: call),
            storage: storage
        )
        switch step3 {
        case .valid(let validCall, let validStepRef, _):
            XCTAssertEqual(validCall, call)
            XCTAssertEqual(validStepRef, "step-draft")
        case .invalid(let invalidCall, _, _, _):
            XCTAssertEqual(invalidCall, call)
            // Invalid is also a valid test outcome depending on schema match
        }
    }

    func testLLMCallRepair() async throws {
        // invariant: repair increments attempt count and transitions back to requesting
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let prompt = Data("Generate JSON output".utf8)

        let step1 = try await handler.request(
            input: LLMCallRequestInput(
                stepRef: "step-generate",
                model: "claude-sonnet-4-5-20250929",
                prompt: prompt,
                outputSchema: "Output:v1",
                maxAttempts: 3
            ),
            storage: storage
        )
        guard case .ok(let call, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        let step2 = try await handler.repair(
            input: LLMCallRepairInput(call: call, errors: "Missing required field: subject"),
            storage: storage
        )
        switch step2 {
        case .ok(let repairedCall):
            XCTAssertEqual(repairedCall, call)
        case .maxAttemptsReached(let reachedCall, _):
            XCTAssertEqual(reachedCall, call)
        }
    }

    func testLLMCallAccept() async throws {
        // invariant: accept manually accepts output bypassing schema validation
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let prompt = Data("Classify this text".utf8)
        let rawOutput = Data("positive".utf8)

        let step1 = try await handler.request(
            input: LLMCallRequestInput(
                stepRef: "step-classify",
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

        let _ = try await handler.recordResponse(
            input: LLMCallRecordResponseInput(
                call: call,
                rawOutput: rawOutput,
                inputTokens: 50,
                outputTokens: 10
            ),
            storage: storage
        )

        // --- THEN clause ---
        let step3 = try await handler.accept(
            input: LLMCallAcceptInput(call: call),
            storage: storage
        )
        if case .ok(let acceptedCall, let acceptedStepRef, _) = step3 {
            XCTAssertEqual(acceptedCall, call)
            XCTAssertEqual(acceptedStepRef, "step-classify")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testLLMCallReject() async throws {
        // invariant: reject permanently rejects the call output with a reason
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let prompt = Data("Write an email".utf8)

        let step1 = try await handler.request(
            input: LLMCallRequestInput(
                stepRef: "step-email",
                model: "claude-sonnet-4-5-20250929",
                prompt: prompt,
                outputSchema: "Email:v1",
                maxAttempts: 2
            ),
            storage: storage
        )
        guard case .ok(let call, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        let step2 = try await handler.reject(
            input: LLMCallRejectInput(call: call, reason: "Output quality insufficient"),
            storage: storage
        )
        if case .ok(let rejectedCall, let rejectedStepRef, let reason) = step2 {
            XCTAssertEqual(rejectedCall, call)
            XCTAssertEqual(rejectedStepRef, "step-email")
            XCTAssertEqual(reason, "Output quality insufficient")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
