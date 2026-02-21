// TypeSystemTests.swift — Tests for TypeSystem concept

import XCTest
@testable import COPF

final class TypeSystemTests: XCTestCase {

    // MARK: - registerType

    func testRegisterTypeReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = TypeSystemHandlerImpl()

        let result = try await handler.registerType(
            input: TypeSystemRegisterTypeInput(typeId: "text", definition: "{\"kind\":\"string\"}"),
            storage: storage
        )

        if case .ok(let typeId) = result {
            XCTAssertEqual(typeId, "text")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRegisterTypeDuplicateReturnsAlreadyExists() async throws {
        let storage = InMemoryStorage()
        let handler = TypeSystemHandlerImpl()

        _ = try await handler.registerType(
            input: TypeSystemRegisterTypeInput(typeId: "text", definition: "{\"kind\":\"string\"}"),
            storage: storage
        )

        let result = try await handler.registerType(
            input: TypeSystemRegisterTypeInput(typeId: "text", definition: "{\"kind\":\"string\"}"),
            storage: storage
        )

        if case .alreadyExists(let typeId) = result {
            XCTAssertEqual(typeId, "text")
        } else {
            XCTFail("Expected .alreadyExists but got \(result)")
        }
    }

    func testRegisterTypeStoresDefinition() async throws {
        let storage = InMemoryStorage()
        let handler = TypeSystemHandlerImpl()

        _ = try await handler.registerType(
            input: TypeSystemRegisterTypeInput(typeId: "number", definition: "{\"kind\":\"int\"}"),
            storage: storage
        )

        let record = try await storage.get(relation: "type_def", key: "number")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["definition"] as? String, "{\"kind\":\"int\"}")
    }

    // MARK: - resolve

    func testResolveReturnsRegisteredType() async throws {
        let storage = InMemoryStorage()
        let handler = TypeSystemHandlerImpl()

        _ = try await handler.registerType(
            input: TypeSystemRegisterTypeInput(typeId: "boolean", definition: "{\"kind\":\"bool\"}"),
            storage: storage
        )

        let result = try await handler.resolve(
            input: TypeSystemResolveInput(typePath: "boolean"),
            storage: storage
        )

        if case .ok(let typeId, let definition) = result {
            XCTAssertEqual(typeId, "boolean")
            XCTAssertEqual(definition, "{\"kind\":\"bool\"}")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testResolveUnknownTypeReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = TypeSystemHandlerImpl()

        let result = try await handler.resolve(
            input: TypeSystemResolveInput(typePath: "unknown"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - validate

    func testValidateReturnsOkForValidValue() async throws {
        let storage = InMemoryStorage()
        let handler = TypeSystemHandlerImpl()

        _ = try await handler.registerType(
            input: TypeSystemRegisterTypeInput(typeId: "text", definition: "{\"kind\":\"string\"}"),
            storage: storage
        )

        let result = try await handler.validate(
            input: TypeSystemValidateInput(value: "hello", typeId: "text"),
            storage: storage
        )

        if case .ok(let valid) = result {
            XCTAssertTrue(valid)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testValidateEmptyValueReturnsInvalid() async throws {
        let storage = InMemoryStorage()
        let handler = TypeSystemHandlerImpl()

        _ = try await handler.registerType(
            input: TypeSystemRegisterTypeInput(typeId: "text", definition: "{\"kind\":\"string\"}"),
            storage: storage
        )

        let result = try await handler.validate(
            input: TypeSystemValidateInput(value: "", typeId: "text"),
            storage: storage
        )

        if case .invalid(let typeId, _) = result {
            XCTAssertEqual(typeId, "text")
        } else {
            XCTFail("Expected .invalid but got \(result)")
        }
    }

    func testValidateUnregisteredTypeReturnsInvalid() async throws {
        let storage = InMemoryStorage()
        let handler = TypeSystemHandlerImpl()

        let result = try await handler.validate(
            input: TypeSystemValidateInput(value: "test", typeId: "missing"),
            storage: storage
        )

        if case .invalid(let typeId, _) = result {
            XCTAssertEqual(typeId, "missing")
        } else {
            XCTFail("Expected .invalid but got \(result)")
        }
    }
}
