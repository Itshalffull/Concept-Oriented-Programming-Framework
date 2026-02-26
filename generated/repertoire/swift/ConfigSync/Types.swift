// generated: ConfigSync/Types.swift

import Foundation

struct ConfigSyncExportInput: Codable {
    let config: String
}

enum ConfigSyncExportOutput: Codable {
    case ok(data: String)
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
        case data
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                data: try container.decode(String.self, forKey: .data)
            )
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let data):
            try container.encode("ok", forKey: .variant)
            try container.encode(data, forKey: .data)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

struct ConfigSyncImportInput: Codable {
    let config: String
    let data: String
}

enum ConfigSyncImportOutput: Codable {
    case ok
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
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
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ConfigSyncOverrideInput: Codable {
    let config: String
    let layer: String
    let values: String
}

enum ConfigSyncOverrideOutput: Codable {
    case ok
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

struct ConfigSyncDiffInput: Codable {
    let configA: String
    let configB: String
}

enum ConfigSyncDiffOutput: Codable {
    case ok(changes: String)
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
        case changes
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                changes: try container.decode(String.self, forKey: .changes)
            )
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let changes):
            try container.encode("ok", forKey: .variant)
            try container.encode(changes, forKey: .changes)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

