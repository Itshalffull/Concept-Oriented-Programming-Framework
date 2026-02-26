// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Authorization.sol";

contract AuthorizationTest is Test {
    Authorization public target;

    event PermissionGranted(bytes32 indexed roleId, bytes32 permissionId);
    event PermissionRevoked(bytes32 indexed roleId, bytes32 permissionId);
    event RoleAssigned(bytes32 indexed userId, bytes32 roleId);

    function setUp() public {
        target = new Authorization();
    }

    // --- createRole tests ---

    function test_createRole_succeeds() public {
        bytes32 roleId = keccak256("admin");
        target.createRole(roleId);

        // Verify role exists by granting a permission (would revert if role missing)
        target.grantPermission(roleId, keccak256("read"));
    }

    function test_createRole_zero_id_reverts() public {
        vm.expectRevert("Role ID cannot be zero");
        target.createRole(bytes32(0));
    }

    function test_createRole_duplicate_reverts() public {
        bytes32 roleId = keccak256("admin");
        target.createRole(roleId);

        vm.expectRevert("Role already exists");
        target.createRole(roleId);
    }

    // --- grantPermission tests ---

    function test_grantPermission_enables_check() public {
        bytes32 roleId = keccak256("admin");
        bytes32 permId = keccak256("write");
        bytes32 userId = keccak256("alice");

        target.createRole(roleId);
        target.grantPermission(roleId, permId);
        target.assignRole(userId, roleId);

        assertTrue(target.checkPermission(userId, permId));
    }

    function test_grantPermission_emits_event() public {
        bytes32 roleId = keccak256("admin");
        bytes32 permId = keccak256("write");

        target.createRole(roleId);

        vm.expectEmit(true, false, false, true);
        emit PermissionGranted(roleId, permId);

        target.grantPermission(roleId, permId);
    }

    function test_grantPermission_nonexistent_role_reverts() public {
        vm.expectRevert("Role not found");
        target.grantPermission(keccak256("missing"), keccak256("perm"));
    }

    function test_grantPermission_zero_permission_reverts() public {
        bytes32 roleId = keccak256("admin");
        target.createRole(roleId);

        vm.expectRevert("Permission ID cannot be zero");
        target.grantPermission(roleId, bytes32(0));
    }

    // --- revokePermission tests ---

    function test_revokePermission_disables_check() public {
        bytes32 roleId = keccak256("admin");
        bytes32 permId = keccak256("write");
        bytes32 userId = keccak256("alice");

        target.createRole(roleId);
        target.grantPermission(roleId, permId);
        target.assignRole(userId, roleId);
        target.revokePermission(roleId, permId);

        assertFalse(target.checkPermission(userId, permId));
    }

    function test_revokePermission_emits_event() public {
        bytes32 roleId = keccak256("admin");
        bytes32 permId = keccak256("write");

        target.createRole(roleId);
        target.grantPermission(roleId, permId);

        vm.expectEmit(true, false, false, true);
        emit PermissionRevoked(roleId, permId);

        target.revokePermission(roleId, permId);
    }

    function test_revokePermission_nonexistent_role_reverts() public {
        vm.expectRevert("Role not found");
        target.revokePermission(keccak256("missing"), keccak256("perm"));
    }

    // --- assignRole tests ---

    function test_assignRole_emits_event() public {
        bytes32 roleId = keccak256("admin");
        bytes32 userId = keccak256("alice");

        target.createRole(roleId);

        vm.expectEmit(true, false, false, true);
        emit RoleAssigned(userId, roleId);

        target.assignRole(userId, roleId);
    }

    function test_assignRole_zero_user_reverts() public {
        bytes32 roleId = keccak256("admin");
        target.createRole(roleId);

        vm.expectRevert("User ID cannot be zero");
        target.assignRole(bytes32(0), roleId);
    }

    function test_assignRole_nonexistent_role_reverts() public {
        vm.expectRevert("Role not found");
        target.assignRole(keccak256("alice"), keccak256("missing"));
    }

    function test_assignRole_duplicate_reverts() public {
        bytes32 roleId = keccak256("admin");
        bytes32 userId = keccak256("alice");

        target.createRole(roleId);
        target.assignRole(userId, roleId);

        vm.expectRevert("Role already assigned");
        target.assignRole(userId, roleId);
    }

    // --- checkPermission tests ---

    function test_checkPermission_returns_false_without_role() public {
        assertFalse(target.checkPermission(keccak256("alice"), keccak256("write")));
    }

    function test_checkPermission_multi_role() public {
        bytes32 role1 = keccak256("reader");
        bytes32 role2 = keccak256("writer");
        bytes32 readPerm = keccak256("read");
        bytes32 writePerm = keccak256("write");
        bytes32 userId = keccak256("alice");

        target.createRole(role1);
        target.createRole(role2);
        target.grantPermission(role1, readPerm);
        target.grantPermission(role2, writePerm);
        target.assignRole(userId, role1);
        target.assignRole(userId, role2);

        assertTrue(target.checkPermission(userId, readPerm));
        assertTrue(target.checkPermission(userId, writePerm));
    }
}
