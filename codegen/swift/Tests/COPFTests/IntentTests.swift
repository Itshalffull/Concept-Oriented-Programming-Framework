// IntentTests.swift — Tests for Intent concept

import XCTest
@testable import COPF

final class IntentTests: XCTestCase {

    // MARK: - define

    func testDefineReturnsOkWithTargetId() async throws {
        let storage = InMemoryStorage()
        let handler = IntentHandlerImpl()

        let result = try await handler.define(
            input: IntentDefineInput(
                targetId: "concept1",
                purpose: "Manage content nodes",
                principles: "CRUD operations",
                description: "A concept for managing content"
            ),
            storage: storage
        )

        if case .ok(let targetId) = result {
            XCTAssertEqual(targetId, "concept1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDefineStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = IntentHandlerImpl()

        _ = try await handler.define(
            input: IntentDefineInput(
                targetId: "concept1",
                purpose: "Testing",
                principles: "TDD",
                description: "Test concept"
            ),
            storage: storage
        )

        let record = try await storage.get(relation: "intent", key: "concept1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["purpose"] as? String, "Testing")
    }

    // MARK: - update

    func testUpdateExistingIntentReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = IntentHandlerImpl()

        _ = try await handler.define(
            input: IntentDefineInput(
                targetId: "concept1",
                purpose: "Original",
                principles: "P1",
                description: "D1"
            ),
            storage: storage
        )

        let result = try await handler.update(
            input: IntentUpdateInput(targetId: "concept1", changes: "Updated purpose"),
            storage: storage
        )

        if case .ok(let targetId) = result {
            XCTAssertEqual(targetId, "concept1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testUpdateMissingIntentReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = IntentHandlerImpl()

        let result = try await handler.update(
            input: IntentUpdateInput(targetId: "missing", changes: "changes"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - verify

    func testVerifyWithCompleteIntentPassesChecks() async throws {
        let storage = InMemoryStorage()
        let handler = IntentHandlerImpl()

        _ = try await handler.define(
            input: IntentDefineInput(
                targetId: "concept1",
                purpose: "Well-defined purpose",
                principles: "Clear principles",
                description: "Description"
            ),
            storage: storage
        )

        let result = try await handler.verify(
            input: IntentVerifyInput(targetId: "concept1"),
            storage: storage
        )

        if case .ok(let targetId, let passed, let failed) = result {
            XCTAssertEqual(targetId, "concept1")
            XCTAssertTrue(passed.contains("purpose_defined"))
            XCTAssertTrue(passed.contains("principles_defined"))
            XCTAssertEqual(failed, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testVerifyMissingIntentReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = IntentHandlerImpl()

        let result = try await handler.verify(
            input: IntentVerifyInput(targetId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - discover

    func testDiscoverFindsMatchingIntents() async throws {
        let storage = InMemoryStorage()
        let handler = IntentHandlerImpl()

        _ = try await handler.define(
            input: IntentDefineInput(
                targetId: "auth",
                purpose: "Handle authentication",
                principles: "Security first",
                description: "Authentication concept"
            ),
            storage: storage
        )

        let result = try await handler.discover(
            input: IntentDiscoverInput(query: "authentication"),
            storage: storage
        )

        if case .ok(let results) = result {
            XCTAssertTrue(results.contains("auth"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDiscoverNoMatchReturnsEmptyResults() async throws {
        let storage = InMemoryStorage()
        let handler = IntentHandlerImpl()

        let result = try await handler.discover(
            input: IntentDiscoverInput(query: "zzzzz"),
            storage: storage
        )

        if case .ok(let results) = result {
            XCTAssertEqual(results, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - document

    func testDocumentReturnsFormattedDocumentation() async throws {
        let storage = InMemoryStorage()
        let handler = IntentHandlerImpl()

        _ = try await handler.define(
            input: IntentDefineInput(
                targetId: "concept1",
                purpose: "My purpose",
                principles: "My principles",
                description: "My description"
            ),
            storage: storage
        )

        let result = try await handler.document(
            input: IntentDocumentInput(targetId: "concept1"),
            storage: storage
        )

        if case .ok(let targetId, let documentation) = result {
            XCTAssertEqual(targetId, "concept1")
            XCTAssertTrue(documentation.contains("My purpose"))
            XCTAssertTrue(documentation.contains("My principles"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDocumentMissingIntentReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = IntentHandlerImpl()

        let result = try await handler.document(
            input: IntentDocumentInput(targetId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
