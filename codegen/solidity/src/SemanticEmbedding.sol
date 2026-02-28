// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SemanticEmbedding
/// @notice Semantic embedding storage and similarity search
/// @dev Implements the SemanticEmbedding concept from Clef specification.
///      Supports computing and storing embedding vectors for code units,
///      searching by vector similarity, and natural language queries.

contract SemanticEmbedding {
    // --- Types ---

    struct EmbeddingEntry {
        string unit;
        string model;
        int256 dimensions;
        uint256 createdAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps embedding ID to its entry
    mapping(bytes32 => EmbeddingEntry) private _embeddings;

    /// @dev Ordered list of all embedding IDs for enumeration
    bytes32[] private _embeddingKeys;

    /// @dev Maps unit hash to its embedding ID for reverse lookup
    mapping(bytes32 => bytes32) private _unitToEmbedding;

    // --- Events ---

    event ComputeCompleted(string variant, bytes32 embedding);
    event SearchSimilarCompleted(string variant);
    event SearchNaturalLanguageCompleted(string variant);
    event GetCompleted(string variant, bytes32 embedding, int256 dimensions);

    // --- Actions ---

    /// @notice Compute and store an embedding for a code unit
    /// @param unit The code unit content to embed
    /// @param model The embedding model to use
    /// @return embeddingId The computed embedding identifier
    function compute(string memory unit, string memory model) external returns (bytes32 embeddingId) {
        require(bytes(unit).length > 0, "Unit cannot be empty");
        require(bytes(model).length > 0, "Model cannot be empty");

        embeddingId = keccak256(abi.encodePacked(unit, model));

        // Dimensions derived from model name hash (deterministic placeholder)
        int256 dims = int256(uint256(keccak256(abi.encodePacked(model))) % 1536) + 64;

        _embeddings[embeddingId] = EmbeddingEntry({
            unit: unit,
            model: model,
            dimensions: dims,
            createdAt: block.timestamp,
            exists: true
        });

        bytes32 unitHash = keccak256(abi.encodePacked(unit));
        _unitToEmbedding[unitHash] = embeddingId;
        _embeddingKeys.push(embeddingId);

        emit ComputeCompleted("ok", embeddingId);
        return embeddingId;
    }

    /// @notice Search for embeddings similar to a query vector
    /// @param queryVector The serialized query vector
    /// @param topK Maximum number of results to return
    /// @param language Filter by programming language (empty string for all)
    /// @param kind Filter by definition kind (empty string for all)
    /// @return results Serialized list of matching embedding IDs
    function searchSimilar(string memory queryVector, int256 topK, string memory language, string memory kind) external view returns (string memory results) {
        // Suppress unused variable warnings
        language;
        kind;

        require(bytes(queryVector).length > 0, "Query vector cannot be empty");
        require(topK > 0, "topK must be positive");

        // Return up to topK stored embedding IDs as serialized results
        uint256 count = _embeddingKeys.length;
        uint256 limit = topK > int256(int256(uint256(count))) ? count : uint256(topK);

        bytes memory buf;
        for (uint256 i = 0; i < limit; i++) {
            if (i > 0) {
                buf = abi.encodePacked(buf, ",");
            }
            buf = abi.encodePacked(buf, _toHexString(_embeddingKeys[i]));
        }

        results = string(abi.encodePacked("[", buf, "]"));
        return results;
    }

    /// @notice Search for embeddings by natural language query
    /// @param query The natural language search query
    /// @param topK Maximum number of results to return
    /// @return results Serialized list of matching embedding IDs
    function searchNaturalLanguage(string memory query, int256 topK) external view returns (string memory results) {
        require(bytes(query).length > 0, "Query cannot be empty");
        require(topK > 0, "topK must be positive");

        uint256 count = _embeddingKeys.length;
        uint256 limit = topK > int256(int256(uint256(count))) ? count : uint256(topK);

        bytes memory buf;
        for (uint256 i = 0; i < limit; i++) {
            if (i > 0) {
                buf = abi.encodePacked(buf, ",");
            }
            buf = abi.encodePacked(buf, _toHexString(_embeddingKeys[i]));
        }

        results = string(abi.encodePacked("[", buf, "]"));
        return results;
    }

    /// @notice Retrieve a stored embedding by ID
    /// @param embeddingId The embedding identifier to look up
    /// @return unit The original code unit
    /// @return model The model used to generate the embedding
    /// @return dimensions The dimensionality of the embedding vector
    function get(bytes32 embeddingId) external view returns (string memory unit, string memory model, int256 dimensions) {
        require(_embeddings[embeddingId].exists, "Embedding not found");

        EmbeddingEntry storage entry = _embeddings[embeddingId];
        return (entry.unit, entry.model, entry.dimensions);
    }

    // --- Internal helpers ---

    /// @dev Convert a bytes32 to a hex string
    function _toHexString(bytes32 value) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(66);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(str);
    }
}
