// generated: ProcessEvent/ConformanceTests.swift

import XCTest
@testable import Clef

final class ProcessEventConformanceTests: XCTestCase {

    func testProcessEventAppendAndQuery() async throws {
        // invariant: after append, query returns the appended event
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let processId = "u-test-invariant-001"

        // --- AFTER clause ---
        // append(processId: processId, eventType: "started", payload: "{}") -> ok(eventId: _)
        let step1 = try await handler.append(
            input: ProcessEventAppendInput(processId: processId, eventType: "started", payload: "{}"),
            storage: storage
        )
        if case .ok(let eventId) = step1 {
            XCTAssertFalse(eventId.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // query(processId: processId) -> ok(events: _)
        let step2 = try await handler.query(
            input: ProcessEventQueryInput(processId: processId),
            storage: storage
        )
        if case .ok(let events) = step2 {
            XCTAssertFalse(events.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testProcessEventQueryByType() async throws {
        // invariant: queryByType filters events by eventType
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let processId = "u-test-invariant-002"

        // --- AFTER clause ---
        // append two events of different types
        let _ = try await handler.append(
            input: ProcessEventAppendInput(processId: processId, eventType: "started", payload: "{}"),
            storage: storage
        )
        let _ = try await handler.append(
            input: ProcessEventAppendInput(processId: processId, eventType: "completed", payload: "{}"),
            storage: storage
        )

        // --- THEN clause ---
        // queryByType(processId: processId, eventType: "started") -> ok(events: _)
        let step3 = try await handler.queryByType(
            input: ProcessEventQueryByTypeInput(processId: processId, eventType: "started"),
            storage: storage
        )
        if case .ok(let events) = step3 {
            XCTAssertFalse(events.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testProcessEventGetCursor() async throws {
        // invariant: getCursor returns current position in the event stream
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let processId = "u-test-invariant-003"

        // --- AFTER clause ---
        let _ = try await handler.append(
            input: ProcessEventAppendInput(processId: processId, eventType: "started", payload: "{}"),
            storage: storage
        )

        // --- THEN clause ---
        // getCursor(processId: processId) -> ok(cursor: _)
        let step2 = try await handler.getCursor(
            input: ProcessEventGetCursorInput(processId: processId),
            storage: storage
        )
        if case .ok(let cursor) = step2 {
            XCTAssertFalse(cursor.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
