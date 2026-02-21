// generated: Renderer/Types.swift

import Foundation

struct RendererRenderInput: Codable {
    let renderer: String
    let tree: String
}

enum RendererRenderOutput: Codable {
    case ok(output: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case output
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                output: try container.decode(String.self, forKey: .output)
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
        case .ok(let output):
            try container.encode("ok", forKey: .variant)
            try container.encode(output, forKey: .output)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct RendererAutoPlaceholderInput: Codable {
    let renderer: String
    let name: String
}

enum RendererAutoPlaceholderOutput: Codable {
    case ok(placeholder: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case placeholder
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                placeholder: try container.decode(String.self, forKey: .placeholder)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let placeholder):
            try container.encode("ok", forKey: .variant)
            try container.encode(placeholder, forKey: .placeholder)
        }
    }
}

struct RendererStreamInput: Codable {
    let renderer: String
    let tree: String
}

enum RendererStreamOutput: Codable {
    case ok(streamId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case streamId
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                streamId: try container.decode(String.self, forKey: .streamId)
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
        case .ok(let streamId):
            try container.encode("ok", forKey: .variant)
            try container.encode(streamId, forKey: .streamId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct RendererMergeCacheabilityInput: Codable {
    let renderer: String
    let tags: String
}

enum RendererMergeCacheabilityOutput: Codable {
    case ok(merged: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case merged
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                merged: try container.decode(String.self, forKey: .merged)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let merged):
            try container.encode("ok", forKey: .variant)
            try container.encode(merged, forKey: .merged)
        }
    }
}

