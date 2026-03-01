// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Tag
/// @notice Flat or hierarchical labels for cross-cutting classification of content
/// @dev Implements the Tag concept from Clef specification.

contract Tag {
    // --- Storage ---

    /// @dev Maps tag => entity => whether that entity is tagged
    mapping(bytes32 => mapping(bytes32 => bool)) private _tagEntities;

    /// @dev Maps tag => list of entity IDs tagged with it
    mapping(bytes32 => bytes32[]) private _tagEntityKeys;

    /// @dev Maps tag => entity => index in _tagEntityKeys (for removal)
    mapping(bytes32 => mapping(bytes32 => uint256)) private _tagEntityIndex;

    /// @dev Whether a tag exists
    mapping(bytes32 => bool) private _tagExists;

    /// @dev Tag display names
    mapping(bytes32 => string) private _tagNames;

    /// @dev Tag hierarchy parent references
    mapping(bytes32 => bytes32) private _tagParent;

    /// @dev All known tags
    bytes32[] private _allTags;

    // --- Events ---

    event TagAdded(bytes32 indexed tag, bytes32 indexed entity);
    event TagRemoved(bytes32 indexed tag, bytes32 indexed entity);
    event TagRenamed(bytes32 indexed tag, string name);
    event TagChildrenQueried(bytes32 indexed tag);

    // --- Actions ---

    /// @notice Associate a tag with an entity
    /// @param entity The entity identifier
    /// @param tag The tag identifier
    function addTag(bytes32 entity, bytes32 tag) external {
        require(tag != bytes32(0), "Tag cannot be zero");
        require(entity != bytes32(0), "Entity cannot be zero");
        require(!_tagEntities[tag][entity], "Entity already tagged");

        // If this is a new tag, add it to the global list
        if (!_tagExists[tag]) {
            _tagExists[tag] = true;
            _allTags.push(tag);
        }

        // Add the entity to this tag's list
        _tagEntities[tag][entity] = true;
        _tagEntityIndex[tag][entity] = _tagEntityKeys[tag].length;
        _tagEntityKeys[tag].push(entity);

        emit TagAdded(tag, entity);
    }

    /// @notice Dissociate a tag from an entity
    /// @param entity The entity identifier
    /// @param tag The tag identifier
    function removeTag(bytes32 entity, bytes32 tag) external {
        require(_tagEntities[tag][entity], "Entity not tagged with this tag");

        // Swap-and-pop from the tag's entity list
        uint256 index = _tagEntityIndex[tag][entity];
        uint256 lastIndex = _tagEntityKeys[tag].length - 1;

        if (index != lastIndex) {
            bytes32 lastEntity = _tagEntityKeys[tag][lastIndex];
            _tagEntityKeys[tag][index] = lastEntity;
            _tagEntityIndex[tag][lastEntity] = index;
        }

        _tagEntityKeys[tag].pop();
        delete _tagEntityIndex[tag][entity];
        _tagEntities[tag][entity] = false;

        emit TagRemoved(tag, entity);
    }

    /// @notice Return all entities associated with a tag
    /// @param tag The tag identifier
    /// @return entities Array of entity IDs tagged with this tag
    function getByTag(bytes32 tag) external view returns (bytes32[] memory entities) {
        return _tagEntityKeys[tag];
    }

    /// @notice Return child tags in the hierarchy
    /// @param tag The parent tag identifier
    /// @return children Array of child tag IDs
    function getChildren(bytes32 tag) external view returns (bytes32[] memory children) {
        require(_tagExists[tag], "Tag does not exist");

        // Count children first
        uint256 count = 0;
        for (uint256 i = 0; i < _allTags.length; i++) {
            if (_tagParent[_allTags[i]] == tag) {
                count++;
            }
        }

        // Collect children
        children = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < _allTags.length; i++) {
            if (_tagParent[_allTags[i]] == tag) {
                children[idx] = _allTags[i];
                idx++;
            }
        }

        emit TagChildrenQueried(tag);
        return children;
    }

    /// @notice Rename a tag
    /// @param tag The tag identifier
    /// @param name The new display name
    function rename(bytes32 tag, string calldata name) external {
        require(_tagExists[tag], "Tag does not exist");

        _tagNames[tag] = name;

        emit TagRenamed(tag, name);
    }

    /// @notice Check whether an entity has a specific tag
    /// @param tag The tag identifier
    /// @param entity The entity identifier
    /// @return Whether the entity is tagged
    function isTagged(bytes32 tag, bytes32 entity) external view returns (bool) {
        return _tagEntities[tag][entity];
    }
}
