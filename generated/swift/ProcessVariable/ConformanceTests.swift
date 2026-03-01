// generated: ProcessVariable/ConformanceTests.swift

import XCTest
@testable import Clef

final class ProcessVariableConformanceTests: XCTestCase {

    func testProcessVariableSetAndGet() async throws {
        // invariant: after set, get returns the stored value
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let processId = "u-test-invariant-001"

        // --- AFTER clause ---
        // set(processId: processId, key: "status", value: "active") -> ok
        let step1 = try await handler.set(
            input: ProcessVariableSetInput(processId: processId, key: "status", value: "active"),
            storage: storage
        )
        if case .ok = step1 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // get(processId: processId, key: "status") -> ok(value: "active")
        let step2 = try await handler.get(
            input: ProcessVariableGetInput(processId: processId, key: "status"),
            storage: storage
        )
        if case .ok(let value) = step2 {
            XCTAssertEqual(value, "active")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testProcessVariableDeleteAndGetNotFound() async throws {
        // invariant: after delete, get returns notFound
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let processId = "u-test-invariant-002"

        // --- AFTER clause ---
        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: processId, key: "temp", value: "val"),
            storage: storage
        )
        let step2 = try await handler.delete(
            input: ProcessVariableDeleteInput(processId: processId, key: "temp"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        let step3 = try await handler.get(
            input: ProcessVariableGetInput(processId: processId, key: "temp"),
            storage: storage
        )
        if case .notFound = step3 {
            // success
        } else {
            XCTFail("Expected .notFound, got \(step3)")
        }
    }

    func testProcessVariableListAndSnapshot() async throws {
        // invariant: after set, list includes the key and snapshot includes the variable
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let processId = "u-test-invariant-003"

        // --- AFTER clause ---
        let _ = try await handler.set(
            input: ProcessVariableSetInput(processId: processId, key: "count", value: "42"),
            storage: storage
        )

        // --- THEN clause ---
        let step2 = try await handler.list(
            input: ProcessVariableListInput(processId: processId),
            storage: storage
        )
        if case .ok(let keys) = step2 {
            XCTAssertTrue(keys.contains("count"))
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        let step3 = try await handler.snapshot(
            input: ProcessVariableSnapshotInput(processId: processId),
            storage: storage
        )
        if case .ok(let snapshot) = step3 {
            XCTAssertFalse(snapshot.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
