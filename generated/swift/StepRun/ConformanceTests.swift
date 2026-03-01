// generated: StepRun/ConformanceTests.swift

import XCTest
@testable import Clef

final class StepRunConformanceTests: XCTestCase {

    func testStepRunStartAndGet() async throws {
        // invariant: after start, get returns status "running"
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        // --- AFTER clause ---
        let step1 = try await handler.start(
            input: StepRunStartInput(processId: "proc-1", stepId: "step-1", stepName: "Validate"),
            storage: storage
        )
        guard case .ok(let runId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        let step2 = try await handler.get(
            input: StepRunGetInput(runId: runId),
            storage: storage
        )
        if case .ok(_, _, _, let status) = step2 {
            XCTAssertEqual(status, "running")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testStepRunCompleteAndGet() async throws {
        // invariant: after complete, get returns status "completed"
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.start(
            input: StepRunStartInput(processId: "proc-2", stepId: "step-2", stepName: "Process"),
            storage: storage
        )
        guard case .ok(let runId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.complete(
            input: StepRunCompleteInput(runId: runId, output: "done"),
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
            XCTAssertEqual(status, "completed")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testStepRunFailAndGet() async throws {
        // invariant: after fail, get returns status "failed"
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.start(
            input: StepRunStartInput(processId: "proc-3", stepId: "step-3", stepName: "Transform"),
            storage: storage
        )
        guard case .ok(let runId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.fail(
            input: StepRunFailInput(runId: runId, reason: "timeout"),
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
            XCTAssertEqual(status, "failed")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
