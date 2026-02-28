// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VoyageCodeEmbeddingProvider
/// @notice Voyage Code embedding provider for code-specific semantic search
/// @dev Implements the VoyageCodeEmbeddingProvider concept from Clef specification.
///      Provides code embeddings using the Voyage Code model optimized for code retrieval.

contract VoyageCodeEmbeddingProvider {
    // --- Events ---

    event Registered(string name, string category);
    event Initialized(bytes32 instance);

    // --- Actions ---

    /// @notice Register this embedding provider and return its metadata
    /// @return name The provider name ("voyage-code")
    /// @return category The provider category ("embedding")
    function register() external pure returns (string memory name, string memory category) {
        return ("voyage-code", "embedding");
    }

    /// @notice Initialize a Voyage Code embedding instance
    /// @return instance The unique identifier for this instance
    function initialize() external returns (bytes32 instance) {
        instance = keccak256(abi.encodePacked("voyage-code", block.timestamp, msg.sender));
        emit Initialized(instance);
        return instance;
    }
}
