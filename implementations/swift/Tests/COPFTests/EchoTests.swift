// EchoTests.swift — Tests for Echo concept

import XCTest
@testable import COPF

final class EchoTests: XCTestCase {

    func testSendEcho() async throws {
        let storage = InMemoryStorage()
        let handler = EchoHandlerImpl()

        let result = try await handler.send(
            input: EchoSendInput(id: "e1", text: "Hello, World!"),
            storage: storage
        )

        if case .ok(let id, let echo) = result {
            XCTAssertEqual(id, "e1")
            XCTAssertEqual(echo, "Hello, World!")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSendEchoStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = EchoHandlerImpl()

        _ = try await handler.send(
            input: EchoSendInput(id: "e1", text: "stored text"),
            storage: storage
        )

        let record = try await storage.get(relation: "echo", key: "e1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["text"] as? String, "stored text")
        XCTAssertEqual(record?["id"] as? String, "e1")
    }

    func testSendEchoEmptyText() async throws {
        let storage = InMemoryStorage()
        let handler = EchoHandlerImpl()

        let result = try await handler.send(
            input: EchoSendInput(id: "e2", text: ""),
            storage: storage
        )

        if case .ok(let id, let echo) = result {
            XCTAssertEqual(id, "e2")
            XCTAssertEqual(echo, "")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSendMultipleEchoes() async throws {
        let storage = InMemoryStorage()
        let handler = EchoHandlerImpl()

        let result1 = try await handler.send(
            input: EchoSendInput(id: "e1", text: "first"),
            storage: storage
        )
        let result2 = try await handler.send(
            input: EchoSendInput(id: "e2", text: "second"),
            storage: storage
        )

        if case .ok(let id1, let echo1) = result1 {
            XCTAssertEqual(id1, "e1")
            XCTAssertEqual(echo1, "first")
        } else {
            XCTFail("Expected .ok for first echo")
        }

        if case .ok(let id2, let echo2) = result2 {
            XCTAssertEqual(id2, "e2")
            XCTAssertEqual(echo2, "second")
        } else {
            XCTFail("Expected .ok for second echo")
        }
    }

    func testSendEchoSpecialCharacters() async throws {
        let storage = InMemoryStorage()
        let handler = EchoHandlerImpl()

        let specialText = "Hello! @#$%^&*() \"quoted\" 'single' <html> {json: true}"
        let result = try await handler.send(
            input: EchoSendInput(id: "e3", text: specialText),
            storage: storage
        )

        if case .ok(let id, let echo) = result {
            XCTAssertEqual(id, "e3")
            XCTAssertEqual(echo, specialText)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSendEchoOverwritesSameId() async throws {
        let storage = InMemoryStorage()
        let handler = EchoHandlerImpl()

        _ = try await handler.send(
            input: EchoSendInput(id: "e1", text: "original"),
            storage: storage
        )

        let result = try await handler.send(
            input: EchoSendInput(id: "e1", text: "updated"),
            storage: storage
        )

        if case .ok(let id, let echo) = result {
            XCTAssertEqual(id, "e1")
            XCTAssertEqual(echo, "updated")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        // Verify storage has the latest value
        let record = try await storage.get(relation: "echo", key: "e1")
        XCTAssertEqual(record?["text"] as? String, "updated")
    }
}
