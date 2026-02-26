// generated: Outline/ConformanceTests.swift

import XCTest
@testable import Clef

final class OutlineConformanceTests: XCTestCase {

    func testOutlineInvariant1() async throws {
        // invariant 1: after create, collapse, expand behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let x = "u-test-invariant-001"

        // --- AFTER clause ---
        // create(node: x) -> ok(node: x)
        let step1 = try await handler.create(
            input: OutlineCreateInput(node: x),
            storage: storage
        )
        if case .ok(let node) = step1 {
            XCTAssertEqual(node, x)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
        // collapse(node: x) -> ok(node: x)
        let step2 = try await handler.collapse(
            input: OutlineCollapseInput(node: x),
            storage: storage
        )
        if case .ok(let node) = step2 {
            XCTAssertEqual(node, x)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        // expand(node: x) -> ok(node: x)
        let step3 = try await handler.expand(
            input: OutlineExpandInput(node: x),
            storage: storage
        )
        if case .ok(let node) = step3 {
            XCTAssertEqual(node, x)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
