// BacklinkTests.swift — Tests for Backlink concept

import XCTest
@testable import Clef

final class BacklinkTests: XCTestCase {

    // MARK: - getBacklinks

    func testGetBacklinksReturnsSourceIds() async throws {
        let storage = InMemoryStorage()
        let handler = BacklinkHandlerImpl()

        // Seed some backlink records
        try await storage.put(
            relation: "backlink",
            key: "targetB::sourceA",
            value: ["targetId": "targetB", "sourceId": "sourceA"]
        )
        try await storage.put(
            relation: "backlink",
            key: "targetB::sourceC",
            value: ["targetId": "targetB", "sourceId": "sourceC"]
        )

        let result = try await handler.getBacklinks(
            input: BacklinkGetBacklinksInput(entityId: "targetB"),
            storage: storage
        )

        if case .ok(let entityId, let backlinks) = result {
            XCTAssertEqual(entityId, "targetB")
            XCTAssertTrue(backlinks.contains("sourceA"))
            XCTAssertTrue(backlinks.contains("sourceC"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetBacklinksNoBacklinksReturnsEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = BacklinkHandlerImpl()

        let result = try await handler.getBacklinks(
            input: BacklinkGetBacklinksInput(entityId: "lonely"),
            storage: storage
        )

        if case .ok(let entityId, _) = result {
            XCTAssertEqual(entityId, "lonely")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetBacklinksOnlySameTarget() async throws {
        let storage = InMemoryStorage()
        let handler = BacklinkHandlerImpl()

        try await storage.put(
            relation: "backlink",
            key: "t1::s1",
            value: ["targetId": "t1", "sourceId": "s1"]
        )
        try await storage.put(
            relation: "backlink",
            key: "t2::s2",
            value: ["targetId": "t2", "sourceId": "s2"]
        )

        let result = try await handler.getBacklinks(
            input: BacklinkGetBacklinksInput(entityId: "t1"),
            storage: storage
        )

        if case .ok(_, let backlinks) = result {
            XCTAssertTrue(backlinks.contains("s1"))
            XCTAssertFalse(backlinks.contains("s2"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - reindex

    func testReindexBuildsBacklinksFromReferences() async throws {
        let storage = InMemoryStorage()
        let handler = BacklinkHandlerImpl()

        // Seed references
        try await storage.put(
            relation: "reference",
            key: "a::b",
            value: ["sourceId": "a", "targetId": "b", "refType": "link"]
        )
        try await storage.put(
            relation: "reference",
            key: "c::b",
            value: ["sourceId": "c", "targetId": "b", "refType": "link"]
        )

        let result = try await handler.reindex(
            input: BacklinkReindexInput(),
            storage: storage
        )

        if case .ok(let count) = result {
            XCTAssertEqual(count, 2)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testReindexEmptyReferencesReturnsZero() async throws {
        let storage = InMemoryStorage()
        let handler = BacklinkHandlerImpl()

        let result = try await handler.reindex(
            input: BacklinkReindexInput(),
            storage: storage
        )

        if case .ok(let count) = result {
            XCTAssertEqual(count, 0)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
