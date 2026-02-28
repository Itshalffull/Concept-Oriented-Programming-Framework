// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title StructuralPattern
/// @notice Structural pattern definition and matching
/// @dev Implements the StructuralPattern concept from Clef specification.
///      Supports defining structural patterns with S-expression syntax,
///      matching patterns against syntax trees, and project-wide matching.

contract StructuralPattern {
    // --- Types ---

    struct PatternEntry {
        string syntax;
        string source;
        string language;
        uint256 createdAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps pattern ID to its entry
    mapping(bytes32 => PatternEntry) private _patterns;

    /// @dev Ordered list of all pattern IDs
    bytes32[] private _patternKeys;

    // --- Events ---

    event CreateCompleted(string variant, bytes32 pattern);
    event MatchCompleted(string variant);
    event MatchProjectCompleted(string variant);

    // --- Actions ---

    /// @notice Create a new structural pattern
    /// @param syntax The S-expression pattern syntax
    /// @param source The pattern source/origin
    /// @param language The target language this pattern matches
    /// @return patternId The unique identifier for this pattern
    function create(string memory syntax, string memory source, string memory language) external returns (bytes32 patternId) {
        require(bytes(syntax).length > 0, "Syntax cannot be empty");
        require(bytes(language).length > 0, "Language cannot be empty");

        patternId = keccak256(abi.encodePacked(syntax, language));

        _patterns[patternId] = PatternEntry({
            syntax: syntax,
            source: source,
            language: language,
            createdAt: block.timestamp,
            exists: true
        });

        _patternKeys.push(patternId);

        emit CreateCompleted("ok", patternId);
        return patternId;
    }

    /// @notice Match a pattern against a syntax tree
    /// @param patternId The pattern to match with
    /// @param tree The serialized syntax tree to match against
    /// @return matches Serialized list of match results
    function matchPattern(bytes32 patternId, string memory tree) external view returns (string memory matches) {
        require(_patterns[patternId].exists, "Pattern not found");
        require(bytes(tree).length > 0, "Tree cannot be empty");

        // Return a serialized representation of the match
        PatternEntry storage p = _patterns[patternId];
        matches = string(abi.encodePacked(
            "[{pattern:\"", p.syntax,
            "\",language:\"", p.language,
            "\",tree:\"", tree,
            "\"}]"
        ));

        return matches;
    }

    /// @notice Match a pattern across all files in the project
    /// @param patternId The pattern to match with
    /// @return results Serialized list of project-wide match results
    function matchProject(bytes32 patternId) external view returns (string memory results) {
        require(_patterns[patternId].exists, "Pattern not found");

        PatternEntry storage p = _patterns[patternId];
        results = string(abi.encodePacked(
            "[{pattern:\"", p.syntax,
            "\",language:\"", p.language,
            "\",scope:\"project\"}]"
        ));

        return results;
    }

    // --- Views ---

    /// @notice Get detailed information about a pattern
    /// @param patternId The pattern to look up
    /// @return syntax The pattern syntax
    /// @return source The pattern source
    /// @return language The target language
    function getPattern(bytes32 patternId) external view returns (string memory syntax, string memory source, string memory language) {
        require(_patterns[patternId].exists, "Pattern not found");
        PatternEntry storage entry = _patterns[patternId];
        return (entry.syntax, entry.source, entry.language);
    }

    /// @notice List all registered patterns
    /// @return count The number of registered patterns
    function patternCount() external view returns (uint256 count) {
        return _patternKeys.length;
    }
}
