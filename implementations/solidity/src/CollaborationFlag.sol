// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CollaborationFlag
/// @notice Concept-oriented flagging system for collaborative content moderation
/// @dev Implements the CollaborationFlag concept from COPF specification.
///      Supports creating flag types, flagging/unflagging entities per user, and counting flags.

contract CollaborationFlag {
    // --- Types ---

    struct FlagType {
        string name;
        string description;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps flag type hash to its definition
    mapping(bytes32 => FlagType) private _flagTypes;

    /// @dev Maps flag type -> user ID -> entity ID -> whether flagged
    mapping(bytes32 => mapping(bytes32 => mapping(bytes32 => bool))) private _flaggings;

    /// @dev Maps flag type -> entity ID -> total flag count
    mapping(bytes32 => mapping(bytes32 => uint256)) private _counts;

    // --- Events ---

    event FlagTypeCreated(bytes32 indexed flagType);
    event Flagged(bytes32 indexed flagType, bytes32 indexed userId, bytes32 indexed entityId);
    event Unflagged(bytes32 indexed flagType, bytes32 indexed userId, bytes32 indexed entityId);

    // --- Actions ---

    /// @notice Create a new flag type
    /// @param flagType The unique identifier for the flag type
    /// @param name The human-readable name of the flag type
    /// @param description A description of what this flag type represents
    function createFlagType(bytes32 flagType, string calldata name, string calldata description) external {
        require(flagType != bytes32(0), "Flag type cannot be zero");
        require(!_flagTypes[flagType].exists, "Flag type already exists");
        require(bytes(name).length > 0, "Name cannot be empty");

        _flagTypes[flagType] = FlagType({
            name: name,
            description: description,
            exists: true
        });

        emit FlagTypeCreated(flagType);
    }

    /// @notice Flag an entity as a user
    /// @param flagType The flag type
    /// @param userId The user performing the flag
    /// @param entityId The entity being flagged
    function flag(bytes32 flagType, bytes32 userId, bytes32 entityId) external {
        require(_flagTypes[flagType].exists, "Flag type not found");
        require(userId != bytes32(0), "User ID cannot be zero");
        require(entityId != bytes32(0), "Entity ID cannot be zero");
        require(!_flaggings[flagType][userId][entityId], "Already flagged");

        _flaggings[flagType][userId][entityId] = true;
        _counts[flagType][entityId]++;

        emit Flagged(flagType, userId, entityId);
    }

    /// @notice Remove a flag from an entity
    /// @param flagType The flag type
    /// @param userId The user removing the flag
    /// @param entityId The entity being unflagged
    function unflag(bytes32 flagType, bytes32 userId, bytes32 entityId) external {
        require(_flagTypes[flagType].exists, "Flag type not found");
        require(_flaggings[flagType][userId][entityId], "Not flagged");

        _flaggings[flagType][userId][entityId] = false;
        _counts[flagType][entityId]--;

        emit Unflagged(flagType, userId, entityId);
    }

    // --- Views ---

    /// @notice Check if a user has flagged an entity
    /// @param flagType The flag type
    /// @param userId The user ID
    /// @param entityId The entity ID
    /// @return Whether the entity is flagged by the user
    function isFlagged(bytes32 flagType, bytes32 userId, bytes32 entityId) external view returns (bool) {
        return _flaggings[flagType][userId][entityId];
    }

    /// @notice Get the total flag count for an entity
    /// @param flagType The flag type
    /// @param entityId The entity ID
    /// @return The number of flags on the entity
    function getCount(bytes32 flagType, bytes32 entityId) external view returns (uint256) {
        return _counts[flagType][entityId];
    }
}
