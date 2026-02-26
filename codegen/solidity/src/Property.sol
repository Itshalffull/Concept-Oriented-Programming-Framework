// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Property
/// @notice Concept-oriented key-value property store for content nodes
/// @dev Implements the Property concept from Clef specification.
///      Supports set, get, delete, type definitions, and property enumeration.

contract Property {
    // --- Storage ---

    /// @dev Maps nodeId -> key -> value
    mapping(bytes32 => mapping(string => string)) private _properties;

    /// @dev Maps nodeId -> list of property keys (for enumeration)
    mapping(bytes32 => string[]) private _propertyKeys;

    /// @dev Maps nodeId -> key -> whether property has been set
    mapping(bytes32 => mapping(string => bool)) private _hasProperty;

    /// @dev Maps property key -> type definition string
    mapping(string => string) private _typeRegistry;

    // --- Events ---

    event PropertySet(bytes32 indexed nodeId, string key);
    event PropertyDeleted(bytes32 indexed nodeId, string key);
    event TypeDefined(string key, string propType);

    // --- Actions ---

    /// @notice Set a property on a node
    /// @param nodeId The node to set the property on
    /// @param key The property key
    /// @param value The property value
    function set(bytes32 nodeId, string calldata key, string calldata value) external {
        require(nodeId != bytes32(0), "Node ID cannot be zero");
        require(bytes(key).length > 0, "Key cannot be empty");

        if (!_hasProperty[nodeId][key]) {
            _propertyKeys[nodeId].push(key);
            _hasProperty[nodeId][key] = true;
        }

        _properties[nodeId][key] = value;

        emit PropertySet(nodeId, key);
    }

    /// @notice Get a property value from a node
    /// @param nodeId The node to read from
    /// @param key The property key
    /// @return found Whether the property exists
    /// @return value The property value (empty string if not found)
    function get(bytes32 nodeId, string calldata key) external view returns (bool found, string memory value) {
        if (!_hasProperty[nodeId][key]) {
            return (false, "");
        }
        return (true, _properties[nodeId][key]);
    }

    /// @notice Delete a property from a node
    /// @param nodeId The node to delete the property from
    /// @param key The property key to delete
    function deleteProperty(bytes32 nodeId, string calldata key) external {
        require(_hasProperty[nodeId][key], "Property not found");

        delete _properties[nodeId][key];
        _hasProperty[nodeId][key] = false;

        // Remove key from the keys array
        string[] storage keys = _propertyKeys[nodeId];
        uint256 len = keys.length;
        for (uint256 i = 0; i < len; i++) {
            if (keccak256(bytes(keys[i])) == keccak256(bytes(key))) {
                if (i != len - 1) {
                    keys[i] = keys[len - 1];
                }
                keys.pop();
                break;
            }
        }

        emit PropertyDeleted(nodeId, key);
    }

    /// @notice Define the expected type for a property key
    /// @param key The property key
    /// @param propType The type definition string (e.g., "string", "number", "date")
    function defineType(string calldata key, string calldata propType) external {
        require(bytes(key).length > 0, "Key cannot be empty");

        _typeRegistry[key] = propType;

        emit TypeDefined(key, propType);
    }

    // --- View ---

    /// @notice List all property keys for a node
    /// @param nodeId The node to query
    /// @return keys Array of property key names
    function listAll(bytes32 nodeId) external view returns (string[] memory keys) {
        return _propertyKeys[nodeId];
    }
}
