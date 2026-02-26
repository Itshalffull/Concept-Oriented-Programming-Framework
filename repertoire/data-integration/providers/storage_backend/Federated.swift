// Federated.swift — storage_backend provider
// Decorator-pattern storage that routes field reads/writes to either a remote backend
// (via Connector + FieldMapping + Cache through EventBus dispatch) or the local SQL
// backend, based on per-field configuration in the Schema's federation_config.

import Foundation

public let federatedProviderId = "federated"
public let federatedPluginType = "storage_backend"

// MARK: - Domain Types

public struct ContentNode {
    public var id: String
    public var type: String
    public var fields: [String: Any]
    public var metadata: [String: Any]?

    public init(id: String, type: String, fields: [String: Any], metadata: [String: Any]? = nil) {
        self.id = id
        self.type = type
        self.fields = fields
        self.metadata = metadata
    }
}

public struct FederationConfig {
    public let source: String
    public let fieldMapping: String?
    public let cacheTtl: Int
    public let readOnlyRemote: Bool
    public let localFields: [String]

    public init(source: String, fieldMapping: String?, cacheTtl: Int, readOnlyRemote: Bool, localFields: [String]) {
        self.source = source
        self.fieldMapping = fieldMapping
        self.cacheTtl = cacheTtl
        self.readOnlyRemote = readOnlyRemote
        self.localFields = localFields
    }
}

public struct SchemaAssociations {
    public let storageBackend: String
    public let providers: [String: String]
    public let federationConfig: FederationConfig
}

public struct FieldDef {
    public let name: String
    public let type: String
    public let required: Bool?
}

public struct SchemaRef {
    public let name: String
    public let fields: [FieldDef]
    public let associations: SchemaAssociations
}

public struct SaveResult {
    public let id: String
    public let created: Bool
}

public struct DeleteResult {
    public let deleted: Bool
}

public struct QueryCondition {
    public let field: String
    public let `operator`: String
    public let value: Any
}

public struct SortSpec {
    public let field: String
    public let direction: String  // "asc" or "desc"
}

public struct RangeSpec {
    public let offset: Int
    public let limit: Int
}

// MARK: - Error

public enum FederatedStorageError: Error {
    case localBackendError(String)
    case remoteError(String)
    case cacheError(String)
}

// MARK: - Dependency Protocols (injected)

public protocol LocalStorageBackend {
    func save(node: ContentNode, schema: SchemaRef) async throws -> SaveResult
    func load(id: String, schema: SchemaRef) async throws -> ContentNode?
    func loadMultiple(ids: [String], schema: SchemaRef) async throws -> [ContentNode]
    func delete(id: String, schema: SchemaRef) async throws -> DeleteResult
    func query(conditions: [QueryCondition], sorts: [SortSpec], range: RangeSpec, schema: SchemaRef) async throws -> [ContentNode]
}

public protocol EventBus {
    func dispatch(event: String, payload: [String: Any]) async throws -> [String: Any]
}

// MARK: - Cache Entry

private struct CacheEntry {
    let data: [String: Any]
    let expiresAt: TimeInterval
}

// MARK: - Helpers

private func cacheKey(schemaName: String, id: String) -> String {
    return "\(schemaName):\(id)"
}

private func partitionFields(
    fields: [String: Any],
    localFieldNames: [String]
) -> (local: [String: Any], remote: [String: Any]) {
    var local: [String: Any] = [:]
    var remote: [String: Any] = [:]
    for (key, value) in fields {
        if localFieldNames.contains(key) {
            local[key] = value
        } else {
            remote[key] = value
        }
    }
    return (local, remote)
}

private func matchesCondition(value: Any?, operator op: String, target: Any?) -> Bool {
    switch op {
    case "eq":
        return areEqual(value, target)
    case "neq":
        return !areEqual(value, target)
    case "gt":
        return asDouble(value) > asDouble(target)
    case "gte":
        return asDouble(value) >= asDouble(target)
    case "lt":
        return asDouble(value) < asDouble(target)
    case "lte":
        return asDouble(value) <= asDouble(target)
    case "contains":
        if let haystack = value as? String, let needle = target as? String {
            return haystack.contains(needle)
        }
        return false
    case "in":
        if let arr = target as? [Any] {
            return arr.contains { areEqual($0, value) }
        }
        return false
    default:
        return false
    }
}

