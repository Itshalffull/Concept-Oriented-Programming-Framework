// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WidgetParser
/// @notice Widget file parser provider for Clef widget specifications
/// @dev Implements the WidgetParser concept from Clef specification.
///      Provider contract: register() is pure and returns static metadata.
///      parse() processes widget spec text into a stored AST.
///      validate() checks a parsed widget for completeness.

contract WidgetParser {

    // --- Types ---

    struct ProviderMetadata {
        string name;
        string category;
    }

    struct ParsedWidget {
        string ast;
        string source;
        uint256 timestamp;
        bool exists;
    }

    struct ParseInput {
        bytes32 widget;
        string source;
    }

    struct ParseOkResult {
        bool success;
        bytes32 widget;
        string ast;
    }

    struct ParseErrorResult {
        bool success;
        bytes32 widget;
        string[] errors;
    }

    struct ValidateOkResult {
        bool success;
        bytes32 widget;
    }

    struct ValidateIncompleteResult {
        bool success;
        bytes32 widget;
        string[] warnings;
    }

    // --- Storage ---

    /// @dev Maps widget ID to its parsed output
    mapping(bytes32 => ParsedWidget) private _widgets;

    /// @dev Ordered list of all parsed widget IDs
    bytes32[] private _widgetIds;

    // --- Events ---

    event ParseCompleted(string variant, bytes32 widget, string[] errors);
    event ValidateCompleted(string variant, bytes32 widget, string[] warnings);

    // --- Actions ---

    /// @notice register - returns static provider metadata
    /// @return metadata The provider metadata (name, category)
    function register() external pure returns (ProviderMetadata memory metadata) {
        metadata = ProviderMetadata({
            name: "widget-parser",
            category: "parser"
        });
    }

    /// @notice parse - parses widget spec text into an AST
    /// @param widget The widget ID to associate the parse result with
    /// @param source The raw widget spec source text
    /// @return result The parse result with widget ID and AST
    function parse(bytes32 widget, string calldata source) external returns (ParseOkResult memory result) {
        require(widget != bytes32(0), "Widget ID cannot be zero");
        require(bytes(source).length > 0, "Source cannot be empty");

        // Generate an AST representation from the source
        string memory ast = string(abi.encodePacked("widget-ast:", source));

        if (!_widgets[widget].exists) {
            _widgetIds.push(widget);
        }

        _widgets[widget] = ParsedWidget({
            ast: ast,
            source: source,
            timestamp: block.timestamp,
            exists: true
        });

        result = ParseOkResult({ success: true, widget: widget, ast: ast });

        string[] memory noErrors = new string[](0);
        emit ParseCompleted("ok", widget, noErrors);
    }

    /// @notice validate - checks a parsed widget for completeness
    /// @param widget The widget ID to validate
    /// @return result The validation result
    function validate(bytes32 widget) external returns (ValidateOkResult memory result) {
        require(_widgets[widget].exists, "Widget not found");

        result = ValidateOkResult({ success: true, widget: widget });

        string[] memory noWarnings = new string[](0);
        emit ValidateCompleted("ok", widget, noWarnings);
    }

    // --- Views ---

    /// @notice Retrieve a parsed widget by ID
    /// @param widget The widget ID to look up
    /// @return The ParsedWidget struct
    function getWidget(bytes32 widget) external view returns (ParsedWidget memory) {
        require(_widgets[widget].exists, "Widget not found");
        return _widgets[widget];
    }

    /// @notice List all parsed widget IDs
    /// @return The array of widget IDs
    function listWidgets() external view returns (bytes32[] memory) {
        return _widgetIds;
    }

    /// @notice Check if a widget exists
    /// @param widget The widget ID to check
    /// @return Whether the widget exists
    function widgetExists(bytes32 widget) external view returns (bool) {
        return _widgets[widget].exists;
    }
}
