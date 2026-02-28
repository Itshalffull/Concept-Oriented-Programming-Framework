// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Web3Content.sol";

contract Web3ContentTest is Test {
    Web3Content public target;

    event Stored(bytes32 indexed cid, string name, uint256 size);
    event Pinned(bytes32 indexed cid);
    event Unpinned(bytes32 indexed cid);

    function setUp() public {
        target = new Web3Content();
    }

    // --- store tests ---

    function test_store_creates_content() public {
        bytes memory data = "hello world";
        (bytes32 cid, uint256 size) = target.store(data, "greeting.txt", "text/plain");

        assertEq(cid, keccak256(data));
        assertEq(size, data.length);

        (bytes memory resolved, string memory ct, uint256 resolvedSize) = target.resolve(cid);
        assertEq(resolved, data);
        assertEq(ct, "text/plain");
        assertEq(resolvedSize, data.length);
    }

    function test_store_emits_event() public {
        bytes memory data = "hello world";
        bytes32 expectedCid = keccak256(data);

        vm.expectEmit(true, false, false, true);
        emit Stored(expectedCid, "greeting.txt", data.length);

        target.store(data, "greeting.txt", "text/plain");
    }

    function test_store_empty_data_reverts() public {
        vm.expectRevert("Data cannot be empty");
        target.store("", "name.txt", "text/plain");
    }

    function test_store_empty_name_reverts() public {
        vm.expectRevert("Name cannot be empty");
        target.store("data", "", "text/plain");
    }

    function test_store_empty_contentType_reverts() public {
        vm.expectRevert("Content type cannot be empty");
        target.store("data", "name.txt", "");
    }

    function test_store_duplicate_cid_reverts() public {
        bytes memory data = "hello world";
        target.store(data, "first.txt", "text/plain");

        vm.expectRevert("Content with this CID already exists");
        target.store(data, "second.txt", "text/plain");
    }

    function test_store_increments_count() public {
        assertEq(target.contentCount(), 0);

        target.store("data1", "file1.txt", "text/plain");
        assertEq(target.contentCount(), 1);

        target.store("data2", "file2.txt", "text/plain");
        assertEq(target.contentCount(), 2);
    }

    // --- resolve tests ---

    function test_resolve_returns_content() public {
        bytes memory data = hex"deadbeef";
        (bytes32 cid, ) = target.store(data, "binary.bin", "application/octet-stream");

        (bytes memory resolved, string memory ct, uint256 size) = target.resolve(cid);
        assertEq(resolved, data);
        assertEq(ct, "application/octet-stream");
        assertEq(size, 4);
    }

    function test_resolve_nonexistent_reverts() public {
        vm.expectRevert("Content not found");
        target.resolve(keccak256("nonexistent"));
    }

    // --- pin tests ---

    function test_pin_sets_pinned_state() public {
        bytes memory data = "pinnable";
        (bytes32 cid, ) = target.store(data, "pin.txt", "text/plain");

        target.pin(cid);

        (, , , , bool pinned) = target.getMetadata(cid);
        assertTrue(pinned);
    }

    function test_pin_emits_event() public {
        bytes memory data = "pinnable";
        (bytes32 cid, ) = target.store(data, "pin.txt", "text/plain");

        vm.expectEmit(true, false, false, false);
        emit Pinned(cid);

        target.pin(cid);
    }

    function test_pin_nonexistent_reverts() public {
        vm.expectRevert("Content not found");
        target.pin(keccak256("nonexistent"));
    }

    function test_pin_already_pinned_reverts() public {
        bytes memory data = "pinnable";
        (bytes32 cid, ) = target.store(data, "pin.txt", "text/plain");
        target.pin(cid);

        vm.expectRevert("Content already pinned");
        target.pin(cid);
    }

    // --- unpin tests ---

    function test_unpin_clears_pinned_state() public {
        bytes memory data = "unpinnable";
        (bytes32 cid, ) = target.store(data, "unpin.txt", "text/plain");
        target.pin(cid);
        target.unpin(cid);

        (, , , , bool pinned) = target.getMetadata(cid);
        assertFalse(pinned);
    }

    function test_unpin_emits_event() public {
        bytes memory data = "unpinnable";
        (bytes32 cid, ) = target.store(data, "unpin.txt", "text/plain");
        target.pin(cid);

        vm.expectEmit(true, false, false, false);
        emit Unpinned(cid);

        target.unpin(cid);
    }

    function test_unpin_nonexistent_reverts() public {
        vm.expectRevert("Content not found");
        target.unpin(keccak256("nonexistent"));
    }

    function test_unpin_not_pinned_reverts() public {
        bytes memory data = "notpinned";
        (bytes32 cid, ) = target.store(data, "notpinned.txt", "text/plain");

        vm.expectRevert("Content not pinned");
        target.unpin(cid);
    }

    // --- pin/unpin toggle ---

    function test_pin_unpin_toggle() public {
        bytes memory data = "toggle";
        (bytes32 cid, ) = target.store(data, "toggle.txt", "text/plain");

        // Initially not pinned
        (, , , , bool pinned0) = target.getMetadata(cid);
        assertFalse(pinned0);

        // Pin
        target.pin(cid);
        (, , , , bool pinned1) = target.getMetadata(cid);
        assertTrue(pinned1);

        // Unpin
        target.unpin(cid);
        (, , , , bool pinned2) = target.getMetadata(cid);
        assertFalse(pinned2);

        // Re-pin
        target.pin(cid);
        (, , , , bool pinned3) = target.getMetadata(cid);
        assertTrue(pinned3);
    }

    // --- getMetadata tests ---

    function test_getMetadata_returns_details() public {
        bytes memory data = "metadata test";
        (bytes32 cid, ) = target.store(data, "meta.txt", "text/plain");

        (bool exists, string memory name, string memory ct, uint256 size, bool pinned) = target.getMetadata(cid);
        assertTrue(exists);
        assertEq(name, "meta.txt");
        assertEq(ct, "text/plain");
        assertEq(size, data.length);
        assertFalse(pinned);
    }

    function test_getMetadata_unknown_returns_false() public {
        (bool exists, , , , ) = target.getMetadata(keccak256("unknown"));
        assertFalse(exists);
    }
}
