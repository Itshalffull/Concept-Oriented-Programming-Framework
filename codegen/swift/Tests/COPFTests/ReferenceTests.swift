// ReferenceTests.swift — Tests for Reference concept

import XCTest
@testable import COPF

final class ReferenceTests: XCTestCase {

    // MARK: - addRef

    func testAddRefReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = ReferenceHandlerImpl()

        let result = try await handler.addRef(
            input: ReferenceAddRefInput(sourceId: "page1", targetId: "page2", refType: "link"),
            storage: storage
        )

        if case .ok(let sourceId, let targetId) = result {
            XCTAssertEqual(sourceId, "page1")
            XCTAssertEqual(targetId, "page2")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddRefStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = ReferenceHandlerImpl()

        _ = try await handler.addRef(
            input: ReferenceAddRefInput(sourceId: "a", targetId: "b", refType: "embed"),
            storage: storage
        )

        let record = try await storage.get(relation: "reference", key: "a::b")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["refType"] as? String, "embed")
    }

    func testAddMultipleRefs() async throws {
        let storage = InMemoryStorage()
        let handler = ReferenceHandlerImpl()

        _ = try await handler.addRef(
            input: ReferenceAddRefInput(sourceId: "a", targetId: "b", refType: "link"),
            storage: storage
        )
        _ = try await handler.addRef(
            input: ReferenceAddRefInput(sourceId: "a", targetId: "c", refType: "link"),
            storage: storage
        )

        let r1 = try await storage.get(relation: "reference", key: "a::b")
        let r2 = try await storage.get(relation: "reference", key: "a::c")
        XCTAssertNotNil(r1)
        XCTAssertNotNil(r2)
    }

    // MARK: - removeRef

    func testRemoveRefReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = ReferenceHandlerImpl()

        _ = try await handler.addRef(
            input: ReferenceAddRefInput(sourceId: "a", targetId: "b", refType: "link"),
            storage: storage
        )

        let result = try await handler.removeRef(
            input: ReferenceRemoveRefInput(sourceId: "a", targetId: "b"),
            storage: storage
        )

        if case .ok(let sourceId, let targetId) = result {
            XCTAssertEqual(sourceId, "a")
            XCTAssertEqual(targetId, "b")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }

        let record = try await storage.get(relation: "reference", key: "a::b")
        XCTAssertNil(record)
    }

    func testRemoveRefMissingReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = ReferenceHandlerImpl()

        let result = try await handler.removeRef(
            input: ReferenceRemoveRefInput(sourceId: "a", targetId: "b"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - getRefs

    func testGetRefsReturnsAddedRefs() async throws {
        let storage = InMemoryStorage()
        let handler = ReferenceHandlerImpl()

        _ = try await handler.addRef(
            input: ReferenceAddRefInput(sourceId: "a", targetId: "b", refType: "link"),
            storage: storage
        )
        _ = try await handler.addRef(
            input: ReferenceAddRefInput(sourceId: "a", targetId: "c", refType: "embed"),
            storage: storage
        )

        let result = try await handler.getRefs(
            input: ReferenceGetRefsInput(sourceId: "a"),
            storage: storage
        )

        if case .ok(let sourceId, let refs) = result {
            XCTAssertEqual(sourceId, "a")
            XCTAssertFalse(refs.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetRefsEmptyReturnsEmptyList() async throws {
        let storage = InMemoryStorage()
        let handler = ReferenceHandlerImpl()

        let result = try await handler.getRefs(
            input: ReferenceGetRefsInput(sourceId: "no_refs"),
            storage: storage
        )

        if case .ok(let sourceId, _) = result {
            XCTAssertEqual(sourceId, "no_refs")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
