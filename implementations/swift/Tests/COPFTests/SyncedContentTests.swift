// SyncedContentTests.swift — Tests for SyncedContent concept

import XCTest
@testable import COPF

final class SyncedContentTests: XCTestCase {

    // MARK: - createReference

    func testCreateReference() async throws {
        let storage = InMemoryStorage()
        let handler = SyncedContentHandlerImpl()

        let result = try await handler.createReference(
            input: SyncedContentCreateReferenceInput(sourceId: "src1", targetLocation: "/page/embed"),
            storage: storage
        )

        if case .ok(let refId) = result {
            XCTAssertFalse(refId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateReferenceStoresOriginalAndReference() async throws {
        let storage = InMemoryStorage()
        let handler = SyncedContentHandlerImpl()

        let result = try await handler.createReference(
            input: SyncedContentCreateReferenceInput(sourceId: "src1", targetLocation: "/page/embed"),
            storage: storage
        )

        if case .ok(let refId) = result {
            let original = try await storage.get(relation: "synced_original", key: "src1")
            XCTAssertNotNil(original)
            XCTAssertEqual(original?["sourceId"] as? String, "src1")

            let reference = try await storage.get(relation: "synced_reference", key: refId)
            XCTAssertNotNil(reference)
            XCTAssertEqual(reference?["sourceId"] as? String, "src1")
            XCTAssertEqual(reference?["targetLocation"] as? String, "/page/embed")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateMultipleReferences() async throws {
        let storage = InMemoryStorage()
        let handler = SyncedContentHandlerImpl()

        let result1 = try await handler.createReference(
            input: SyncedContentCreateReferenceInput(sourceId: "src1", targetLocation: "/a"),
            storage: storage
        )
        let result2 = try await handler.createReference(
            input: SyncedContentCreateReferenceInput(sourceId: "src2", targetLocation: "/b"),
            storage: storage
        )

        guard case .ok(let ref1) = result1, case .ok(let ref2) = result2 else {
            return XCTFail("Expected both results to be .ok")
        }
        XCTAssertNotEqual(ref1, ref2)
    }

    // MARK: - editOriginal

    func testEditOriginal() async throws {
        let storage = InMemoryStorage()
        let handler = SyncedContentHandlerImpl()

        let createResult = try await handler.createReference(
            input: SyncedContentCreateReferenceInput(sourceId: "src1", targetLocation: "/page"),
            storage: storage
        )
        guard case .ok(let refId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        let result = try await handler.editOriginal(
            input: SyncedContentEditOriginalInput(refId: refId, newContent: "Updated content"),
            storage: storage
        )

        if case .ok(let returnedRefId) = result {
            XCTAssertEqual(returnedRefId, refId)
            let original = try await storage.get(relation: "synced_original", key: "src1")
            XCTAssertEqual(original?["content"] as? String, "Updated content")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testEditOriginalNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = SyncedContentHandlerImpl()

        let result = try await handler.editOriginal(
            input: SyncedContentEditOriginalInput(refId: "nonexistent", newContent: "Content"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testEditOriginalMultipleTimes() async throws {
        let storage = InMemoryStorage()
        let handler = SyncedContentHandlerImpl()

        let createResult = try await handler.createReference(
            input: SyncedContentCreateReferenceInput(sourceId: "src1", targetLocation: "/page"),
            storage: storage
        )
        guard case .ok(let refId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        _ = try await handler.editOriginal(
            input: SyncedContentEditOriginalInput(refId: refId, newContent: "First edit"),
            storage: storage
        )
        _ = try await handler.editOriginal(
            input: SyncedContentEditOriginalInput(refId: refId, newContent: "Second edit"),
            storage: storage
        )

        let original = try await storage.get(relation: "synced_original", key: "src1")
        XCTAssertEqual(original?["content"] as? String, "Second edit")
    }

    // MARK: - deleteReference

    func testDeleteReference() async throws {
        let storage = InMemoryStorage()
        let handler = SyncedContentHandlerImpl()

        let createResult = try await handler.createReference(
            input: SyncedContentCreateReferenceInput(sourceId: "src1", targetLocation: "/page"),
            storage: storage
        )
        guard case .ok(let refId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        let result = try await handler.deleteReference(
            input: SyncedContentDeleteReferenceInput(refId: refId),
            storage: storage
        )

        if case .ok(let returnedRefId) = result {
            XCTAssertEqual(returnedRefId, refId)
            let ref = try await storage.get(relation: "synced_reference", key: refId)
            XCTAssertNil(ref)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testDeleteReferenceNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = SyncedContentHandlerImpl()

        let result = try await handler.deleteReference(
            input: SyncedContentDeleteReferenceInput(refId: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - convertToIndependent

    func testConvertToIndependent() async throws {
        let storage = InMemoryStorage()
        let handler = SyncedContentHandlerImpl()

        let createResult = try await handler.createReference(
            input: SyncedContentCreateReferenceInput(sourceId: "src1", targetLocation: "/page"),
            storage: storage
        )
        guard case .ok(let refId) = createResult else {
            return XCTFail("Expected .ok on create")
        }

        _ = try await handler.editOriginal(
            input: SyncedContentEditOriginalInput(refId: refId, newContent: "Some content"),
            storage: storage
        )

        let result = try await handler.convertToIndependent(
            input: SyncedContentConvertToIndependentInput(refId: refId),
            storage: storage
        )

        if case .ok(let newNodeId) = result {
            XCTAssertFalse(newNodeId.isEmpty)
            // Reference should be deleted
            let ref = try await storage.get(relation: "synced_reference", key: refId)
            XCTAssertNil(ref)
            // New independent node should exist
            let independent = try await storage.get(relation: "synced_original", key: newNodeId)
            XCTAssertNotNil(independent)
            XCTAssertEqual(independent?["content"] as? String, "Some content")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testConvertToIndependentNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = SyncedContentHandlerImpl()

        let result = try await handler.convertToIndependent(
            input: SyncedContentConvertToIndependentInput(refId: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }
}
