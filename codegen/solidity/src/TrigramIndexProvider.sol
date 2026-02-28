// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TrigramIndexProvider
/// @notice Trigram-based search index provider
/// @dev Implements the TrigramIndexProvider concept from Clef specification.
///      Provides fast approximate string matching using trigram (3-gram) indexes.

contract TrigramIndexProvider {
    // --- Events ---

    event Registered(string name, string category);
    event Initialized(bytes32 instance);

    // --- Actions ---

    /// @notice Register this search index provider and return its metadata
    /// @return name The provider name ("trigram")
    /// @return category The provider category ("search")
    function register() external pure returns (string memory name, string memory category) {
        return ("trigram", "search");
    }

    /// @notice Initialize a trigram index instance
    /// @return instance The unique identifier for this instance
    function initialize() external returns (bytes32 instance) {
        instance = keccak256(abi.encodePacked("trigram", block.timestamp, msg.sender));
        emit Initialized(instance);
        return instance;
    }
}
