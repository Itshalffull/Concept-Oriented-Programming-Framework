// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TreeSitterJson
/// @notice TreeSitter grammar provider for JSON files
/// @dev Implements the TreeSitterJson concept from Clef specification.
///      Provides parsing capabilities for JSON files using TreeSitter.

contract TreeSitterJson {
    // --- Events ---

    event Registered(string name, string category, string language);
    event Initialized(bytes32 instance);

    // --- Actions ---

    /// @notice Register this grammar provider and return its metadata
    /// @return name The grammar name ("json")
    /// @return category The provider category ("grammar")
    /// @return language The target language ("json")
    function register() external pure returns (string memory name, string memory category, string memory language) {
        return ("json", "grammar", "json");
    }

    /// @notice Initialize a JSON grammar instance
    /// @return instance The unique identifier for this instance
    function initialize() external returns (bytes32 instance) {
        instance = keccak256(abi.encodePacked("json", block.timestamp, msg.sender));
        emit Initialized(instance);
        return instance;
    }
}
