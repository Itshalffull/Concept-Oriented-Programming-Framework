// generated: Reference/ConformanceTests.swift

import XCTest
@testable import Clef

final class ReferenceConformanceTests: XCTestCase {

    func testReferenceInvariant1() async throws {
        // invariant 1: after addRef, getRefs behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let x = "u-test-invariant-001"

        // --- AFTER clause ---
        // addRef(source: x, target: "doc-1") -> ok(source: x, target: "doc-1")
        let step1 = try await handler.addRef(
            input: ReferenceAddRefInput(source: x, target: "doc-1"),
            storage: storage
        )
        if case .ok(let source, let target) = step1 {
            XCTAssertEqual(source, x)
            XCTAssertEqual(target, "doc-1")
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // getRefs(source: x) -> ok(targets: "doc-1")
        let step2 = try await handler.getRefs(
            input: ReferenceGetRefsInput(source: x),
            storage: storage
        )
        if case .ok(let targets) = step2 {
            XCTAssertEqual(targets, "doc-1")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
