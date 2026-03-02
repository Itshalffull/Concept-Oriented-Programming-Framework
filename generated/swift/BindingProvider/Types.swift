// generated: BindingProvider/Types.swift

import Foundation

struct BindingProviderInitializeInput: Codable {
    let pluginRef: String
}

enum BindingProviderInitializeOutput: Codable {
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

struct BindingProviderBindInput: Codable {
    let bindingId: String
    let sourceKey: String
    let targetKey: String
}

enum BindingProviderBindOutput: Codable {
    case ok(bindingId: String)
    case alreadyBound(bindingId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case bindingId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                bindingId: try container.decode(String.self, forKey: .bindingId)
            )
        case "alreadyBound":
            self = .alreadyBound(
                bindingId: try container.decode(String.self, forKey: .bindingId)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let bindingId):
            try container.encode("ok", forKey: .variant)
            try container.encode(bindingId, forKey: .bindingId)
        case .alreadyBound(let bindingId):
            try container.encode("alreadyBound", forKey: .variant)
            try container.encode(bindingId, forKey: .bindingId)
        }
    }
}

struct BindingProviderSyncInput: Codable {
    let bindingId: String
}

enum BindingProviderSyncOutput: Codable {
    case ok(bindingId: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case bindingId
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                bindingId: try container.decode(String.self, forKey: .bindingId)
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
        case .ok(let bindingId):
            try container.encode("ok", forKey: .variant)
            try container.encode(bindingId, forKey: .bindingId)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct BindingProviderInvokeInput: Codable {
    let bindingId: String
    let payload: String
}

enum BindingProviderInvokeOutput: Codable {
    case ok(bindingId: String, result: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case bindingId
        case result
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                bindingId: try container.decode(String.self, forKey: .bindingId),
                result: try container.decode(String.self, forKey: .result)
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
        case .ok(let bindingId, let result):
            try container.encode("ok", forKey: .variant)
            try container.encode(bindingId, forKey: .bindingId)
            try container.encode(result, forKey: .result)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct BindingProviderUnbindInput: Codable {
    let bindingId: String
}

enum BindingProviderUnbindOutput: Codable {
    case ok(bindingId: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case bindingId
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                bindingId: try container.decode(String.self, forKey: .bindingId)
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
        case .ok(let bindingId):
            try container.encode("ok", forKey: .variant)
            try container.encode(bindingId, forKey: .bindingId)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}
