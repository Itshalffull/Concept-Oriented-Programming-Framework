// generated: ViewportProvider/Types.swift

import Foundation

struct ViewportProviderInitializeInput: Codable {
    let pluginRef: String
}

enum ViewportProviderInitializeOutput: Codable {
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

struct ViewportProviderObserveInput: Codable {
    let width: Int
    let height: Int
}

enum ViewportProviderObserveOutput: Codable {
    case ok(breakpoint: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case breakpoint
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                breakpoint: try container.decode(String.self, forKey: .breakpoint)
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
        case .ok(let breakpoint):
            try container.encode("ok", forKey: .variant)
            try container.encode(breakpoint, forKey: .breakpoint)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ViewportProviderGetBreakpointInput: Codable {
    let width: Int
}

enum ViewportProviderGetBreakpointOutput: Codable {
    case ok(breakpoint: String, minWidth: Int, maxWidth: Int)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case breakpoint
        case minWidth
        case maxWidth
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                breakpoint: try container.decode(String.self, forKey: .breakpoint),
                minWidth: try container.decode(Int.self, forKey: .minWidth),
                maxWidth: try container.decode(Int.self, forKey: .maxWidth)
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
        case .ok(let breakpoint, let minWidth, let maxWidth):
            try container.encode("ok", forKey: .variant)
            try container.encode(breakpoint, forKey: .breakpoint)
            try container.encode(minWidth, forKey: .minWidth)
            try container.encode(maxWidth, forKey: .maxWidth)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ViewportProviderSetBreakpointsInput: Codable {
    let breakpoints: [String]
}

enum ViewportProviderSetBreakpointsOutput: Codable {
    case ok(count: Int)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case count
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                count: try container.decode(Int.self, forKey: .count)
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
        case .ok(let count):
            try container.encode("ok", forKey: .variant)
            try container.encode(count, forKey: .count)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}
