// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DisplayMode
/// @notice Manages display modes (view/form) and per-field display configurations scoped to schemas.
contract DisplayMode {
    struct Mode {
        string name;
        string modeType; // "view" or "form"
        bool exists;
    }

    struct FieldDisplayConfig {
        string formatter;
        string settings;
        bool exists;
    }

    mapping(bytes32 => Mode) private _modes;
    mapping(bytes32 => mapping(bytes32 => mapping(bytes32 => FieldDisplayConfig))) private _fieldConfigs; // schema -> mode -> field

    event ModeDefined(bytes32 indexed modeId, string name);
    event FieldConfigured(bytes32 indexed schemaId, bytes32 indexed modeId, bytes32 fieldId);

    /// @notice Defines a new display mode.
    /// @param modeId Unique identifier for the mode.
    /// @param name Human-readable mode name.
    /// @param modeType The type of mode ("view" or "form").
    function defineMode(bytes32 modeId, string calldata name, string calldata modeType) external {
        require(!_modes[modeId].exists, "Mode already exists");
        require(bytes(name).length > 0, "Name cannot be empty");

        _modes[modeId] = Mode({name: name, modeType: modeType, exists: true});

        emit ModeDefined(modeId, name);
    }

    /// @notice Configures how a field is displayed in a specific mode and schema.
    /// @param schemaId The schema the field belongs to.
    /// @param modeId The display mode.
    /// @param fieldId The field to configure.
    /// @param formatter The formatter to use for rendering.
    /// @param settings Serialised display settings.
    function configureFieldDisplay(
        bytes32 schemaId,
        bytes32 modeId,
        bytes32 fieldId,
        string calldata formatter,
        string calldata settings
    ) external {
        require(_modes[modeId].exists, "Mode does not exist");

        _fieldConfigs[schemaId][modeId][fieldId] = FieldDisplayConfig({
            formatter: formatter,
            settings: settings,
            exists: true
        });

        emit FieldConfigured(schemaId, modeId, fieldId);
    }

    /// @notice Retrieves a display mode.
    /// @param modeId The mode to look up.
    /// @return The mode struct.
    function getMode(bytes32 modeId) external view returns (Mode memory) {
        require(_modes[modeId].exists, "Mode does not exist");
        return _modes[modeId];
    }

    /// @notice Retrieves the display configuration for a specific field in a given schema and mode.
    /// @param schemaId The schema context.
    /// @param modeId The display mode context.
    /// @param fieldId The field to look up.
    /// @return The field display config struct.
    function getFieldConfig(
        bytes32 schemaId,
        bytes32 modeId,
        bytes32 fieldId
    ) external view returns (FieldDisplayConfig memory) {
        return _fieldConfigs[schemaId][modeId][fieldId];
    }
}
