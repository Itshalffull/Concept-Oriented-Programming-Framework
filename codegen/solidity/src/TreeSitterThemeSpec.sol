// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TreeSitterThemeSpec
/// @notice TreeSitter grammar provider for Clef theme specification files
/// @dev Implements the TreeSitterThemeSpec concept from Clef specification.
///      Provides parsing capabilities for .theme spec files using TreeSitter.

contract TreeSitterThemeSpec {
    // --- Events ---

    event Registered(string name, string category, string language);
    event Initialized(bytes32 instance);

    // --- Actions ---

    /// @notice Register this grammar provider and return its metadata
    /// @return name The grammar name ("theme-spec")
    /// @return category The provider category ("grammar")
    /// @return language The target language ("theme")
    function register() external pure returns (string memory name, string memory category, string memory language) {
        return ("theme-spec", "grammar", "theme");
    }

    /// @notice Initialize a theme-spec grammar instance
    /// @return instance The unique identifier for this instance
    function initialize() external returns (bytes32 instance) {
        instance = keccak256(abi.encodePacked("theme-spec", block.timestamp, msg.sender));
        emit Initialized(instance);
        return instance;
    }
}
