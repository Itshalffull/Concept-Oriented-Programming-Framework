// generated: SyncParser/ConformanceTests.swift

import XCTest
@testable import COPF

final class SyncParserConformanceTests: XCTestCase {

    func testSyncParserInvariant1() async throws {
        // invariant 1: after parse, parse behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let s = "u-test-invariant-001"
        let a = "u-test-invariant-002"
        let e = "u-test-invariant-003"

        // --- AFTER clause ---
        // parse(source: "sync T [eager]
when {
  A/act: [ x: ?v ] => []
}
then {
  B/do: [ x: ?v ]
}", manifests: []) -> ok(sync: s, ast: a)
        let step1 = try await handler.parse(
            input: SyncParserParseInput(source: "sync T [eager]
when {
  A/act: [ x: ?v ] => []
}
then {
  B/do: [ x: ?v ]
}", manifests: []),
            storage: storage
        )
        if case .ok(let sync, let ast) = step1 {
            XCTAssertEqual(sync, s)
            XCTAssertEqual(ast, a)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // parse(source: "invalid", manifests: []) -> error(message: e, line: 0)
        let step2 = try await handler.parse(
            input: SyncParserParseInput(source: "invalid", manifests: []),
            storage: storage
        )
        if case .error(let message, let line) = step2 {
            XCTAssertEqual(message, e)
            XCTAssertEqual(line, 0)
        } else {
            XCTFail("Expected .error, got \(step2)")
        }
    }

}
