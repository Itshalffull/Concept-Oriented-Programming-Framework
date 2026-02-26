// generated: MediaAsset/ConformanceTests.swift

import XCTest
@testable import COPF

final class MediaAssetConformanceTests: XCTestCase {

    func testMediaAssetInvariant1() async throws {
        // invariant 1: after createMedia, extractMetadata, getMedia behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let a = "u-test-invariant-001"
        let s = "u-test-invariant-002"
        let f = "u-test-invariant-003"
        let m = "u-test-invariant-004"

        // --- AFTER clause ---
        // createMedia(asset: a, source: s, file: f) -> ok(asset: a)
        let step1 = try await handler.createMedia(
            input: MediaAssetCreateMediaInput(asset: a, source: s, file: f),
            storage: storage
        )
        if case .ok(let asset) = step1 {
            XCTAssertEqual(asset, a)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // extractMetadata(asset: a) -> ok(metadata: m)
        let step2 = try await handler.extractMetadata(
            input: MediaAssetExtractMetadataInput(asset: a),
            storage: storage
        )
        if case .ok(let metadata) = step2 {
            XCTAssertEqual(metadata, m)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // getMedia(asset: a) -> ok(asset: a, metadata: m, thumbnail: _)
        let step3 = try await handler.getMedia(
            input: MediaAssetGetMediaInput(asset: a),
            storage: storage
        )
        if case .ok(let asset, let metadata, let thumbnail) = step3 {
            XCTAssertEqual(asset, a)
            XCTAssertEqual(metadata, m)
            XCTAssertEqual(thumbnail, _)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
