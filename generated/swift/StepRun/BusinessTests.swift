// generated: StepRun/BusinessTests.swift

import XCTest
@testable import Clef

final class StepRunBusinessTests: XCTestCase {

    // MARK: - Cancel transition

    func testStepRunCancelSetsCancelledStatus() async throws {
        // After starting and cancelling, status should be "cancelled"
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.start(
            input: StepRunStartInput(processId: "proc-cancel", stepId: "step-cancel", stepName: "CancelMe"),
            storage: storage
        )
        guard case .ok(let runId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.cancel(
            input: StepRunCancelInput(runId: runId, reason: "process aborted"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        let step3 = try await handler.get(
            input: StepRunGetInput(runId: runId),
            storage: storage
        )
        if case .ok(_, _, _, let status) = step3 {
            XCTAssertEqual(status, "cancelled")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Skip transition

    func testStepRunSkipSetsSkippedStatus() async throws {
        // After starting and skipping, status should be "skipped"
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.start(
            input: StepRunStartInput(processId: "proc-skip", stepId: "step-skip", stepName: "SkipMe"),
            storage: storage
        )
        guard case .ok(let runId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.skip(
            input: StepRunSkipInput(runId: runId, reason: "condition not met"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        let step3 = try await handler.get(
            input: StepRunGetInput(runId: runId),
            storage: storage
        )
        if case .ok(_, _, _, let status) = step3 {
            XCTAssertEqual(status, "skipped")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Multiple steps within same process

    func testMultipleStepsInSameProcess() async throws {
        // Multiple steps within the same process should be independent
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-multi-step"

        let step1 = try await handler.start(
            input: StepRunStartInput(processId: processId, stepId: "step-a", stepName: "StepA"),
            storage: storage
        )
        guard case .ok(let runIdA) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.start(
            input: StepRunStartInput(processId: processId, stepId: "step-b", stepName: "StepB"),
            storage: storage
        )
        guard case .ok(let runIdB) = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }

        XCTAssertNotEqual(runIdA, runIdB)

        // Complete A, fail B
        let _ = try await handler.complete(
            input: StepRunCompleteInput(runId: runIdA, output: "done-a"),
            storage: storage
        )
        let _ = try await handler.fail(
            input: StepRunFailInput(runId: runIdB, reason: "error-b"),
            storage: storage
        )

        let getA = try await handler.get(
            input: StepRunGetInput(runId: runIdA),
            storage: storage
        )
        if case .ok(_, _, _, let status) = getA {
            XCTAssertEqual(status, "completed")
        } else {
            XCTFail("Expected .ok, got \(getA)")
        }

        let getB = try await handler.get(
            input: StepRunGetInput(runId: runIdB),
            storage: storage
        )
        if case .ok(_, _, _, let status) = getB {
            XCTAssertEqual(status, "failed")
        } else {
            XCTFail("Expected .ok, got \(getB)")
        }
    }

    // MARK: - Get returns correct metadata

    func testGetReturnsCorrectStepMetadata() async throws {
        // Get should return the processId, stepId, stepName, and status
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.start(
            input: StepRunStartInput(processId: "proc-meta", stepId: "step-meta", stepName: "MetadataCheck"),
            storage: storage
        )
        guard case .ok(let runId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.get(
            input: StepRunGetInput(runId: runId),
            storage: storage
        )
        if case .ok(let processId, let stepId, let stepName, let status) = step2 {
            XCTAssertEqual(processId, "proc-meta")
            XCTAssertEqual(stepId, "step-meta")
            XCTAssertEqual(stepName, "MetadataCheck")
            XCTAssertEqual(status, "running")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - All terminal states

    func testAllTerminalStatesAreDistinct() async throws {
        // completed, failed, cancelled, skipped are all distinct terminal states
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-terminals"

        // Create four step runs
        let r1 = try await handler.start(input: StepRunStartInput(processId: processId, stepId: "s1", stepName: "S1"), storage: storage)
        guard case .ok(let id1) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.start(input: StepRunStartInput(processId: processId, stepId: "s2", stepName: "S2"), storage: storage)
        guard case .ok(let id2) = r2 else { XCTFail("Expected .ok"); return }

        let r3 = try await handler.start(input: StepRunStartInput(processId: processId, stepId: "s3", stepName: "S3"), storage: storage)
        guard case .ok(let id3) = r3 else { XCTFail("Expected .ok"); return }

        let r4 = try await handler.start(input: StepRunStartInput(processId: processId, stepId: "s4", stepName: "S4"), storage: storage)
        guard case .ok(let id4) = r4 else { XCTFail("Expected .ok"); return }

        // Move each to a different terminal state
        let _ = try await handler.complete(input: StepRunCompleteInput(runId: id1, output: "ok"), storage: storage)
        let _ = try await handler.fail(input: StepRunFailInput(runId: id2, reason: "err"), storage: storage)
        let _ = try await handler.cancel(input: StepRunCancelInput(runId: id3, reason: "abort"), storage: storage)
        let _ = try await handler.skip(input: StepRunSkipInput(runId: id4, reason: "skipped"), storage: storage)

        let statuses = [id1, id2, id3, id4]
        var results: [String] = []
        for id in statuses {
            let g = try await handler.get(input: StepRunGetInput(runId: id), storage: storage)
            if case .ok(_, _, _, let status) = g {
                results.append(status)
            }
        }
        XCTAssertEqual(results, ["completed", "failed", "cancelled", "skipped"])
    }

    // MARK: - Unique run IDs

    func testEachStartReturnsUniqueRunId() async throws {
        // Each start call should produce a unique run identifier
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        var runIds: Set<String> = []
        for i in 1...6 {
            let result = try await handler.start(
                input: StepRunStartInput(processId: "proc-uniq", stepId: "step-\(i)", stepName: "Step\(i)"),
                storage: storage
            )
            guard case .ok(let runId) = result else {
                XCTFail("Expected .ok, got \(result)")
                return
            }
            runIds.insert(runId)
        }
        XCTAssertEqual(runIds.count, 6, "All 6 run IDs should be unique")
    }

    // MARK: - Complete with different outputs

    func testCompleteWithVariousOutputValues() async throws {
        // Completing with different output values should succeed
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let outputs = ["simple", "{\"complex\":true}", "", "12345"]
        for (i, output) in outputs.enumerated() {
            let r = try await handler.start(
                input: StepRunStartInput(processId: "proc-out", stepId: "step-out-\(i)", stepName: "Out\(i)"),
                storage: storage
            )
            guard case .ok(let runId) = r else {
                XCTFail("Expected .ok, got \(r)")
                return
            }

            let c = try await handler.complete(
                input: StepRunCompleteInput(runId: runId, output: output),
                storage: storage
            )
            if case .ok = c {
                // success
            } else {
                XCTFail("Expected .ok for output '\(output)', got \(c)")
            }

            let g = try await handler.get(input: StepRunGetInput(runId: runId), storage: storage)
            if case .ok(_, _, _, let status) = g {
                XCTAssertEqual(status, "completed")
            } else {
                XCTFail("Expected .ok, got \(g)")
            }
        }
    }

}
