// MediaAssetImpl.swift — MediaAsset concept implementation

import Foundation

// MARK: - Types

public struct MediaAssetCreateMediaInput: Codable {
    public let mediaType: String
    public let source: String
    public let metadata: String

    public init(mediaType: String, source: String, metadata: String) {
        self.mediaType = mediaType
        self.source = source
        self.metadata = metadata
    }
}

public enum MediaAssetCreateMediaOutput: Codable {
    case ok(mediaId: String)

    enum CodingKeys: String, CodingKey {
        case variant, mediaId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(mediaId: try container.decode(String.self, forKey: .mediaId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let mediaId):
            try container.encode("ok", forKey: .variant)
            try container.encode(mediaId, forKey: .mediaId)
        }
    }
}

public struct MediaAssetExtractMetadataInput: Codable {
    public let mediaId: String

    public init(mediaId: String) {
        self.mediaId = mediaId
    }
}

public enum MediaAssetExtractMetadataOutput: Codable {
    case ok(mediaId: String, metadata: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, mediaId, metadata, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                mediaId: try container.decode(String.self, forKey: .mediaId),
                metadata: try container.decode(String.self, forKey: .metadata)
            )
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let mediaId, let metadata):
            try container.encode("ok", forKey: .variant)
            try container.encode(mediaId, forKey: .mediaId)
            try container.encode(metadata, forKey: .metadata)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct MediaAssetGenerateThumbnailInput: Codable {
    public let mediaId: String

    public init(mediaId: String) {
        self.mediaId = mediaId
    }
}

public enum MediaAssetGenerateThumbnailOutput: Codable {
    case ok(mediaId: String, thumbnailUri: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, mediaId, thumbnailUri, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                mediaId: try container.decode(String.self, forKey: .mediaId),
                thumbnailUri: try container.decode(String.self, forKey: .thumbnailUri)
            )
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let mediaId, let thumbnailUri):
            try container.encode("ok", forKey: .variant)
            try container.encode(mediaId, forKey: .mediaId)
            try container.encode(thumbnailUri, forKey: .thumbnailUri)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol MediaAssetHandler {
    func createMedia(input: MediaAssetCreateMediaInput, storage: ConceptStorage) async throws -> MediaAssetCreateMediaOutput
    func extractMetadata(input: MediaAssetExtractMetadataInput, storage: ConceptStorage) async throws -> MediaAssetExtractMetadataOutput
    func generateThumbnail(input: MediaAssetGenerateThumbnailInput, storage: ConceptStorage) async throws -> MediaAssetGenerateThumbnailOutput
}

// MARK: - Implementation

public struct MediaAssetHandlerImpl: MediaAssetHandler {
    public init() {}

    public func createMedia(
        input: MediaAssetCreateMediaInput,
        storage: ConceptStorage
    ) async throws -> MediaAssetCreateMediaOutput {
        let mediaId = UUID().uuidString
        try await storage.put(
            relation: "media",
            key: mediaId,
            value: [
                "mediaId": mediaId,
                "mediaType": input.mediaType,
                "source": input.source,
                "metadata": input.metadata,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(mediaId: mediaId)
    }

    public func extractMetadata(
        input: MediaAssetExtractMetadataInput,
        storage: ConceptStorage
    ) async throws -> MediaAssetExtractMetadataOutput {
        guard let record = try await storage.get(relation: "media", key: input.mediaId) else {
            return .notfound(message: "Media \(input.mediaId) not found")
        }
        let metadata = record["metadata"] as? String ?? "{}"
        return .ok(mediaId: input.mediaId, metadata: metadata)
    }

    public func generateThumbnail(
        input: MediaAssetGenerateThumbnailInput,
        storage: ConceptStorage
    ) async throws -> MediaAssetGenerateThumbnailOutput {
        guard let record = try await storage.get(relation: "media", key: input.mediaId) else {
            return .notfound(message: "Media \(input.mediaId) not found")
        }
        let source = record["source"] as? String ?? ""
        let thumbnailUri = "thumbnails/\(input.mediaId)_thumb_\(source)"
        var updated = record
        updated["thumbnailUri"] = thumbnailUri
        try await storage.put(relation: "media", key: input.mediaId, value: updated)
        return .ok(mediaId: input.mediaId, thumbnailUri: thumbnailUri)
    }
}
