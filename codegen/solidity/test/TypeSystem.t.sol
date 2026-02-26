// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TypeSystem.sol";

contract TypeSystemTest is Test {
    TypeSystem public target;

    event TypeRegistered(bytes32 indexed typeId);

    function setUp() public {
        target = new TypeSystem();
    }

    // --- registerType tests ---

    function test_registerType_stores_type() public {
        bytes32 id = keccak256("string");
        target.registerType(id, "A string type", "maxLength=255");

        (bool found, string memory def) = target.resolve(id);
        assertTrue(found);
        assertEq(def, "A string type");
    }

    function test_registerType_emits_event() public {
        bytes32 id = keccak256("string");

        vm.expectEmit(true, false, false, false);
        emit TypeRegistered(id);

        target.registerType(id, "A string type", "maxLength=255");
    }

    function test_registerType_zero_id_reverts() public {
        vm.expectRevert("Type ID cannot be zero");
        target.registerType(bytes32(0), "def", "constraints");
    }

    function test_registerType_duplicate_reverts() public {
        bytes32 id = keccak256("string");
        target.registerType(id, "def", "constraints");

        vm.expectRevert("Type already registered");
        target.registerType(id, "def2", "constraints2");
    }

    // --- resolve tests ---

    function test_resolve_missing_returns_false() public {
        (bool found, string memory def) = target.resolve(keccak256("missing"));
        assertFalse(found);
        assertEq(bytes(def).length, 0);
    }

    // --- exists tests ---

    function test_exists_returns_false_for_unknown() public {
        assertFalse(target.exists(keccak256("unknown")));
    }

    function test_exists_returns_true_after_register() public {
        bytes32 id = keccak256("string");
        target.registerType(id, "def", "constraints");
        assertTrue(target.exists(id));
    }
}
