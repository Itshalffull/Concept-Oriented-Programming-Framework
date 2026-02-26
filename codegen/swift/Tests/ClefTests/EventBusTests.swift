// EventBusTests.swift — Tests for EventBus concept

import XCTest
@testable import Clef

final class EventBusTests: XCTestCase {

    // MARK: - registerEventType

    func testRegisterEventType() async throws {
        let storage = InMemoryStorage()
        let handler = EventBusHandlerImpl()

        let result = try await handler.registerEventType(
            input: EventBusRegisterEventTypeInput(eventTypeId: "node.created", payloadSchema: "{\"nodeId\": \"string\"}"),
            storage: storage
        )

        if case .ok(let eventTypeId) = result {
            XCTAssertEqual(eventTypeId, "node.created")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRegisterEventTypeStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = EventBusHandlerImpl()

        _ = try await handler.registerEventType(
            input: EventBusRegisterEventTypeInput(eventTypeId: "user.login", payloadSchema: "{}"),
            storage: storage
        )

        let record = try await storage.get(relation: "event_type", key: "user.login")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["eventTypeId"] as? String, "user.login")
    }

    // MARK: - subscribe

    func testSubscribe() async throws {
        let storage = InMemoryStorage()
        let handler = EventBusHandlerImpl()

        let result = try await handler.subscribe(
            input: EventBusSubscribeInput(eventTypeId: "node.created", listenerId: "logger", priority: 10),
            storage: storage
        )

        if case .ok(let eventTypeId, let listenerId) = result {
            XCTAssertEqual(eventTypeId, "node.created")
            XCTAssertEqual(listenerId, "logger")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSubscribeMultipleListeners() async throws {
        let storage = InMemoryStorage()
        let handler = EventBusHandlerImpl()

        _ = try await handler.subscribe(
            input: EventBusSubscribeInput(eventTypeId: "e1", listenerId: "l1", priority: 1),
            storage: storage
        )
        _ = try await handler.subscribe(
            input: EventBusSubscribeInput(eventTypeId: "e1", listenerId: "l2", priority: 2),
            storage: storage
        )

        let listeners = try await storage.find(relation: "listener", criteria: ["eventTypeId": "e1"])
        XCTAssertEqual(listeners.count, 2)
    }

    // MARK: - unsubscribe

    func testUnsubscribe() async throws {
        let storage = InMemoryStorage()
        let handler = EventBusHandlerImpl()

        _ = try await handler.subscribe(
            input: EventBusSubscribeInput(eventTypeId: "e1", listenerId: "l1", priority: 1),
            storage: storage
        )

        let result = try await handler.unsubscribe(
            input: EventBusUnsubscribeInput(eventTypeId: "e1", listenerId: "l1"),
            storage: storage
        )

        if case .ok(let eventTypeId, let listenerId) = result {
            XCTAssertEqual(eventTypeId, "e1")
            XCTAssertEqual(listenerId, "l1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testUnsubscribeNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = EventBusHandlerImpl()

        let result = try await handler.unsubscribe(
            input: EventBusUnsubscribeInput(eventTypeId: "e1", listenerId: "missing"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("missing"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - dispatch

    func testDispatchWithListeners() async throws {
        let storage = InMemoryStorage()
        let handler = EventBusHandlerImpl()

        _ = try await handler.subscribe(
            input: EventBusSubscribeInput(eventTypeId: "e1", listenerId: "l1", priority: 1),
            storage: storage
        )
        _ = try await handler.subscribe(
            input: EventBusSubscribeInput(eventTypeId: "e1", listenerId: "l2", priority: 2),
            storage: storage
        )

        let result = try await handler.dispatch(
            input: EventBusDispatchInput(eventTypeId: "e1", payload: "{\"data\":\"test\"}"),
            storage: storage
        )

        if case .ok(let eventTypeId, let listenerCount) = result {
            XCTAssertEqual(eventTypeId, "e1")
            XCTAssertEqual(listenerCount, 2)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDispatchNoListeners() async throws {
        let storage = InMemoryStorage()
        let handler = EventBusHandlerImpl()

        let result = try await handler.dispatch(
            input: EventBusDispatchInput(eventTypeId: "e1", payload: "{}"),
            storage: storage
        )

        if case .ok(_, let listenerCount) = result {
            XCTAssertEqual(listenerCount, 0)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - getHistory

    func testGetHistory() async throws {
        let storage = InMemoryStorage()
        let handler = EventBusHandlerImpl()

        _ = try await handler.dispatch(
            input: EventBusDispatchInput(eventTypeId: "e1", payload: "{\"x\":1}"),
            storage: storage
        )

        let result = try await handler.getHistory(
            input: EventBusGetHistoryInput(eventTypeId: "e1", since: "2000-01-01"),
            storage: storage
        )

        if case .ok(let events) = result {
            XCTAssertTrue(events.contains("e1"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetHistoryEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = EventBusHandlerImpl()

        let result = try await handler.getHistory(
            input: EventBusGetHistoryInput(eventTypeId: "no-events", since: "2000-01-01"),
            storage: storage
        )

        if case .ok(let events) = result {
            XCTAssertEqual(events, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
