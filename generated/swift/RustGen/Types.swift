// generated: RustGen/Types.swift

import Foundation

struct RustGenGenerateInput: Codable {
    let spec: String
    let manifest: Any
}

enum RustGenGenerateOutput: Codable {
    case ok(files: [(path: String, content: String)])
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case files
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                files: try container.decode([(path: String, content: String)].self, forKey: .files)
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
        case .ok(let files):
            try container.encode("ok", forKey: .variant)
            try container.encode(files, forKey: .files)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

