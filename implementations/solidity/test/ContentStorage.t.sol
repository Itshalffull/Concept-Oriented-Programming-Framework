// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ContentStorage.sol";

contract ContentStorageTest is Test {
    ContentStorage public target;

    event Saved(bytes32 indexed nodeId);
    event Removed(bytes32 indexed nodeId);

    function setUp() public {
        target = new ContentStorage();
    }

    // --- save tests ---

    function test_save_stores_data() public {
        bytes32 id = keccak256("node1");
        target.save(id, "payload data");

        (bool found, string memory data) = target.load(id);
        assertTrue(found);
        assertEq(data, "payload data");
    }

    function test_save_emits_event() public {
        bytes32 id = keccak256("node1");

        vm.expectEmit(true, false, false, false);
        emit Saved(id);

        target.save(id, "payload");
    }

    function test_save_zero_id_reverts() public {
        vm.expectRevert("Node ID cannot be zero");
        target.save(bytes32(0), "data");
    }

    function test_save_overwrites_existing() public {
        bytes32 id = keccak256("node1");
        target.save(id, "original");
        target.save(id, "overwritten");

        (, string memory data) = target.load(id);
        assertEq(data, "overwritten");
    }

    function test_save_increments_count() public {
        assertEq(target.count(), 0);

        target.save(keccak256("a"), "data-a");
        assertEq(target.count(), 1);

        target.save(keccak256("b"), "data-b");
        assertEq(target.count(), 2);
    }

    // --- load tests ---

    function test_load_missing_returns_false() public {
        (bool found, string memory data) = target.load(keccak256("missing"));
        assertFalse(found);
        assertEq(bytes(data).length, 0);
    }

    // --- remove tests ---

    function test_remove_deletes_data() public {
        bytes32 id = keccak256("node1");
        target.save(id, "data");
        target.remove(id);

        (bool found,) = target.load(id);
        assertFalse(found);
        assertEq(target.count(), 0);
    }

    function test_remove_emits_event() public {
        bytes32 id = keccak256("node1");
        target.save(id, "data");

        vm.expectEmit(true, false, false, false);
        emit Removed(id);

        target.remove(id);
    }

    function test_remove_nonexistent_reverts() public {
        vm.expectRevert("Node not found in storage");
        target.remove(keccak256("missing"));
    }

    // --- count tests ---

    function test_count_starts_at_zero() public {
        assertEq(target.count(), 0);
    }
}
