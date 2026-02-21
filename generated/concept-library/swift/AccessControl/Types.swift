// generated: AccessControl/Types.swift

import Foundation

struct AccessControlCheckInput: Codable {
    let resource: String
    let action: String
    let context: String
}

enum AccessControlCheckOutput: Codable {
    case ok(result: String, tags: String, maxAge: Int)

    enum CodingKeys: String, CodingKey {
        case variant
        case result
        case tags
        case maxAge
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                result: try container.decode(String.self, forKey: .result),
                tags: try container.decode(String.self, forKey: .tags),
                maxAge: try container.decode(Int.self, forKey: .maxAge)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let result, let tags, let maxAge):
            try container.encode("ok", forKey: .variant)
            try container.encode(result, forKey: .result)
            try container.encode(tags, forKey: .tags)
            try container.encode(maxAge, forKey: .maxAge)
        }
    }
}

struct AccessControlOrIfInput: Codable {
    let left: String
    let right: String
}

enum AccessControlOrIfOutput: Codable {
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

struct AccessControlAndIfInput: Codable {
    let left: String
    let right: String
}

enum AccessControlAndIfOutput: Codable {
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

