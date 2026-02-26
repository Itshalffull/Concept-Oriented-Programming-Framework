// generated: Namespace/ConformanceTests.swift

import XCTest
@testable import COPF

final class NamespaceConformanceTests: XCTestCase {

    func testNamespaceInvariant1() async throws {
        // invariant 1: after createNamespacedPage, getChildren behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let n = "u-test-invariant-001"

        // --- AFTER clause ---
        // createNamespacedPage(node: n, path: "projects/alpha") -> ok()
        let step1 = try await handler.createNamespacedPage(
            input: NamespaceCreateNamespacedPageInput(node: n, path: "projects/alpha"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // getChildren(node: n) -> ok(children: "")
        let step2 = try await handler.getChildren(
            input: NamespaceGetChildrenInput(node: n),
            storage: storage
        )
        if case .ok(let children) = step2 {
            XCTAssertEqual(children, "")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
