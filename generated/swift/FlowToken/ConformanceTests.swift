// generated: FlowToken/ConformanceTests.swift

import XCTest
@testable import Clef

final class FlowTokenConformanceTests: XCTestCase {

    func testFlowTokenEmitAndCountActive() async throws {
        // invariant: after emit, countActive reflects the new token
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let processId = "u-test-invariant-001"

        // --- AFTER clause ---
        // emit(processId: processId, stepId: "step-1", tokenType: "normal") -> ok(tokenId: _)
        let step1 = try await handler.emit(
            input: FlowTokenEmitInput(processId: processId, stepId: "step-1", tokenType: "normal"),
            storage: storage
        )
        if case .ok(let tokenId) = step1 {
            XCTAssertFalse(tokenId.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // countActive(processId: processId) -> ok(count: 1)
        let step2 = try await handler.countActive(
            input: FlowTokenCountActiveInput(processId: processId),
            storage: storage
        )
        if case .ok(let count) = step2 {
            XCTAssertEqual(count, 1)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testFlowTokenConsumeReducesCount() async throws {
        // invariant: after consume, the token is no longer active
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let processId = "u-test-invariant-002"

        // --- AFTER clause ---
        let step1 = try await handler.emit(
            input: FlowTokenEmitInput(processId: processId, stepId: "step-1", tokenType: "normal"),
            storage: storage
        )
        guard case .ok(let tokenId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.consume(
            input: FlowTokenConsumeInput(tokenId: tokenId),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        let step3 = try await handler.countActive(
            input: FlowTokenCountActiveInput(processId: processId),
            storage: storage
        )
        if case .ok(let count) = step3 {
            XCTAssertEqual(count, 0)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testFlowTokenListActive() async throws {
        // invariant: listActive returns all active token IDs
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let processId = "u-test-invariant-003"

        // --- AFTER clause ---
        let _ = try await handler.emit(
            input: FlowTokenEmitInput(processId: processId, stepId: "step-1", tokenType: "normal"),
            storage: storage
        )

        // --- THEN clause ---
        let step2 = try await handler.listActive(
            input: FlowTokenListActiveInput(processId: processId),
            storage: storage
        )
        if case .ok(let tokenIds) = step2 {
            XCTAssertFalse(tokenIds.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
