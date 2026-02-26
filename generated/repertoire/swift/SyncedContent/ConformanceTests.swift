// generated: SyncedContent/ConformanceTests.swift

import XCTest
@testable import Clef

final class SyncedContentConformanceTests: XCTestCase {

    func testSyncedContentInvariant1() async throws {
        // invariant 1: after createReference, editOriginal behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let r = "u-test-invariant-001"
        let o = "u-test-invariant-002"

        // --- AFTER clause ---
        // createReference(ref: r, original: o) -> ok()
        let step1 = try await handler.createReference(
            input: SyncedContentCreateReferenceInput(ref: r, original: o),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // editOriginal(original: o, content: "updated") -> ok()
        let step2 = try await handler.editOriginal(
            input: SyncedContentEditOriginalInput(original: o, content: "updated"),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
    }

}
