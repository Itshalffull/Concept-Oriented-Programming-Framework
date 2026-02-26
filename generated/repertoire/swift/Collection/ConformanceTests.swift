// generated: Collection/ConformanceTests.swift

import XCTest
@testable import Clef

final class CollectionConformanceTests: XCTestCase {

    func testCollectionInvariant1() async throws {
        // invariant 1: after create, addMember, getMembers behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let c = "u-test-invariant-001"

        // --- AFTER clause ---
        // create(collection: c, type: "list", schema: "default") -> ok()
        let step1 = try await handler.create(
            input: CollectionCreateInput(collection: c, type: "list", schema: "default"),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // addMember(collection: c, member: "item1") -> ok()
        let step2 = try await handler.addMember(
            input: CollectionAddMemberInput(collection: c, member: "item1"),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // getMembers(collection: c) -> ok(members: "item1")
        let step3 = try await handler.getMembers(
            input: CollectionGetMembersInput(collection: c),
            storage: storage
        )
        if case .ok(let members) = step3 {
            XCTAssertEqual(members, "item1")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
