// ViewImpl.swift — View concept implementation

import Foundation

// MARK: - Types

public struct ViewCreateInput: Codable {
    public let name: String
    public let dataSource: String
    public let layout: String

    public init(name: String, dataSource: String, layout: String) {
        self.name = name
        self.dataSource = dataSource
        self.layout = layout
    }
}

public enum ViewCreateOutput: Codable {
    case ok(viewId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case viewId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(viewId: try container.decode(String.self, forKey: .viewId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let viewId):
            try container.encode("ok", forKey: .variant)
            try container.encode(viewId, forKey: .viewId)
        }
    }
}

public struct ViewSetFilterInput: Codable {
    public let viewId: String
    public let rules: String

    public init(viewId: String, rules: String) {
        self.viewId = viewId
        self.rules = rules
    }
}

public enum ViewSetFilterOutput: Codable {
    case ok(viewId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case viewId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(viewId: try container.decode(String.self, forKey: .viewId))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let viewId):
            try container.encode("ok", forKey: .variant)
            try container.encode(viewId, forKey: .viewId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ViewSetSortInput: Codable {
    public let viewId: String
    public let rules: String

    public init(viewId: String, rules: String) {
        self.viewId = viewId
        self.rules = rules
    }
}

public enum ViewSetSortOutput: Codable {
    case ok(viewId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case viewId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(viewId: try container.decode(String.self, forKey: .viewId))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let viewId):
            try container.encode("ok", forKey: .variant)
            try container.encode(viewId, forKey: .viewId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ViewSetGroupInput: Codable {
    public let viewId: String
    public let field: String

    public init(viewId: String, field: String) {
        self.viewId = viewId
        self.field = field
    }
}

public enum ViewSetGroupOutput: Codable {
    case ok(viewId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case viewId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(viewId: try container.decode(String.self, forKey: .viewId))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let viewId):
            try container.encode("ok", forKey: .variant)
            try container.encode(viewId, forKey: .viewId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ViewSetVisibleFieldsInput: Codable {
    public let viewId: String
    public let fieldIds: String

    public init(viewId: String, fieldIds: String) {
        self.viewId = viewId
        self.fieldIds = fieldIds
    }
}

public enum ViewSetVisibleFieldsOutput: Codable {
    case ok(viewId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case viewId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(viewId: try container.decode(String.self, forKey: .viewId))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let viewId):
            try container.encode("ok", forKey: .variant)
            try container.encode(viewId, forKey: .viewId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ViewChangeLayoutInput: Codable {
    public let viewId: String
    public let layout: String

    public init(viewId: String, layout: String) {
        self.viewId = viewId
        self.layout = layout
    }
}

public enum ViewChangeLayoutOutput: Codable {
    case ok(viewId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case viewId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(viewId: try container.decode(String.self, forKey: .viewId))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let viewId):
            try container.encode("ok", forKey: .variant)
            try container.encode(viewId, forKey: .viewId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ViewDuplicateInput: Codable {
    public let viewId: String

    public init(viewId: String) {
        self.viewId = viewId
    }
}

public enum ViewDuplicateOutput: Codable {
    case ok(newViewId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case newViewId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(newViewId: try container.decode(String.self, forKey: .newViewId))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let newViewId):
            try container.encode("ok", forKey: .variant)
            try container.encode(newViewId, forKey: .newViewId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol ViewHandler {
    func create(input: ViewCreateInput, storage: ConceptStorage) async throws -> ViewCreateOutput
    func setFilter(input: ViewSetFilterInput, storage: ConceptStorage) async throws -> ViewSetFilterOutput
    func setSort(input: ViewSetSortInput, storage: ConceptStorage) async throws -> ViewSetSortOutput
    func setGroup(input: ViewSetGroupInput, storage: ConceptStorage) async throws -> ViewSetGroupOutput
    func setVisibleFields(input: ViewSetVisibleFieldsInput, storage: ConceptStorage) async throws -> ViewSetVisibleFieldsOutput
    func changeLayout(input: ViewChangeLayoutInput, storage: ConceptStorage) async throws -> ViewChangeLayoutOutput
    func duplicate(input: ViewDuplicateInput, storage: ConceptStorage) async throws -> ViewDuplicateOutput
}

// MARK: - Implementation

public struct ViewHandlerImpl: ViewHandler {
    public init() {}

    public func create(
        input: ViewCreateInput,
        storage: ConceptStorage
    ) async throws -> ViewCreateOutput {
        let viewId = UUID().uuidString
        try await storage.put(
            relation: "view",
            key: viewId,
            value: [
                "id": viewId,
                "name": input.name,
                "dataSource": input.dataSource,
                "layout": input.layout,
                "filterRules": "",
                "sortRules": "",
                "groupField": "",
                "visibleFields": "",
            ]
        )
        return .ok(viewId: viewId)
    }

    public func setFilter(
        input: ViewSetFilterInput,
        storage: ConceptStorage
    ) async throws -> ViewSetFilterOutput {
        guard let existing = try await storage.get(relation: "view", key: input.viewId) else {
            return .notfound(message: "View '\(input.viewId)' not found")
        }

        var updated = existing
        updated["filterRules"] = input.rules
        try await storage.put(relation: "view", key: input.viewId, value: updated)

        return .ok(viewId: input.viewId)
    }

    public func setSort(
        input: ViewSetSortInput,
        storage: ConceptStorage
    ) async throws -> ViewSetSortOutput {
        guard let existing = try await storage.get(relation: "view", key: input.viewId) else {
            return .notfound(message: "View '\(input.viewId)' not found")
        }

        var updated = existing
        updated["sortRules"] = input.rules
        try await storage.put(relation: "view", key: input.viewId, value: updated)

        return .ok(viewId: input.viewId)
    }

    public func setGroup(
        input: ViewSetGroupInput,
        storage: ConceptStorage
    ) async throws -> ViewSetGroupOutput {
        guard let existing = try await storage.get(relation: "view", key: input.viewId) else {
            return .notfound(message: "View '\(input.viewId)' not found")
        }

        var updated = existing
        updated["groupField"] = input.field
        try await storage.put(relation: "view", key: input.viewId, value: updated)

        return .ok(viewId: input.viewId)
    }

    public func setVisibleFields(
        input: ViewSetVisibleFieldsInput,
        storage: ConceptStorage
    ) async throws -> ViewSetVisibleFieldsOutput {
        guard let existing = try await storage.get(relation: "view", key: input.viewId) else {
            return .notfound(message: "View '\(input.viewId)' not found")
        }

        var updated = existing
        updated["visibleFields"] = input.fieldIds
        try await storage.put(relation: "view", key: input.viewId, value: updated)

        return .ok(viewId: input.viewId)
    }

    public func changeLayout(
        input: ViewChangeLayoutInput,
        storage: ConceptStorage
    ) async throws -> ViewChangeLayoutOutput {
        guard let existing = try await storage.get(relation: "view", key: input.viewId) else {
            return .notfound(message: "View '\(input.viewId)' not found")
        }

        var updated = existing
        updated["layout"] = input.layout
        try await storage.put(relation: "view", key: input.viewId, value: updated)

        return .ok(viewId: input.viewId)
    }

    public func duplicate(
        input: ViewDuplicateInput,
        storage: ConceptStorage
    ) async throws -> ViewDuplicateOutput {
        guard let existing = try await storage.get(relation: "view", key: input.viewId) else {
            return .notfound(message: "View '\(input.viewId)' not found")
        }

        let newViewId = UUID().uuidString
        var copy = existing
        copy["id"] = newViewId
        let originalName = existing["name"] as? String ?? ""
        copy["name"] = "\(originalName) (copy)"
        try await storage.put(relation: "view", key: newViewId, value: copy)

        return .ok(newViewId: newViewId)
    }
}
