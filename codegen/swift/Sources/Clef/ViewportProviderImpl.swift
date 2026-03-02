// ViewportProviderImpl.swift — Surface Provider: Viewport concept implementation

import Foundation

// MARK: - Types

public struct ViewportProviderInitializeInput: Codable {
    public let pluginRef: String

    public init(pluginRef: String) {
        self.pluginRef = pluginRef
    }
}

public enum ViewportProviderInitializeOutput: Codable {
    case ok(pluginRef: String)
    case alreadyInitialized(pluginRef: String)

    enum CodingKeys: String, CodingKey {
        case variant, pluginRef
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(pluginRef: try container.decode(String.self, forKey: .pluginRef))
        case "alreadyInitialized":
            self = .alreadyInitialized(pluginRef: try container.decode(String.self, forKey: .pluginRef))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
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

public struct ViewportProviderObserveInput: Codable {
    public let width: Int
    public let height: Int

    public init(width: Int, height: Int) {
        self.width = width
        self.height = height
    }
}

public enum ViewportProviderObserveOutput: Codable {
    case ok(breakpoint: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, breakpoint, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(breakpoint: try container.decode(String.self, forKey: .breakpoint))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
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

public struct ViewportProviderGetBreakpointInput: Codable {
    public let width: Int

    public init(width: Int) {
        self.width = width
    }
}

public enum ViewportProviderGetBreakpointOutput: Codable {
    case ok(breakpoint: String, minWidth: Int, maxWidth: Int)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, breakpoint, minWidth, maxWidth, message
    }

    public init(from decoder: Decoder) throws {
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
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
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

public struct ViewportProviderSetBreakpointsInput: Codable {
    public let breakpoints: [String]

    public init(breakpoints: [String]) {
        self.breakpoints = breakpoints
    }
}

public enum ViewportProviderSetBreakpointsOutput: Codable {
    case ok(count: Int)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, count, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(count: try container.decode(Int.self, forKey: .count))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
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

// MARK: - Handler Protocol

public protocol ViewportProviderHandler {
    func initialize(input: ViewportProviderInitializeInput, storage: ConceptStorage) async throws -> ViewportProviderInitializeOutput
    func observe(input: ViewportProviderObserveInput, storage: ConceptStorage) async throws -> ViewportProviderObserveOutput
    func getBreakpoint(input: ViewportProviderGetBreakpointInput, storage: ConceptStorage) async throws -> ViewportProviderGetBreakpointOutput
    func setBreakpoints(input: ViewportProviderSetBreakpointsInput, storage: ConceptStorage) async throws -> ViewportProviderSetBreakpointsOutput
}

// MARK: - Implementation

public struct ViewportProviderHandlerImpl: ViewportProviderHandler {
    public init() {}

    private let pluginRef = "surface-provider:viewport"

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func initialize(
        input: ViewportProviderInitializeInput,
        storage: ConceptStorage
    ) async throws -> ViewportProviderInitializeOutput {
        if let _ = try await storage.get(relation: "viewportProvider", key: pluginRef) {
            return .alreadyInitialized(pluginRef: pluginRef)
        }
        let now = iso8601Now()
        try await storage.put(
            relation: "viewportProvider",
            key: pluginRef,
            value: [
                "pluginRef": pluginRef,
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        // Set default breakpoints
        let defaults = ["sm:0:639", "md:640:1023", "lg:1024:1279", "xl:1280:99999"]
        for (index, bp) in defaults.enumerated() {
            try await storage.put(
                relation: "breakpoint",
                key: "bp-\(index)",
                value: [
                    "name": bp.components(separatedBy: ":")[0],
                    "minWidth": bp.components(separatedBy: ":")[1],
                    "maxWidth": bp.components(separatedBy: ":")[2],
                    "order": "\(index)",
                ]
            )
        }
        return .ok(pluginRef: pluginRef)
    }

    public func observe(
        input: ViewportProviderObserveInput,
        storage: ConceptStorage
    ) async throws -> ViewportProviderObserveOutput {
        let breakpoints = try await storage.find(relation: "breakpoint", criteria: nil)
        guard !breakpoints.isEmpty else {
            return .error(message: "No breakpoints configured")
        }
        for bp in breakpoints {
            let minW = Int(bp["minWidth"] as? String ?? "0") ?? 0
            let maxW = Int(bp["maxWidth"] as? String ?? "0") ?? 0
            if input.width >= minW && input.width <= maxW {
                let name = bp["name"] as? String ?? "unknown"
                return .ok(breakpoint: name)
            }
        }
        return .ok(breakpoint: "unknown")
    }

    public func getBreakpoint(
        input: ViewportProviderGetBreakpointInput,
        storage: ConceptStorage
    ) async throws -> ViewportProviderGetBreakpointOutput {
        let breakpoints = try await storage.find(relation: "breakpoint", criteria: nil)
        guard !breakpoints.isEmpty else {
            return .error(message: "No breakpoints configured")
        }
        for bp in breakpoints {
            let minW = Int(bp["minWidth"] as? String ?? "0") ?? 0
            let maxW = Int(bp["maxWidth"] as? String ?? "0") ?? 0
            if input.width >= minW && input.width <= maxW {
                let name = bp["name"] as? String ?? "unknown"
                return .ok(breakpoint: name, minWidth: minW, maxWidth: maxW)
            }
        }
        return .error(message: "No breakpoint matches width \(input.width)")
    }

    public func setBreakpoints(
        input: ViewportProviderSetBreakpointsInput,
        storage: ConceptStorage
    ) async throws -> ViewportProviderSetBreakpointsOutput {
        // Clear existing breakpoints
        let _ = try await storage.delMany(relation: "breakpoint", criteria: [:])
        // Store new breakpoints (format: "name:min:max")
        for (index, bp) in input.breakpoints.enumerated() {
            let parts = bp.components(separatedBy: ":")
            guard parts.count == 3 else { continue }
            try await storage.put(
                relation: "breakpoint",
                key: "bp-\(index)",
                value: [
                    "name": parts[0],
                    "minWidth": parts[1],
                    "maxWidth": parts[2],
                    "order": "\(index)",
                ]
            )
        }
        return .ok(count: input.breakpoints.count)
    }
}
