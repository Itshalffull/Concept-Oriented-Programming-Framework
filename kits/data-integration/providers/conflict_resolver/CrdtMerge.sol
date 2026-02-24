// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CrdtMergeResolverProvider
/// @notice CRDT-based conflict-free merge resolver for on-chain data.
/// Implements LWW-Register and G-Counter merge logic. Always auto-resolves
/// mathematically — convergence is guaranteed by CRDT properties.
contract CrdtMergeResolverProvider {
    string public constant PROVIDER_ID = "crdt_merge";
    string public constant PLUGIN_TYPE = "conflict_resolver";

    /// @notice Emitted when a CRDT merge is performed
    event CrdtMergeResolved(
        bytes32 indexed conflictId,
        string strategy,
        string mergeType
    );

    /// @notice Resolve a conflict using CRDT merge semantics
    /// @dev For string/opaque data, applies LWW-Register using timestamps.
    /// @param conflictId Unique identifier for the conflict
    /// @param versionA Serialized data for version A
    /// @param versionB Serialized data for version B
    /// @param timestampA Timestamp of version A in milliseconds
    /// @param timestampB Timestamp of version B in milliseconds
    /// @return winner The merged version's data
    /// @return strategy The resolution strategy used
    function resolve(
        bytes32 conflictId,
        string calldata versionA,
        string calldata versionB,
        uint256 timestampA,
        uint256 timestampB
    ) external pure returns (string memory winner, string memory strategy) {
        // For opaque string data, apply LWW-Register semantics:
        // the version with the higher timestamp wins deterministically.
        conflictId; // suppress unused warning

        if (timestampA >= timestampB) {
            winner = versionA;
        } else {
            winner = versionB;
        }

        strategy = "crdt_merge";
    }

    /// @notice Merge two G-Counter values by taking the maximum
    /// @dev G-Counters are monotonically increasing; max is the correct merge.
    /// @param counterA Counter value from replica A
    /// @param counterB Counter value from replica B
    /// @return merged The merged counter value (max of the two)
    function mergeGCounter(
        uint256 counterA,
        uint256 counterB
    ) external pure returns (uint256 merged) {
        merged = counterA >= counterB ? counterA : counterB;
    }

    /// @notice Merge two G-Counter vectors by taking element-wise max
    /// @dev Each element in the vector represents a different actor's count.
    /// @param vectorA Counter vector from replica A
    /// @param vectorB Counter vector from replica B
    /// @return merged The merged counter vector
    function mergeGCounterVector(
        uint256[] calldata vectorA,
        uint256[] calldata vectorB
    ) external pure returns (uint256[] memory merged) {
        uint256 maxLen = vectorA.length >= vectorB.length
            ? vectorA.length
            : vectorB.length;
        merged = new uint256[](maxLen);

        for (uint256 i = 0; i < maxLen; i++) {
            uint256 valA = i < vectorA.length ? vectorA[i] : 0;
            uint256 valB = i < vectorB.length ? vectorB[i] : 0;
            merged[i] = valA >= valB ? valA : valB;
        }
    }

    /// @notice Resolve using LWW-Register semantics for a single field
    /// @param valueA The value from replica A
    /// @param valueB The value from replica B
    /// @param timestampA Timestamp when replica A wrote
    /// @param timestampB Timestamp when replica B wrote
    /// @return winner The winning value
    /// @return source Which replica won ("A" or "B")
    function mergeLwwRegister(
        string calldata valueA,
        string calldata valueB,
        uint256 timestampA,
        uint256 timestampB
    ) external pure returns (string memory winner, string memory source) {
        if (timestampA >= timestampB) {
            winner = valueA;
            source = "A";
        } else {
            winner = valueB;
            source = "B";
        }
    }

    /// @notice Merge two PN-Counter values (positive - negative)
    /// @dev Each PN-Counter is represented as (positive, negative) pair.
    ///      Merge takes max of each component independently.
    /// @param posA Positive counter from replica A
    /// @param negA Negative counter from replica A
    /// @param posB Positive counter from replica B
    /// @param negB Negative counter from replica B
    /// @return mergedPos The merged positive counter
    /// @return mergedNeg The merged negative counter
    /// @return netValue The net counter value (pos - neg)
    function mergePnCounter(
        uint256 posA,
        uint256 negA,
        uint256 posB,
        uint256 negB
    ) external pure returns (uint256 mergedPos, uint256 mergedNeg, int256 netValue) {
        mergedPos = posA >= posB ? posA : posB;
        mergedNeg = negA >= negB ? negA : negB;
        netValue = int256(mergedPos) - int256(mergedNeg);
    }

    /// @notice CRDT merges are always conflict-free by mathematical guarantee
    /// @param conflictId Unique identifier for the conflict (unused)
    /// @return True always, since CRDTs guarantee convergence
    function canAutoResolve(bytes32 conflictId) external pure returns (bool) {
        conflictId; // suppress unused warning
        return true;
    }
}
