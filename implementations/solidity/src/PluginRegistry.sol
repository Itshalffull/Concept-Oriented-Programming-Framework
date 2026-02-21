// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PluginRegistry
/// @notice Concept-oriented plugin type and instance registry
/// @dev Implements the PluginRegistry concept from COPF specification.
///      Supports registering plugin types with definitions, and individual plugins within types.

contract PluginRegistry {
    // --- Types ---

    struct PluginType {
        string definition;
        bool exists;
    }

    struct PluginDef {
        string config;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps type ID to its plugin type definition
    mapping(bytes32 => PluginType) private _pluginTypes;

    /// @dev Maps type ID -> plugin ID -> plugin definition
    mapping(bytes32 => mapping(bytes32 => PluginDef)) private _plugins;

    /// @dev Maps type ID to array of plugin IDs for enumeration
    mapping(bytes32 => bytes32[]) private _pluginList;

    // --- Events ---

    event TypeRegistered(bytes32 indexed typeId);
    event PluginRegistered(bytes32 indexed typeId, bytes32 indexed pluginId);

    // --- Actions ---

    /// @notice Register a new plugin type
    /// @param typeId The unique identifier for the plugin type
    /// @param definition The type's definition/schema
    function registerType(bytes32 typeId, string calldata definition) external {
        require(typeId != bytes32(0), "Type ID cannot be zero");
        require(!_pluginTypes[typeId].exists, "Plugin type already exists");
        require(bytes(definition).length > 0, "Definition cannot be empty");

        _pluginTypes[typeId] = PluginType({
            definition: definition,
            exists: true
        });

        emit TypeRegistered(typeId);
    }

    /// @notice Register a plugin within a type
    /// @param typeId The plugin type ID
    /// @param pluginId The unique identifier for the plugin
    /// @param config The plugin's configuration
    function registerPlugin(bytes32 typeId, bytes32 pluginId, string calldata config) external {
        require(_pluginTypes[typeId].exists, "Plugin type not found");
        require(pluginId != bytes32(0), "Plugin ID cannot be zero");
        require(!_plugins[typeId][pluginId].exists, "Plugin already exists");

        _plugins[typeId][pluginId] = PluginDef({
            config: config,
            exists: true
        });

        _pluginList[typeId].push(pluginId);

        emit PluginRegistered(typeId, pluginId);
    }

    // --- Views ---

    /// @notice Get all plugin IDs for a given type
    /// @param typeId The plugin type ID
    /// @return Array of plugin IDs
    function getPlugins(bytes32 typeId) external view returns (bytes32[] memory) {
        require(_pluginTypes[typeId].exists, "Plugin type not found");
        return _pluginList[typeId];
    }

    /// @notice Get a specific plugin's definition
    /// @param typeId The plugin type ID
    /// @param pluginId The plugin ID
    /// @return The plugin definition struct
    function getPlugin(bytes32 typeId, bytes32 pluginId) external view returns (PluginDef memory) {
        require(_plugins[typeId][pluginId].exists, "Plugin not found");
        return _plugins[typeId][pluginId];
    }

    /// @notice Check if a plugin type exists
    /// @param typeId The plugin type ID
    /// @return Whether the type is registered
    function typeExists(bytes32 typeId) external view returns (bool) {
        return _pluginTypes[typeId].exists;
    }
}
