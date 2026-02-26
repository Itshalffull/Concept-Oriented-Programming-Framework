// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ContentStorage
/// @notice Concept-oriented persistence layer for content node data
/// @dev Implements the ContentStorage concept from COPF specification.
///      Provides save, load, remove, and count operations for persisted content.

contract ContentStorage {
    // --- Types ---

    struct PersistedNode {
        string data;
        uint256 savedAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps node ID to its persisted data
    mapping(bytes32 => PersistedNode) private _store;

    /// @dev Array of all stored node IDs (for enumeration and counting)
    bytes32[] private _keys;

    /// @dev Maps node ID to its index in _keys (for deletion)
    mapping(bytes32 => uint256) private _keyIndex;

    // --- Events ---

    event Saved(bytes32 indexed nodeId);
    event Loaded(bytes32 indexed nodeId);
    event Removed(bytes32 indexed nodeId);

    // --- Actions ---

    /// @notice Save or overwrite persisted data for a node
    /// @param nodeId The unique identifier for the node
    /// @param data The serialized data to persist
    function save(bytes32 nodeId, string calldata data) external {
        require(nodeId != bytes32(0), "Node ID cannot be zero");

        if (!_store[nodeId].exists) {
            _keyIndex[nodeId] = _keys.length;
            _keys.push(nodeId);
        }

        _store[nodeId] = PersistedNode({
            data: data,
            savedAt: block.timestamp,
            exists: true
        });

        emit Saved(nodeId);
    }

    /// @notice Load persisted data for a node
    /// @param nodeId The node ID to load
    /// @return found Whether the node was found in storage
    /// @return data The persisted data (empty string if not found)
    function load(bytes32 nodeId) external view returns (bool found, string memory data) {
        if (!_store[nodeId].exists) {
            return (false, "");
        }
        return (true, _store[nodeId].data);
    }

    /// @notice Remove persisted data for a node
    /// @param nodeId The node ID to remove
    function remove(bytes32 nodeId) external {
        require(_store[nodeId].exists, "Node not found in storage");

        // Swap-and-pop from keys array
        uint256 index = _keyIndex[nodeId];
        uint256 lastIndex = _keys.length - 1;

        if (index != lastIndex) {
            bytes32 lastKey = _keys[lastIndex];
            _keys[index] = lastKey;
            _keyIndex[lastKey] = index;
        }

        _keys.pop();
        delete _keyIndex[nodeId];
        delete _store[nodeId];

        emit Removed(nodeId);
    }

    // --- View ---

    /// @notice Get the total number of persisted nodes
    /// @return The count of stored nodes
    function count() external view returns (uint256) {
        return _keys.length;
    }
}
