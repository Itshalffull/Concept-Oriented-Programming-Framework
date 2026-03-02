// generated: DesignTokenProvider/Types.swift

import Foundation

struct DesignTokenProviderInitializeInput: Codable {
    let pluginRef: String
}

enum DesignTokenProviderInitializeOutput: Codable {
    case ok(pluginRef: String)
    case alreadyInitialized(pluginRef: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case pluginRef
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                pluginRef: try container.decode(String.self, forKey: .pluginRef)
            )
        case "alreadyInitialized":
            self = .alreadyInitialized(
                pluginRef: try container.decode(String.self, forKey: .pluginRef)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let pluginRef):
            try container.encode("ok", forKey: .variant)
            try container.encode(pluginRef, forKey: .pluginRef)
        case .alreadyInitialized(let pluginRef):
            try container.encode("alreadyInitialized", forKey: .variant)
            try container.encode(pluginRef, forKey: .pluginRef)
        }
    }
}

struct DesignTokenProviderResolveInput: Codable {
    let tokenName: String
    let themeName: String
}

enum DesignTokenProviderResolveOutput: Codable {
    case ok(tokenName: String, value: String)
    case notFound(tokenName: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tokenName
        case value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tokenName: try container.decode(String.self, forKey: .tokenName),
                value: try container.decode(String.self, forKey: .value)
            )
        case "notFound":
            self = .notFound(
                tokenName: try container.decode(String.self, forKey: .tokenName)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let tokenName, let value):
            try container.encode("ok", forKey: .variant)
            try container.encode(tokenName, forKey: .tokenName)
            try container.encode(value, forKey: .value)
        case .notFound(let tokenName):
            try container.encode("notFound", forKey: .variant)
            try container.encode(tokenName, forKey: .tokenName)
        }
    }
}

struct DesignTokenProviderSwitchThemeInput: Codable {
    let themeName: String
}

enum DesignTokenProviderSwitchThemeOutput: Codable {
    case ok(themeName: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case themeName
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                themeName: try container.decode(String.self, forKey: .themeName)
            )
        case "notFound":
            self = .notFound(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let themeName):
            try container.encode("ok", forKey: .variant)
            try container.encode(themeName, forKey: .themeName)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct DesignTokenProviderGetTokensInput: Codable {
    let themeName: String
}

enum DesignTokenProviderGetTokensOutput: Codable {
    case ok(tokens: [String])
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tokens
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tokens: try container.decode([String].self, forKey: .tokens)
            )
        case "notFound":
            self = .notFound(
                message: try container.decode(String.self, forKey: .message)
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
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct DesignTokenProviderExportInput: Codable {
    let themeName: String
    let format: String
}

enum DesignTokenProviderExportOutput: Codable {
    case ok(data: String)
    case notFound(message: String)

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
        case "notFound":
            self = .notFound(
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
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}
