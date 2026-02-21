// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Backlink
/// @notice Concept-oriented reverse-link index tracking which entities reference a given target
/// @dev Implements the Backlink concept from COPF specification.
///      Maintains an inverted index of source -> target relationships for efficient backlink queries.

contract Backlink {
    // --- Storage ---

    /// @dev Maps target ID -> list of source IDs that reference it
    mapping(bytes32 => bytes32[]) private _backlinks;

    /// @dev Maps target ID -> source ID -> whether the backlink exists (for deduplication)
    mapping(bytes32 => mapping(bytes32 => bool)) private _backlinkExists;

    // --- Events ---

    event Indexed(bytes32 indexed targetId, bytes32 sourceId);
    event Removed(bytes32 indexed targetId, bytes32 sourceId);

    // --- Actions ---

    /// @notice Index a backlink from source to target
    /// @param targetId The entity being referenced
    /// @param sourceId The entity that contains the reference
    function index(bytes32 targetId, bytes32 sourceId) external {
        require(targetId != bytes32(0), "Target ID cannot be zero");
        require(sourceId != bytes32(0), "Source ID cannot be zero");
        require(!_backlinkExists[targetId][sourceId], "Backlink already indexed");

        _backlinkExists[targetId][sourceId] = true;
        _backlinks[targetId].push(sourceId);

        emit Indexed(targetId, sourceId);
    }

    /// @notice Remove a backlink
    /// @param targetId The entity being referenced
    /// @param sourceId The entity that contained the reference
    function remove(bytes32 targetId, bytes32 sourceId) external {
        require(_backlinkExists[targetId][sourceId], "Backlink not found");

        _backlinkExists[targetId][sourceId] = false;

        // Remove from array using swap-and-pop
        bytes32[] storage sources = _backlinks[targetId];
        uint256 len = sources.length;
        for (uint256 i = 0; i < len; i++) {
            if (sources[i] == sourceId) {
                if (i != len - 1) {
                    sources[i] = sources[len - 1];
                }
                sources.pop();
                break;
            }
        }

        emit Removed(targetId, sourceId);
    }

    // --- View ---

    /// @notice Get all backlinks (source entities) for a target
    /// @param entityId The target entity
    /// @return Array of source entity IDs that reference the target
    function getBacklinks(bytes32 entityId) external view returns (bytes32[] memory) {
        return _backlinks[entityId];
    }

    /// @notice Get the number of backlinks for a target
    /// @param entityId The target entity
    /// @return The number of entities referencing the target
    function count(bytes32 entityId) external view returns (uint256) {
        return _backlinks[entityId].length;
    }
}
