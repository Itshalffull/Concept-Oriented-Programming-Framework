// generated: ProcessRun/BusinessTests.swift

import XCTest
@testable import Clef

final class ProcessRunBusinessTests: XCTestCase {

    // MARK: - Fail transition

    func testProcessRunFailSetsFailedStatus() async throws {
        // After starting and then failing, status should be "failed"
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.start(
            input: ProcessRunStartInput(specId: "spec-fail", initiator: "user-1"),
            storage: storage
        )
        guard case .ok(let processId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.fail(
            input: ProcessRunFailInput(processId: processId, reason: "unrecoverable error"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        let step3 = try await handler.getStatus(
            input: ProcessRunGetStatusInput(processId: processId),
            storage: storage
        )
        if case .ok(_, let status, _) = step3 {
            XCTAssertEqual(status, "failed")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Cancel transition

    func testProcessRunCancelSetsCancelledStatus() async throws {
        // After starting and then cancelling, status should be "cancelled"
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.start(
            input: ProcessRunStartInput(specId: "spec-cancel", initiator: "admin"),
            storage: storage
        )
        guard case .ok(let processId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.cancel(
            input: ProcessRunCancelInput(processId: processId, reason: "user requested cancellation"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        let step3 = try await handler.getStatus(
            input: ProcessRunGetStatusInput(processId: processId),
            storage: storage
        )
        if case .ok(_, let status, _) = step3 {
            XCTAssertEqual(status, "cancelled")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Child process

    func testStartChildCreatesLinkedProcess() async throws {
        // Starting a child process should return a distinct processId
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.start(
            input: ProcessRunStartInput(specId: "spec-parent", initiator: "orchestrator"),
            storage: storage
        )
        guard case .ok(let parentId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.startChild(
            input: ProcessRunStartChildInput(parentProcessId: parentId, specId: "spec-child", initiator: "orchestrator"),
            storage: storage
        )
        guard case .ok(let childId) = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }

        XCTAssertNotEqual(parentId, childId)

        let step3 = try await handler.getStatus(
            input: ProcessRunGetStatusInput(processId: childId),
            storage: storage
        )
        if case .ok(_, let status, _) = step3 {
            XCTAssertEqual(status, "running")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Multiple processes isolation

    func testMultipleProcessesAreIsolated() async throws {
        // Completing one process should not affect another
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.start(
            input: ProcessRunStartInput(specId: "spec-iso-1", initiator: "user-a"),
            storage: storage
        )
        guard case .ok(let proc1) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.start(
            input: ProcessRunStartInput(specId: "spec-iso-2", initiator: "user-b"),
            storage: storage
        )
        guard case .ok(let proc2) = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }

        let _ = try await handler.complete(
            input: ProcessRunCompleteInput(processId: proc1, result: "done"),
            storage: storage
        )

        let status1 = try await handler.getStatus(
            input: ProcessRunGetStatusInput(processId: proc1),
            storage: storage
        )
        if case .ok(_, let s, _) = status1 {
            XCTAssertEqual(s, "completed")
        } else {
            XCTFail("Expected .ok, got \(status1)")
        }

        let status2 = try await handler.getStatus(
            input: ProcessRunGetStatusInput(processId: proc2),
            storage: storage
        )
        if case .ok(_, let s, _) = status2 {
            XCTAssertEqual(s, "running")
        } else {
            XCTFail("Expected .ok, got \(status2)")
        }
    }

    // MARK: - Suspend from running, cancel from suspended

    func testCancelFromSuspendedState() async throws {
        // A suspended process should be cancellable
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.start(
            input: ProcessRunStartInput(specId: "spec-susp-cancel", initiator: "user-x"),
            storage: storage
        )
        guard case .ok(let processId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.suspend(
            input: ProcessRunSuspendInput(processId: processId, reason: "waiting for external system"),
            storage: storage
        )

        let step3 = try await handler.cancel(
            input: ProcessRunCancelInput(processId: processId, reason: "external system unavailable"),
            storage: storage
        )
        if case .ok = step3 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }

        let step4 = try await handler.getStatus(
            input: ProcessRunGetStatusInput(processId: processId),
            storage: storage
        )
        if case .ok(_, let status, _) = step4 {
            XCTAssertEqual(status, "cancelled")
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

    // MARK: - Multiple suspend/resume cycles

    func testMultipleSuspendResumeCycles() async throws {
        // A process should support multiple suspend/resume cycles
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.start(
            input: ProcessRunStartInput(specId: "spec-cycle", initiator: "user-cycle"),
            storage: storage
        )
        guard case .ok(let processId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        for i in 1...3 {
            let suspResult = try await handler.suspend(
                input: ProcessRunSuspendInput(processId: processId, reason: "cycle \(i)"),
                storage: storage
            )
            if case .ok = suspResult {
                // success
            } else {
                XCTFail("Expected .ok on suspend cycle \(i), got \(suspResult)")
            }

            let resResult = try await handler.resume(
                input: ProcessRunResumeInput(processId: processId),
                storage: storage
            )
            if case .ok = resResult {
                // success
            } else {
                XCTFail("Expected .ok on resume cycle \(i), got \(resResult)")
            }
        }

        let finalStatus = try await handler.getStatus(
            input: ProcessRunGetStatusInput(processId: processId),
            storage: storage
        )
        if case .ok(_, let status, _) = finalStatus {
            XCTAssertEqual(status, "running")
        } else {
            XCTFail("Expected .ok, got \(finalStatus)")
        }
    }

    // MARK: - Complete after resume

    func testCompleteAfterResumeFromSuspended() async throws {
        // A process that is resumed from suspended should be completable
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.start(
            input: ProcessRunStartInput(specId: "spec-resume-complete", initiator: "user-rc"),
            storage: storage
        )
        guard case .ok(let processId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.suspend(
            input: ProcessRunSuspendInput(processId: processId, reason: "paused"),
            storage: storage
        )
        let _ = try await handler.resume(
            input: ProcessRunResumeInput(processId: processId),
            storage: storage
        )

        let step4 = try await handler.complete(
            input: ProcessRunCompleteInput(processId: processId, result: "finalized"),
            storage: storage
        )
        if case .ok = step4 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }

        let step5 = try await handler.getStatus(
            input: ProcessRunGetStatusInput(processId: processId),
            storage: storage
        )
        if case .ok(_, let status, _) = step5 {
            XCTAssertEqual(status, "completed")
        } else {
            XCTFail("Expected .ok, got \(step5)")
        }
    }

    // MARK: - Unique process IDs

    func testEachStartReturnsUniqueProcessId() async throws {
        // Each start call should return a unique process identifier
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        var processIds: Set<String> = []
        for i in 1...5 {
            let result = try await handler.start(
                input: ProcessRunStartInput(specId: "spec-unique", initiator: "user-\(i)"),
                storage: storage
            )
            guard case .ok(let pid) = result else {
                XCTFail("Expected .ok, got \(result)")
                return
            }
            processIds.insert(pid)
        }
        XCTAssertEqual(processIds.count, 5, "All 5 process IDs should be unique")
    }

}
