// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Ref.sol";

contract RefTest is Test {
    Ref public target;

    event RefCreated(bytes32 indexed nameHash, bytes32 indexed targetHash);
    event RefUpdated(bytes32 indexed nameHash, bytes32 indexed oldTarget, bytes32 indexed newTarget);
    event RefDeleted(bytes32 indexed nameHash);

    function setUp() public {
        target = new Ref();
    }

    // --- create tests ---

    function test_create_stores_ref() public {
        bytes32 hash = keccak256("content-v1");
        target.create("main", hash);

        bytes32 resolved = target.resolve("main");
        assertEq(resolved, hash);
    }

    function test_create_emits_event() public {
        bytes32 hash = keccak256("content-v1");
        bytes32 nameHash = keccak256(abi.encodePacked("main"));

        vm.expectEmit(true, true, false, false);
        emit RefCreated(nameHash, hash);

        target.create("main", hash);
    }

    function test_create_duplicate_reverts() public {
        bytes32 hash = keccak256("content-v1");
        target.create("main", hash);

        vm.expectRevert("Ref already exists");
        target.create("main", keccak256("content-v2"));
    }

    // --- resolve tests ---

    function test_resolve_returns_hash() public {
        bytes32 hash = keccak256("abc123");
        target.create("feature", hash);

        assertEq(target.resolve("feature"), hash);
    }

    function test_resolve_not_found_reverts() public {
        vm.expectRevert("Ref not found");
        target.resolve("nonexistent");
    }

    // --- update tests ---

    function test_update_with_correct_old_hash() public {
        bytes32 v1 = keccak256("v1");
        bytes32 v2 = keccak256("v2");

        target.create("main", v1);
        target.update("main", v2, v1);

        assertEq(target.resolve("main"), v2);
    }

    function test_update_with_wrong_old_hash_reverts() public {
        bytes32 v1 = keccak256("v1");
        bytes32 v2 = keccak256("v2");
        bytes32 wrongOld = keccak256("wrong");

        target.create("main", v1);

        vm.expectRevert("Conflict: current hash does not match expected");
        target.update("main", v2, wrongOld);
    }

    function test_update_nonexistent_reverts() public {
        vm.expectRevert("Ref not found");
        target.update("missing", keccak256("v2"), keccak256("v1"));
    }

    function test_update_emits_event() public {
        bytes32 v1 = keccak256("v1");
        bytes32 v2 = keccak256("v2");
        bytes32 nameHash = keccak256(abi.encodePacked("main"));

        target.create("main", v1);

        vm.expectEmit(true, true, true, false);
        emit RefUpdated(nameHash, v1, v2);

        target.update("main", v2, v1);
    }

    // --- deleteRef tests ---

    function test_delete_removes_ref() public {
        bytes32 hash = keccak256("content");
        target.create("temp", hash);
        target.deleteRef("temp");

        vm.expectRevert("Ref not found");
        target.resolve("temp");
    }

    function test_delete_nonexistent_reverts() public {
        vm.expectRevert("Ref not found");
        target.deleteRef("ghost");
    }

    // --- log tests ---

    function test_log_records_create_and_update() public {
        bytes32 v1 = keccak256("v1");
        bytes32 v2 = keccak256("v2");

        target.create("main", v1);
        target.update("main", v2, v1);

        Ref.LogEntry[] memory entries = target.log("main");
        assertEq(entries.length, 2);
        assertEq(entries[0].oldHash, bytes32(0));
        assertEq(entries[0].newHash, v1);
        assertEq(entries[1].oldHash, v1);
        assertEq(entries[1].newHash, v2);
    }

    function test_log_empty_for_unknown() public {
        Ref.LogEntry[] memory entries = target.log("unknown");
        assertEq(entries.length, 0);
    }

    function test_log_records_delete() public {
        bytes32 hash = keccak256("content");
        target.create("temp", hash);
        target.deleteRef("temp");

        Ref.LogEntry[] memory entries = target.log("temp");
        assertEq(entries.length, 2);
        assertEq(entries[1].oldHash, hash);
        assertEq(entries[1].newHash, bytes32(0));
    }
}