private func areEqual(_ a: Any?, _ b: Any?) -> Bool {
    switch (a, b) {
    case (nil, nil): return true
    case (nil, _), (_, nil): return false
    case (let a as String, let b as String): return a == b
    case (let a as Int, let b as Int): return a == b
    case (let a as Double, let b as Double): return a == b
    case (let a as Bool, let b as Bool): return a == b
    default: return false
    }
}

private func asDouble(_ value: Any?) -> Double {
    switch value {
    case let v as Double: return v
    case let v as Int: return Double(v)
    case let v as Float: return Double(v)
    case let v as String: return Double(v) ?? 0.0
    default: return 0.0
    }
}

private func applySorts(_ nodes: [ContentNode], sorts: [SortSpec]) -> [ContentNode] {
    guard !sorts.isEmpty else { return nodes }
    return nodes.sorted { a, b in
        for sort in sorts {
            let aVal = a.fields[sort.field]
            let bVal = b.fields[sort.field]

            let aDouble = asDouble(aVal)
            let bDouble = asDouble(bVal)

            if aDouble != bDouble {
                return sort.direction == "asc" ? aDouble < bDouble : aDouble > bDouble
            }

            // Fall back to string comparison for non-numeric values
            let aStr = (aVal as? String) ?? ""
            let bStr = (bVal as? String) ?? ""
            if aStr != bStr {
                return sort.direction == "asc" ? aStr < bStr : aStr > bStr
            }
        }
        return false
    }
}

// MARK: - Provider Implementation

public final class FederatedStorageProvider {
    private let localBackend: LocalStorageBackend
    private let eventBus: EventBus
    private var cache: [String: CacheEntry] = [:]
    private let cacheLock = NSLock()

    public init(localBackend: LocalStorageBackend, eventBus: EventBus) {
        self.localBackend = localBackend
        self.eventBus = eventBus
    }

    private func getCached(key: String) -> [String: Any]? {
        cacheLock.lock()
        defer { cacheLock.unlock() }
        guard let entry = cache[key] else { return nil }
        if Date().timeIntervalSince1970 > entry.expiresAt {
            cache.removeValue(forKey: key)
            return nil
        }
        return entry.data
    }

    private func setCache(key: String, data: [String: Any], ttlSeconds: Int) {
        cacheLock.lock()
        defer { cacheLock.unlock() }
        cache[key] = CacheEntry(
            data: data,
            expiresAt: Date().timeIntervalSince1970 + Double(ttlSeconds)
        )
    }

    private func removeCache(key: String) {
        cacheLock.lock()
        defer { cacheLock.unlock() }
        cache.removeValue(forKey: key)
    }

    private func loadRemoteFields(
        id: String,
        schema: SchemaRef,
        config: FederationConfig
    ) async throws -> [String: Any] {
        let key = cacheKey(schemaName: schema.name, id: id)
        if let cached = getCached(key: key) {
            return cached
        }

        // Dispatch federated.load_remote through EventBus to trigger
        // Connector.read followed by FieldMapping.apply
        let payload: [String: Any] = [
            "id": id,
            "source": config.source,
            "fieldMapping": config.fieldMapping as Any,
            "schemaName": schema.name
        ]
        let result = try await eventBus.dispatch(event: "federated.load_remote", payload: payload)

        let remoteData: [String: Any]
        if let fields = result["fields"] as? [String: Any] {
            remoteData = fields
        } else {
            remoteData = result
        }

        setCache(key: key, data: remoteData, ttlSeconds: config.cacheTtl)
        return remoteData
    }

