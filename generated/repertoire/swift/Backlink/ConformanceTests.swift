// generated: Backlink/ConformanceTests.swift

import XCTest
@testable import Clef

final class BacklinkConformanceTests: XCTestCase {

    func testBacklinkInvariant1() async throws {
        // invariant 1: after reindex, getBacklinks behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let n = "u-test-invariant-001"
        let x = "u-test-invariant-002"
        let s = "u-test-invariant-003"

        // --- AFTER clause ---
        // reindex() -> ok(count: n)
        let step1 = try await handler.reindex(
            input: BacklinkReindexInput(),
            storage: storage
        )
        if case .ok(let count) = step1 {
            XCTAssertEqual(count, n)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // getBacklinks(entity: x) -> ok(sources: s)
        let step2 = try await handler.getBacklinks(
            input: BacklinkGetBacklinksInput(entity: x),
            storage: storage
        )
        if case .ok(let sources) = step2 {
            XCTAssertEqual(sources, s)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
