// MediaAssetTests.swift — Tests for MediaAsset concept

import XCTest
@testable import COPF

final class MediaAssetTests: XCTestCase {

    // MARK: - createMedia

    func testCreateMedia() async throws {
        let storage = InMemoryStorage()
        let handler = MediaAssetHandlerImpl()

        let result = try await handler.createMedia(
            input: MediaAssetCreateMediaInput(mediaType: "image", source: "photo.jpg", metadata: "{\"width\":800}"),
            storage: storage
        )

        if case .ok(let mediaId) = result {
            XCTAssertFalse(mediaId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateMediaStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = MediaAssetHandlerImpl()

        let result = try await handler.createMedia(
            input: MediaAssetCreateMediaInput(mediaType: "video", source: "clip.mp4", metadata: "{\"duration\":120}"),
            storage: storage
        )

        if case .ok(let mediaId) = result {
            let record = try await storage.get(relation: "media", key: mediaId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["mediaType"] as? String, "video")
            XCTAssertEqual(record?["source"] as? String, "clip.mp4")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCreateMultipleMedia() async throws {
        let storage = InMemoryStorage()
        let handler = MediaAssetHandlerImpl()

        let r1 = try await handler.createMedia(
            input: MediaAssetCreateMediaInput(mediaType: "image", source: "a.jpg", metadata: "{}"),
            storage: storage
        )
        let r2 = try await handler.createMedia(
            input: MediaAssetCreateMediaInput(mediaType: "audio", source: "b.mp3", metadata: "{}"),
            storage: storage
        )

        if case .ok(let id1) = r1, case .ok(let id2) = r2 {
            XCTAssertNotEqual(id1, id2)
        } else {
            XCTFail("Expected .ok for both media creations")
        }
    }

    // MARK: - extractMetadata

    func testExtractMetadata() async throws {
        let storage = InMemoryStorage()
        let handler = MediaAssetHandlerImpl()

        let createResult = try await handler.createMedia(
            input: MediaAssetCreateMediaInput(mediaType: "image", source: "photo.jpg", metadata: "{\"width\":1920}"),
            storage: storage
        )
        guard case .ok(let mediaId) = createResult else {
            XCTFail("Expected .ok for create"); return
        }

        let result = try await handler.extractMetadata(
            input: MediaAssetExtractMetadataInput(mediaId: mediaId),
            storage: storage
        )

        if case .ok(let mid, let metadata) = result {
            XCTAssertEqual(mid, mediaId)
            XCTAssertTrue(metadata.contains("1920"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testExtractMetadataNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = MediaAssetHandlerImpl()

        let result = try await handler.extractMetadata(
            input: MediaAssetExtractMetadataInput(mediaId: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - generateThumbnail

    func testGenerateThumbnail() async throws {
        let storage = InMemoryStorage()
        let handler = MediaAssetHandlerImpl()

        let createResult = try await handler.createMedia(
            input: MediaAssetCreateMediaInput(mediaType: "image", source: "photo.jpg", metadata: "{}"),
            storage: storage
        )
        guard case .ok(let mediaId) = createResult else {
            XCTFail("Expected .ok for create"); return
        }

        let result = try await handler.generateThumbnail(
            input: MediaAssetGenerateThumbnailInput(mediaId: mediaId),
            storage: storage
        )

        if case .ok(let mid, let thumbnailUri) = result {
            XCTAssertEqual(mid, mediaId)
            XCTAssertTrue(thumbnailUri.contains("thumb"))
            XCTAssertTrue(thumbnailUri.contains("photo.jpg"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGenerateThumbnailNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = MediaAssetHandlerImpl()

        let result = try await handler.generateThumbnail(
            input: MediaAssetGenerateThumbnailInput(mediaId: "missing"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("missing"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    func testGenerateThumbnailStoresUri() async throws {
        let storage = InMemoryStorage()
        let handler = MediaAssetHandlerImpl()

        let createResult = try await handler.createMedia(
            input: MediaAssetCreateMediaInput(mediaType: "image", source: "img.png", metadata: "{}"),
            storage: storage
        )
        guard case .ok(let mediaId) = createResult else {
            XCTFail("Expected .ok for create"); return
        }

        _ = try await handler.generateThumbnail(
            input: MediaAssetGenerateThumbnailInput(mediaId: mediaId),
            storage: storage
        )

        let record = try await storage.get(relation: "media", key: mediaId)
        XCTAssertNotNil(record?["thumbnailUri"])
    }
}
