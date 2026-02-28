// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Layout
/// @notice Layout management with nesting, configuration, and responsive breakpoints.
contract Layout {

    // --- Storage ---

    struct LayoutEntry {
        string name;
        string kind;
        string config;
        string breakpoints;
        bytes32 parentId;
        bool hasParent;
        uint256 createdAt;
    }

    mapping(bytes32 => LayoutEntry) private _layouts;
    mapping(bytes32 => bool) private _exists;
    mapping(bytes32 => bytes32[]) private _children;

    // --- Types ---

    struct CreateOkResult {
        bool success;
        bytes32 layout;
    }

    struct ConfigureOkResult {
        bool success;
        bytes32 layout;
    }

    struct NestOkResult {
        bool success;
        bytes32 parent;
    }

    struct SetResponsiveOkResult {
        bool success;
        bytes32 layout;
    }

    struct RemoveOkResult {
        bool success;
        bytes32 layout;
    }

    // --- Events ---

    event CreateCompleted(string variant, bytes32 indexed layout);
    event ConfigureCompleted(string variant, bytes32 indexed layout);
    event NestCompleted(string variant, bytes32 indexed parent);
    event SetResponsiveCompleted(string variant, bytes32 indexed layout);
    event RemoveCompleted(string variant, bytes32 indexed layout);

    // --- Actions ---

    /// @notice Create a layout with a name and kind.
    function create(bytes32 layout, string memory name, string memory kind) external returns (CreateOkResult memory) {
        require(!_exists[layout], "Layout already exists");
        require(bytes(name).length > 0, "Name required");
        require(bytes(kind).length > 0, "Kind required");

        _layouts[layout] = LayoutEntry({
            name: name,
            kind: kind,
            config: "",
            breakpoints: "",
            parentId: bytes32(0),
            hasParent: false,
            createdAt: block.timestamp
        });
        _exists[layout] = true;

        emit CreateCompleted("ok", layout);
        return CreateOkResult({success: true, layout: layout});
    }

    /// @notice Configure a layout with layout-specific settings.
    function configure(bytes32 layout, string memory config) external returns (ConfigureOkResult memory) {
        require(_exists[layout], "Layout not found");

        _layouts[layout].config = config;

        emit ConfigureCompleted("ok", layout);
        return ConfigureOkResult({success: true, layout: layout});
    }

    /// @notice Nest a child layout under a parent layout.
    function nest(bytes32 parent, bytes32 child) external returns (NestOkResult memory) {
        require(_exists[parent], "Parent layout not found");
        require(_exists[child], "Child layout not found");
        require(parent != child, "Cannot nest layout under itself");

        _layouts[child].parentId = parent;
        _layouts[child].hasParent = true;
        _children[parent].push(child);

        emit NestCompleted("ok", parent);
        return NestOkResult({success: true, parent: parent});
    }

    /// @notice Set responsive breakpoints on a layout.
    function setResponsive(bytes32 layout, string memory breakpoints) external returns (SetResponsiveOkResult memory) {
        require(_exists[layout], "Layout not found");

        _layouts[layout].breakpoints = breakpoints;

        emit SetResponsiveCompleted("ok", layout);
        return SetResponsiveOkResult({success: true, layout: layout});
    }

    /// @notice Remove a layout and its configuration.
    function remove(bytes32 layout) external returns (RemoveOkResult memory) {
        require(_exists[layout], "Layout not found");

        delete _layouts[layout];
        _exists[layout] = false;

        emit RemoveCompleted("ok", layout);
        return RemoveOkResult({success: true, layout: layout});
    }

}
