// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LwwTimestampResolverProvider
/// @notice Last-Write-Wins conflict resolution by on-chain timestamp comparison.
/// Always auto-resolves by selecting the version with the higher timestamp.
/// Simple but risks silent data loss when concurrent writes occur.
contract LwwTimestampResolverProvider {
    string public constant PROVIDER_ID = "lww_timestamp";
    string public constant PLUGIN_TYPE = "conflict_resolver";

    /// @notice Emitted when a conflict is resolved via LWW
    event ConflictResolved(
        bytes32 indexed conflictId,
        string winningVersion,
        uint256 winningTimestamp,
        uint256 losingTimestamp,
        uint256 marginMs
    );

    /// @notice Resolve a conflict between two versions using Last-Write-Wins semantics
    /// @param conflictId Unique identifier for the conflict
    /// @param versionA Serialized data for version A
    /// @param versionB Serialized data for version B
    /// @param timestampA Timestamp of version A in milliseconds
    /// @param timestampB Timestamp of version B in milliseconds
    /// @return winner The winning version's data
    /// @return strategy The resolution strategy used
    function resolve(
        bytes32 conflictId,
        string calldata versionA,
        string calldata versionB,
        uint256 timestampA,
        uint256 timestampB
    ) external pure returns (string memory winner, string memory strategy) {
        // Compare timestamps: version with higher (more recent) timestamp wins.
        // On tie, version A wins (deterministic tie-breaking).
        bool aWins = timestampA >= timestampB;

        if (aWins) {
            winner = versionA;
        } else {
            winner = versionB;
        }

        strategy = "lww_timestamp";
    }

    /// @notice Resolve and emit an event with resolution details (non-pure variant)
    /// @param conflictId Unique identifier for the conflict
    /// @param versionA Serialized data for version A
    /// @param versionB Serialized data for version B
    /// @param timestampA Timestamp of version A in milliseconds
    /// @param timestampB Timestamp of version B in milliseconds
    /// @return winner The winning version's data
    /// @return strategy The resolution strategy used
    function resolveWithEvent(
        bytes32 conflictId,
        string calldata versionA,
        string calldata versionB,
        uint256 timestampA,
        uint256 timestampB
    ) external returns (string memory winner, string memory strategy) {
        bool aWins = timestampA >= timestampB;

        uint256 winningTs;
        uint256 losingTs;
        string memory winningVersion;

        if (aWins) {
            winner = versionA;
            winningTs = timestampA;
            losingTs = timestampB;
            winningVersion = "A";
        } else {
            winner = versionB;
            winningTs = timestampB;
            losingTs = timestampA;
            winningVersion = "B";
        }

        uint256 margin = winningTs - losingTs;
        strategy = "lww_timestamp";

        emit ConflictResolved(
            conflictId,
            winningVersion,
            winningTs,
            losingTs,
            margin
        );
    }

    /// @notice LWW can always auto-resolve — no human intervention needed
    /// @param conflictId Unique identifier for the conflict (unused)
    /// @return True always, since LWW is fully deterministic
    function canAutoResolve(bytes32 conflictId) external pure returns (bool) {
        // Suppress unused parameter warning
        conflictId;
        return true;
    }
}
