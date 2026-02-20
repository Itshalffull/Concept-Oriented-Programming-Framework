// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {WidgetTypes} from "./WidgetSpec.sol";

/// @title ConduitWidgetRegistry
/// @notice On-chain registry that stores all Conduit widget definitions.
/// @dev Renderers query this registry to discover widgets and retrieve their
///      full COIF specification (elements, anatomy, concept bindings, a11y,
///      and state machine). Only the deployer may register new widgets.

contract ConduitWidgetRegistry {

    // --- Storage ---

    address public immutable deployer;

    string[] private _widgetNames;
    mapping(string => bool) private _registered;

    mapping(string => WidgetTypes.WidgetMeta) private _meta;
    mapping(string => WidgetTypes.ElementNode[]) private _elements;
    mapping(string => WidgetTypes.ConceptBinding[]) private _bindings;
    mapping(string => WidgetTypes.AnatomySpec) private _anatomy;
    mapping(string => WidgetTypes.A11ySpec) private _a11y;

    // --- Events ---

    event WidgetRegistered(string indexed name, string version, uint8 category);

    // --- Errors ---

    error OnlyDeployer();
    error WidgetAlreadyRegistered(string name);
    error WidgetNotFound(string name);

    // --- Modifiers ---

    modifier onlyDeployer() {
        if (msg.sender != deployer) revert OnlyDeployer();
        _;
    }

    modifier widgetExists(string memory name) {
        if (!_registered[name]) revert WidgetNotFound(name);
        _;
    }

    // --- Constructor ---

    constructor() {
        deployer = msg.sender;
    }

    // --- Registration ---

    /// @notice Register a complete widget definition.
    /// @param meta         Widget metadata (name, version, category, machine JSON)
    /// @param elements     Ordered array of abstract UI element nodes
    /// @param bindings     Concept bindings (which contracts the widget connects to)
    /// @param anatomy      Named structural parts and composition slots
    /// @param a11y         Accessibility metadata (ARIA role, label)
    function registerWidget(
        WidgetTypes.WidgetMeta memory meta,
        WidgetTypes.ElementNode[] memory elements,
        WidgetTypes.ConceptBinding[] memory bindings,
        WidgetTypes.AnatomySpec memory anatomy,
        WidgetTypes.A11ySpec memory a11y
    ) external onlyDeployer {
        if (_registered[meta.name]) revert WidgetAlreadyRegistered(meta.name);

        _registered[meta.name] = true;
        _widgetNames.push(meta.name);
        _meta[meta.name] = meta;

        for (uint256 i = 0; i < elements.length; i++) {
            _elements[meta.name].push(elements[i]);
        }

        for (uint256 i = 0; i < bindings.length; i++) {
            _bindings[meta.name].push(bindings[i]);
        }

        _anatomy[meta.name] = anatomy;
        _a11y[meta.name] = a11y;

        emit WidgetRegistered(meta.name, meta.version, uint8(meta.category));
    }

    // --- View functions ---

    /// @notice Get widget metadata by name.
    function getWidget(string memory name)
        external
        view
        widgetExists(name)
        returns (WidgetTypes.WidgetMeta memory)
    {
        return _meta[name];
    }

    /// @notice Get the abstract element tree for a widget.
    function getElements(string memory name)
        external
        view
        widgetExists(name)
        returns (WidgetTypes.ElementNode[] memory)
    {
        return _elements[name];
    }

    /// @notice Get concept bindings for a widget.
    function getConceptBindings(string memory name)
        external
        view
        widgetExists(name)
        returns (WidgetTypes.ConceptBinding[] memory)
    {
        return _bindings[name];
    }

    /// @notice Get the anatomy specification for a widget.
    function getAnatomy(string memory name)
        external
        view
        widgetExists(name)
        returns (WidgetTypes.AnatomySpec memory)
    {
        return _anatomy[name];
    }

    /// @notice Get the accessibility specification for a widget.
    function getA11y(string memory name)
        external
        view
        widgetExists(name)
        returns (WidgetTypes.A11ySpec memory)
    {
        return _a11y[name];
    }

    /// @notice List all registered widget names.
    function listWidgets() external view returns (string[] memory) {
        return _widgetNames;
    }

    /// @notice Check whether a widget is registered.
    function isRegistered(string memory name) external view returns (bool) {
        return _registered[name];
    }

    /// @notice Total number of registered widgets.
    function widgetCount() external view returns (uint256) {
        return _widgetNames.length;
    }
}
