// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Property.sol";

contract PropertyTest is Test {
    Property public target;

    event PropertySet(bytes32 indexed nodeId, string key);
    event PropertyDeleted(bytes32 indexed nodeId, string key);
    event TypeDefined(string key, string propType);

    function setUp() public {
        target = new Property();
    }

    // --- set tests ---

    function test_set_stores_property() public {
        bytes32 id = keccak256("node1");
        target.set(id, "color", "blue");

        (bool found, string memory value) = target.get(id, "color");
        assertTrue(found);
        assertEq(value, "blue");
    }

    function test_set_emits_event() public {
        bytes32 id = keccak256("node1");

        vm.expectEmit(true, false, false, true);
        emit PropertySet(id, "color");

        target.set(id, "color", "blue");
    }

    function test_set_zero_id_reverts() public {
        vm.expectRevert("Node ID cannot be zero");
        target.set(bytes32(0), "key", "val");
    }

    function test_set_empty_key_reverts() public {
        vm.expectRevert("Key cannot be empty");
        target.set(keccak256("node1"), "", "val");
    }

    function test_set_overwrites_existing() public {
        bytes32 id = keccak256("node1");
        target.set(id, "color", "blue");
        target.set(id, "color", "red");

        (, string memory value) = target.get(id, "color");
        assertEq(value, "red");
    }

    // --- get tests ---

    function test_get_missing_returns_false() public {
        (bool found, string memory value) = target.get(keccak256("node1"), "missing");
        assertFalse(found);
        assertEq(bytes(value).length, 0);
    }

    // --- deleteProperty tests ---

    function test_deleteProperty_removes_property() public {
        bytes32 id = keccak256("node1");
        target.set(id, "color", "blue");
        target.deleteProperty(id, "color");

        (bool found,) = target.get(id, "color");
        assertFalse(found);
    }

    function test_deleteProperty_emits_event() public {
        bytes32 id = keccak256("node1");
        target.set(id, "color", "blue");

        vm.expectEmit(true, false, false, true);
        emit PropertyDeleted(id, "color");

        target.deleteProperty(id, "color");
    }

    function test_deleteProperty_nonexistent_reverts() public {
        vm.expectRevert("Property not found");
        target.deleteProperty(keccak256("node1"), "missing");
    }

    // --- defineType tests ---

    function test_defineType_emits_event() public {
        vm.expectEmit(false, false, false, true);
        emit TypeDefined("title", "string");

        target.defineType("title", "string");
    }

    function test_defineType_empty_key_reverts() public {
        vm.expectRevert("Key cannot be empty");
        target.defineType("", "string");
    }

    // --- listAll tests ---

    function test_listAll_returns_keys() public {
        bytes32 id = keccak256("node1");
        target.set(id, "color", "blue");
        target.set(id, "size", "large");

        string[] memory keys = target.listAll(id);
        assertEq(keys.length, 2);
    }

    function test_listAll_empty_node_returns_empty() public {
        string[] memory keys = target.listAll(keccak256("empty"));
        assertEq(keys.length, 0);
    }
}
