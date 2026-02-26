// generated: Tag/ConformanceTests.swift

import XCTest
@testable import Clef

final class TagConformanceTests: XCTestCase {

    func testTagInvariant1() async throws {
        // invariant 1: after addTag, getByTag behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let t = "u-test-invariant-001"

        // --- AFTER clause ---
        // addTag(entity: "page-1", tag: t) -> ok()
        let step1 = try await handler.addTag(
            input: TagAddTagInput(entity: "page-1", tag: t),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // getByTag(tag: t) -> ok(entities: "page-1")
        let step2 = try await handler.getByTag(
            input: TagGetByTagInput(tag: t),
            storage: storage
        )
        if case .ok(let entities) = step2 {
            XCTAssertEqual(entities, "page-1")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
