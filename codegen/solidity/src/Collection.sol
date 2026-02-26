// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Collection
/// @notice Manages named collections of nodes with typed membership and optional schema association.
contract Collection {
    struct CollectionData {
        string name;
        string collectionType;
        bytes32 schemaId;
        bool exists;
    }

    mapping(bytes32 => CollectionData) private _collections;
    mapping(bytes32 => bytes32[]) private _members;
    mapping(bytes32 => mapping(bytes32 => bool)) private _isMember;

    event CollectionCreated(bytes32 indexed collectionId);
    event MemberAdded(bytes32 indexed collectionId, bytes32 indexed nodeId);
    event MemberRemoved(bytes32 indexed collectionId, bytes32 indexed nodeId);

    /// @notice Creates a new collection.
    /// @param collectionId Unique identifier for the collection.
    /// @param name Human-readable collection name.
    /// @param collectionType The type of collection.
    /// @param schemaId Optional schema ID to associate (bytes32(0) for none).
    function create(
        bytes32 collectionId,
        string calldata name,
        string calldata collectionType,
        bytes32 schemaId
    ) external {
        require(!_collections[collectionId].exists, "Collection already exists");
        require(bytes(name).length > 0, "Name cannot be empty");

        _collections[collectionId] = CollectionData({
            name: name,
            collectionType: collectionType,
            schemaId: schemaId,
            exists: true
        });

        emit CollectionCreated(collectionId);
    }

    /// @notice Adds a member to a collection.
    /// @param collectionId The collection to add to.
    /// @param nodeId The node to add.
    function addMember(bytes32 collectionId, bytes32 nodeId) external {
        require(_collections[collectionId].exists, "Collection does not exist");
        require(!_isMember[collectionId][nodeId], "Already a member");

        _members[collectionId].push(nodeId);
        _isMember[collectionId][nodeId] = true;

        emit MemberAdded(collectionId, nodeId);
    }

    /// @notice Removes a member from a collection.
    /// @param collectionId The collection to remove from.
    /// @param nodeId The node to remove.
    function removeMember(bytes32 collectionId, bytes32 nodeId) external {
        require(_collections[collectionId].exists, "Collection does not exist");
        require(_isMember[collectionId][nodeId], "Not a member");

        _isMember[collectionId][nodeId] = false;

        bytes32[] storage members = _members[collectionId];
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == nodeId) {
                members[i] = members[members.length - 1];
                members.pop();
                break;
            }
        }

        emit MemberRemoved(collectionId, nodeId);
    }

    /// @notice Retrieves all members of a collection.
    /// @param collectionId The collection to query.
    /// @return Array of member node IDs.
    function getMembers(bytes32 collectionId) external view returns (bytes32[] memory) {
        require(_collections[collectionId].exists, "Collection does not exist");
        return _members[collectionId];
    }

    /// @notice Checks whether a node is a member of a collection.
    /// @param collectionId The collection to check.
    /// @param nodeId The node to check.
    /// @return True if the node is a member.
    function isMember(bytes32 collectionId, bytes32 nodeId) external view returns (bool) {
        return _isMember[collectionId][nodeId];
    }

    /// @notice Retrieves collection data.
    /// @param collectionId The collection to look up.
    /// @return The collection struct.
    function getCollection(bytes32 collectionId) external view returns (CollectionData memory) {
        require(_collections[collectionId].exists, "Collection does not exist");
        return _collections[collectionId];
    }
}
