// generated: ProcessRun/ConformanceTests.swift

import XCTest
@testable import Clef

final class ProcessRunConformanceTests: XCTestCase {

    func testProcessRunStartAndGetStatus() async throws {
        // invariant: after start, getStatus returns status "running"
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        // --- AFTER clause ---
        let step1 = try await handler.start(
            input: ProcessRunStartInput(specId: "spec-1", initiator: "user-1"),
            storage: storage
        )
        guard case .ok(let processId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        let step2 = try await handler.getStatus(
            input: ProcessRunGetStatusInput(processId: processId),
            storage: storage
        )
        if case .ok(_, let status, _) = step2 {
            XCTAssertEqual(status, "running")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testProcessRunSuspendAndResume() async throws {
        // invariant: after suspend, getStatus returns "suspended"; after resume, returns "running"
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.start(
            input: ProcessRunStartInput(specId: "spec-2", initiator: "user-2"),
            storage: storage
        )
        guard case .ok(let processId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- suspend ---
        let step2 = try await handler.suspend(
            input: ProcessRunSuspendInput(processId: processId, reason: "awaiting input"),
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
            XCTAssertEqual(status, "suspended")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }

        // --- resume ---
        let step4 = try await handler.resume(
            input: ProcessRunResumeInput(processId: processId),
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
            XCTAssertEqual(status, "running")
        } else {
            XCTFail("Expected .ok, got \(step5)")
        }
    }

    func testProcessRunCompleteAndGetStatus() async throws {
        // invariant: after complete, getStatus returns status "completed"
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.start(
            input: ProcessRunStartInput(specId: "spec-3", initiator: "user-3"),
            storage: storage
        )
        guard case .ok(let processId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.complete(
            input: ProcessRunCompleteInput(processId: processId, result: "success"),
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
            XCTAssertEqual(status, "completed")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
