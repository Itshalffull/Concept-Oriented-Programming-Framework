// generated: SyncCompiler/Types.swift

import Foundation

struct SyncCompilerCompileInput: Codable {
    let sync: String
    let ast: Any
}

enum SyncCompilerCompileOutput: Codable {
    case ok(compiled: Any)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case compiled
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                compiled: try container.decode(Any.self, forKey: .compiled)
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
        case .ok(let compiled):
            try container.encode("ok", forKey: .variant)
            try container.encode(compiled, forKey: .compiled)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

