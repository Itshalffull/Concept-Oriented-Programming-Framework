// generated: Property/ConformanceTests.swift

import XCTest
@testable import Clef

final class PropertyConformanceTests: XCTestCase {

    func testPropertyInvariant1() async throws {
        // invariant 1: after set, get behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let e = "u-test-invariant-001"

        // --- AFTER clause ---
        // set(entity: e, key: "title", value: "Hello World") -> ok(entity: e)
        let step1 = try await handler.set(
            input: PropertySetInput(entity: e, key: "title", value: "Hello World"),
            storage: storage
        )
        if case .ok(let entity) = step1 {
            XCTAssertEqual(entity, e)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // get(entity: e, key: "title") -> ok(value: "Hello World")
        let step2 = try await handler.get(
            input: PropertyGetInput(entity: e, key: "title"),
            storage: storage
        )
        if case .ok(let value) = step2 {
            XCTAssertEqual(value, "Hello World")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testPropertyInvariant2() async throws {
        // invariant 2: after set, delete, get behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let e = "u-test-invariant-001"

        // --- AFTER clause ---
        // set(entity: e, key: "title", value: "Hello") -> ok(entity: e)
        let step1 = try await handler.set(
            input: PropertySetInput(entity: e, key: "title", value: "Hello"),
            storage: storage
        )
        if case .ok(let entity) = step1 {
            XCTAssertEqual(entity, e)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
        // delete(entity: e, key: "title") -> ok(entity: e)
        let step2 = try await handler.delete(
            input: PropertyDeleteInput(entity: e, key: "title"),
            storage: storage
        )
        if case .ok(let entity) = step2 {
            XCTAssertEqual(entity, e)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        // get(entity: e, key: "title") -> notfound(message: "not found")
        let step3 = try await handler.get(
            input: PropertyGetInput(entity: e, key: "title"),
            storage: storage
        )
        if case .notfound(let message) = step3 {
            XCTAssertEqual(message, "not found")
        } else {
            XCTFail("Expected .notfound, got \(step3)")
        }
    }

}
