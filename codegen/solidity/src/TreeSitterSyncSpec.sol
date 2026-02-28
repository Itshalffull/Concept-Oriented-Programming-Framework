// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TreeSitterSyncSpec
/// @notice TreeSitter grammar provider for Clef sync specification files
/// @dev Implements the TreeSitterSyncSpec concept from Clef specification.
///      Provides parsing capabilities for .sync spec files using TreeSitter.

contract TreeSitterSyncSpec {
    // --- Events ---

    event Registered(string name, string category, string language);
    event Initialized(bytes32 instance);

    // --- Actions ---

    /// @notice Register this grammar provider and return its metadata
    /// @return name The grammar name ("sync-spec")
    /// @return category The provider category ("grammar")
    /// @return language The target language ("sync")
    function register() external pure returns (string memory name, string memory category, string memory language) {
        return ("sync-spec", "grammar", "sync");
    }

    /// @notice Initialize a sync-spec grammar instance
    /// @return instance The unique identifier for this instance
    function initialize() external returns (bytes32 instance) {
        instance = keccak256(abi.encodePacked("sync-spec", block.timestamp, msg.sender));
        emit Initialized(instance);
        return instance;
    }
}
