// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ContentHash.sol";

contract ContentHashTest is Test {
    ContentHash public target;

    event Stored(bytes32 indexed hash, uint256 size);
    event AlreadyExists(bytes32 indexed hash);
    event Deleted(bytes32 indexed hash);
    event Verified(bytes32 indexed hash, bool valid);

    function setUp() public {
        target = new ContentHash();
    }

    // --- store tests ---

    function test_store_returns_hash() public {
        bytes memory content = "hello world";
        bytes32 expectedHash = keccak256(content);

        (bytes32 hash, bool isNew) = target.store(content);

        assertEq(hash, expectedHash);
        assertTrue(isNew);
    }

    function test_store_emits_stored_event() public {
        bytes memory content = "hello world";
        bytes32 expectedHash = keccak256(content);

        vm.expectEmit(true, false, false, true);
        emit Stored(expectedHash, content.length);

        target.store(content);
    }

    function test_store_duplicate_returns_already_exists() public {
        bytes memory content = "hello world";
        target.store(content);

        (bytes32 hash, bool isNew) = target.store(content);

        assertEq(hash, keccak256(content));
        assertFalse(isNew);
    }

    function test_store_duplicate_emits_already_exists() public {
        bytes memory content = "hello world";
        target.store(content);

        bytes32 expectedHash = keccak256(content);
        vm.expectEmit(true, false, false, false);
        emit AlreadyExists(expectedHash);

        target.store(content);
    }

    function test_store_records_size() public {
        bytes memory content = "hello world";
        (bytes32 hash,) = target.store(content);

        assertEq(target.getSize(hash), content.length);
    }

    // --- retrieve tests ---

    function test_retrieve_returns_content() public {
        bytes memory content = "hello world";
        (bytes32 hash,) = target.store(content);

        bytes memory retrieved = target.retrieve(hash);
        assertEq(retrieved, content);
    }

    function test_retrieve_not_found_reverts() public {
        vm.expectRevert("Content not found");
        target.retrieve(keccak256("nonexistent"));
    }

    // --- verify tests ---

    function test_verify_valid_content() public {
        bytes memory content = "hello world";
        (bytes32 hash,) = target.store(content);

        bool valid = target.verify(hash, content);
        assertTrue(valid);
    }

    function test_verify_corrupt_content() public {
        bytes memory content = "hello world";
        (bytes32 hash,) = target.store(content);

        bool valid = target.verify(hash, "corrupted data");
        assertFalse(valid);
    }

    function test_verify_emits_event() public {
        bytes memory content = "hello world";
        (bytes32 hash,) = target.store(content);

        vm.expectEmit(true, false, false, true);
        emit Verified(hash, true);

        target.verify(hash, content);
    }

    function test_verify_not_found_reverts() public {
        vm.expectRevert("Content not found");
        target.verify(keccak256("missing"), "data");
    }

    // --- deleteContent tests ---

    function test_delete_removes_content() public {
        bytes memory content = "hello world";
        (bytes32 hash,) = target.store(content);

        target.deleteContent(hash);

        assertFalse(target.exists(hash));
    }

    function test_delete_emits_event() public {
        bytes memory content = "hello world";
        (bytes32 hash,) = target.store(content);

        vm.expectEmit(true, false, false, false);
        emit Deleted(hash);

        target.deleteContent(hash);
    }

    function test_delete_not_found_reverts() public {
        vm.expectRevert("Content not found");
        target.deleteContent(keccak256("missing"));
    }

    function test_delete_then_retrieve_reverts() public {
        bytes memory content = "hello world";
        (bytes32 hash,) = target.store(content);
        target.deleteContent(hash);

        vm.expectRevert("Content not found");
        target.retrieve(hash);
    }

    // --- exists tests ---

    function test_exists_false_for_unknown() public {
        assertFalse(target.exists(keccak256("unknown")));
    }

    function test_exists_true_after_store() public {
        (bytes32 hash,) = target.store("data");
        assertTrue(target.exists(hash));
    }
}
