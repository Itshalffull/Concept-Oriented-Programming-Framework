// generated: Version/Types.swift

import Foundation

struct VersionSnapshotInput: Codable {
    let version: String
    let entity: String
    let data: String
    let author: String
}

enum VersionSnapshotOutput: Codable {
    case ok(version: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case version
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                version: try container.decode(String.self, forKey: .version)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let version):
            try container.encode("ok", forKey: .variant)
            try container.encode(version, forKey: .version)
        }
    }
}

struct VersionListVersionsInput: Codable {
    let entity: String
}

enum VersionListVersionsOutput: Codable {
    case ok(versions: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case versions
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                versions: try container.decode(String.self, forKey: .versions)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let versions):
            try container.encode("ok", forKey: .variant)
            try container.encode(versions, forKey: .versions)
        }
    }
}

struct VersionRollbackInput: Codable {
    let version: String
}

enum VersionRollbackOutput: Codable {
    case ok(data: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case data
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                data: try container.decode(String.self, forKey: .data)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let data):
            try container.encode("ok", forKey: .variant)
            try container.encode(data, forKey: .data)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct VersionDiffInput: Codable {
    let versionA: String
    let versionB: String
}

enum VersionDiffOutput: Codable {
    case ok(changes: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case changes
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                changes: try container.decode(String.self, forKey: .changes)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let changes):
            try container.encode("ok", forKey: .variant)
            try container.encode(changes, forKey: .changes)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

