// generated: SchemaGen/Types.swift

import Foundation

struct SchemaGenGenerateInput: Codable {
    let spec: String
    let ast: Any
}

enum SchemaGenGenerateOutput: Codable {
    case ok(manifest: Any)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case manifest
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                manifest: try container.decode(Any.self, forKey: .manifest)
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
        case .ok(let manifest):
            try container.encode("ok", forKey: .variant)
            try container.encode(manifest, forKey: .manifest)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

