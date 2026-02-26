// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Cache.sol";

contract CacheTest is Test {
    Cache public target;

    event CacheSet(bytes32 indexed key);
    event CacheInvalidated(bytes32 indexed key);

    function setUp() public {
        target = new Cache();
    }

    // --- set tests ---

    function test_set_stores_entry() public {
        bytes32 key = keccak256("key1");
        target.set(key, "value1", "tag1,tag2", 60);

        (bool hit, string memory value) = target.get(key);
        assertTrue(hit, "Cache should hit");
        assertEq(value, "value1", "Cached value should match");
    }

    function test_set_emits_event() public {
        bytes32 key = keccak256("key1");

        vm.expectEmit(true, false, false, false);
        emit CacheSet(key);

        target.set(key, "val", "tags", 0);
    }

    function test_set_zero_key_reverts() public {
        vm.expectRevert("Cache key cannot be zero");
        target.set(bytes32(0), "val", "tags", 0);
    }

    // --- get tests ---

    function test_get_miss_returns_false() public view {
        (bool hit, string memory value) = target.get(keccak256("missing"));
        assertFalse(hit, "Non-existent key should miss");
        assertEq(bytes(value).length, 0, "Value should be empty");
    }

    function test_get_expired_entry_returns_false() public {
        bytes32 key = keccak256("key1");
        target.set(key, "val", "tags", 10);

        // Warp time forward past maxAge
        vm.warp(block.timestamp + 11);

        (bool hit,) = target.get(key);
        assertFalse(hit, "Expired entry should miss");
    }

    function test_get_no_expiry_always_hits() public {
        bytes32 key = keccak256("key1");
        target.set(key, "val", "tags", 0);

        vm.warp(block.timestamp + 999999);

        (bool hit, string memory value) = target.get(key);
        assertTrue(hit, "Zero maxAge should never expire");
        assertEq(value, "val", "Value should persist");
    }

    // --- invalidate tests ---

    function test_invalidate_removes_entry() public {
        bytes32 key = keccak256("key1");
        target.set(key, "val", "tags", 0);
        target.invalidate(key);

        assertFalse(target.cacheExists(key), "Entry should be removed");
    }

    function test_invalidate_emits_event() public {
        bytes32 key = keccak256("key1");
        target.set(key, "val", "tags", 0);

        vm.expectEmit(true, false, false, false);
        emit CacheInvalidated(key);

        target.invalidate(key);
    }

    function test_invalidate_nonexistent_reverts() public {
        vm.expectRevert("Cache entry not found");
        target.invalidate(keccak256("missing"));
    }

    // --- cacheExists tests ---

    function test_cacheExists_false_for_missing() public view {
        assertFalse(target.cacheExists(keccak256("missing")), "Missing key should not exist");
    }

    function test_cacheExists_true_after_set() public {
        bytes32 key = keccak256("key1");
        target.set(key, "val", "", 0);
        assertTrue(target.cacheExists(key), "Key should exist after set");
    }
}