    private func saveRemoteFields(
        id: String,
        remoteFields: [String: Any],
        config: FederationConfig
    ) async throws {
        // Dispatch federated.save_remote through EventBus to trigger
        // FieldMapping.reverse followed by Connector.write
        let payload: [String: Any] = [
            "id": id,
            "fields": remoteFields,
            "source": config.source,
            "fieldMapping": config.fieldMapping as Any
        ]
        _ = try await eventBus.dispatch(event: "federated.save_remote", payload: payload)

        // Invalidate cache after remote write so next read picks up fresh data
        removeCache(key: cacheKey(schemaName: config.source, id: id))
    }

    // MARK: - Public Interface

    public func load(id: String, schema: SchemaRef) async throws -> ContentNode? {
        let config = schema.associations.federationConfig

        // Load remote fields (cache-first, then EventBus dispatch on miss)
        let remoteFields = try await loadRemoteFields(id: id, schema: schema, config: config)

        // Load local fields from SQL backend
        let localNode = try await localBackend.load(id: id, schema: schema)

        // If neither remote nor local has data, the entity does not exist
        if localNode == nil && remoteFields.isEmpty {
            return nil
        }

        // Merge: remote fields as the base, local fields overlay
        var mergedFields = remoteFields
        if let local = localNode {
            for (key, value) in local.fields {
                if config.localFields.contains(key) {
                    mergedFields[key] = value
                }
            }
        }

        var metadata: [String: Any] = localNode?.metadata ?? [:]
        metadata["federated"] = true
        metadata["source"] = config.source

        return ContentNode(
            id: id,
            type: localNode?.type ?? schema.name,
            fields: mergedFields,
            metadata: metadata
        )
    }

    public func save(node: ContentNode, schema: SchemaRef) async throws -> SaveResult {
        let config = schema.associations.federationConfig
        let (localFields, remoteFields) = partitionFields(fields: node.fields, localFieldNames: config.localFields)

        // Always persist local fields to the SQL backend
        let localNode = ContentNode(
            id: node.id,
            type: node.type,
            fields: localFields,
            metadata: node.metadata
        )
        let result = try await localBackend.save(node: localNode, schema: schema)

        // Write remote fields only when the remote source is writable
        if !config.readOnlyRemote && !remoteFields.isEmpty {
            try await saveRemoteFields(id: node.id, remoteFields: remoteFields, config: config)
        }

        return result
    }

    public func loadMultiple(ids: [String], schema: SchemaRef) async throws -> [ContentNode] {
        let config = schema.associations.federationConfig

        // Partition IDs into cache-hits and cache-misses for remote data
        var remoteDataMap: [String: [String: Any]] = [:]
        var missedIds: [String] = []

        for id in ids {
            let key = cacheKey(schemaName: schema.name, id: id)
            if let cached = getCached(key: key) {
                remoteDataMap[id] = cached
            } else {
                missedIds.append(id)
            }
        }

        // Batch-fetch remote data for all cache misses via EventBus
        if !missedIds.isEmpty {
            let payload: [String: Any] = [
                "ids": missedIds,
                "source": config.source,
                "fieldMapping": config.fieldMapping as Any,
                "schemaName": schema.name
            ]
            let batchResult = try await eventBus.dispatch(event: "federated.load_remote_batch", payload: payload)

            let batchRecords = (batchResult["records"] as? [String: [String: Any]]) ?? [:]
            for id in missedIds {
                let remoteData = batchRecords[id] ?? [:]
                setCache(key: cacheKey(schemaName: schema.name, id: id), data: remoteData, ttlSeconds: config.cacheTtl)
                remoteDataMap[id] = remoteData
            }
        }

        // Load all local fields in a single SQL query
        let localNodes = try await localBackend.loadMultiple(ids: ids, schema: schema)
        var localMap: [String: ContentNode] = [:]
        for node in localNodes {
            localMap[node.id] = node
        }

        // Merge per-ID
        var results: [ContentNode] = []
        for id in ids {
            let remoteFields = remoteDataMap[id] ?? [:]
            let localNode = localMap[id]

            if localNode == nil && remoteFields.isEmpty { continue }

            var mergedFields = remoteFields
            if let local = localNode {
                for (key, value) in local.fields {
                    if config.localFields.contains(key) {
                        mergedFields[key] = value
                    }
                }
            }

            var metadata: [String: Any] = localNode?.metadata ?? [:]
            metadata["federated"] = true
            metadata["source"] = config.source

            results.append(ContentNode(
                id: id,
                type: localNode?.type ?? schema.name,
                fields: mergedFields,
                metadata: metadata
            ))
        }

        return results
    }

