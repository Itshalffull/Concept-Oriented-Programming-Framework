// CollectionTests.swift — Tests for Collection concept

import XCTest
@testable import COPF

final class CollectionTests: XCTestCase {

    // MARK: - create

    func testCreateCollection() async throws {
        let storage = InMemoryStorage()
        let handler = CollectionHandlerImpl()

        let result = try await handler.create(
            input: CollectionCreateInput(name: "Favorites", collectionType: "manual"),
            storage: storage
        )

        if case .ok(let collectionId) = result {
            XCTAssertFalse(collectionId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateCollectionStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = CollectionHandlerImpl()

        let result = try await handler.create(
            input: CollectionCreateInput(name: "Reading List", collectionType: "smart", schemaId: "articles"),
            storage: storage
        )

        if case .ok(let collectionId) = result {
            let record = try await storage.get(relation: "collection", key: collectionId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["name"] as? String, "Reading List")
            XCTAssertEqual(record?["collectionType"] as? String, "smart")
            XCTAssertEqual(record?["schemaId"] as? String, "articles")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateCollectionWithoutSchema() async throws {
        let storage = InMemoryStorage()
        let handler = CollectionHandlerImpl()

        let result = try await handler.create(
            input: CollectionCreateInput(name: "Bookmarks", collectionType: "manual"),
            storage: storage
        )

        if case .ok(let collectionId) = result {
            let record = try await storage.get(relation: "collection", key: collectionId)
            XCTAssertEqual(record?["schemaId"] as? String, "")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - addMember

    func testAddMember() async throws {
        let storage = InMemoryStorage()
        let handler = CollectionHandlerImpl()

        let createResult = try await handler.create(
            input: CollectionCreateInput(name: "Favorites", collectionType: "manual"),
            storage: storage
        )
        guard case .ok(let collectionId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        let result = try await handler.addMember(
            input: CollectionAddMemberInput(collectionId: collectionId, nodeId: "node1"),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, collectionId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddMemberCollectionNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = CollectionHandlerImpl()

        let result = try await handler.addMember(
            input: CollectionAddMemberInput(collectionId: "nonexistent", nodeId: "node1"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testAddMultipleMembers() async throws {
        let storage = InMemoryStorage()
        let handler = CollectionHandlerImpl()

        let createResult = try await handler.create(
            input: CollectionCreateInput(name: "Favorites", collectionType: "manual"),
            storage: storage
        )
        guard case .ok(let collectionId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        _ = try await handler.addMember(
            input: CollectionAddMemberInput(collectionId: collectionId, nodeId: "node1"),
            storage: storage
        )
        _ = try await handler.addMember(
            input: CollectionAddMemberInput(collectionId: collectionId, nodeId: "node2"),
            storage: storage
        )

        let member1 = try await storage.get(relation: "collection_member", key: "\(collectionId):node1")
        let member2 = try await storage.get(relation: "collection_member", key: "\(collectionId):node2")
        XCTAssertNotNil(member1)
        XCTAssertNotNil(member2)
    }

    // MARK: - removeMember

    func testRemoveMember() async throws {
        let storage = InMemoryStorage()
        let handler = CollectionHandlerImpl()

        let createResult = try await handler.create(
            input: CollectionCreateInput(name: "Favorites", collectionType: "manual"),
            storage: storage
        )
        guard case .ok(let collectionId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        _ = try await handler.addMember(
            input: CollectionAddMemberInput(collectionId: collectionId, nodeId: "node1"),
            storage: storage
        )

        let result = try await handler.removeMember(
            input: CollectionRemoveMemberInput(collectionId: collectionId, nodeId: "node1"),
            storage: storage
        )

        if case .ok(let returnedId) = result {
            XCTAssertEqual(returnedId, collectionId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRemoveMemberNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = CollectionHandlerImpl()

        let result = try await handler.removeMember(
            input: CollectionRemoveMemberInput(collectionId: "c1", nodeId: "node99"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("node99"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - getMembers

    func testGetMembers() async throws {
        let storage = InMemoryStorage()
        let handler = CollectionHandlerImpl()

        let createResult = try await handler.create(
            input: CollectionCreateInput(name: "Favorites", collectionType: "manual"),
            storage: storage
        )
        guard case .ok(let collectionId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        _ = try await handler.addMember(
            input: CollectionAddMemberInput(collectionId: collectionId, nodeId: "node1"),
            storage: storage
        )
        _ = try await handler.addMember(
            input: CollectionAddMemberInput(collectionId: collectionId, nodeId: "node2"),
            storage: storage
        )

        let result = try await handler.getMembers(
            input: CollectionGetMembersInput(collectionId: collectionId),
            storage: storage
        )

        if case .ok(let returnedId, let members) = result {
            XCTAssertEqual(returnedId, collectionId)
            XCTAssertTrue(members.contains("node1"))
            XCTAssertTrue(members.contains("node2"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetMembersCollectionNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = CollectionHandlerImpl()

        let result = try await handler.getMembers(
            input: CollectionGetMembersInput(collectionId: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testGetMembersEmptyCollection() async throws {
        let storage = InMemoryStorage()
        let handler = CollectionHandlerImpl()

        let createResult = try await handler.create(
            input: CollectionCreateInput(name: "Empty", collectionType: "manual"),
            storage: storage
        )
        guard case .ok(let collectionId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        let result = try await handler.getMembers(
            input: CollectionGetMembersInput(collectionId: collectionId),
            storage: storage
        )

        if case .ok(_, let members) = result {
            XCTAssertEqual(members, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
