// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SuffixArrayIndexProvider
/// @notice Suffix array-based search index provider
/// @dev Implements the SuffixArrayIndexProvider concept from Clef specification.
///      Provides substring search capabilities using suffix array data structures.

contract SuffixArrayIndexProvider {
    // --- Events ---

    event Registered(string name, string category);
    event Initialized(bytes32 instance);

    // --- Actions ---

    /// @notice Register this search index provider and return its metadata
    /// @return name The provider name ("suffix-array")
    /// @return category The provider category ("search")
    function register() external pure returns (string memory name, string memory category) {
        return ("suffix-array", "search");
    }

    /// @notice Initialize a suffix array index instance
    /// @return instance The unique identifier for this instance
    function initialize() external returns (bytes32 instance) {
        instance = keccak256(abi.encodePacked("suffix-array", block.timestamp, msg.sender));
        emit Initialized(instance);
        return instance;
    }
}
