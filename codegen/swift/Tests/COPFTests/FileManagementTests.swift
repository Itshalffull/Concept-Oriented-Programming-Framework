// FileManagementTests.swift — Tests for FileManagement concept

import XCTest
@testable import Clef

final class FileManagementTests: XCTestCase {

    // MARK: - upload

    func testUpload() async throws {
        let storage = InMemoryStorage()
        let handler = FileManagementHandlerImpl()

        let result = try await handler.upload(
            input: FileManagementUploadInput(fileId: "f1", destination: "/uploads/f1.png", metadata: "{\"size\":1024}"),
            storage: storage
        )

        if case .ok(let fileId) = result {
            XCTAssertEqual(fileId, "f1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testUploadStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = FileManagementHandlerImpl()

        _ = try await handler.upload(
            input: FileManagementUploadInput(fileId: "f1", destination: "/uploads/f1.png", metadata: "{\"type\":\"image\"}"),
            storage: storage
        )

        let record = try await storage.get(relation: "file", key: "f1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["destination"] as? String, "/uploads/f1.png")
    }

    func testUploadMultipleFiles() async throws {
        let storage = InMemoryStorage()
        let handler = FileManagementHandlerImpl()

        _ = try await handler.upload(
            input: FileManagementUploadInput(fileId: "f1", destination: "/a", metadata: "{}"),
            storage: storage
        )
        _ = try await handler.upload(
            input: FileManagementUploadInput(fileId: "f2", destination: "/b", metadata: "{}"),
            storage: storage
        )

        let files = try await storage.find(relation: "file", criteria: nil)
        XCTAssertEqual(files.count, 2)
    }

    // MARK: - addUsage

    func testAddUsage() async throws {
        let storage = InMemoryStorage()
        let handler = FileManagementHandlerImpl()

        _ = try await handler.upload(
            input: FileManagementUploadInput(fileId: "f1", destination: "/a", metadata: "{}"),
            storage: storage
        )

        let result = try await handler.addUsage(
            input: FileManagementAddUsageInput(fileId: "f1", entityId: "node-1"),
            storage: storage
        )

        if case .ok(let fileId) = result {
            XCTAssertEqual(fileId, "f1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAddUsageFileNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = FileManagementHandlerImpl()

        let result = try await handler.addUsage(
            input: FileManagementAddUsageInput(fileId: "missing", entityId: "node-1"),
            storage: storage
        )

        if case .fileNotfound(let message) = result {
            XCTAssertTrue(message.contains("missing"))
        } else {
            XCTFail("Expected .fileNotfound but got \(result)")
        }
    }

    // MARK: - removeUsage

    func testRemoveUsage() async throws {
        let storage = InMemoryStorage()
        let handler = FileManagementHandlerImpl()

        _ = try await handler.upload(
            input: FileManagementUploadInput(fileId: "f1", destination: "/a", metadata: "{}"),
            storage: storage
        )
        _ = try await handler.addUsage(
            input: FileManagementAddUsageInput(fileId: "f1", entityId: "node-1"),
            storage: storage
        )

        let result = try await handler.removeUsage(
            input: FileManagementRemoveUsageInput(fileId: "f1", entityId: "node-1"),
            storage: storage
        )

        if case .ok(let fileId) = result {
            XCTAssertEqual(fileId, "f1")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRemoveUsageFileNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = FileManagementHandlerImpl()

        let result = try await handler.removeUsage(
            input: FileManagementRemoveUsageInput(fileId: "missing", entityId: "node-1"),
            storage: storage
        )

        if case .fileNotfound(let message) = result {
            XCTAssertTrue(message.contains("missing"))
        } else {
            XCTFail("Expected .fileNotfound but got \(result)")
        }
    }

    // MARK: - garbageCollect

    func testGarbageCollectRemovesUnusedFiles() async throws {
        let storage = InMemoryStorage()
        let handler = FileManagementHandlerImpl()

        _ = try await handler.upload(
            input: FileManagementUploadInput(fileId: "f1", destination: "/a", metadata: "{}"),
            storage: storage
        )
        _ = try await handler.upload(
            input: FileManagementUploadInput(fileId: "f2", destination: "/b", metadata: "{}"),
            storage: storage
        )
        // Only f1 has a usage
        _ = try await handler.addUsage(
            input: FileManagementAddUsageInput(fileId: "f1", entityId: "node-1"),
            storage: storage
        )

        let result = try await handler.garbageCollect(
            input: FileManagementGarbageCollectInput(),
            storage: storage
        )

        if case .ok(let removedCount) = result {
            XCTAssertEqual(removedCount, 1)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGarbageCollectNoFilesToRemove() async throws {
        let storage = InMemoryStorage()
        let handler = FileManagementHandlerImpl()

        let result = try await handler.garbageCollect(
            input: FileManagementGarbageCollectInput(),
            storage: storage
        )

        if case .ok(let removedCount) = result {
            XCTAssertEqual(removedCount, 0)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
