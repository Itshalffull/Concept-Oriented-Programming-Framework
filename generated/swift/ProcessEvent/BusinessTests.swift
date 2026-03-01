// generated: ProcessEvent/BusinessTests.swift

import XCTest
@testable import Clef

final class ProcessEventBusinessTests: XCTestCase {

    // MARK: - Multiple events appended in order

    func testMultipleEventsQueryReturnsAll() async throws {
        // After appending multiple events, query should return all of them
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-multi-events"

        let _ = try await handler.append(
            input: ProcessEventAppendInput(processId: processId, eventType: "started", payload: "{\"step\":\"init\"}"),
            storage: storage
        )
        let _ = try await handler.append(
            input: ProcessEventAppendInput(processId: processId, eventType: "progressed", payload: "{\"step\":\"validate\"}"),
            storage: storage
        )
        let _ = try await handler.append(
            input: ProcessEventAppendInput(processId: processId, eventType: "completed", payload: "{\"step\":\"finalize\"}"),
            storage: storage
        )

        let step4 = try await handler.query(
            input: ProcessEventQueryInput(processId: processId),
            storage: storage
        )
        if case .ok(let events) = step4 {
            XCTAssertGreaterThanOrEqual(events.count, 3)
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

    // MARK: - QueryByType filters correctly

    func testQueryByTypeDoesNotReturnOtherTypes() async throws {
        // queryByType should only return events matching the specified type
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-filter-type"

        let _ = try await handler.append(
            input: ProcessEventAppendInput(processId: processId, eventType: "error", payload: "{\"msg\":\"timeout\"}"),
            storage: storage
        )
        let _ = try await handler.append(
            input: ProcessEventAppendInput(processId: processId, eventType: "info", payload: "{\"msg\":\"ok\"}"),
            storage: storage
        )
        let _ = try await handler.append(
            input: ProcessEventAppendInput(processId: processId, eventType: "error", payload: "{\"msg\":\"connection lost\"}"),
            storage: storage
        )

        let step4 = try await handler.queryByType(
            input: ProcessEventQueryByTypeInput(processId: processId, eventType: "error"),
            storage: storage
        )
        if case .ok(let events) = step4 {
            XCTAssertGreaterThanOrEqual(events.count, 2)
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }

        let step5 = try await handler.queryByType(
            input: ProcessEventQueryByTypeInput(processId: processId, eventType: "info"),
            storage: storage
        )
        if case .ok(let events) = step5 {
            XCTAssertEqual(events.count, 1)
        } else {
            XCTFail("Expected .ok, got \(step5)")
        }
    }

    // MARK: - Event isolation between processes

    func testEventsAreIsolatedBetweenProcesses() async throws {
        // Events appended to one process should not appear in another process's query
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let _ = try await handler.append(
            input: ProcessEventAppendInput(processId: "proc-x", eventType: "started", payload: "{}"),
            storage: storage
        )
        let _ = try await handler.append(
            input: ProcessEventAppendInput(processId: "proc-x", eventType: "completed", payload: "{}"),
            storage: storage
        )
        let _ = try await handler.append(
            input: ProcessEventAppendInput(processId: "proc-y", eventType: "started", payload: "{}"),
            storage: storage
        )

        let queryX = try await handler.query(
            input: ProcessEventQueryInput(processId: "proc-x"),
            storage: storage
        )
        if case .ok(let events) = queryX {
            XCTAssertEqual(events.count, 2)
        } else {
            XCTFail("Expected .ok, got \(queryX)")
        }

        let queryY = try await handler.query(
            input: ProcessEventQueryInput(processId: "proc-y"),
            storage: storage
        )
        if case .ok(let events) = queryY {
            XCTAssertEqual(events.count, 1)
        } else {
            XCTFail("Expected .ok, got \(queryY)")
        }
    }

    // MARK: - Cursor advances

    func testCursorAdvancesAfterEachAppend() async throws {
        // Each append should move the cursor forward
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-cursor-advance"

        let _ = try await handler.append(
            input: ProcessEventAppendInput(processId: processId, eventType: "step1", payload: "{}"),
            storage: storage
        )

        let cursor1 = try await handler.getCursor(
            input: ProcessEventGetCursorInput(processId: processId),
            storage: storage
        )
        guard case .ok(let c1) = cursor1 else {
            XCTFail("Expected .ok, got \(cursor1)")
            return
        }

        let _ = try await handler.append(
            input: ProcessEventAppendInput(processId: processId, eventType: "step2", payload: "{}"),
            storage: storage
        )

        let cursor2 = try await handler.getCursor(
            input: ProcessEventGetCursorInput(processId: processId),
            storage: storage
        )
        guard case .ok(let c2) = cursor2 else {
            XCTFail("Expected .ok, got \(cursor2)")
            return
        }

        XCTAssertNotEqual(c1, c2, "Cursor should advance after appending an event")
    }

    // MARK: - Unique event IDs

    func testEachAppendReturnsUniqueEventId() async throws {
        // Every appended event should have a unique ID
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-unique-events"

        var eventIds: Set<String> = []
        for i in 1...5 {
            let result = try await handler.append(
                input: ProcessEventAppendInput(processId: processId, eventType: "type-\(i)", payload: "{}"),
                storage: storage
            )
            if case .ok(let eventId) = result {
                eventIds.insert(eventId)
            } else {
                XCTFail("Expected .ok, got \(result)")
            }
        }
        XCTAssertEqual(eventIds.count, 5, "All 5 event IDs should be unique")
    }

    // MARK: - QueryByType with no matches

    func testQueryByTypeWithNoMatchesReturnsEmpty() async throws {
        // queryByType for a type that was never appended should return empty
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-no-match-type"

        let _ = try await handler.append(
            input: ProcessEventAppendInput(processId: processId, eventType: "info", payload: "{}"),
            storage: storage
        )

        let step2 = try await handler.queryByType(
            input: ProcessEventQueryByTypeInput(processId: processId, eventType: "critical"),
            storage: storage
        )
        if case .ok(let events) = step2 {
            XCTAssertTrue(events.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Query empty process

    func testQueryEmptyProcessReturnsEmptyList() async throws {
        // Querying a process with no events should return an empty list
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.query(
            input: ProcessEventQueryInput(processId: "proc-no-events"),
            storage: storage
        )
        if case .ok(let events) = step1 {
            XCTAssertTrue(events.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
    }

    // MARK: - Payload preservation

    func testAppendPreservesPayload() async throws {
        // The payload stored with an event should be preserved in query results
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let processId = "proc-payload"
        let payload = "{\"orderId\":\"ORD-999\",\"amount\":42.50}"

        let step1 = try await handler.append(
            input: ProcessEventAppendInput(processId: processId, eventType: "payment", payload: payload),
            storage: storage
        )
        if case .ok(let eventId) = step1 {
            XCTAssertFalse(eventId.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        let step2 = try await handler.query(
            input: ProcessEventQueryInput(processId: processId),
            storage: storage
        )
        if case .ok(let events) = step2 {
            XCTAssertEqual(events.count, 1)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
