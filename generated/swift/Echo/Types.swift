// generated: Echo/Types.swift

import Foundation

struct EchoSendInput: Codable {
    let id: String
    let text: String
}

enum EchoSendOutput: Codable {
    case ok(id: String, echo: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case id
        case echo
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                id: try container.decode(String.self, forKey: .id),
                echo: try container.decode(String.self, forKey: .echo)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let id, let echo):
            try container.encode("ok", forKey: .variant)
            try container.encode(id, forKey: .id)
            try container.encode(echo, forKey: .echo)
        }
    }
}

