// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Version
/// @notice Manages version history for entities with snapshot storage and rollback support.
contract Version {
    struct VersionEntry {
        string snapshotData;
        bytes32 author;
        uint256 timestamp;
        bool exists;
    }

    mapping(bytes32 => mapping(bytes32 => VersionEntry)) private _history; // entityId -> versionId
    mapping(bytes32 => bytes32[]) private _versionList; // entityId -> version IDs in order

    event Snapshot(bytes32 indexed entityId, bytes32 indexed versionId);
    event Rollback(bytes32 indexed entityId, bytes32 indexed versionId);

    /// @notice Creates a versioned snapshot of an entity.
    /// @param entityId The entity to snapshot.
    /// @param versionId Unique identifier for this version.
    /// @param snapshotData Serialised state data.
    /// @param author The author of the snapshot.
    function snapshot(
        bytes32 entityId,
        bytes32 versionId,
        string calldata snapshotData,
        bytes32 author
    ) external {
        require(!_history[entityId][versionId].exists, "Version already exists");

        _history[entityId][versionId] = VersionEntry({
            snapshotData: snapshotData,
            author: author,
            timestamp: block.timestamp,
            exists: true
        });

        _versionList[entityId].push(versionId);

        emit Snapshot(entityId, versionId);
    }

    /// @notice Retrieves a specific version entry.
    /// @param entityId The entity to look up.
    /// @param versionId The version to retrieve.
    /// @return The version entry struct.
    function getVersion(bytes32 entityId, bytes32 versionId) external view returns (VersionEntry memory) {
        require(_history[entityId][versionId].exists, "Version does not exist");
        return _history[entityId][versionId];
    }

    /// @notice Returns the number of versions for an entity.
    /// @param entityId The entity to query.
    /// @return The count of versions.
    function getVersionCount(bytes32 entityId) external view returns (uint256) {
        return _versionList[entityId].length;
    }

    /// @notice Retrieves the ordered list of version IDs for an entity.
    /// @param entityId The entity to query.
    /// @return Array of version IDs in chronological order.
    function getVersionList(bytes32 entityId) external view returns (bytes32[] memory) {
        return _versionList[entityId];
    }

    /// @notice Rolls back an entity to a specific version by emitting an event. The actual state restoration is handled off-chain.
    /// @param entityId The entity to roll back.
    /// @param versionId The version to roll back to.
    function rollback(bytes32 entityId, bytes32 versionId) external {
        require(_history[entityId][versionId].exists, "Version does not exist");

        emit Rollback(entityId, versionId);
    }
}
