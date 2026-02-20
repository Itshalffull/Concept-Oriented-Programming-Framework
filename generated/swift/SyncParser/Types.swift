// generated: SyncParser/Types.swift

import Foundation

struct SyncParserParseInput: Codable {
    let source: String
    let manifests: [Any]
}

enum SyncParserParseOutput: Codable {
    case ok(sync: String, ast: Any)
    case error(message: String, line: Int)

    enum CodingKeys: String, CodingKey {
        case variant
        case sync
        case ast
        case message
        case line
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                sync: try container.decode(String.self, forKey: .sync),
                ast: try container.decode(Any.self, forKey: .ast)
            )
        case "error":
            self = .error(
                message: try container.decode(String.self, forKey: .message),
                line: try container.decode(Int.self, forKey: .line)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let sync, let ast):
            try container.encode("ok", forKey: .variant)
            try container.encode(sync, forKey: .sync)
            try container.encode(ast, forKey: .ast)
        case .error(let message, let line):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
            try container.encode(line, forKey: .line)
        }
    }
}

