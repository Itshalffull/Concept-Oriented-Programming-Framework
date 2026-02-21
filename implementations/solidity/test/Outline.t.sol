// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Outline.sol";

contract OutlineTest is Test {
    Outline public target;

    event Reparented(bytes32 indexed nodeId, bytes32 indexed newParentId);
    event Collapsed(bytes32 indexed nodeId);
    event Expanded(bytes32 indexed nodeId);

    function setUp() public {
        target = new Outline();
    }

    // --- register tests ---

    function test_register_adds_node() public {
        bytes32 id = keccak256("node1");
        bytes32 parentId = bytes32(0); // root-level

        target.register(id, parentId, 0);

        bytes32[] memory children = target.getChildren(parentId);
        assertEq(children.length, 1);
        assertEq(children[0], id);
    }

    function test_register_zero_id_reverts() public {
        vm.expectRevert("Node ID cannot be zero");
        target.register(bytes32(0), bytes32(0), 0);
    }

    function test_register_duplicate_reverts() public {
        bytes32 id = keccak256("node1");
        target.register(id, bytes32(0), 0);

        vm.expectRevert("Node already registered");
        target.register(id, bytes32(0), 1);
    }

    // --- reparent tests ---

    function test_reparent_moves_node() public {
        bytes32 parent1 = keccak256("parent1");
        bytes32 parent2 = keccak256("parent2");
        bytes32 child = keccak256("child");

        target.register(parent1, bytes32(0), 0);
        target.register(parent2, bytes32(0), 1);
        target.register(child, parent1, 0);

        target.reparent(child, parent2, 0);

        assertEq(target.getParent(child), parent2);
        assertEq(target.getChildren(parent1).length, 0);
        assertEq(target.getChildren(parent2).length, 1);
    }

    function test_reparent_emits_event() public {
        bytes32 parent = keccak256("parent");
        bytes32 child = keccak256("child");

        target.register(child, bytes32(0), 0);
        target.register(parent, bytes32(0), 1);

        vm.expectEmit(true, true, false, false);
        emit Reparented(child, parent);

        target.reparent(child, parent, 0);
    }

    function test_reparent_nonexistent_reverts() public {
        vm.expectRevert("Node not found");
        target.reparent(keccak256("missing"), bytes32(0), 0);
    }

    // --- collapse / expand tests ---

    function test_collapse_sets_collapsed() public {
        bytes32 id = keccak256("node1");
        target.register(id, bytes32(0), 0);

        target.collapse(id);
        assertTrue(target.isCollapsed(id));
    }

    function test_collapse_emits_event() public {
        bytes32 id = keccak256("node1");
        target.register(id, bytes32(0), 0);

        vm.expectEmit(true, false, false, false);
        emit Collapsed(id);

        target.collapse(id);
    }

    function test_collapse_nonexistent_reverts() public {
        vm.expectRevert("Node not found");
        target.collapse(keccak256("missing"));
    }

    function test_expand_clears_collapsed() public {
        bytes32 id = keccak256("node1");
        target.register(id, bytes32(0), 0);

        target.collapse(id);
        target.expand(id);
        assertFalse(target.isCollapsed(id));
    }

    function test_expand_emits_event() public {
        bytes32 id = keccak256("node1");
        target.register(id, bytes32(0), 0);

        vm.expectEmit(true, false, false, false);
        emit Expanded(id);

        target.expand(id);
    }

    function test_expand_nonexistent_reverts() public {
        vm.expectRevert("Node not found");
        target.expand(keccak256("missing"));
    }

    // --- getParent tests ---

    function test_getParent_returns_parent() public {
        bytes32 parent = keccak256("parent");
        bytes32 child = keccak256("child");

        target.register(parent, bytes32(0), 0);
        target.register(child, parent, 0);

        assertEq(target.getParent(child), parent);
    }

    function test_getParent_nonexistent_reverts() public {
        vm.expectRevert("Node not found");
        target.getParent(keccak256("missing"));
    }

    // --- isCollapsed tests ---

    function test_isCollapsed_default_false() public {
        bytes32 id = keccak256("node1");
        target.register(id, bytes32(0), 0);

        assertFalse(target.isCollapsed(id));
    }
}
