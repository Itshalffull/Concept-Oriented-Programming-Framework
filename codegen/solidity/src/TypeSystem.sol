// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TypeSystem
/// @notice Concept-oriented type registration and resolution system
/// @dev Implements the TypeSystem concept from Clef specification.
///      Provides type registration, resolution, and existence checks.

contract TypeSystem {
    // --- Types ---

    struct TypeDef {
        string definition;
        string constraints;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps type ID to its definition
    mapping(bytes32 => TypeDef) private _types;

    // --- Events ---

    event TypeRegistered(bytes32 indexed typeId);

    // --- Actions ---

    /// @notice Register a new type definition
    /// @param typeId The unique identifier for this type
    /// @param definition The type definition string
    /// @param constraints The type constraints or validation rules
    function registerType(bytes32 typeId, string calldata definition, string calldata constraints) external {
        require(typeId != bytes32(0), "Type ID cannot be zero");
        require(!_types[typeId].exists, "Type already registered");

        _types[typeId] = TypeDef({
            definition: definition,
            constraints: constraints,
            exists: true
        });

        emit TypeRegistered(typeId);
    }

    // --- View ---

    /// @notice Resolve a type ID to its definition
    /// @param typeId The type ID to look up
    /// @return found Whether the type was found
    /// @return definition The type definition string (empty if not found)
    function resolve(bytes32 typeId) external view returns (bool found, string memory definition) {
        if (!_types[typeId].exists) {
            return (false, "");
        }
        return (true, _types[typeId].definition);
    }

    /// @notice Check if a type is registered
    /// @param typeId The type ID to check
    /// @return Whether the type exists
    function exists(bytes32 typeId) external view returns (bool) {
        return _types[typeId].exists;
    }
}
