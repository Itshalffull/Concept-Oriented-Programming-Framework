// generated: SchemaGen/ConformanceTests.swift

import XCTest
@testable import Clef

final class SchemaGenConformanceTests: XCTestCase {

    func testSchemaGenInvariant1() async throws {
        // invariant 1: after generate, generate behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let m = "u-test-invariant-001"
        let e = "u-test-invariant-002"

        // --- AFTER clause ---
        // generate(spec: "s1", ast: ["name": "Ping", "typeParams": ["T"], "purpose": "A test.", "state": [], "actions": [["name": "ping", "params": [], "variants": [["name": "ok", "params": [], "description": "Pong."]]]], "invariants": [], "capabilities": []]) -> ok(manifest: m)
        let step1 = try await handler.generate(
            input: SchemaGenGenerateInput(spec: "s1", ast: ["name": "Ping", "typeParams": ["T"], "purpose": "A test.", "state": [], "actions": [["name": "ping", "params": [], "variants": [["name": "ok", "params": [], "description": "Pong."]]]], "invariants": [], "capabilities": []]),
            storage: storage
        )
        if case .ok(let manifest) = step1 {
            XCTAssertEqual(manifest, m)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // generate(spec: "s2", ast: ["name": ""]) -> error(message: e)
        let step2 = try await handler.generate(
            input: SchemaGenGenerateInput(spec: "s2", ast: ["name": ""]),
            storage: storage
        )
        if case .error(let message) = step2 {
            XCTAssertEqual(message, e)
        } else {
            XCTFail("Expected .error, got \(step2)")
        }
    }

}
