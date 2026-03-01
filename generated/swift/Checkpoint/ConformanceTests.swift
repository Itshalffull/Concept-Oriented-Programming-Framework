// generated: Checkpoint/ConformanceTests.swift

import XCTest
@testable import Clef

final class CheckpointConformanceTests: XCTestCase {

    func testCheckpointCaptureAndRestore() async throws {
        // invariant: after capture, restore returns the exact captured state snapshots
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let runState = Data("{\"status\":\"running\",\"step\":\"validate\"}".utf8)
        let varsSnapshot = Data("{\"orderId\":\"O-123\"}".utf8)
        let tokenSnapshot = Data("{\"tokens\":[\"t1\"]}".utf8)

        // --- AFTER clause ---
        let step1 = try await handler.capture(
            input: CheckpointCaptureInput(
                runRef: "run-001",
                runState: runState,
                variablesSnapshot: varsSnapshot,
                tokenSnapshot: tokenSnapshot,
                eventCursor: 42
            ),
            storage: storage
        )
        guard case .ok(let checkpoint, let timestamp) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }
        XCTAssertFalse(checkpoint.isEmpty)
        XCTAssertFalse(timestamp.isEmpty)

        // --- THEN clause ---
        let step2 = try await handler.restore(
            input: CheckpointRestoreInput(checkpoint: checkpoint),
            storage: storage
        )
        if case .ok(let restoredCheckpoint, let restoredRunState, let restoredVars, let restoredTokens, let restoredCursor) = step2 {
            XCTAssertEqual(restoredCheckpoint, checkpoint)
            XCTAssertEqual(restoredRunState, runState)
            XCTAssertEqual(restoredVars, varsSnapshot)
            XCTAssertEqual(restoredTokens, tokenSnapshot)
            XCTAssertEqual(restoredCursor, 42)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testCheckpointRestoreNotFound() async throws {
        // invariant: restore with unknown checkpoint returns notFound
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.restore(
            input: CheckpointRestoreInput(checkpoint: "nonexistent-checkpoint"),
            storage: storage
        )
        if case .notFound(let cp) = step1 {
            XCTAssertEqual(cp, "nonexistent-checkpoint")
        } else {
            XCTFail("Expected .notFound, got \(step1)")
        }
    }

    func testCheckpointFindLatest() async throws {
        // invariant: after multiple captures, findLatest returns the most recent checkpoint
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let runRef = "run-002"
        let emptyData = Data("{}".utf8)

        let _ = try await handler.capture(
            input: CheckpointCaptureInput(
                runRef: runRef,
                runState: emptyData,
                variablesSnapshot: emptyData,
                tokenSnapshot: emptyData,
                eventCursor: 10
            ),
            storage: storage
        )

        let step2 = try await handler.capture(
            input: CheckpointCaptureInput(
                runRef: runRef,
                runState: emptyData,
                variablesSnapshot: emptyData,
                tokenSnapshot: emptyData,
                eventCursor: 20
            ),
            storage: storage
        )
        guard case .ok(let latestCheckpoint, _) = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }

        // --- THEN clause ---
        let step3 = try await handler.findLatest(
            input: CheckpointFindLatestInput(runRef: runRef),
            storage: storage
        )
        if case .ok(let foundCheckpoint) = step3 {
            XCTAssertEqual(foundCheckpoint, latestCheckpoint)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testCheckpointFindLatestNone() async throws {
        // invariant: findLatest on a run with no checkpoints returns none
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.findLatest(
            input: CheckpointFindLatestInput(runRef: "run-no-checkpoints"),
            storage: storage
        )
        if case .none(let runRef) = step1 {
            XCTAssertEqual(runRef, "run-no-checkpoints")
        } else {
            XCTFail("Expected .none, got \(step1)")
        }
    }

    func testCheckpointPrune() async throws {
        // invariant: prune removes old checkpoints beyond keepCount
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let runRef = "run-003"
        let emptyData = Data("{}".utf8)

        for cursor in 1...5 {
            let _ = try await handler.capture(
                input: CheckpointCaptureInput(
                    runRef: runRef,
                    runState: emptyData,
                    variablesSnapshot: emptyData,
                    tokenSnapshot: emptyData,
                    eventCursor: cursor
                ),
                storage: storage
            )
        }

        // --- THEN clause ---
        let step2 = try await handler.prune(
            input: CheckpointPruneInput(runRef: runRef, keepCount: 2),
            storage: storage
        )
        if case .ok(let pruned) = step2 {
            XCTAssertEqual(pruned, 3)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
