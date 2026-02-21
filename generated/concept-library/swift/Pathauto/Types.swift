// generated: Pathauto/Types.swift

import Foundation

struct PathautoGenerateAliasInput: Codable {
    let pattern: String
    let entity: String
}

enum PathautoGenerateAliasOutput: Codable {
    case ok(alias: String)
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
        case alias
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                alias: try container.decode(String.self, forKey: .alias)
            )
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let alias):
            try container.encode("ok", forKey: .variant)
            try container.encode(alias, forKey: .alias)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

struct PathautoBulkGenerateInput: Codable {
    let pattern: String
    let entities: String
}

enum PathautoBulkGenerateOutput: Codable {
    case ok(aliases: String)
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
        case aliases
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                aliases: try container.decode(String.self, forKey: .aliases)
            )
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let aliases):
            try container.encode("ok", forKey: .variant)
            try container.encode(aliases, forKey: .aliases)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

struct PathautoCleanStringInput: Codable {
    let input: String
}

enum PathautoCleanStringOutput: Codable {
    case ok(cleaned: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case cleaned
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                cleaned: try container.decode(String.self, forKey: .cleaned)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let cleaned):
            try container.encode("ok", forKey: .variant)
            try container.encode(cleaned, forKey: .cleaned)
        }
    }
}

