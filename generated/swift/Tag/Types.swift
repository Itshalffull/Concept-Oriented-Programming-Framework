// generated: Tag/Types.swift

import Foundation

struct TagAddInput: Codable {
    let tag: String
    let article: String
}

enum TagAddOutput: Codable {
    case ok(tag: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tag
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tag: try container.decode(String.self, forKey: .tag)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let tag):
            try container.encode("ok", forKey: .variant)
            try container.encode(tag, forKey: .tag)
        }
    }
}

struct TagRemoveInput: Codable {
    let tag: String
    let article: String
}

enum TagRemoveOutput: Codable {
    case ok(tag: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tag
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tag: try container.decode(String.self, forKey: .tag)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let tag):
            try container.encode("ok", forKey: .variant)
            try container.encode(tag, forKey: .tag)
        }
    }
}

struct TagListInput: Codable {
}

enum TagListOutput: Codable {
    case ok(tags: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tags
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tags: try container.decode(String.self, forKey: .tags)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let tags):
            try container.encode("ok", forKey: .variant)
            try container.encode(tags, forKey: .tags)
        }
    }
}

