// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ContentNode
/// @notice Concept-oriented content node with typed content, metadata, and lifecycle management
/// @dev Implements the ContentNode concept from COPF specification.
///      Supports create, update, delete, metadata, and type-change operations.

contract ContentNode {
    // --- Types ---

    struct NodeData {
        string nodeType;
        string content;
        string metadata;
        uint256 createdAt;
        uint256 updatedAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps node ID to its full data
    mapping(bytes32 => NodeData) private _nodes;

    // --- Events ---

    event Created(bytes32 indexed id, string nodeType);
    event Updated(bytes32 indexed id);
    event Deleted(bytes32 indexed id);
    event MetadataSet(bytes32 indexed id, string key);
    event TypeChanged(bytes32 indexed id, string newType);

    // --- Actions ---

    /// @notice Create a new content node
    /// @param id The unique identifier for this node
    /// @param nodeType The type classification of the node
    /// @param content The initial content payload
    function create(bytes32 id, string calldata nodeType, string calldata content) external {
        require(id != bytes32(0), "Node ID cannot be zero");
        require(!_nodes[id].exists, "Node already exists");

        _nodes[id] = NodeData({
            nodeType: nodeType,
            content: content,
            metadata: "",
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            exists: true
        });

        emit Created(id, nodeType);
    }

    /// @notice Update a node's content
    /// @param id The node ID to update
    /// @param content The new content payload
    function update(bytes32 id, string calldata content) external {
        require(_nodes[id].exists, "Node not found");

        NodeData storage node = _nodes[id];
        node.content = content;
        node.updatedAt = block.timestamp;

        emit Updated(id);
    }

    /// @notice Delete a content node
    /// @param id The node ID to delete
    function deleteNode(bytes32 id) external {
        require(_nodes[id].exists, "Node not found");

        delete _nodes[id];

        emit Deleted(id);
    }

    /// @notice Set a metadata key-value pair on a node
    /// @dev Stores metadata as a concatenated string; off-chain indexing recommended for complex queries
    /// @param id The node ID
    /// @param key The metadata key
    /// @param value The metadata value
    function setMetadata(bytes32 id, string calldata key, string calldata value) external {
        require(_nodes[id].exists, "Node not found");

        NodeData storage node = _nodes[id];
        node.metadata = string(abi.encodePacked(node.metadata, key, "=", value, ";"));
        node.updatedAt = block.timestamp;

        emit MetadataSet(id, key);
    }

    /// @notice Retrieve a metadata value by key
    /// @dev Searches the metadata string for the key; returns empty string if not found
    /// @param id The node ID
    /// @param key The metadata key to look up
    /// @return The metadata value associated with the key
    function getMetadata(bytes32 id, string calldata key) external view returns (string memory) {
        require(_nodes[id].exists, "Node not found");

        bytes memory meta = bytes(_nodes[id].metadata);
        bytes memory keyBytes = bytes(key);
        bytes memory searchKey = abi.encodePacked(key, "=");
        uint256 searchLen = searchKey.length;

        if (meta.length == 0 || searchLen > meta.length) {
            return "";
        }

        // Scan for the last occurrence of "key=" to get the most recent value
        uint256 foundStart = type(uint256).max;
        for (uint256 i = 0; i <= meta.length - searchLen; i++) {
            bool match_ = true;
            // Ensure this is a key start (beginning of string or preceded by ';')
            if (i > 0 && meta[i - 1] != 0x3B) {
                continue;
            }
            for (uint256 j = 0; j < searchLen; j++) {
                if (meta[i + j] != searchKey[j]) {
                    match_ = false;
                    break;
                }
            }
            if (match_) {
                foundStart = i + searchLen;
            }
        }

        if (foundStart == type(uint256).max) {
            return "";
        }

        // Extract value until ';'
        uint256 valueEnd = foundStart;
        while (valueEnd < meta.length && meta[valueEnd] != 0x3B) {
            valueEnd++;
        }

        bytes memory result = new bytes(valueEnd - foundStart);
        for (uint256 i = 0; i < result.length; i++) {
            result[i] = meta[foundStart + i];
        }

        return string(result);
    }

    /// @notice Change a node's type classification
    /// @param id The node ID
    /// @param newType The new type to assign
    function changeType(bytes32 id, string calldata newType) external {
        require(_nodes[id].exists, "Node not found");

        NodeData storage node = _nodes[id];
        node.nodeType = newType;
        node.updatedAt = block.timestamp;

        emit TypeChanged(id, newType);
    }

    // --- View ---

    /// @notice Retrieve a node's full data
    /// @param id The node ID
    /// @return The full NodeData struct
    function get(bytes32 id) external view returns (NodeData memory) {
        require(_nodes[id].exists, "Node not found");
        return _nodes[id];
    }

    /// @notice Check if a node exists
    /// @param id The node ID
    /// @return Whether the node exists
    function exists(bytes32 id) external view returns (bool) {
        return _nodes[id].exists;
    }
}
