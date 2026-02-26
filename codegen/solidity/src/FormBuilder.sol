// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FormBuilder
/// @notice On-chain widget registry mapping field types to widget identifiers. Form building and validation happen off-chain.
contract FormBuilder {
    struct WidgetMapping {
        string widgetId;
        bool exists;
    }

    mapping(string => WidgetMapping) private _widgetRegistry; // fieldType -> widget

    event WidgetRegistered(string fieldType, string widgetId);

    /// @notice Registers a widget for a given field type.
    /// @param fieldType The field type to associate a widget with.
    /// @param widgetId The widget identifier.
    function registerWidget(string calldata fieldType, string calldata widgetId) external {
        require(bytes(fieldType).length > 0, "Field type cannot be empty");
        require(bytes(widgetId).length > 0, "Widget ID cannot be empty");

        _widgetRegistry[fieldType] = WidgetMapping({widgetId: widgetId, exists: true});

        emit WidgetRegistered(fieldType, widgetId);
    }

    /// @notice Retrieves the widget registered for a field type.
    /// @param fieldType The field type to look up.
    /// @return found Whether a widget is registered.
    /// @return widgetId The widget identifier (empty string if not found).
    function getWidget(string calldata fieldType) external view returns (bool found, string memory widgetId) {
        WidgetMapping storage w = _widgetRegistry[fieldType];
        if (w.exists) {
            return (true, w.widgetId);
        }
        return (false, "");
    }
}
