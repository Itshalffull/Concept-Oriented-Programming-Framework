// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ClassificationTag
/// @notice Manages tagging of nodes with string-based classification labels, supporting tag lookups and renaming.
contract ClassificationTag {
    mapping(bytes32 => mapping(string => bool)) private _nodeTags; // nodeId -> tag -> exists
    mapping(string => bytes32[]) private _tagIndex; // tag -> nodeIds
    mapping(string => bool) private _tagExists;

    event TagAdded(bytes32 indexed nodeId, string tagName);
    event TagRemoved(bytes32 indexed nodeId, string tagName);
    event TagRenamed(string oldTag, string newTag);

    /// @notice Adds a tag to a node.
    /// @param nodeId The node to tag.
    /// @param tagName The tag label.
    function addTag(bytes32 nodeId, string calldata tagName) external {
        require(nodeId != bytes32(0), "Invalid node ID");
        require(bytes(tagName).length > 0, "Tag name cannot be empty");
        require(!_nodeTags[nodeId][tagName], "Tag already assigned to node");

        _nodeTags[nodeId][tagName] = true;
        _tagIndex[tagName].push(nodeId);
        _tagExists[tagName] = true;

        emit TagAdded(nodeId, tagName);
    }

    /// @notice Removes a tag from a node.
    /// @param nodeId The node to untag.
    /// @param tagName The tag label.
    function removeTag(bytes32 nodeId, string calldata tagName) external {
        require(_nodeTags[nodeId][tagName], "Tag not assigned to node");

        _nodeTags[nodeId][tagName] = false;

        // Remove nodeId from tag index
        bytes32[] storage nodes = _tagIndex[tagName];
        for (uint256 i = 0; i < nodes.length; i++) {
            if (nodes[i] == nodeId) {
                nodes[i] = nodes[nodes.length - 1];
                nodes.pop();
                break;
            }
        }

        emit TagRemoved(nodeId, tagName);
    }

    /// @notice Retrieves all node IDs associated with a given tag.
    /// @param tagName The tag to look up.
    /// @return The array of node IDs tagged with the given label.
    function getByTag(string calldata tagName) external view returns (bytes32[] memory) {
        return _tagIndex[tagName];
    }

    /// @notice Renames a tag across all nodes.
    /// @param oldTag The current tag name.
    /// @param newTag The replacement tag name.
    function rename(string calldata oldTag, string calldata newTag) external {
        require(_tagExists[oldTag], "Old tag does not exist");
        require(!_tagExists[newTag], "New tag already exists");
        require(bytes(newTag).length > 0, "New tag name cannot be empty");

        bytes32[] storage nodes = _tagIndex[oldTag];
        for (uint256 i = 0; i < nodes.length; i++) {
            _nodeTags[nodes[i]][oldTag] = false;
            _nodeTags[nodes[i]][newTag] = true;
        }

        _tagIndex[newTag] = nodes;
        delete _tagIndex[oldTag];
        _tagExists[newTag] = true;
        _tagExists[oldTag] = false;

        emit TagRenamed(oldTag, newTag);
    }

    /// @notice Checks whether a node has a specific tag.
    /// @param nodeId The node to check.
    /// @param tagName The tag to check for.
    /// @return True if the node has the tag.
    function hasTag(bytes32 nodeId, string calldata tagName) external view returns (bool) {
        return _nodeTags[nodeId][tagName];
    }
}
