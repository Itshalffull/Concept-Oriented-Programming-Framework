// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TreeSitterConceptSpec
/// @notice TreeSitter grammar provider for Clef concept specification files
/// @dev Implements the TreeSitterConceptSpec concept from Clef specification.
///      Provides parsing capabilities for .concept spec files using TreeSitter.

contract TreeSitterConceptSpec {
    // --- Events ---

    event Registered(string name, string category, string language);
    event Initialized(bytes32 instance);

    // --- Actions ---

    /// @notice Register this grammar provider and return its metadata
    /// @return name The grammar name ("concept-spec")
    /// @return category The provider category ("grammar")
    /// @return language The target language ("concept")
    function register() external pure returns (string memory name, string memory category, string memory language) {
        return ("concept-spec", "grammar", "concept");
    }

    /// @notice Initialize a concept-spec grammar instance
    /// @return instance The unique identifier for this instance
    function initialize() external returns (bytes32 instance) {
        instance = keccak256(abi.encodePacked("concept-spec", block.timestamp, msg.sender));
        emit Initialized(instance);
        return instance;
    }
}
