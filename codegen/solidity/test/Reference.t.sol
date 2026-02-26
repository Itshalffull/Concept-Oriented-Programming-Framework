// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Reference.sol";

contract ReferenceTest is Test {
    Reference public target;

    event RefAdded(bytes32 indexed sourceId, bytes32 indexed targetId, string refType);
    event RefRemoved(bytes32 indexed sourceId, bytes32 indexed targetId);

    function setUp() public {
        target = new Reference();
    }

    // --- addRef tests ---

    function test_addRef_creates_reference() public {
        bytes32 source = keccak256("pageA");
        bytes32 dest = keccak256("pageB");

        target.addRef(source, dest, "link");

        assertTrue(target.hasRef(source, dest));
    }

    function test_addRef_emits_event() public {
        bytes32 source = keccak256("pageA");
        bytes32 dest = keccak256("pageB");

        vm.expectEmit(true, true, false, true);
        emit RefAdded(source, dest, "link");

        target.addRef(source, dest, "link");
    }

    function test_addRef_zero_source_reverts() public {
        vm.expectRevert("Source ID cannot be zero");
        target.addRef(bytes32(0), keccak256("target"), "link");
    }

    function test_addRef_zero_target_reverts() public {
        vm.expectRevert("Target ID cannot be zero");
        target.addRef(keccak256("source"), bytes32(0), "link");
    }

    function test_addRef_duplicate_reverts() public {
        bytes32 source = keccak256("pageA");
        bytes32 dest = keccak256("pageB");

        target.addRef(source, dest, "link");

        vm.expectRevert("Reference already exists");
        target.addRef(source, dest, "embed");
    }

    // --- removeRef tests ---

    function test_removeRef_deletes_reference() public {
        bytes32 source = keccak256("pageA");
        bytes32 dest = keccak256("pageB");

        target.addRef(source, dest, "link");
        target.removeRef(source, dest);

        assertFalse(target.hasRef(source, dest));
    }

    function test_removeRef_emits_event() public {
        bytes32 source = keccak256("pageA");
        bytes32 dest = keccak256("pageB");

        target.addRef(source, dest, "link");

        vm.expectEmit(true, true, false, false);
        emit RefRemoved(source, dest);

        target.removeRef(source, dest);
    }

    function test_removeRef_nonexistent_reverts() public {
        vm.expectRevert("Reference not found");
        target.removeRef(keccak256("a"), keccak256("b"));
    }

    // --- getRefs tests ---

    function test_getRefs_returns_targets() public {
        bytes32 source = keccak256("pageA");
        bytes32 t1 = keccak256("pageB");
        bytes32 t2 = keccak256("pageC");

        target.addRef(source, t1, "link");
        target.addRef(source, t2, "embed");

        bytes32[] memory refs = target.getRefs(source);
        assertEq(refs.length, 2);
    }

    function test_getRefs_empty_returns_empty() public {
        bytes32[] memory refs = target.getRefs(keccak256("empty"));
        assertEq(refs.length, 0);
    }

    // --- hasRef tests ---

    function test_hasRef_returns_false_for_missing() public {
        assertFalse(target.hasRef(keccak256("a"), keccak256("b")));
    }
}
