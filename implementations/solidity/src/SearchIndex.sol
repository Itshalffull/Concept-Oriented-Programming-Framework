// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SearchIndex
/// @notice Manages search index registrations and tracks which items are indexed.
contract SearchIndex {
    struct IndexConfig {
        string config;
        bool exists;
    }

    mapping(bytes32 => IndexConfig) private _indexes;
    mapping(bytes32 => mapping(bytes32 => bool)) private _indexedItems; // indexId -> nodeId -> indexed
    mapping(bytes32 => uint256) private _itemCounts;

    event IndexCreated(bytes32 indexed indexId);
    event ItemIndexed(bytes32 indexed indexId, bytes32 indexed nodeId);
    event ItemRemoved(bytes32 indexed indexId, bytes32 indexed nodeId);

    /// @notice Creates a new search index.
    /// @param indexId Unique identifier for the index.
    /// @param config Serialised index configuration.
    function createIndex(bytes32 indexId, string calldata config) external {
        require(!_indexes[indexId].exists, "Index already exists");

        _indexes[indexId] = IndexConfig({config: config, exists: true});

        emit IndexCreated(indexId);
    }

    /// @notice Adds an item to a search index.
    /// @param indexId The index to add to.
    /// @param nodeId The item to index.
    function indexItem(bytes32 indexId, bytes32 nodeId) external {
        require(_indexes[indexId].exists, "Index does not exist");
        require(!_indexedItems[indexId][nodeId], "Item already indexed");

        _indexedItems[indexId][nodeId] = true;
        _itemCounts[indexId]++;

        emit ItemIndexed(indexId, nodeId);
    }

    /// @notice Removes an item from a search index.
    /// @param indexId The index to remove from.
    /// @param nodeId The item to remove.
    function removeItem(bytes32 indexId, bytes32 nodeId) external {
        require(_indexes[indexId].exists, "Index does not exist");
        require(_indexedItems[indexId][nodeId], "Item not indexed");

        _indexedItems[indexId][nodeId] = false;
        _itemCounts[indexId]--;

        emit ItemRemoved(indexId, nodeId);
    }

    /// @notice Checks whether an item is in an index.
    /// @param indexId The index to check.
    /// @param nodeId The item to check for.
    /// @return True if the item is indexed.
    function isIndexed(bytes32 indexId, bytes32 nodeId) external view returns (bool) {
        return _indexedItems[indexId][nodeId];
    }

    /// @notice Returns the number of items in an index.
    /// @param indexId The index to query.
    /// @return The count of indexed items.
    function itemCount(bytes32 indexId) external view returns (uint256) {
        require(_indexes[indexId].exists, "Index does not exist");
        return _itemCounts[indexId];
    }
}
