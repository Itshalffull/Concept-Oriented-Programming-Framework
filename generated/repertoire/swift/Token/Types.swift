// generated: Token/Types.swift

import Foundation

struct TokenReplaceInput: Codable {
    let text: String
    let context: String
}

enum TokenReplaceOutput: Codable {
    case ok(result: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case result
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                result: try container.decode(String.self, forKey: .result)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let result):
            try container.encode("ok", forKey: .variant)
            try container.encode(result, forKey: .result)
        }
    }
}

struct TokenGetAvailableTokensInput: Codable {
    let context: String
}

enum TokenGetAvailableTokensOutput: Codable {
    case ok(tokens: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tokens
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tokens: try container.decode(String.self, forKey: .tokens)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let tokens):
            try container.encode("ok", forKey: .variant)
            try container.encode(tokens, forKey: .tokens)
        }
    }
}

struct TokenScanInput: Codable {
    let text: String
}

enum TokenScanOutput: Codable {
    case ok(found: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case found
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                found: try container.decode(String.self, forKey: .found)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let found):
            try container.encode("ok", forKey: .variant)
            try container.encode(found, forKey: .found)
        }
    }
}

struct TokenRegisterProviderInput: Codable {
    let token: String
    let provider: String
}

enum TokenRegisterProviderOutput: Codable {
    case ok
    case exists

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "exists": self = .exists
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .exists:
            try container.encode("exists", forKey: .variant)
        }
    }
}

