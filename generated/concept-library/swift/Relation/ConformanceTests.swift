// generated: Relation/ConformanceTests.swift

import XCTest
@testable import COPF

final class RelationConformanceTests: XCTestCase {

    func testRelationInvariant1() async throws {
        // invariant 1: after defineRelation, link, getRelated behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let r = "u-test-invariant-001"

        // --- AFTER clause ---
        // defineRelation(relation: r, schema: "parent-child") -> ok(relation: r)
        let step1 = try await handler.defineRelation(
            input: RelationDefineRelationInput(relation: r, schema: "parent-child"),
            storage: storage
        )
        if case .ok(let relation) = step1 {
            XCTAssertEqual(relation, r)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // link(relation: r, source: "alice", target: "bob") -> ok(relation: r, source: "alice", target: "bob")
        let step2 = try await handler.link(
            input: RelationLinkInput(relation: r, source: "alice", target: "bob"),
            storage: storage
        )
        if case .ok(let relation, let source, let target) = step2 {
            XCTAssertEqual(relation, r)
            XCTAssertEqual(source, "alice")
            XCTAssertEqual(target, "bob")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // getRelated(relation: r, entity: "alice") -> ok(related: "bob")
        let step3 = try await handler.getRelated(
            input: RelationGetRelatedInput(relation: r, entity: "alice"),
            storage: storage
        )
        if case .ok(let related) = step3 {
            XCTAssertEqual(related, "bob")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
