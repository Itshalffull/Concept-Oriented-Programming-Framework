// generated: Group/ConformanceTests.swift

import XCTest
@testable import Clef

final class GroupConformanceTests: XCTestCase {

    func testGroupInvariant1() async throws {
        // invariant 1: after createGroup, addMember, checkGroupAccess behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let g = "u-test-invariant-001"
        let n = "u-test-invariant-002"
        let u = "u-test-invariant-003"

        // --- AFTER clause ---
        // createGroup(group: g, name: n) -> ok()
        let step1 = try await handler.createGroup(
            input: GroupCreateGroupInput(group: g, name: n),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        // addMember(group: g, user: u, role: "member") -> ok()
        let step2 = try await handler.addMember(
            input: GroupAddMemberInput(group: g, user: u, role: "member"),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }
        // checkGroupAccess(group: g, user: u, permission: "read") -> ok(granted: true)
        let step3 = try await handler.checkGroupAccess(
            input: GroupCheckGroupAccessInput(group: g, user: u, permission: "read"),
            storage: storage
        )
        if case .ok(let granted) = step3 {
            XCTAssertEqual(granted, true)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
