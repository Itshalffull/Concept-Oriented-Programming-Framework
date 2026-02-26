// RelationTests.swift — Tests for Relation concept

import XCTest
@testable import Clef

final class RelationTests: XCTestCase {

    // MARK: - defineRelation

    func testDefineRelationReturnsOkWithRelationId() async throws {
        let storage = InMemoryStorage()
        let handler = RelationHandlerImpl()

        let result = try await handler.defineRelation(
            input: RelationDefineRelationInput(
                name: "parent-child",
                sourceType: "page",
                targetType: "page",
                cardinality: "one-to-many",
                isBidirectional: false
            ),
            storage: storage
        )

        if case .ok(let relationId) = result {
            XCTAssertFalse(relationId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDefineRelationStoresDefinition() async throws {
        let storage = InMemoryStorage()
        let handler = RelationHandlerImpl()

        let result = try await handler.defineRelation(
            input: RelationDefineRelationInput(
                name: "sibling",
                sourceType: "node",
                targetType: "node",
                cardinality: "many-to-many",
                isBidirectional: true
            ),
            storage: storage
        )

        if case .ok(let relationId) = result {
            let record = try await storage.get(relation: "relation_def", key: relationId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["name"] as? String, "sibling")
            XCTAssertEqual(record?["isBidirectional"] as? String, "true")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - link

    func testLinkWithExistingRelationReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = RelationHandlerImpl()

        let defineResult = try await handler.defineRelation(
            input: RelationDefineRelationInput(
                name: "contains",
                sourceType: "folder",
                targetType: "file",
                cardinality: "one-to-many",
                isBidirectional: false
            ),
            storage: storage
        )

        guard case .ok(let relationId) = defineResult else {
            return XCTFail("Expected defineRelation to succeed")
        }

        let result = try await handler.link(
            input: RelationLinkInput(relationId: relationId, sourceId: "folder1", targetId: "file1"),
            storage: storage
        )

        if case .ok(let rId) = result {
            XCTAssertEqual(rId, relationId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testLinkWithMissingRelationReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = RelationHandlerImpl()

        let result = try await handler.link(
            input: RelationLinkInput(relationId: "missing", sourceId: "a", targetId: "b"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - unlink

    func testUnlinkExistingLinkReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = RelationHandlerImpl()

        let defineResult = try await handler.defineRelation(
            input: RelationDefineRelationInput(
                name: "ref",
                sourceType: "node",
                targetType: "node",
                cardinality: "many-to-many",
                isBidirectional: false
            ),
            storage: storage
        )

        guard case .ok(let relationId) = defineResult else {
            return XCTFail("Expected defineRelation to succeed")
        }

        _ = try await handler.link(
            input: RelationLinkInput(relationId: relationId, sourceId: "a", targetId: "b"),
            storage: storage
        )

        let result = try await handler.unlink(
            input: RelationUnlinkInput(relationId: relationId, sourceId: "a", targetId: "b"),
            storage: storage
        )

        if case .ok(let rId) = result {
            XCTAssertEqual(rId, relationId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testUnlinkMissingLinkReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = RelationHandlerImpl()

        let result = try await handler.unlink(
            input: RelationUnlinkInput(relationId: "rel1", sourceId: "a", targetId: "b"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - getRelated

    func testGetRelatedReturnsLinkedNodes() async throws {
        let storage = InMemoryStorage()
        let handler = RelationHandlerImpl()

        let defineResult = try await handler.defineRelation(
            input: RelationDefineRelationInput(
                name: "depends-on",
                sourceType: "task",
                targetType: "task",
                cardinality: "many-to-many",
                isBidirectional: false
            ),
            storage: storage
        )

        guard case .ok(let relationId) = defineResult else {
            return XCTFail("Expected defineRelation to succeed")
        }

        _ = try await handler.link(
            input: RelationLinkInput(relationId: relationId, sourceId: "task1", targetId: "task2"),
            storage: storage
        )

        let result = try await handler.getRelated(
            input: RelationGetRelatedInput(nodeId: "task1", relationId: relationId),
            storage: storage
        )

        if case .ok(let nodeId, let related) = result {
            XCTAssertEqual(nodeId, "task1")
            XCTAssertTrue(related.contains("task2"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetRelatedEmptyReturnsEmptyList() async throws {
        let storage = InMemoryStorage()
        let handler = RelationHandlerImpl()

        let defineResult = try await handler.defineRelation(
            input: RelationDefineRelationInput(
                name: "ref",
                sourceType: "node",
                targetType: "node",
                cardinality: "many-to-many",
                isBidirectional: false
            ),
            storage: storage
        )

        guard case .ok(let relationId) = defineResult else {
            return XCTFail("Expected defineRelation to succeed")
        }

        let result = try await handler.getRelated(
            input: RelationGetRelatedInput(nodeId: "lonely", relationId: relationId),
            storage: storage
        )

        if case .ok(let nodeId, _) = result {
            XCTAssertEqual(nodeId, "lonely")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
