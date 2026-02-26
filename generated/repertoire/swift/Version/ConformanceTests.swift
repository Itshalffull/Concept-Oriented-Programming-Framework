// generated: Version/ConformanceTests.swift

import XCTest
@testable import COPF

final class VersionConformanceTests: XCTestCase {

    func testVersionInvariant1() async throws {
        // invariant 1: after snapshot, listVersions, rollback behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let v1 = "u-test-invariant-001"

        // --- AFTER clause ---
        // snapshot(version: v1, entity: "doc", data: "original", author: "alice") -> ok(version: v1)
        let step1 = try await handler.snapshot(
            input: VersionSnapshotInput(version: v1, entity: "doc", data: "original", author: "alice"),
            storage: storage
        )
        if case .ok(let version) = step1 {
            XCTAssertEqual(version, v1)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // listVersions(entity: "doc") -> ok(versions: "v1")
        let step2 = try await handler.listVersions(
            input: VersionListVersionsInput(entity: "doc"),
            storage: storage
        )
        if case .ok(let versions) = step2 {
            XCTAssertEqual(versions, "v1")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // rollback(version: v1) -> ok(data: "original")
        let step3 = try await handler.rollback(
            input: VersionRollbackInput(version: v1),
            storage: storage
        )
        if case .ok(let data) = step3 {
            XCTAssertEqual(data, "original")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
