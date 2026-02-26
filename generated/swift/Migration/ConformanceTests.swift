// generated: Migration/ConformanceTests.swift

import XCTest
@testable import Clef

final class MigrationConformanceTests: XCTestCase {

    func testMigrationInvariant1() async throws {
        // invariant 1: after complete, check behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        // --- AFTER clause ---
        // complete(concept: "c1", version: 1) -> ok()
        let step1 = try await handler.complete(
            input: MigrationCompleteInput(concept: "c1", version: 1),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // check(concept: "c1", specVersion: 2) -> needsMigration(from: 1, to: 2)
        let step2 = try await handler.check(
            input: MigrationCheckInput(concept: "c1", specVersion: 2),
            storage: storage
        )
        if case .needsMigration(let from, let to) = step2 {
            XCTAssertEqual(from, 1)
            XCTAssertEqual(to, 2)
        } else {
            XCTFail("Expected .needsMigration, got \(step2)")
        }
    }

}
