// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ConfigSync
/// @notice Concept-oriented configuration management with layered overrides
/// @dev Implements the ConfigSync concept from Clef specification.
///      Supports setting base configuration values and layer-specific overrides.

contract ConfigSync {
    // --- Storage ---

    /// @dev Maps config key to its base value
    mapping(bytes32 => string) private _config;

    /// @dev Maps config key -> layer name -> override value
    mapping(bytes32 => mapping(string => string)) private _overrides;

    /// @dev Array of all config keys for enumeration
    bytes32[] private _configKeys;

    /// @dev Tracks whether a key has been registered
    mapping(bytes32 => bool) private _keyExists;

    // --- Events ---

    event ConfigSet(bytes32 indexed key);
    event ConfigOverridden(bytes32 indexed key, string layer);

    // --- Actions ---

    /// @notice Set a base configuration value
    /// @param key The configuration key
    /// @param value The configuration value
    function setConfig(bytes32 key, string calldata value) external {
        require(key != bytes32(0), "Config key cannot be zero");

        if (!_keyExists[key]) {
            _keyExists[key] = true;
            _configKeys.push(key);
        }

        _config[key] = value;

        emit ConfigSet(key);
    }

    /// @notice Override a configuration value for a specific layer
    /// @param key The configuration key
    /// @param value The override value
    /// @param layer The layer name (e.g., "production", "staging")
    function overrideConfig(bytes32 key, string calldata value, string calldata layer) external {
        require(_keyExists[key], "Config key not found");
        require(bytes(layer).length > 0, "Layer cannot be empty");

        _overrides[key][layer] = value;

        emit ConfigOverridden(key, layer);
    }

    // --- Views ---

    /// @notice Get the base configuration value for a key
    /// @param key The configuration key
    /// @return found Whether the key exists
    /// @return value The base configuration value
    function getConfig(bytes32 key) external view returns (bool found, string memory value) {
        if (!_keyExists[key]) {
            return (false, "");
        }
        return (true, _config[key]);
    }

    /// @notice Get a layer-specific override value
    /// @param key The configuration key
    /// @param layer The layer name
    /// @return found Whether the override exists
    /// @return value The override value
    function getOverride(bytes32 key, string calldata layer) external view returns (bool found, string memory value) {
        if (!_keyExists[key]) {
            return (false, "");
        }

        string storage overrideValue = _overrides[key][layer];
        if (bytes(overrideValue).length == 0) {
            return (false, "");
        }

        return (true, overrideValue);
    }

    /// @notice Get the total number of configuration keys
    /// @return The count of registered configuration keys
    function configCount() external view returns (uint256) {
        return _configKeys.length;
    }
}
