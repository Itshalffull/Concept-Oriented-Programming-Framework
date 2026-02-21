// generated: PluginRegistry/Types.swift

import Foundation

struct PluginRegistryDiscoverInput: Codable {
    let type: String
}

enum PluginRegistryDiscoverOutput: Codable {
    case ok(plugins: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case plugins
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                plugins: try container.decode(String.self, forKey: .plugins)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let plugins):
            try container.encode("ok", forKey: .variant)
            try container.encode(plugins, forKey: .plugins)
        }
    }
}

struct PluginRegistryCreateInstanceInput: Codable {
    let plugin: String
    let config: String
}

enum PluginRegistryCreateInstanceOutput: Codable {
    case ok(instance: String)
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
        case instance
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                instance: try container.decode(String.self, forKey: .instance)
            )
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let instance):
            try container.encode("ok", forKey: .variant)
            try container.encode(instance, forKey: .instance)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

struct PluginRegistryGetDefinitionsInput: Codable {
    let type: String
}

enum PluginRegistryGetDefinitionsOutput: Codable {
    case ok(definitions: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case definitions
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                definitions: try container.decode(String.self, forKey: .definitions)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let definitions):
            try container.encode("ok", forKey: .variant)
            try container.encode(definitions, forKey: .definitions)
        }
    }
}

struct PluginRegistryAlterDefinitionsInput: Codable {
    let type: String
    let alterations: String
}

enum PluginRegistryAlterDefinitionsOutput: Codable {
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

struct PluginRegistryDerivePluginsInput: Codable {
    let plugin: String
    let config: String
}

enum PluginRegistryDerivePluginsOutput: Codable {
    case ok(derived: String)
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
        case derived
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                derived: try container.decode(String.self, forKey: .derived)
            )
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let derived):
            try container.encode("ok", forKey: .variant)
            try container.encode(derived, forKey: .derived)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

