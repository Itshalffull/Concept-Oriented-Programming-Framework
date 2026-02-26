// generated: SpecParser/ConformanceTests.swift

import XCTest
@testable import Clef

final class SpecParserConformanceTests: XCTestCase {

    func testSpecParserInvariant1() async throws {
        // invariant 1: after parse, parse behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let s = "u-test-invariant-001"
        let a = "u-test-invariant-002"
        let m = "u-test-invariant-003"

        // --- AFTER clause ---
        // parse(source: "concept Tiny [X] { purpose { A test. } state { items: set X } actions { action get(x: X) { -> ok(item: X) { Return. } } } }") -> ok(spec: s, ast: a)
        let step1 = try await handler.parse(
            input: SpecParserParseInput(source: "concept Tiny [X] { purpose { A test. } state { items: set X } actions { action get(x: X) { -> ok(item: X) { Return. } } } }"),
            storage: storage
        )
        if case .ok(let spec, let ast) = step1 {
            XCTAssertEqual(spec, s)
            XCTAssertEqual(ast, a)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // parse(source: "") -> error(message: m, line: 0)
        let step2 = try await handler.parse(
            input: SpecParserParseInput(source: ""),
            storage: storage
        )
        if case .error(let message, let line) = step2 {
            XCTAssertEqual(message, m)
            XCTAssertEqual(line, 0)
        } else {
            XCTFail("Expected .error, got \(step2)")
        }
    }

}
