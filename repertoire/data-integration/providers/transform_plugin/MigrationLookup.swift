// Transform Plugin Provider: migration_lookup
// Resolve IDs from Provenance batch map table for referential integrity.
// See Architecture doc for transform plugin interface contract.

import Foundation

public struct ProvenanceMapEntry {
    public let sourceId: String
    public let destId: String
    public let entityType: String
    public let batchId: String

    public init(sourceId: String, destId: String, entityType: String, batchId: String) {
        self.sourceId = sourceId
        self.destId = destId
        self.entityType = entityType
        self.batchId = batchId
    }
}

public final class MigrationLookupTransformProvider {
    public static let providerId = "migration_lookup"
    public static let pluginType = "transform_plugin"

    private var provenanceMap: [String: ProvenanceMapEntry] = [:]

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        if value is NSNull {
            let required = (config.options["required"] as? Bool) ?? true
            if required {
                throw TransformError.invalidCast("Migration lookup received null for required field")
            }
            return NSNull()
        }

        let sourceId = String(describing: value)
        let entityType = (config.options["entityType"] as? String) ?? ""
        let batchId = config.options["batchId"] as? String
        let fallback = (config.options["fallback"] as? String) ?? "error"

        // Look up with batch ID first, then without
        let keyWithBatch = batchId.map { buildLookupKey(sourceId: sourceId, entityType: entityType, batchId: $0) }
        let keyWithout = buildLookupKey(sourceId: sourceId, entityType: entityType)

        let entry: ProvenanceMapEntry?
        if let kwb = keyWithBatch, let e = provenanceMap[kwb] {
            entry = e
        } else {
            entry = provenanceMap[keyWithout]
        }

        if let e = entry {
            return e.destId
        }

        // Check inline map
        if let inlineMap = config.options["map"] as? [String: String],
           let mapped = inlineMap[sourceId] {
            return mapped
        }

        // Handle unresolved
        switch fallback {
        case "null":
            return NSNull()
        case "passthrough":
            return sourceId
        case "placeholder":
            let placeholder = (config.options["placeholder"] as? String)
                ?? "__unresolved:\(entityType):\(sourceId)"
            return placeholder
        default:
            let batchInfo = batchId.map { ", batch: \($0)" } ?? ""
            throw TransformError.invalidCast(
                "No destination ID found for source \"\(sourceId)\" (entity: \(entityType)\(batchInfo))"
            )
        }
    }

    public func loadProvenanceMap(entries: [ProvenanceMapEntry]) {
        provenanceMap.removeAll()
        for entry in entries {
            let keyWith = buildLookupKey(sourceId: entry.sourceId, entityType: entry.entityType, batchId: entry.batchId)
            let keyWithout = buildLookupKey(sourceId: entry.sourceId, entityType: entry.entityType)
            provenanceMap[keyWith] = entry
            provenanceMap[keyWithout] = entry
        }
    }

    private func buildLookupKey(sourceId: String, entityType: String, batchId: String? = nil) -> String {
        if let bid = batchId {
            return "\(entityType)::\(sourceId)::\(bid)"
        }
        return "\(entityType)::\(sourceId)"
    }

    public func inputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }

    public func outputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }
}
