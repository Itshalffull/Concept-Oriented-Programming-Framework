// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Alias.sol";

contract AliasTest is Test {
    Alias public target;

    event AliasAdded(bytes32 indexed entityId, string aliasName);
    event AliasRemoved(bytes32 indexed entityId, string aliasName);

    function setUp() public {
        target = new Alias();
    }

    // --- addAlias tests ---

    function test_addAlias_creates_alias() public {
        bytes32 entityId = keccak256("page1");
        target.addAlias(entityId, "my-page");

        (bool found, bytes32 resolved) = target.resolve("my-page");
        assertTrue(found);
        assertEq(resolved, entityId);
    }

    function test_addAlias_emits_event() public {
        bytes32 entityId = keccak256("page1");

        vm.expectEmit(true, false, false, true);
        emit AliasAdded(entityId, "my-page");

        target.addAlias(entityId, "my-page");
    }

    function test_addAlias_zero_entity_reverts() public {
        vm.expectRevert("Entity ID cannot be zero");
        target.addAlias(bytes32(0), "alias");
    }

    function test_addAlias_empty_name_reverts() public {
        vm.expectRevert("Alias name cannot be empty");
        target.addAlias(keccak256("entity"), "");
    }

    function test_addAlias_duplicate_name_reverts() public {
        target.addAlias(keccak256("entity1"), "shared-name");

        vm.expectRevert("Alias already taken");
        target.addAlias(keccak256("entity2"), "shared-name");
    }

    function test_addAlias_multiple_per_entity() public {
        bytes32 entityId = keccak256("page1");

        target.addAlias(entityId, "alias-one");
        target.addAlias(entityId, "alias-two");

        (bool found1, bytes32 r1) = target.resolve("alias-one");
        (bool found2, bytes32 r2) = target.resolve("alias-two");

        assertTrue(found1);
        assertTrue(found2);
        assertEq(r1, entityId);
        assertEq(r2, entityId);
    }

    // --- removeAlias tests ---

    function test_removeAlias_deletes_alias() public {
        bytes32 entityId = keccak256("page1");
        target.addAlias(entityId, "my-page");
        target.removeAlias(entityId, "my-page");

        (bool found,) = target.resolve("my-page");
        assertFalse(found);
    }

    function test_removeAlias_emits_event() public {
        bytes32 entityId = keccak256("page1");
        target.addAlias(entityId, "my-page");

        vm.expectEmit(true, false, false, true);
        emit AliasRemoved(entityId, "my-page");

        target.removeAlias(entityId, "my-page");
    }

    function test_removeAlias_nonexistent_reverts() public {
        vm.expectRevert("Alias not found");
        target.removeAlias(keccak256("entity"), "missing");
    }

    function test_removeAlias_wrong_entity_reverts() public {
        bytes32 entity1 = keccak256("entity1");
        bytes32 entity2 = keccak256("entity2");

        target.addAlias(entity1, "my-alias");

        vm.expectRevert("Alias does not belong to this entity");
        target.removeAlias(entity2, "my-alias");
    }

    // --- resolve tests ---

    function test_resolve_missing_returns_false() public {
        (bool found, bytes32 entityId) = target.resolve("nonexistent");
        assertFalse(found);
        assertEq(entityId, bytes32(0));
    }
}
