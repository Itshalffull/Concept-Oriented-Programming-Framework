// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Authorization
/// @notice Concept-oriented role-based access control with role creation, permission grants, and user assignment
/// @dev Implements the Authorization concept from Clef specification.
///      Supports roles, permissions, and multi-role permission checking.

contract Authorization {
    // --- Storage ---

    /// @dev Maps role ID -> permission ID -> whether granted
    mapping(bytes32 => mapping(bytes32 => bool)) private _rolePermissions;

    /// @dev Maps user ID -> role ID -> whether assigned
    mapping(bytes32 => mapping(bytes32 => bool)) private _userRoles;

    /// @dev Tracks which roles exist
    mapping(bytes32 => bool) private _roleExists;

    /// @dev Maps user ID -> list of assigned role IDs (for enumeration during permission checks)
    mapping(bytes32 => bytes32[]) private _userRoleList;

    // --- Events ---

    event PermissionGranted(bytes32 indexed roleId, bytes32 permissionId);
    event PermissionRevoked(bytes32 indexed roleId, bytes32 permissionId);
    event RoleAssigned(bytes32 indexed userId, bytes32 roleId);

    // --- Actions ---

    /// @notice Create a new role
    /// @param roleId The unique identifier for the role
    function createRole(bytes32 roleId) external {
        require(roleId != bytes32(0), "Role ID cannot be zero");
        require(!_roleExists[roleId], "Role already exists");

        _roleExists[roleId] = true;
    }

    /// @notice Grant a permission to a role
    /// @param roleId The role to grant the permission to
    /// @param permissionId The permission to grant
    function grantPermission(bytes32 roleId, bytes32 permissionId) external {
        require(_roleExists[roleId], "Role not found");
        require(permissionId != bytes32(0), "Permission ID cannot be zero");

        _rolePermissions[roleId][permissionId] = true;

        emit PermissionGranted(roleId, permissionId);
    }

    /// @notice Revoke a permission from a role
    /// @param roleId The role to revoke the permission from
    /// @param permissionId The permission to revoke
    function revokePermission(bytes32 roleId, bytes32 permissionId) external {
        require(_roleExists[roleId], "Role not found");

        _rolePermissions[roleId][permissionId] = false;

        emit PermissionRevoked(roleId, permissionId);
    }

    /// @notice Assign a role to a user
    /// @param userId The user to assign the role to
    /// @param roleId The role to assign
    function assignRole(bytes32 userId, bytes32 roleId) external {
        require(userId != bytes32(0), "User ID cannot be zero");
        require(_roleExists[roleId], "Role not found");
        require(!_userRoles[userId][roleId], "Role already assigned");

        _userRoles[userId][roleId] = true;
        _userRoleList[userId].push(roleId);

        emit RoleAssigned(userId, roleId);
    }

    // --- View ---

    /// @notice Check if a user has a specific permission through any of their assigned roles
    /// @param userId The user to check
    /// @param permissionId The permission to check for
    /// @return allowed Whether the user has the permission
    function checkPermission(bytes32 userId, bytes32 permissionId) external view returns (bool allowed) {
        bytes32[] storage roles = _userRoleList[userId];
        uint256 len = roles.length;

        for (uint256 i = 0; i < len; i++) {
            if (_rolePermissions[roles[i]][permissionId]) {
                return true;
            }
        }

        return false;
    }
}
