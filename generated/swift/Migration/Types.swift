// generated: Migration/Types.swift

import Foundation

struct MigrationCheckInput: Codable {
    let concept: String
    let specVersion: Int
}

enum MigrationCheckOutput: Codable {
    case ok
    case needsMigration(from: Int, to: Int)

    enum CodingKeys: String, CodingKey {
        case variant
        case from
        case to
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "needsMigration":
            self = .needsMigration(
                from: try container.decode(Int.self, forKey: .from),
                to: try container.decode(Int.self, forKey: .to)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .needsMigration(let from, let to):
            try container.encode("needsMigration", forKey: .variant)
            try container.encode(from, forKey: .from)
            try container.encode(to, forKey: .to)
        }
    }
}

struct MigrationCompleteInput: Codable {
    let concept: String
    let version: Int
}

enum MigrationCompleteOutput: Codable {
    case ok

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        }
    }
}

