// NamespaceImpl.swift — Namespace concept implementation

import Foundation

// MARK: - Types

public struct NamespaceCreateNamespacedPageInput: Codable {
    public let fullPath: String

    public init(fullPath: String) {
        self.fullPath = fullPath
    }
}

public enum NamespaceCreateNamespacedPageOutput: Codable {
    case ok(pageId: String, parentId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case pageId
        case parentId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                pageId: try container.decode(String.self, forKey: .pageId),
                parentId: try container.decode(String.self, forKey: .parentId)
            )
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let pageId, let parentId):
            try container.encode("ok", forKey: .variant)
            try container.encode(pageId, forKey: .pageId)
            try container.encode(parentId, forKey: .parentId)
        }
    }
}

public struct NamespaceGetChildrenInput: Codable {
    public let pageId: String

    public init(pageId: String) {
        self.pageId = pageId
    }
}

public enum NamespaceGetChildrenOutput: Codable {
    case ok(pageId: String, children: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case pageId
        case children
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                pageId: try container.decode(String.self, forKey: .pageId),
                children: try container.decode(String.self, forKey: .children)
            )
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let pageId, let children):
            try container.encode("ok", forKey: .variant)
            try container.encode(pageId, forKey: .pageId)
            try container.encode(children, forKey: .children)
        }
    }
}

public struct NamespaceGetHierarchyInput: Codable {
    public let pageId: String

    public init(pageId: String) {
        self.pageId = pageId
    }
}

public enum NamespaceGetHierarchyOutput: Codable {
    case ok(pageId: String, ancestors: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case pageId
        case ancestors
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                pageId: try container.decode(String.self, forKey: .pageId),
                ancestors: try container.decode(String.self, forKey: .ancestors)
            )
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let pageId, let ancestors):
            try container.encode("ok", forKey: .variant)
            try container.encode(pageId, forKey: .pageId)
            try container.encode(ancestors, forKey: .ancestors)
        }
    }
}

public struct NamespaceMovePageInput: Codable {
    public let pageId: String
    public let newParentPath: String

    public init(pageId: String, newParentPath: String) {
        self.pageId = pageId
        self.newParentPath = newParentPath
    }
}

public enum NamespaceMovePageOutput: Codable {
    case ok(pageId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case pageId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(pageId: try container.decode(String.self, forKey: .pageId))
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
        case .ok(let pageId):
            try container.encode("ok", forKey: .variant)
            try container.encode(pageId, forKey: .pageId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol NamespaceHandler {
    func createNamespacedPage(input: NamespaceCreateNamespacedPageInput, storage: ConceptStorage) async throws -> NamespaceCreateNamespacedPageOutput
    func getChildren(input: NamespaceGetChildrenInput, storage: ConceptStorage) async throws -> NamespaceGetChildrenOutput
    func getHierarchy(input: NamespaceGetHierarchyInput, storage: ConceptStorage) async throws -> NamespaceGetHierarchyOutput
    func movePage(input: NamespaceMovePageInput, storage: ConceptStorage) async throws -> NamespaceMovePageOutput
}

// MARK: - Implementation

public struct NamespaceHandlerImpl: NamespaceHandler {
    public init() {}

    public func createNamespacedPage(
        input: NamespaceCreateNamespacedPageInput,
        storage: ConceptStorage
    ) async throws -> NamespaceCreateNamespacedPageOutput {
        let pageId = UUID().uuidString
        let segments = input.fullPath.split(separator: "/").map(String.init)
        let pageName = segments.last ?? input.fullPath

        // Find or create parent
        var parentId = ""
        if segments.count > 1 {
            let parentPath = segments.dropLast().joined(separator: "/")
            let allPages = try await storage.find(relation: "namespace_page", criteria: nil)
            for page in allPages {
                if let path = page["fullPath"] as? String, path == parentPath {
                    parentId = page["id"] as? String ?? ""
                    break
                }
            }
        }

        try await storage.put(
            relation: "namespace_page",
            key: pageId,
            value: [
                "id": pageId,
                "name": pageName,
                "fullPath": input.fullPath,
                "parentId": parentId,
            ]
        )

        return .ok(pageId: pageId, parentId: parentId)
    }

    public func getChildren(
        input: NamespaceGetChildrenInput,
        storage: ConceptStorage
    ) async throws -> NamespaceGetChildrenOutput {
        let children = try await storage.find(
            relation: "namespace_page",
            criteria: ["parentId": input.pageId]
        )

        let childIds = children.compactMap { $0["id"] as? String }
        let jsonData = try JSONSerialization.data(withJSONObject: childIds, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        return .ok(pageId: input.pageId, children: jsonString)
    }

    public func getHierarchy(
        input: NamespaceGetHierarchyInput,
        storage: ConceptStorage
    ) async throws -> NamespaceGetHierarchyOutput {
        var ancestors: [String] = []
        var currentId = input.pageId

        while true {
            guard let page = try await storage.get(relation: "namespace_page", key: currentId) else {
                break
            }
            let parentId = page["parentId"] as? String ?? ""
            if parentId.isEmpty {
                break
            }
            ancestors.insert(parentId, at: 0)
            currentId = parentId
        }

        let jsonData = try JSONSerialization.data(withJSONObject: ancestors, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        return .ok(pageId: input.pageId, ancestors: jsonString)
    }

    public func movePage(
        input: NamespaceMovePageInput,
        storage: ConceptStorage
    ) async throws -> NamespaceMovePageOutput {
        guard let existing = try await storage.get(relation: "namespace_page", key: input.pageId) else {
            return .notfound(message: "Page '\(input.pageId)' not found")
        }

        let pageName = existing["name"] as? String ?? ""

        // Find new parent by path
        var newParentId = ""
        if !input.newParentPath.isEmpty {
            let allPages = try await storage.find(relation: "namespace_page", criteria: nil)
            for page in allPages {
                if let path = page["fullPath"] as? String, path == input.newParentPath {
                    newParentId = page["id"] as? String ?? ""
                    break
                }
            }
        }

        let newFullPath = input.newParentPath.isEmpty ? pageName : "\(input.newParentPath)/\(pageName)"

        var updated = existing
        updated["parentId"] = newParentId
        updated["fullPath"] = newFullPath
        try await storage.put(relation: "namespace_page", key: input.pageId, value: updated)

        return .ok(pageId: input.pageId)
    }
}
