// generated: Alias/ConformanceTests.swift

import XCTest
@testable import Clef

final class AliasConformanceTests: XCTestCase {

    func testAliasInvariant1() async throws {
        // invariant 1: after addAlias, resolve behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let x = "u-test-invariant-001"

        // --- AFTER clause ---
        // addAlias(entity: x, name: "homepage") -> ok(entity: x, name: "homepage")
        let step1 = try await handler.addAlias(
            input: AliasAddAliasInput(entity: x, name: "homepage"),
            storage: storage
        )
        if case .ok(let entity, let name) = step1 {
            XCTAssertEqual(entity, x)
            XCTAssertEqual(name, "homepage")
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // resolve(name: "homepage") -> ok(entity: x)
        let step2 = try await handler.resolve(
            input: AliasResolveInput(name: "homepage"),
            storage: storage
        )
        if case .ok(let entity) = step2 {
            XCTAssertEqual(entity, x)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
