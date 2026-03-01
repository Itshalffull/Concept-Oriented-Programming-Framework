// generated: Checkpoint/BusinessTests.swift

import XCTest
@testable import Clef

final class CheckpointBusinessTests: XCTestCase {

    // MARK: - Restore preserves all data fields

    func testRestorePreservesAllDataFields() async throws {
        // Restoring a checkpoint should return exact copies of all snapshot data
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let runState = Data("{\"currentStep\":\"step-4\",\"status\":\"running\"}".utf8)
        let varsSnapshot = Data("{\"orderId\":\"O-456\",\"amount\":100.50}".utf8)
        let tokenSnapshot = Data("{\"tokens\":[\"t1\",\"t2\",\"t3\"]}".utf8)
        let eventCursor = 99

        let step1 = try await handler.capture(
            input: CheckpointCaptureInput(
                runRef: "run-preserve",
                runState: runState,
                variablesSnapshot: varsSnapshot,
                tokenSnapshot: tokenSnapshot,
                eventCursor: eventCursor
            ),
            storage: storage
        )
        guard case .ok(let checkpoint, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.restore(
            input: CheckpointRestoreInput(checkpoint: checkpoint),
            storage: storage
        )
        if case .ok(_, let restoredRunState, let restoredVars, let restoredTokens, let restoredCursor) = step2 {
            XCTAssertEqual(restoredRunState, runState)
            XCTAssertEqual(restoredVars, varsSnapshot)
            XCTAssertEqual(restoredTokens, tokenSnapshot)
            XCTAssertEqual(restoredCursor, eventCursor)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Multiple checkpoints for same run

    func testMultipleCheckpointsForSameRun() async throws {
        // Multiple checkpoints for the same run should all be independently restorable
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let runRef = "run-multi-cp"
        let emptyData = Data("{}".utf8)

        let r1 = try await handler.capture(
            input: CheckpointCaptureInput(
                runRef: runRef,
                runState: Data("{\"step\":1}".utf8),
                variablesSnapshot: emptyData,
                tokenSnapshot: emptyData,
                eventCursor: 1
            ),
            storage: storage
        )
        guard case .ok(let cp1, _) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.capture(
            input: CheckpointCaptureInput(
                runRef: runRef,
                runState: Data("{\"step\":2}".utf8),
                variablesSnapshot: emptyData,
                tokenSnapshot: emptyData,
                eventCursor: 2
            ),
            storage: storage
        )
        guard case .ok(let cp2, _) = r2 else { XCTFail("Expected .ok"); return }

        XCTAssertNotEqual(cp1, cp2)

        // Both should be restorable
        let restore1 = try await handler.restore(
            input: CheckpointRestoreInput(checkpoint: cp1),
            storage: storage
        )
        if case .ok(_, _, _, _, let cursor) = restore1 {
            XCTAssertEqual(cursor, 1)
        } else {
            XCTFail("Expected .ok, got \(restore1)")
        }

        let restore2 = try await handler.restore(
            input: CheckpointRestoreInput(checkpoint: cp2),
            storage: storage
        )
        if case .ok(_, _, _, _, let cursor) = restore2 {
            XCTAssertEqual(cursor, 2)
        } else {
            XCTFail("Expected .ok, got \(restore2)")
        }
    }

    // MARK: - FindLatest always returns most recent

    func testFindLatestAlwaysReturnsMostRecent() async throws {
        // After capturing multiple checkpoints, findLatest should return the last one
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let runRef = "run-latest"
        let emptyData = Data("{}".utf8)

        var lastCheckpoint: String = ""
        for cursor in 1...4 {
            let result = try await handler.capture(
                input: CheckpointCaptureInput(
                    runRef: runRef,
                    runState: emptyData,
                    variablesSnapshot: emptyData,
                    tokenSnapshot: emptyData,
                    eventCursor: cursor
                ),
                storage: storage
            )
            if case .ok(let cp, _) = result {
                lastCheckpoint = cp
            }
        }

        let step2 = try await handler.findLatest(
            input: CheckpointFindLatestInput(runRef: runRef),
            storage: storage
        )
        if case .ok(let foundCheckpoint) = step2 {
            XCTAssertEqual(foundCheckpoint, lastCheckpoint)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Prune keeps the specified number

    func testPruneKeepsCorrectNumberOfCheckpoints() async throws {
        // Prune with keepCount should remove exactly the right number
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let runRef = "run-prune-count"
        let emptyData = Data("{}".utf8)

        for cursor in 1...8 {
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

        let step2 = try await handler.prune(
            input: CheckpointPruneInput(runRef: runRef, keepCount: 3),
            storage: storage
        )
        if case .ok(let pruned) = step2 {
            XCTAssertEqual(pruned, 5, "Should prune 5 out of 8 checkpoints when keeping 3")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Prune with keepCount greater than total

    func testPruneWithKeepCountGreaterThanTotal() async throws {
        // Pruning when keepCount exceeds total checkpoints should prune zero
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let runRef = "run-prune-excess"
        let emptyData = Data("{}".utf8)

        for cursor in 1...2 {
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

        let step2 = try await handler.prune(
            input: CheckpointPruneInput(runRef: runRef, keepCount: 10),
            storage: storage
        )
        if case .ok(let pruned) = step2 {
            XCTAssertEqual(pruned, 0, "Should prune 0 when keepCount exceeds total")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Checkpoints are isolated between runs

    func testCheckpointsAreIsolatedBetweenRuns() async throws {
        // Checkpoints for different runs should not interfere
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let emptyData = Data("{}".utf8)

        for cursor in 1...3 {
            let _ = try await handler.capture(
                input: CheckpointCaptureInput(
                    runRef: "run-iso-a",
                    runState: emptyData,
                    variablesSnapshot: emptyData,
                    tokenSnapshot: emptyData,
                    eventCursor: cursor
                ),
                storage: storage
            )
        }

        let _ = try await handler.capture(
            input: CheckpointCaptureInput(
                runRef: "run-iso-b",
                runState: emptyData,
                variablesSnapshot: emptyData,
                tokenSnapshot: emptyData,
                eventCursor: 100
            ),
            storage: storage
        )

        // Pruning run-iso-a should not affect run-iso-b
        let pruneA = try await handler.prune(
            input: CheckpointPruneInput(runRef: "run-iso-a", keepCount: 1),
            storage: storage
        )
        if case .ok(let pruned) = pruneA {
            XCTAssertEqual(pruned, 2)
        } else {
            XCTFail("Expected .ok, got \(pruneA)")
        }

        // run-iso-b should still have its checkpoint
        let findB = try await handler.findLatest(
            input: CheckpointFindLatestInput(runRef: "run-iso-b"),
            storage: storage
        )
        if case .ok(let cp) = findB {
            XCTAssertFalse(cp.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(findB)")
        }
    }

    // MARK: - Capture with large data

    func testCaptureWithLargeData() async throws {
        // Checkpoints should handle large state snapshots
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let largeState = Data(String(repeating: "x", count: 50000).utf8)
        let largeVars = Data(String(repeating: "y", count: 50000).utf8)
        let largeTokens = Data(String(repeating: "z", count: 50000).utf8)

        let step1 = try await handler.capture(
            input: CheckpointCaptureInput(
                runRef: "run-large",
                runState: largeState,
                variablesSnapshot: largeVars,
                tokenSnapshot: largeTokens,
                eventCursor: 999
            ),
            storage: storage
        )
        guard case .ok(let checkpoint, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.restore(
            input: CheckpointRestoreInput(checkpoint: checkpoint),
            storage: storage
        )
        if case .ok(_, let restoredState, let restoredVars, let restoredTokens, let cursor) = step2 {
            XCTAssertEqual(restoredState, largeState)
            XCTAssertEqual(restoredVars, largeVars)
            XCTAssertEqual(restoredTokens, largeTokens)
            XCTAssertEqual(cursor, 999)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Unique checkpoint IDs

    func testEachCaptureReturnsUniqueCheckpointId() async throws {
        // Each capture should produce a unique checkpoint ID
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let emptyData = Data("{}".utf8)
        var ids: Set<String> = []

        for i in 1...6 {
            let result = try await handler.capture(
                input: CheckpointCaptureInput(
                    runRef: "run-uniq-cp",
                    runState: emptyData,
                    variablesSnapshot: emptyData,
                    tokenSnapshot: emptyData,
                    eventCursor: i
                ),
                storage: storage
            )
            guard case .ok(let cp, _) = result else {
                XCTFail("Expected .ok, got \(result)")
                return
            }
            ids.insert(cp)
        }
        XCTAssertEqual(ids.count, 6, "All 6 checkpoint IDs should be unique")
    }

}
