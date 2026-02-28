// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WidgetPropEntity
/// @notice Widget prop entity extraction and query for component property specifications.
/// @dev Manages widget prop entities with widget-based lookups and field tracing.

contract WidgetPropEntity {

    // --- Storage ---

    struct PropData {
        string widget;
        string name;
        string typeExpr;
        string defaultValue;
        bool exists;
    }

    mapping(bytes32 => PropData) private _props;
    bytes32[] private _propIds;

    // Widget index: widgetHash => list of prop IDs
    mapping(bytes32 => bytes32[]) private _widgetIndex;

    // --- Types ---

    struct RegisterInput {
        string widget;
        string name;
        string typeExpr;
        string defaultValue;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 prop;
    }

    struct FindByWidgetOkResult {
        bool success;
        string props;
    }

    struct TraceToFieldOkResult {
        bool success;
        string field;
        string concept;
        string viaBinding;
    }

    struct GetOkResult {
        bool success;
        bytes32 prop;
        string widget;
        string name;
        string typeExpr;
        string defaultValue;
    }

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 prop);
    event FindByWidgetCompleted(string variant);
    event TraceToFieldCompleted(string variant);
    event GetCompleted(string variant, bytes32 prop);

    // --- Actions ---

    /// @notice register
    function register(string memory widget, string memory name, string memory typeExpr, string memory defaultValue) external returns (RegisterOkResult memory) {
        require(bytes(widget).length > 0, "Widget must not be empty");
        require(bytes(name).length > 0, "Name must not be empty");

        bytes32 propId = keccak256(abi.encodePacked(widget, name));
        require(!_props[propId].exists, "Prop already registered");

        _props[propId] = PropData({
            widget: widget,
            name: name,
            typeExpr: typeExpr,
            defaultValue: defaultValue,
            exists: true
        });
        _propIds.push(propId);

        bytes32 widgetHash = keccak256(abi.encodePacked(widget));
        _widgetIndex[widgetHash].push(propId);

        emit RegisterCompleted("ok", propId);
        return RegisterOkResult({success: true, prop: propId});
    }

    /// @notice findByWidget
    function findByWidget(string memory widget) external returns (FindByWidgetOkResult memory) {
        bytes32 widgetHash = keccak256(abi.encodePacked(widget));
        bytes32[] storage ids = _widgetIndex[widgetHash];

        string memory result = "";
        for (uint256 i = 0; i < ids.length; i++) {
            if (i > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, _props[ids[i]].name));
        }

        emit FindByWidgetCompleted("ok");
        return FindByWidgetOkResult({success: true, props: result});
    }

    /// @notice traceToField
    function traceToField(bytes32 prop) external returns (TraceToFieldOkResult memory) {
        require(_props[prop].exists, "Prop not found");

        PropData storage data = _props[prop];

        // Trace prop back to its originating concept state field
        emit TraceToFieldCompleted("ok");
        return TraceToFieldOkResult({
            success: true,
            field: data.name,
            concept: "",
            viaBinding: data.widget
        });
    }

    /// @notice get
    function get(bytes32 prop) external returns (GetOkResult memory) {
        require(_props[prop].exists, "Prop not found");

        PropData storage data = _props[prop];

        emit GetCompleted("ok", prop);
        return GetOkResult({
            success: true,
            prop: prop,
            widget: data.widget,
            name: data.name,
            typeExpr: data.typeExpr,
            defaultValue: data.defaultValue
        });
    }

}
