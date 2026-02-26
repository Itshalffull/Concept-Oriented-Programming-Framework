// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Transform
/// @notice Individual value conversion with plugin-based transforms and chaining
/// @dev Implements the Transform concept from Clef specification.
///      Supports registering named transforms backed by plugins, applying a single
///      transform to a value, and chaining multiple transforms in sequence.

contract Transform {
    // --- Types ---

    struct TransformEntry {
        string name;
        bytes32 pluginId;
        string config;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps transform ID to its TransformEntry
    mapping(bytes32 => TransformEntry) private _transforms;

    // --- Events ---

    event TransformRegistered(bytes32 indexed transformId, string name);
    event TransformApplied(bytes32 indexed transformId, string value);
    event ChainCompleted(uint256 chainLength);

    // --- Actions ---

    /// @notice Register a new transform
    /// @param transformId Unique identifier for the transform
    /// @param name Human-readable name of the transform
    /// @param pluginId The plugin that implements the transform logic
    /// @param config Serialised configuration for the transform
    function register(bytes32 transformId, string calldata name, bytes32 pluginId, string calldata config) external {
        require(transformId != bytes32(0), "Transform ID cannot be zero");
        require(!_transforms[transformId].exists, "Transform already exists");
        require(bytes(name).length > 0, "Name cannot be empty");

        _transforms[transformId] = TransformEntry({
            name: name,
            pluginId: pluginId,
            config: config,
            exists: true
        });

        emit TransformRegistered(transformId, name);
    }

    /// @notice Apply a single transform to a value
    /// @param transformId The transform to apply
    /// @param value The input value to transform
    /// @return result The input value (actual transformation is off-chain)
    function apply(bytes32 transformId, string calldata value) external returns (string memory result) {
        require(_transforms[transformId].exists, "Transform not found");

        emit TransformApplied(transformId, value);

        return value;
    }

    /// @notice Chain multiple transforms on a value in sequence
    /// @param value The input value to transform
    /// @param transformIds Ordered array of transform IDs to apply
    /// @return result The input value (actual chained transformation is off-chain)
    function chain(string calldata value, bytes32[] calldata transformIds) external returns (string memory result) {
        require(transformIds.length > 0, "Transform chain cannot be empty");

        for (uint256 i = 0; i < transformIds.length; i++) {
            require(_transforms[transformIds[i]].exists, "Transform in chain not found");
        }

        emit ChainCompleted(transformIds.length);

        return value;
    }

    // --- Views ---

    /// @notice Retrieve a transform entry
    /// @param transformId The transform to look up
    /// @return The TransformEntry struct
    function getTransform(bytes32 transformId) external view returns (TransformEntry memory) {
        require(_transforms[transformId].exists, "Transform not found");
        return _transforms[transformId];
    }

    /// @notice Check whether a transform exists
    /// @param transformId The transform to check
    /// @return Whether the transform exists
    function transformExists(bytes32 transformId) external view returns (bool) {
        return _transforms[transformId].exists;
    }
}
