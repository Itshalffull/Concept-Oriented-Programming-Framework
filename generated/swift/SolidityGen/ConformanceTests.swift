// generated: SolidityGen/ConformanceTests.swift

import XCTest
@testable import Clef

final class SolidityGenConformanceTests: XCTestCase {

    func testSolidityGenInvariant1() async throws {
        // invariant 1: after generate, generate behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let f = "u-test-invariant-001"
        let e = "u-test-invariant-002"

        // --- AFTER clause ---
        // generate(spec: "s1", manifest: ["name": "Ping", "uri": "urn:clef/Ping", "typeParams": [], "relations": [], "actions": [["name": "ping", "params": [], "variants": [["tag": "ok", "fields": [], "prose": "Pong."]]]], "invariants": [], "graphqlSchema": "", "jsonSchemas": ["invocations": [], "completions": []], "capabilities": [], "purpose": "A test."]) -> ok(files: f)
        let step1 = try await handler.generate(
            input: SolidityGenGenerateInput(spec: "s1", manifest: ["name": "Ping", "uri": "urn:clef/Ping", "typeParams": [], "relations": [], "actions": [["name": "ping", "params": [], "variants": [["tag": "ok", "fields": [], "prose": "Pong."]]]], "invariants": [], "graphqlSchema": "", "jsonSchemas": ["invocations": [], "completions": []], "capabilities": [], "purpose": "A test."]),
            storage: storage
        )
        if case .ok(let files) = step1 {
            XCTAssertEqual(files, f)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // generate(spec: "s2", manifest: ["name": ""]) -> error(message: e)
        let step2 = try await handler.generate(
            input: SolidityGenGenerateInput(spec: "s2", manifest: ["name": ""]),
            storage: storage
        )
        if case .error(let message) = step2 {
            XCTAssertEqual(message, e)
        } else {
            XCTFail("Expected .error, got \(step2)")
        }
    }

}
