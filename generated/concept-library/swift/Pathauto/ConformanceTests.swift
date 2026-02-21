// generated: Pathauto/ConformanceTests.swift

import XCTest
@testable import COPF

final class PathautoConformanceTests: XCTestCase {

    func testPathautoInvariant1() async throws {
        // invariant 1: after generateAlias, cleanString behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let p = "u-test-invariant-001"
        let a = "u-test-invariant-002"

        // --- AFTER clause ---
        // generateAlias(pattern: p, entity: "My Example Page") -> ok(alias: a)
        let step1 = try await handler.generateAlias(
            input: PathautoGenerateAliasInput(pattern: p, entity: "My Example Page"),
            storage: storage
        )
        if case .ok(let alias) = step1 {
            XCTAssertEqual(alias, a)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // cleanString(input: "My Example Page") -> ok(cleaned: a)
        let step2 = try await handler.cleanString(
            input: PathautoCleanStringInput(input: "My Example Page"),
            storage: storage
        )
        if case .ok(let cleaned) = step2 {
            XCTAssertEqual(cleaned, a)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
