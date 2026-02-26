// generated: TypeSystem/ConformanceTests.swift

import XCTest
@testable import Clef

final class TypeSystemConformanceTests: XCTestCase {

    func testTypeSystemInvariant1() async throws {
        // invariant 1: after registerType, resolve behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let t = "u-test-invariant-001"

        // --- AFTER clause ---
        // registerType(type: t, schema: "{"type":"string"}", constraints: "{}") -> ok(type: t)
        let step1 = try await handler.registerType(
            input: TypeSystemRegisterTypeInput(type: t, schema: "{"type":"string"}", constraints: "{}"),
            storage: storage
        )
        if case .ok(let type) = step1 {
            XCTAssertEqual(type, t)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // resolve(type: t) -> ok(type: t, schema: "{"type":"string"}")
        let step2 = try await handler.resolve(
            input: TypeSystemResolveInput(type: t),
            storage: storage
        )
        if case .ok(let type, let schema) = step2 {
            XCTAssertEqual(type, t)
            XCTAssertEqual(schema, "{"type":"string"}")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testTypeSystemInvariant2() async throws {
        // invariant 2: after registerType, registerType behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let t = "u-test-invariant-001"

        // --- AFTER clause ---
        // registerType(type: t, schema: "{"type":"string"}", constraints: "{}") -> ok(type: t)
        let step1 = try await handler.registerType(
            input: TypeSystemRegisterTypeInput(type: t, schema: "{"type":"string"}", constraints: "{}"),
            storage: storage
        )
        if case .ok(let type) = step1 {
            XCTAssertEqual(type, t)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // registerType(type: t, schema: "{"type":"number"}", constraints: "{}") -> exists(message: "already exists")
        let step2 = try await handler.registerType(
            input: TypeSystemRegisterTypeInput(type: t, schema: "{"type":"number"}", constraints: "{}"),
            storage: storage
        )
        if case .exists(let message) = step2 {
            XCTAssertEqual(message, "already exists")
        } else {
            XCTFail("Expected .exists, got \(step2)")
        }
    }

}
