// generated: FlowToken/BusinessTests.swift

import XCTest
@testable import Clef

final class FlowTokenBusinessTests: XCTestCase {

    // MARK: - Multiple token emit and count

    func testEmitMultipleTokensIncrementsCount() async throws {
        // Emitting multiple tokens for the same process should accumulate
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-multi-token"

        let _ = try await handler.emit(
            input: FlowTokenEmitInput(processId: processId, stepId: "step-1", tokenType: "normal"),
            storage: storage
        )
        let _ = try await handler.emit(
            input: FlowTokenEmitInput(processId: processId, stepId: "step-2", tokenType: "normal"),
            storage: storage
        )
        let _ = try await handler.emit(
            input: FlowTokenEmitInput(processId: processId, stepId: "step-3", tokenType: "normal"),
            storage: storage
        )

        let step4 = try await handler.countActive(
            input: FlowTokenCountActiveInput(processId: processId),
            storage: storage
        )
        if case .ok(let count) = step4 {
            XCTAssertEqual(count, 3)
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

    // MARK: - Kill token

    func testKillTokenRemovesFromActive() async throws {
        // Killing a token should decrement the active count
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-kill-token"

        let step1 = try await handler.emit(
            input: FlowTokenEmitInput(processId: processId, stepId: "step-k", tokenType: "normal"),
            storage: storage
        )
        guard case .ok(let tokenId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.kill(
            input: FlowTokenKillInput(tokenId: tokenId),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

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

    // MARK: - Consume one of many

    func testConsumeOneOfManyTokens() async throws {
        // Consuming one token out of many should only reduce count by one
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-consume-partial"

        let step1 = try await handler.emit(
            input: FlowTokenEmitInput(processId: processId, stepId: "step-1", tokenType: "normal"),
            storage: storage
        )
        guard case .ok(let tokenId1) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.emit(
            input: FlowTokenEmitInput(processId: processId, stepId: "step-2", tokenType: "normal"),
            storage: storage
        )

        let step3 = try await handler.consume(
            input: FlowTokenConsumeInput(tokenId: tokenId1),
            storage: storage
        )
        if case .ok = step3 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }

        let step4 = try await handler.countActive(
            input: FlowTokenCountActiveInput(processId: processId),
            storage: storage
        )
        if case .ok(let count) = step4 {
            XCTAssertEqual(count, 1)
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

    // MARK: - Process isolation

    func testTokenCountIsolatedBetweenProcesses() async throws {
        // Tokens from different processes should not interfere
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let procA = "proc-iso-a"
        let procB = "proc-iso-b"

        let _ = try await handler.emit(
            input: FlowTokenEmitInput(processId: procA, stepId: "s1", tokenType: "normal"),
            storage: storage
        )
        let _ = try await handler.emit(
            input: FlowTokenEmitInput(processId: procA, stepId: "s2", tokenType: "normal"),
            storage: storage
        )
        let _ = try await handler.emit(
            input: FlowTokenEmitInput(processId: procB, stepId: "s1", tokenType: "normal"),
            storage: storage
        )

        let countA = try await handler.countActive(
            input: FlowTokenCountActiveInput(processId: procA),
            storage: storage
        )
        if case .ok(let count) = countA {
            XCTAssertEqual(count, 2)
        } else {
            XCTFail("Expected .ok, got \(countA)")
        }

        let countB = try await handler.countActive(
            input: FlowTokenCountActiveInput(processId: procB),
            storage: storage
        )
        if case .ok(let count) = countB {
            XCTAssertEqual(count, 1)
        } else {
            XCTFail("Expected .ok, got \(countB)")
        }
    }

    // MARK: - List active returns correct tokens

    func testListActiveReturnsAllEmittedTokenIds() async throws {
        // listActive should return all active token IDs for the process
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-list-active"

        let r1 = try await handler.emit(
            input: FlowTokenEmitInput(processId: processId, stepId: "s1", tokenType: "normal"),
            storage: storage
        )
        guard case .ok(let t1) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.emit(
            input: FlowTokenEmitInput(processId: processId, stepId: "s2", tokenType: "fork"),
            storage: storage
        )
        guard case .ok(let t2) = r2 else { XCTFail("Expected .ok"); return }

        let step3 = try await handler.listActive(
            input: FlowTokenListActiveInput(processId: processId),
            storage: storage
        )
        if case .ok(let tokenIds) = step3 {
            XCTAssertTrue(tokenIds.contains(t1))
            XCTAssertTrue(tokenIds.contains(t2))
            XCTAssertEqual(tokenIds.count, 2)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Consume all tokens

    func testConsumeAllTokensBringsCountToZero() async throws {
        // Consuming every emitted token should bring count to zero
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-consume-all"

        var tokenIds: [String] = []
        for i in 1...3 {
            let r = try await handler.emit(
                input: FlowTokenEmitInput(processId: processId, stepId: "s-\(i)", tokenType: "normal"),
                storage: storage
            )
            guard case .ok(let tid) = r else { XCTFail("Expected .ok"); return }
            tokenIds.append(tid)
        }

        for tid in tokenIds {
            let _ = try await handler.consume(
                input: FlowTokenConsumeInput(tokenId: tid),
                storage: storage
            )
        }

        let count = try await handler.countActive(
            input: FlowTokenCountActiveInput(processId: processId),
            storage: storage
        )
        if case .ok(let c) = count {
            XCTAssertEqual(c, 0)
        } else {
            XCTFail("Expected .ok, got \(count)")
        }
    }

    // MARK: - Empty process has zero active count

    func testCountActiveOnEmptyProcessReturnsZero() async throws {
        // A process with no emitted tokens should have a count of zero
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.countActive(
            input: FlowTokenCountActiveInput(processId: "proc-empty"),
            storage: storage
        )
        if case .ok(let count) = step1 {
            XCTAssertEqual(count, 0)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
    }

    // MARK: - Token type handling

    func testDifferentTokenTypesAreTrackedCorrectly() async throws {
        // Tokens of different types should all be tracked in active count
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-token-types"

        let _ = try await handler.emit(
            input: FlowTokenEmitInput(processId: processId, stepId: "s1", tokenType: "normal"),
            storage: storage
        )
        let _ = try await handler.emit(
            input: FlowTokenEmitInput(processId: processId, stepId: "s2", tokenType: "fork"),
            storage: storage
        )
        let _ = try await handler.emit(
            input: FlowTokenEmitInput(processId: processId, stepId: "s3", tokenType: "join"),
            storage: storage
        )

        let count = try await handler.countActive(
            input: FlowTokenCountActiveInput(processId: processId),
            storage: storage
        )
        if case .ok(let c) = count {
            XCTAssertEqual(c, 3)
        } else {
            XCTFail("Expected .ok, got \(count)")
        }
    }

}
