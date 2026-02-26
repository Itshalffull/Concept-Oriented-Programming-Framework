// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Alias
/// @notice Concept-oriented alias registry mapping human-readable names to entity IDs
/// @dev Implements the Alias concept from Clef specification.
///      Supports adding, removing, and resolving aliases with uniqueness enforcement.

contract Alias {
    // --- Storage ---

    /// @dev Maps entity ID -> list of alias names
    mapping(bytes32 => string[]) private _aliases;

    /// @dev Maps alias name -> entity ID
    mapping(string => bytes32) private _aliasToEntity;

    /// @dev Maps alias name -> whether it exists (for existence checks)
    mapping(string => bool) private _aliasExists;

    // --- Events ---

    event AliasAdded(bytes32 indexed entityId, string aliasName);
    event AliasRemoved(bytes32 indexed entityId, string aliasName);

    // --- Actions ---

    /// @notice Add an alias for an entity
    /// @param entityId The entity to create an alias for
    /// @param aliasName The human-readable alias name (must be globally unique)
    function addAlias(bytes32 entityId, string calldata aliasName) external {
        require(entityId != bytes32(0), "Entity ID cannot be zero");
        require(bytes(aliasName).length > 0, "Alias name cannot be empty");
        require(!_aliasExists[aliasName], "Alias already taken");

        _aliasExists[aliasName] = true;
        _aliasToEntity[aliasName] = entityId;
        _aliases[entityId].push(aliasName);

        emit AliasAdded(entityId, aliasName);
    }

    /// @notice Remove an alias from an entity
    /// @param entityId The entity to remove the alias from
    /// @param aliasName The alias name to remove
    function removeAlias(bytes32 entityId, string calldata aliasName) external {
        require(_aliasExists[aliasName], "Alias not found");
        require(_aliasToEntity[aliasName] == entityId, "Alias does not belong to this entity");

        _aliasExists[aliasName] = false;
        delete _aliasToEntity[aliasName];

        // Remove from entity's alias list
        string[] storage aliases = _aliases[entityId];
        uint256 len = aliases.length;
        for (uint256 i = 0; i < len; i++) {
            if (keccak256(bytes(aliases[i])) == keccak256(bytes(aliasName))) {
                if (i != len - 1) {
                    aliases[i] = aliases[len - 1];
                }
                aliases.pop();
                break;
            }
        }

        emit AliasRemoved(entityId, aliasName);
    }

    // --- View ---

    /// @notice Resolve an alias name to its entity ID
    /// @param name The alias name to resolve
    /// @return found Whether the alias was found
    /// @return entityId The entity ID (bytes32(0) if not found)
    function resolve(string calldata name) external view returns (bool found, bytes32 entityId) {
        if (!_aliasExists[name]) {
            return (false, bytes32(0));
        }
        return (true, _aliasToEntity[name]);
    }
}
