// generated: MediaAsset/Types.swift

import Foundation

struct MediaAssetCreateMediaInput: Codable {
    let asset: String
    let source: String
    let file: String
}

enum MediaAssetCreateMediaOutput: Codable {
    case ok(asset: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case asset
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                asset: try container.decode(String.self, forKey: .asset)
            )
        case "error":
            self = .error(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let asset):
            try container.encode("ok", forKey: .variant)
            try container.encode(asset, forKey: .asset)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct MediaAssetExtractMetadataInput: Codable {
    let asset: String
}

enum MediaAssetExtractMetadataOutput: Codable {
    case ok(metadata: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case metadata
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                metadata: try container.decode(String.self, forKey: .metadata)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let metadata):
            try container.encode("ok", forKey: .variant)
            try container.encode(metadata, forKey: .metadata)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct MediaAssetGenerateThumbnailInput: Codable {
    let asset: String
}

enum MediaAssetGenerateThumbnailOutput: Codable {
    case ok(thumbnail: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case thumbnail
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                thumbnail: try container.decode(String.self, forKey: .thumbnail)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let thumbnail):
            try container.encode("ok", forKey: .variant)
            try container.encode(thumbnail, forKey: .thumbnail)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct MediaAssetGetMediaInput: Codable {
    let asset: String
}

enum MediaAssetGetMediaOutput: Codable {
    case ok(asset: String, metadata: String, thumbnail: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case asset
        case metadata
        case thumbnail
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                asset: try container.decode(String.self, forKey: .asset),
                metadata: try container.decode(String.self, forKey: .metadata),
                thumbnail: try container.decode(String.self, forKey: .thumbnail)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let asset, let metadata, let thumbnail):
            try container.encode("ok", forKey: .variant)
            try container.encode(asset, forKey: .asset)
            try container.encode(metadata, forKey: .metadata)
            try container.encode(thumbnail, forKey: .thumbnail)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

