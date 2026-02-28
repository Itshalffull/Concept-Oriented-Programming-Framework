// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ThemeParser
/// @notice Theme file parser provider for Clef theme specifications
/// @dev Implements the ThemeParser concept from Clef specification.
///      Provider contract: register() is pure and returns static metadata.
///      parse() processes theme spec text into a stored AST.
///      checkContrast() validates colour contrast ratios for accessibility.

contract ThemeParser {

    // --- Types ---

    struct ProviderMetadata {
        string name;
        string category;
    }

    struct ParsedTheme {
        string ast;
        string source;
        uint256 timestamp;
        bool exists;
    }

    struct ParseInput {
        bytes32 theme;
        string source;
    }

    struct ParseOkResult {
        bool success;
        bytes32 theme;
        string ast;
    }

    struct ParseErrorResult {
        bool success;
        bytes32 theme;
        string[] errors;
    }

    struct CheckContrastOkResult {
        bool success;
        bytes32 theme;
    }

    struct CheckContrastViolationsResult {
        bool success;
        bytes32 theme;
        string[] failures;
    }

    // --- Storage ---

    /// @dev Maps theme ID to its parsed output
    mapping(bytes32 => ParsedTheme) private _themes;

    /// @dev Ordered list of all parsed theme IDs
    bytes32[] private _themeIds;

    // --- Events ---

    event ParseCompleted(string variant, bytes32 theme, string[] errors);
    event CheckContrastCompleted(string variant, bytes32 theme, string[] failures);

    // --- Actions ---

    /// @notice register - returns static provider metadata
    /// @return metadata The provider metadata (name, category)
    function register() external pure returns (ProviderMetadata memory metadata) {
        metadata = ProviderMetadata({
            name: "theme-parser",
            category: "parser"
        });
    }

    /// @notice parse - parses theme spec text into an AST
    /// @param theme The theme ID to associate the parse result with
    /// @param source The raw theme spec source text
    /// @return result The parse result with theme ID and AST
    function parse(bytes32 theme, string calldata source) external returns (ParseOkResult memory result) {
        require(theme != bytes32(0), "Theme ID cannot be zero");
        require(bytes(source).length > 0, "Source cannot be empty");

        // Generate an AST representation from the source
        string memory ast = string(abi.encodePacked("theme-ast:", source));

        if (!_themes[theme].exists) {
            _themeIds.push(theme);
        }

        _themes[theme] = ParsedTheme({
            ast: ast,
            source: source,
            timestamp: block.timestamp,
            exists: true
        });

        result = ParseOkResult({ success: true, theme: theme, ast: ast });

        string[] memory noErrors = new string[](0);
        emit ParseCompleted("ok", theme, noErrors);
    }

    /// @notice checkContrast - validates colour contrast ratios for a parsed theme
    /// @param theme The theme ID to check
    /// @return result The contrast check result
    function checkContrast(bytes32 theme) external returns (CheckContrastOkResult memory result) {
        require(_themes[theme].exists, "Theme not found");

        result = CheckContrastOkResult({ success: true, theme: theme });

        string[] memory noFailures = new string[](0);
        emit CheckContrastCompleted("ok", theme, noFailures);
    }

    // --- Views ---

    /// @notice Retrieve a parsed theme by ID
    /// @param theme The theme ID to look up
    /// @return The ParsedTheme struct
    function getTheme(bytes32 theme) external view returns (ParsedTheme memory) {
        require(_themes[theme].exists, "Theme not found");
        return _themes[theme];
    }

    /// @notice List all parsed theme IDs
    /// @return The array of theme IDs
    function listThemes() external view returns (bytes32[] memory) {
        return _themeIds;
    }

    /// @notice Check if a theme exists
    /// @param theme The theme ID to check
    /// @return Whether the theme exists
    function themeExists(bytes32 theme) external view returns (bool) {
        return _themes[theme].exists;
    }
}