    public func delete(id: String, schema: SchemaRef) async throws -> DeleteResult {
        let config = schema.associations.federationConfig

        // Always delete local data from the SQL backend
        let localResult = try await localBackend.delete(id: id, schema: schema)

        // Evict from cache
        removeCache(key: cacheKey(schemaName: schema.name, id: id))

        // If remote is writable, dispatch remote delete
        if !config.readOnlyRemote {
            let payload: [String: Any] = [
                "id": id,
                "source": config.source,
                "schemaName": schema.name
            ]
            _ = try await eventBus.dispatch(event: "federated.delete_remote", payload: payload)
        }

        return localResult
    }

    public func query(
        conditions: [QueryCondition],
        sorts: [SortSpec],
        range: RangeSpec,
        schema: SchemaRef
    ) async throws -> [ContentNode] {
        let config = schema.associations.federationConfig

        // Determine whether the query touches any remote fields
        let touchesRemote = conditions.contains { !config.localFields.contains($0.field) }

        if !touchesRemote {
            // Pure local query: delegate entirely to the SQL backend
            return try await localBackend.query(conditions: conditions, sorts: sorts, range: range, schema: schema)
        }

        // Mixed or remote query: split conditions, load candidates, filter in memory
        let localConditions = conditions.filter { config.localFields.contains($0.field) }
        let remoteConditions = conditions.filter { !config.localFields.contains($0.field) }

        // Fetch local candidates (apply only local conditions to narrow set)
        let unlimitedRange = RangeSpec(offset: 0, limit: Int.max)
        let localCandidates = try await localBackend.query(
            conditions: localConditions,
            sorts: [],
            range: unlimitedRange,
            schema: schema
        )

        // Load remote fields for each candidate and merge
        var merged: [ContentNode] = []
        for candidate in localCandidates {
            let remoteFields = try await loadRemoteFields(id: candidate.id, schema: schema, config: config)
            var mergedFields = remoteFields
            for (key, value) in candidate.fields {
                if config.localFields.contains(key) {
                    mergedFields[key] = value
                }
            }

            // Apply remote conditions in memory
            let passesRemote = remoteConditions.allSatisfy { cond in
                matchesCondition(value: mergedFields[cond.field], operator: cond.operator, target: cond.value)
            }
            if !passesRemote { continue }

            var metadata: [String: Any] = candidate.metadata ?? [:]
            metadata["federated"] = true
            metadata["source"] = config.source

            merged.append(ContentNode(
                id: candidate.id,
                type: candidate.type,
                fields: mergedFields,
                metadata: metadata
            ))
        }

        // Apply sorting on the full merged set
        let sorted = applySorts(merged, sorts: sorts)

        // Apply range (offset + limit)
        let start = min(range.offset, sorted.count)
        let end = min(range.offset + range.limit, sorted.count)
        return Array(sorted[start..<end])
    }

    /// Remove all expired entries from the in-memory cache.
    public func pruneCache() -> Int {
        cacheLock.lock()
        defer { cacheLock.unlock() }
        let now = Date().timeIntervalSince1970
        var pruned = 0
        for (key, entry) in cache {
            if now > entry.expiresAt {
                cache.removeValue(forKey: key)
                pruned += 1
            }
        }
        return pruned
    }

    /// Invalidate a specific cached entity or the entire cache.
    public func invalidateCache(id: String? = nil, schemaName: String? = nil) {
        cacheLock.lock()
        defer { cacheLock.unlock() }
        if let id = id, let schemaName = schemaName {
            cache.removeValue(forKey: cacheKey(schemaName: schemaName, id: id))
        } else {
            cache.removeAll()
        }
    }
}
