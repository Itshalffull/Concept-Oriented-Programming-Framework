// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Widget
/// @notice Widget registry for defining, retrieving, and managing UI component definitions.
contract Widget {

    // --- Storage ---

    struct WidgetEntry {
        string name;
        string ast;
        string category;
        uint256 createdAt;
    }

    mapping(bytes32 => WidgetEntry) private _widgets;
    mapping(bytes32 => bool) private _exists;
    bytes32[] private _widgetKeys;

    // --- Types ---

    struct RegisterOkResult {
        bool success;
        bytes32 widget;
    }

    struct GetOkResult {
        bool success;
        bytes32 widget;
        string ast;
        string name;
    }

    struct ListOkResult {
        bool success;
        string widgets;
    }

    struct UnregisterOkResult {
        bool success;
        bytes32 widget;
    }

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 indexed widget);
    event GetCompleted(string variant, bytes32 indexed widget);
    event ListCompleted(string variant);
    event UnregisterCompleted(string variant, bytes32 indexed widget);

    // --- Actions ---

    /// @notice Register a widget with its AST definition and category.
    function register(bytes32 widget, string memory name, string memory ast, string memory category) external returns (RegisterOkResult memory) {
        require(!_exists[widget], "Widget already registered");
        require(bytes(name).length > 0, "Name required");

        _widgets[widget] = WidgetEntry({
            name: name,
            ast: ast,
            category: category,
            createdAt: block.timestamp
        });
        _exists[widget] = true;
        _widgetKeys.push(widget);

        emit RegisterCompleted("ok", widget);
        return RegisterOkResult({success: true, widget: widget});
    }

    /// @notice Get a registered widget by its ID.
    function get(bytes32 widget) external returns (GetOkResult memory) {
        require(_exists[widget], "Widget not found");

        WidgetEntry storage entry = _widgets[widget];

        emit GetCompleted("ok", widget);
        return GetOkResult({success: true, widget: widget, ast: entry.ast, name: entry.name});
    }

    /// @notice List all registered widgets, optionally filtered by category.
    function list(string memory category) external returns (ListOkResult memory) {
        string memory result = "";
        bool first = true;
        bytes32 categoryHash = keccak256(bytes(category));
        bool filterByCategory = bytes(category).length > 0;

        for (uint256 i = 0; i < _widgetKeys.length; i++) {
            bytes32 key = _widgetKeys[i];
            if (!_exists[key]) continue;
            if (filterByCategory && keccak256(bytes(_widgets[key].category)) != categoryHash) continue;

            if (!first) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, _widgets[key].name));
            first = false;
        }

        emit ListCompleted("ok");
        return ListOkResult({success: true, widgets: result});
    }

    /// @notice Unregister a widget, removing it from the registry.
    function unregister(bytes32 widget) external returns (UnregisterOkResult memory) {
        require(_exists[widget], "Widget not found");

        delete _widgets[widget];
        _exists[widget] = false;

        emit UnregisterCompleted("ok", widget);
        return UnregisterOkResult({success: true, widget: widget});
    }

}
