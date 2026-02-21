// generated: Query/ConformanceTests.swift

import XCTest
@testable import COPF

final class QueryConformanceTests: XCTestCase {

    func testQueryInvariant1() async throws {
        // invariant 1: after parse, execute behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let q = "u-test-invariant-001"
        let r = "u-test-invariant-002"

        // --- AFTER clause ---
        // parse(query: q, expression: "status = 'active'") -> ok(query: q)
        let step1 = try await handler.parse(
            input: QueryParseInput(query: q, expression: "status = 'active'"),
            storage: storage
        )
        if case .ok(let query) = step1 {
            XCTAssertEqual(query, q)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // execute(query: q) -> ok(results: r)
        let step2 = try await handler.execute(
            input: QueryExecuteInput(query: q),
            storage: storage
        )
        if case .ok(let results) = step2 {
            XCTAssertEqual(results, r)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
