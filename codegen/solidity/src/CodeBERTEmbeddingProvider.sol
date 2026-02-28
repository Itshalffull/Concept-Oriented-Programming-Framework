// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CodeBERTEmbeddingProvider
/// @notice CodeBERT-based code embedding provider
/// @dev Implements the CodeBERTEmbeddingProvider concept from Clef specification.
///      Provides code embeddings using the CodeBERT model for semantic code search.

contract CodeBERTEmbeddingProvider {
    // --- Events ---

    event Registered(string name, string category);
    event Initialized(bytes32 instance);

    // --- Actions ---

    /// @notice Register this embedding provider and return its metadata
    /// @return name The provider name ("codebert")
    /// @return category The provider category ("embedding")
    function register() external pure returns (string memory name, string memory category) {
        return ("codebert", "embedding");
    }

    /// @notice Initialize a CodeBERT embedding instance
    /// @return instance The unique identifier for this instance
    function initialize() external returns (bytes32 instance) {
        instance = keccak256(abi.encodePacked("codebert", block.timestamp, msg.sender));
        emit Initialized(instance);
        return instance;
    }
}
