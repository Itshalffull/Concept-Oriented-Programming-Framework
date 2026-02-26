// generated: Backlink/Types.swift

import Foundation

struct BacklinkGetBacklinksInput: Codable {
    let entity: String
}

enum BacklinkGetBacklinksOutput: Codable {
    case ok(sources: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case sources
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                sources: try container.decode(String.self, forKey: .sources)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let sources):
            try container.encode("ok", forKey: .variant)
            try container.encode(sources, forKey: .sources)
        }
    }
}

struct BacklinkGetUnlinkedMentionsInput: Codable {
    let entity: String
}

enum BacklinkGetUnlinkedMentionsOutput: Codable {
    case ok(mentions: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case mentions
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                mentions: try container.decode(String.self, forKey: .mentions)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let mentions):
            try container.encode("ok", forKey: .variant)
            try container.encode(mentions, forKey: .mentions)
        }
    }
}

struct BacklinkReindexInput: Codable {
}

enum BacklinkReindexOutput: Codable {
    case ok(count: Int)

    enum CodingKeys: String, CodingKey {
        case variant
        case count
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                count: try container.decode(Int.self, forKey: .count)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let count):
            try container.encode("ok", forKey: .variant)
            try container.encode(count, forKey: .count)
        }
    }
}

