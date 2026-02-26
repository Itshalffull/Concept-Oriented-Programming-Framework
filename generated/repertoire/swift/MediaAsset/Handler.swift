// generated: MediaAsset/Handler.swift

import Foundation

protocol MediaAssetHandler {
    func createMedia(
        input: MediaAssetCreateMediaInput,
        storage: ConceptStorage
    ) async throws -> MediaAssetCreateMediaOutput

    func extractMetadata(
        input: MediaAssetExtractMetadataInput,
        storage: ConceptStorage
    ) async throws -> MediaAssetExtractMetadataOutput

    func generateThumbnail(
        input: MediaAssetGenerateThumbnailInput,
        storage: ConceptStorage
    ) async throws -> MediaAssetGenerateThumbnailOutput

    func getMedia(
        input: MediaAssetGetMediaInput,
        storage: ConceptStorage
    ) async throws -> MediaAssetGetMediaOutput

}
