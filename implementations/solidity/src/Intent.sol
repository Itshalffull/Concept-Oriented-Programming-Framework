// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Intent
/// @notice Concept-oriented intent declarations capturing purpose, principles, and description
/// @dev Implements the Intent concept from COPF specification.
///      Supports defining, updating, and querying intent records for any target entity.

contract Intent {
    // --- Types ---

    struct IntentRecord {
        string purpose;
        string principles;
        string description;
        uint256 createdAt;
        uint256 updatedAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps target entity ID to its intent record
    mapping(bytes32 => IntentRecord) private _intents;

    /// @dev Array of all target IDs with intents (for enumeration)
    bytes32[] private _intentKeys;

    // --- Events ---

    event Defined(bytes32 indexed targetId);
    event Updated(bytes32 indexed targetId);

    // --- Actions ---

    /// @notice Define an intent for a target entity
    /// @param targetId The entity to attach the intent to
    /// @param purpose The stated purpose
    /// @param principles The guiding principles
    /// @param description A human-readable description
    function defineIntent(
        bytes32 targetId,
        string calldata purpose,
        string calldata principles,
        string calldata description
    ) external {
        require(targetId != bytes32(0), "Target ID cannot be zero");
        require(!_intents[targetId].exists, "Intent already defined");

        _intents[targetId] = IntentRecord({
            purpose: purpose,
            principles: principles,
            description: description,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            exists: true
        });

        _intentKeys.push(targetId);

        emit Defined(targetId);
    }

    /// @notice Update an existing intent
    /// @param targetId The entity whose intent to update
    /// @param purpose The updated purpose
    /// @param principles The updated principles
    /// @param description The updated description
    function update(
        bytes32 targetId,
        string calldata purpose,
        string calldata principles,
        string calldata description
    ) external {
        require(_intents[targetId].exists, "Intent not found");

        IntentRecord storage intent = _intents[targetId];
        intent.purpose = purpose;
        intent.principles = principles;
        intent.description = description;
        intent.updatedAt = block.timestamp;

        emit Updated(targetId);
    }

    // --- View ---

    /// @notice Retrieve an intent record
    /// @param targetId The entity to query
    /// @return The full IntentRecord struct
    function get(bytes32 targetId) external view returns (IntentRecord memory) {
        require(_intents[targetId].exists, "Intent not found");
        return _intents[targetId];
    }

    /// @notice Check if an intent exists for a target
    /// @param targetId The entity to check
    /// @return Whether an intent is defined
    function exists(bytes32 targetId) external view returns (bool) {
        return _intents[targetId].exists;
    }

    /// @notice Get the total number of defined intents
    /// @return The count of intent records
    function count() external view returns (uint256) {
        return _intentKeys.length;
    }
}
