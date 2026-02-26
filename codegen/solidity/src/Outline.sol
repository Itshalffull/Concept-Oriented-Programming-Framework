// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Outline
/// @notice Concept-oriented hierarchical outline structure with parent-child relationships
/// @dev Implements the Outline concept from COPF specification.
///      Supports registration, reparenting, collapse/expand, and tree traversal.

contract Outline {
    // --- Types ---

    struct OutlineNode {
        bytes32 parentId;
        uint256 position;
        bool collapsed;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps node ID to its outline data
    mapping(bytes32 => OutlineNode) private _nodes;

    /// @dev Maps parent ID to ordered list of child IDs
    mapping(bytes32 => bytes32[]) private _children;

    // --- Events ---

    event Reparented(bytes32 indexed nodeId, bytes32 indexed newParentId);
    event Collapsed(bytes32 indexed nodeId);
    event Expanded(bytes32 indexed nodeId);

    // --- Actions ---

    /// @notice Register a node in the outline hierarchy
    /// @param nodeId The unique identifier for this node
    /// @param parentId The parent node ID (bytes32(0) for root-level nodes)
    /// @param position The ordinal position among siblings
    function register(bytes32 nodeId, bytes32 parentId, uint256 position) external {
        require(nodeId != bytes32(0), "Node ID cannot be zero");
        require(!_nodes[nodeId].exists, "Node already registered");

        _nodes[nodeId] = OutlineNode({
            parentId: parentId,
            position: position,
            collapsed: false,
            exists: true
        });

        _children[parentId].push(nodeId);
    }

    /// @notice Move a node to a new parent
    /// @param nodeId The node to move
    /// @param newParentId The new parent node ID
    /// @param position The new ordinal position among siblings
    function reparent(bytes32 nodeId, bytes32 newParentId, uint256 position) external {
        require(_nodes[nodeId].exists, "Node not found");

        bytes32 oldParentId = _nodes[nodeId].parentId;

        // Remove from old parent's children list
        _removeChild(oldParentId, nodeId);

        // Update node data
        _nodes[nodeId].parentId = newParentId;
        _nodes[nodeId].position = position;

        // Add to new parent's children list
        _children[newParentId].push(nodeId);

        emit Reparented(nodeId, newParentId);
    }

    /// @notice Collapse a node (hide its children in outline view)
    /// @param nodeId The node to collapse
    function collapse(bytes32 nodeId) external {
        require(_nodes[nodeId].exists, "Node not found");

        _nodes[nodeId].collapsed = true;

        emit Collapsed(nodeId);
    }

    /// @notice Expand a node (show its children in outline view)
    /// @param nodeId The node to expand
    function expand(bytes32 nodeId) external {
        require(_nodes[nodeId].exists, "Node not found");

        _nodes[nodeId].collapsed = false;

        emit Expanded(nodeId);
    }

    // --- View ---

    /// @notice Get all children of a parent node
    /// @param parentId The parent node ID
    /// @return Array of child node IDs
    function getChildren(bytes32 parentId) external view returns (bytes32[] memory) {
        return _children[parentId];
    }

    /// @notice Get the parent of a node
    /// @param nodeId The node to query
    /// @return The parent node ID
    function getParent(bytes32 nodeId) external view returns (bytes32) {
        require(_nodes[nodeId].exists, "Node not found");
        return _nodes[nodeId].parentId;
    }

    /// @notice Check if a node is collapsed
    /// @param nodeId The node to query
    /// @return Whether the node is collapsed
    function isCollapsed(bytes32 nodeId) external view returns (bool) {
        require(_nodes[nodeId].exists, "Node not found");
        return _nodes[nodeId].collapsed;
    }

    // --- Internal ---

    /// @dev Remove a child from a parent's children array
    /// @param parentId The parent to remove the child from
    /// @param childId The child to remove
    function _removeChild(bytes32 parentId, bytes32 childId) internal {
        bytes32[] storage children = _children[parentId];
        uint256 len = children.length;

        for (uint256 i = 0; i < len; i++) {
            if (children[i] == childId) {
                if (i != len - 1) {
                    children[i] = children[len - 1];
                }
                children.pop();
                break;
            }
        }
    }
}
