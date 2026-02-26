// generated: DisplayMode/Types.swift

import Foundation

struct DisplayModeDefineModeInput: Codable {
    let mode: String
    let name: String
}

enum DisplayModeDefineModeOutput: Codable {
    case ok(mode: String)
    case exists(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case mode
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                mode: try container.decode(String.self, forKey: .mode)
            )
        case "exists":
            self = .exists(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let mode):
            try container.encode("ok", forKey: .variant)
            try container.encode(mode, forKey: .mode)
        case .exists(let message):
            try container.encode("exists", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct DisplayModeConfigureFieldDisplayInput: Codable {
    let mode: String
    let field: String
    let config: String
}

enum DisplayModeConfigureFieldDisplayOutput: Codable {
    case ok(mode: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case mode
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                mode: try container.decode(String.self, forKey: .mode)
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
        case .ok(let mode):
            try container.encode("ok", forKey: .variant)
            try container.encode(mode, forKey: .mode)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct DisplayModeConfigureFieldFormInput: Codable {
    let mode: String
    let field: String
    let config: String
}

enum DisplayModeConfigureFieldFormOutput: Codable {
    case ok(mode: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case mode
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                mode: try container.decode(String.self, forKey: .mode)
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
        case .ok(let mode):
            try container.encode("ok", forKey: .variant)
            try container.encode(mode, forKey: .mode)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct DisplayModeRenderInModeInput: Codable {
    let mode: String
    let entity: String
}

enum DisplayModeRenderInModeOutput: Codable {
    case ok(output: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case output
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                output: try container.decode(String.self, forKey: .output)
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
        case .ok(let output):
            try container.encode("ok", forKey: .variant)
            try container.encode(output, forKey: .output)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

