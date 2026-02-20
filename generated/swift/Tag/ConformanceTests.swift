// generated: Tag/ConformanceTests.swift

import XCTest
@testable import COPF

final class TagConformanceTests: XCTestCase {

    func testTagInvariant1() async throws {
        // invariant 1: after add, add behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let t = "u-test-invariant-001"

        // --- AFTER clause ---
        // add(tag: t, article: "a1") -> ok(tag: t)
        let step1 = try await handler.add(
            input: TagAddInput(tag: t, article: "a1"),
            storage: storage
        )
        if case .ok(let tag) = step1 {
            XCTAssertEqual(tag, t)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // add(tag: t, article: "a2") -> ok(tag: t)
        let step2 = try await handler.add(
            input: TagAddInput(tag: t, article: "a2"),
            storage: storage
        )
        if case .ok(let tag) = step2 {
            XCTAssertEqual(tag, t)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
