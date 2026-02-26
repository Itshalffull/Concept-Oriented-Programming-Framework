// Last-Write-Wins conflict resolution by timestamp comparison
// Always auto-resolves by selecting the version with the most recent timestamp.
// Simple but risks silent data loss when concurrent writes occur.

import Foundation

public struct Conflict {
    public let entityId: String
    public let versionA: [String: Any]
    public let versionB: [String: Any]
    public let ancestor: [String: Any]?
    public let fieldConflicts: [String]
    public let timestampA: UInt64?
    public let timestampB: UInt64?
}

public struct ResolverConfig {
    public let options: [String: Any]
}

public struct Resolution {
    public let winner: [String: Any]
    public let strategy: String
    public let details: [String: Any]
}

public enum ResolverError: Error {
    case missingTimestamp(String)
}

public let providerID = "lww_timestamp"
public let pluginType = "conflict_resolver"

public final class LwwTimestampResolverProvider {
    public init() {}

    public func resolve(conflict: Conflict, config: ResolverConfig) throws -> Resolution {
        let tsA = conflict.timestampA ?? 0
        let tsB = conflict.timestampB ?? 0

        let aWins = tsA >= tsB
        let winner = aWins ? conflict.versionA : conflict.versionB
        let winningTimestamp = aWins ? tsA : tsB
        let losingTimestamp = aWins ? tsB : tsA
        let margin: UInt64 = tsA > tsB ? tsA - tsB : tsB - tsA

        return Resolution(
            winner: winner,
            strategy: "lww_timestamp",
            details: [
                "winningVersion": aWins ? "A" : "B",
                "winningTimestamp": winningTimestamp,
                "losingTimestamp": losingTimestamp,
                "marginMs": margin,
                "entityId": conflict.entityId,
                "fieldsOverwritten": conflict.fieldConflicts,
                "silentDataLossRisk": !conflict.fieldConflicts.isEmpty,
            ]
        )
    }

    public func canAutoResolve(conflict: Conflict) -> Bool {
        return true
    }
}
