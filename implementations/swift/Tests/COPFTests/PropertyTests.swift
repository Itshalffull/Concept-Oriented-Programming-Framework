// PropertyTests.swift — Tests for Property concept

import XCTest
@testable import COPF

final class PropertyTests: XCTestCase {

    // MARK: - set

    func testSetReturnsOkWithNodeIdAndKey() async throws {
        let storage = InMemoryStorage()
        let handler = PropertyHandlerImpl()

        let result = try await handler.set(
            input: PropertySetInput(nodeId: "n1", key: "color", value: "red"),
            storage: storage
        )

        if case .ok(let nodeId, let key) = result {
            XCTAssertEqual(nodeId, "n1")
            XCTAssertEqual(key, "color")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSetStoresPropertyInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = PropertyHandlerImpl()

        _ = try await handler.set(
            input: PropertySetInput(nodeId: "n1", key: "size", value: "large"),
            storage: storage
        )

        let record = try await storage.get(relation: "property", key: "n1::size")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["value"] as? String, "large")
    }

    func testSetOverwritesExistingProperty() async throws {
        let storage = InMemoryStorage()
        let handler = PropertyHandlerImpl()

        _ = try await handler.set(
            input: PropertySetInput(nodeId: "n1", key: "color", value: "red"),
            storage: storage
        )
        _ = try await handler.set(
            input: PropertySetInput(nodeId: "n1", key: "color", value: "blue"),
            storage: storage
        )

        let record = try await storage.get(relation: "property", key: "n1::color")
        XCTAssertEqual(record?["value"] as? String, "blue")
    }

    // MARK: - get

    func testGetReturnsSetProperty() async throws {
        let storage = InMemoryStorage()
        let handler = PropertyHandlerImpl()

        _ = try await handler.set(
            input: PropertySetInput(nodeId: "n1", key: "status", value: "active"),
            storage: storage
        )

        let result = try await handler.get(
            input: PropertyGetInput(nodeId: "n1", key: "status"),
            storage: storage
        )

        if case .ok(let nodeId, let key, let value) = result {
            XCTAssertEqual(nodeId, "n1")
            XCTAssertEqual(key, "status")
            XCTAssertEqual(value, "active")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetMissingPropertyReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = PropertyHandlerImpl()

        let result = try await handler.get(
            input: PropertyGetInput(nodeId: "n1", key: "nonexistent"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - delete

    func testDeleteRemovesProperty() async throws {
        let storage = InMemoryStorage()
        let handler = PropertyHandlerImpl()

        _ = try await handler.set(
            input: PropertySetInput(nodeId: "n1", key: "temp", value: "val"),
            storage: storage
        )

        let result = try await handler.delete(
            input: PropertyDeleteInput(nodeId: "n1", key: "temp"),
            storage: storage
        )

        if case .ok(let nodeId, let key) = result {
            XCTAssertEqual(nodeId, "n1")
            XCTAssertEqual(key, "temp")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "property", key: "n1::temp")
        XCTAssertNil(record)
    }

    func testDeleteMissingPropertyReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = PropertyHandlerImpl()

        let result = try await handler.delete(
            input: PropertyDeleteInput(nodeId: "n1", key: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - defineType

    func testDefineTypeReturnsOkWithKey() async throws {
        let storage = InMemoryStorage()
        let handler = PropertyHandlerImpl()

        let result = try await handler.defineType(
            input: PropertyDefineTypeInput(key: "priority", propType: "number", constraints: "1-5"),
            storage: storage
        )

        if case .ok(let key) = result {
            XCTAssertEqual(key, "priority")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDefineTypeStoresDefinition() async throws {
        let storage = InMemoryStorage()
        let handler = PropertyHandlerImpl()

        _ = try await handler.defineType(
            input: PropertyDefineTypeInput(key: "status", propType: "enum", constraints: "active,inactive"),
            storage: storage
        )

        let record = try await storage.get(relation: "property_type", key: "status")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["propType"] as? String, "enum")
    }

    // MARK: - listAll

    func testListAllReturnsPropertiesForNode() async throws {
        let storage = InMemoryStorage()
        let handler = PropertyHandlerImpl()

        _ = try await handler.set(
            input: PropertySetInput(nodeId: "n1", key: "a", value: "1"),
            storage: storage
        )
        _ = try await handler.set(
            input: PropertySetInput(nodeId: "n1", key: "b", value: "2"),
            storage: storage
        )

        let result = try await handler.listAll(
            input: PropertyListAllInput(nodeId: "n1"),
            storage: storage
        )

        if case .ok(let nodeId, let properties) = result {
            XCTAssertEqual(nodeId, "n1")
            XCTAssertFalse(properties.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testListAllEmptyReturnsEmptyList() async throws {
        let storage = InMemoryStorage()
        let handler = PropertyHandlerImpl()

        let result = try await handler.listAll(
            input: PropertyListAllInput(nodeId: "empty"),
            storage: storage
        )

        if case .ok(let nodeId, _) = result {
            XCTAssertEqual(nodeId, "empty")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
