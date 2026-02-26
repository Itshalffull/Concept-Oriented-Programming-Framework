// GroupTests.swift — Tests for Group concept

import XCTest
@testable import Clef

final class GroupTests: XCTestCase {

    // MARK: - createGroup

    func testCreateGroup() async throws {
        let storage = InMemoryStorage()
        let handler = GroupHandlerImpl()

        let result = try await handler.createGroup(
            input: GroupCreateGroupInput(name: "Editors", groupType: "role"),
            storage: storage
        )

        if case .ok(let groupId) = result {
            XCTAssertFalse(groupId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateGroupStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = GroupHandlerImpl()

        let result = try await handler.createGroup(
            input: GroupCreateGroupInput(name: "Admins", groupType: "role"),
            storage: storage
        )

        if case .ok(let groupId) = result {
            let record = try await storage.get(relation: "group", key: groupId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["name"] as? String, "Admins")
            XCTAssertEqual(record?["groupType"] as? String, "role")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - addMember

    func testAddMember() async throws {
        let storage = InMemoryStorage()
        let handler = GroupHandlerImpl()

        let createResult = try await handler.createGroup(
            input: GroupCreateGroupInput(name: "Team", groupType: "team"),
            storage: storage
        )
        guard case .ok(let groupId) = createResult else {
            XCTFail("Expected .ok for create"); return
        }

        let result = try await handler.addMember(
            input: GroupAddMemberInput(groupId: groupId, userId: "u1", role: "member"),
            storage: storage
        )

        if case .ok(let gid, let uid) = result {
            XCTAssertEqual(gid, groupId)
            XCTAssertEqual(uid, "u1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddMemberGroupNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = GroupHandlerImpl()

        let result = try await handler.addMember(
            input: GroupAddMemberInput(groupId: "missing", userId: "u1", role: "member"),
            storage: storage
        )

        if case .groupNotfound(let message) = result {
            XCTAssertTrue(message.contains("missing"))
        } else {
            XCTFail("Expected .groupNotfound but got \(result)")
        }
    }

    // MARK: - addContent

    func testAddContent() async throws {
        let storage = InMemoryStorage()
        let handler = GroupHandlerImpl()

        let createResult = try await handler.createGroup(
            input: GroupCreateGroupInput(name: "Project", groupType: "project"),
            storage: storage
        )
        guard case .ok(let groupId) = createResult else {
            XCTFail("Expected .ok for create"); return
        }

        let result = try await handler.addContent(
            input: GroupAddContentInput(groupId: groupId, nodeId: "node-1"),
            storage: storage
        )

        if case .ok(let gid, let nid) = result {
            XCTAssertEqual(gid, groupId)
            XCTAssertEqual(nid, "node-1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddContentGroupNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = GroupHandlerImpl()

        let result = try await handler.addContent(
            input: GroupAddContentInput(groupId: "missing", nodeId: "node-1"),
            storage: storage
        )

        if case .groupNotfound(let message) = result {
            XCTAssertTrue(message.contains("missing"))
        } else {
            XCTFail("Expected .groupNotfound but got \(result)")
        }
    }

    // MARK: - checkGroupAccess

    func testCheckGroupAccessMemberCanView() async throws {
        let storage = InMemoryStorage()
        let handler = GroupHandlerImpl()

        let createResult = try await handler.createGroup(
            input: GroupCreateGroupInput(name: "Team", groupType: "team"),
            storage: storage
        )
        guard case .ok(let groupId) = createResult else {
            XCTFail("Expected .ok for create"); return
        }

        _ = try await handler.addMember(
            input: GroupAddMemberInput(groupId: groupId, userId: "u1", role: "member"),
            storage: storage
        )

        let result = try await handler.checkGroupAccess(
            input: GroupCheckGroupAccessInput(groupId: groupId, entityId: "node-1", operation: "view", userId: "u1"),
            storage: storage
        )

        if case .ok(let allowed) = result {
            XCTAssertTrue(allowed)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCheckGroupAccessNonMemberDenied() async throws {
        let storage = InMemoryStorage()
        let handler = GroupHandlerImpl()

        let createResult = try await handler.createGroup(
            input: GroupCreateGroupInput(name: "Team", groupType: "team"),
            storage: storage
        )
        guard case .ok(let groupId) = createResult else {
            XCTFail("Expected .ok for create"); return
        }

        let result = try await handler.checkGroupAccess(
            input: GroupCheckGroupAccessInput(groupId: groupId, entityId: "node-1", operation: "view", userId: "stranger"),
            storage: storage
        )

        if case .ok(let allowed) = result {
            XCTAssertFalse(allowed)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCheckGroupAccessAdminCanDelete() async throws {
        let storage = InMemoryStorage()
        let handler = GroupHandlerImpl()

        let createResult = try await handler.createGroup(
            input: GroupCreateGroupInput(name: "Team", groupType: "team"),
            storage: storage
        )
        guard case .ok(let groupId) = createResult else {
            XCTFail("Expected .ok for create"); return
        }

        _ = try await handler.addMember(
            input: GroupAddMemberInput(groupId: groupId, userId: "u1", role: "admin"),
            storage: storage
        )

        let result = try await handler.checkGroupAccess(
            input: GroupCheckGroupAccessInput(groupId: groupId, entityId: "node-1", operation: "delete", userId: "u1"),
            storage: storage
        )

        if case .ok(let allowed) = result {
            XCTAssertTrue(allowed)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCheckGroupAccessGroupNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = GroupHandlerImpl()

        let result = try await handler.checkGroupAccess(
            input: GroupCheckGroupAccessInput(groupId: "missing", entityId: "e1", operation: "view", userId: "u1"),
            storage: storage
        )

        if case .groupNotfound(let message) = result {
            XCTAssertTrue(message.contains("missing"))
        } else {
            XCTFail("Expected .groupNotfound but got \(result)")
        }
    }
}
