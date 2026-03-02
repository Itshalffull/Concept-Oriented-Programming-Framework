// generated: SlotProvider/Types.swift

import Foundation

struct SlotProviderInitializeInput: Codable {
    let pluginRef: String
}

enum SlotProviderInitializeOutput: Codable {
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

struct SlotProviderDefineInput: Codable {
    let slotName: String
    let description: String
}

enum SlotProviderDefineOutput: Codable {
    case ok(slotName: String)
    case alreadyDefined(slotName: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case slotName
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                slotName: try container.decode(String.self, forKey: .slotName)
            )
        case "alreadyDefined":
            self = .alreadyDefined(
                slotName: try container.decode(String.self, forKey: .slotName)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let slotName):
            try container.encode("ok", forKey: .variant)
            try container.encode(slotName, forKey: .slotName)
        case .alreadyDefined(let slotName):
            try container.encode("alreadyDefined", forKey: .variant)
            try container.encode(slotName, forKey: .slotName)
        }
    }
}

struct SlotProviderFillInput: Codable {
    let slotName: String
    let content: String
}

enum SlotProviderFillOutput: Codable {
    case ok(slotName: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case slotName
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                slotName: try container.decode(String.self, forKey: .slotName)
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
        case .ok(let slotName):
            try container.encode("ok", forKey: .variant)
            try container.encode(slotName, forKey: .slotName)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct SlotProviderClearInput: Codable {
    let slotName: String
}

enum SlotProviderClearOutput: Codable {
    case ok(slotName: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case slotName
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                slotName: try container.decode(String.self, forKey: .slotName)
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
        case .ok(let slotName):
            try container.encode("ok", forKey: .variant)
            try container.encode(slotName, forKey: .slotName)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct SlotProviderGetSlotsInput: Codable {
}

enum SlotProviderGetSlotsOutput: Codable {
    case ok(slotNames: [String])
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case slotNames
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                slotNames: try container.decode([String].self, forKey: .slotNames)
            )
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
        case .ok(let slotNames):
            try container.encode("ok", forKey: .variant)
            try container.encode(slotNames, forKey: .slotNames)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}
