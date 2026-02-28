// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title OpenAIEmbeddingProvider
/// @notice OpenAI-based code embedding provider
/// @dev Implements the OpenAIEmbeddingProvider concept from Clef specification.
///      Provides code embeddings using OpenAI embedding models for semantic code search.

contract OpenAIEmbeddingProvider {
    // --- Events ---

    event Registered(string name, string category);
    event Initialized(bytes32 instance);

    // --- Actions ---

    /// @notice Register this embedding provider and return its metadata
    /// @return name The provider name ("openai")
    /// @return category The provider category ("embedding")
    function register() external pure returns (string memory name, string memory category) {
        return ("openai", "embedding");
    }

    /// @notice Initialize an OpenAI embedding instance
    /// @return instance The unique identifier for this instance
    function initialize() external returns (bytes32 instance) {
        instance = keccak256(abi.encodePacked("openai", block.timestamp, msg.sender));
        emit Initialized(instance);
        return instance;
    }
}
