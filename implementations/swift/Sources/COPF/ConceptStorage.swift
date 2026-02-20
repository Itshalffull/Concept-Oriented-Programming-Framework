// ConceptStorage.swift — Storage protocol and in-memory implementation

import Foundation

public protocol ConceptStorage: Sendable {
    func put(relation: String, key: String, value: [String: Any]) async throws
    func get(relation: String, key: String) async throws -> [String: Any]?
    func find(relation: String, criteria: [String: Any]?) async throws -> [[String: Any]]
    func del(relation: String, key: String) async throws
    func delMany(relation: String, criteria: [String: Any]) async throws -> Int
}

public actor InMemoryStorage: ConceptStorage {
    private var data: [String: [String: [String: Any]]] = [:]

    public init() {}

    public func put(relation: String, key: String, value: [String: Any]) async throws {
        if data[relation] == nil { data[relation] = [:] }
        data[relation]![key] = value
    }

    public func get(relation: String, key: String) async throws -> [String: Any]? {
        return data[relation]?[key]
    }

    public func find(relation: String, criteria: [String: Any]?) async throws -> [[String: Any]] {
        guard let rel = data[relation] else { return [] }
        let entries = Array(rel.values)
        guard let criteria = criteria else { return entries }
        return entries.filter { entry in
            criteria.allSatisfy { key, value in
                guard let entryVal = entry[key] else { return false }
                return "\(entryVal)" == "\(value)"
            }
        }
    }

    public func del(relation: String, key: String) async throws {
        data[relation]?.removeValue(forKey: key)
    }

    public func delMany(relation: String, criteria: [String: Any]) async throws -> Int {
        guard let rel = data[relation] else { return 0 }
        var count = 0
        let keysToRemove = rel.filter { _, entry in
            criteria.allSatisfy { key, value in
                guard let entryVal = entry[key] else { return false }
                return "\(entryVal)" == "\(value)"
            }
        }.map { $0.key }
        for key in keysToRemove {
            data[relation]?.removeValue(forKey: key)
            count += 1
        }
        return count
    }
}
