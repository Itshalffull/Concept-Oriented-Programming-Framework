// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Reference
/// @notice Concept-oriented typed reference links between entities
/// @dev Implements the Reference concept from Clef specification.
///      Supports adding, removing, querying, and existence-checking of typed references.

contract Reference {
    // --- Types ---

    struct Ref {
        bytes32 targetId;
        string refType;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps source ID -> target ID -> reference data
    mapping(bytes32 => mapping(bytes32 => Ref)) private _refs;

    /// @dev Maps source ID -> list of target IDs (for enumeration)
    mapping(bytes32 => bytes32[]) private _refTargets;

    // --- Events ---

    event RefAdded(bytes32 indexed sourceId, bytes32 indexed targetId, string refType);
    event RefRemoved(bytes32 indexed sourceId, bytes32 indexed targetId);

    // --- Actions ---

    /// @notice Add a typed reference from source to target
    /// @param sourceId The source entity
    /// @param targetId The target entity
    /// @param refType The type of reference (e.g., "link", "embed", "mention")
    function addRef(bytes32 sourceId, bytes32 targetId, string calldata refType) external {
        require(sourceId != bytes32(0), "Source ID cannot be zero");
        require(targetId != bytes32(0), "Target ID cannot be zero");
        require(!_refs[sourceId][targetId].exists, "Reference already exists");

        _refs[sourceId][targetId] = Ref({
            targetId: targetId,
            refType: refType,
            exists: true
        });

        _refTargets[sourceId].push(targetId);

        emit RefAdded(sourceId, targetId, refType);
    }

    /// @notice Remove a reference from source to target
    /// @param sourceId The source entity
    /// @param targetId The target entity
    function removeRef(bytes32 sourceId, bytes32 targetId) external {
        require(_refs[sourceId][targetId].exists, "Reference not found");

        delete _refs[sourceId][targetId];

        // Remove from targets array
        bytes32[] storage targets = _refTargets[sourceId];
        uint256 len = targets.length;
        for (uint256 i = 0; i < len; i++) {
            if (targets[i] == targetId) {
                if (i != len - 1) {
                    targets[i] = targets[len - 1];
                }
                targets.pop();
                break;
            }
        }

        emit RefRemoved(sourceId, targetId);
    }

    // --- View ---

    /// @notice Get all reference targets from a source
    /// @param sourceId The source entity
    /// @return Array of target entity IDs
    function getRefs(bytes32 sourceId) external view returns (bytes32[] memory) {
        return _refTargets[sourceId];
    }

    /// @notice Check if a reference exists between source and target
    /// @param sourceId The source entity
    /// @param targetId The target entity
    /// @return Whether the reference exists
    function hasRef(bytes32 sourceId, bytes32 targetId) external view returns (bool) {
        return _refs[sourceId][targetId].exists;
    }
}
