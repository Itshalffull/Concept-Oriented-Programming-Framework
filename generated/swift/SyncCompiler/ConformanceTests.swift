// generated: SyncCompiler/ConformanceTests.swift

import XCTest
@testable import Clef

final class SyncCompilerConformanceTests: XCTestCase {

    func testSyncCompilerInvariant1() async throws {
        // invariant 1: after compile, compile behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let c = "u-test-invariant-001"
        let e = "u-test-invariant-002"

        // --- AFTER clause ---
        // compile(sync: "s1", ast: ["name": "TestSync", "annotations": [], "when": [["concept": "urn:clef/A", "action": "act", "inputFields": [], "outputFields": []]], "where": [], "then": [["concept": "urn:clef/B", "action": "do", "fields": []]]]) -> ok(compiled: c)
        let step1 = try await handler.compile(
            input: SyncCompilerCompileInput(sync: "s1", ast: ["name": "TestSync", "annotations": [], "when": [["concept": "urn:clef/A", "action": "act", "inputFields": [], "outputFields": []]], "where": [], "then": [["concept": "urn:clef/B", "action": "do", "fields": []]]]),
            storage: storage
        )
        if case .ok(let compiled) = step1 {
            XCTAssertEqual(compiled, c)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // compile(sync: "s2", ast: ["name": "Bad", "annotations": [], "when": [["concept": "urn:clef/A", "action": "act", "inputFields": [], "outputFields": []]], "where": [], "then": []]) -> error(message: e)
        let step2 = try await handler.compile(
            input: SyncCompilerCompileInput(sync: "s2", ast: ["name": "Bad", "annotations": [], "when": [["concept": "urn:clef/A", "action": "act", "inputFields": [], "outputFields": []]], "where": [], "then": []]),
            storage: storage
        )
        if case .error(let message) = step2 {
            XCTAssertEqual(message, e)
        } else {
            XCTFail("Expected .error, got \(step2)")
        }
    }

}
