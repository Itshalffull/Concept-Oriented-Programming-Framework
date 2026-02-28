// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TreeSitterYaml
/// @notice TreeSitter grammar provider for YAML files
/// @dev Implements the TreeSitterYaml concept from Clef specification.
///      Provides parsing capabilities for YAML files using TreeSitter.

contract TreeSitterYaml {
    // --- Events ---

    event Registered(string name, string category, string language);
    event Initialized(bytes32 instance);

    // --- Actions ---

    /// @notice Register this grammar provider and return its metadata
    /// @return name The grammar name ("yaml")
    /// @return category The provider category ("grammar")
    /// @return language The target language ("yaml")
    function register() external pure returns (string memory name, string memory category, string memory language) {
        return ("yaml", "grammar", "yaml");
    }

    /// @notice Initialize a YAML grammar instance
    /// @return instance The unique identifier for this instance
    function initialize() external returns (bytes32 instance) {
        instance = keccak256(abi.encodePacked("yaml", block.timestamp, msg.sender));
        emit Initialized(instance);
        return instance;
    }
}
