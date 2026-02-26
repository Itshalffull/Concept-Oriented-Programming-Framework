// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Profile.sol";

contract ProfileTest is Test {
    Profile public target;

    event ProfileUpdated(bytes32 indexed user, string bio, string image);

    function setUp() public {
        target = new Profile();
    }

    // --- update tests ---

    function test_update_stores_profile() public {
        bytes32 user = keccak256("alice");
        target.update(user, "Hello, I am Alice", "https://example.com/alice.jpg");

        (bool found, string memory bio, string memory image) = target.get(user);
        assertTrue(found, "Profile should be found");
        assertEq(bio, "Hello, I am Alice", "Bio should match");
        assertEq(image, "https://example.com/alice.jpg", "Image should match");
    }

    function test_update_emits_event() public {
        bytes32 user = keccak256("alice");

        vm.expectEmit(true, false, false, true);
        emit ProfileUpdated(user, "bio", "img");

        target.update(user, "bio", "img");
    }

    function test_update_zero_user_reverts() public {
        vm.expectRevert("User ID cannot be zero");
        target.update(bytes32(0), "bio", "img");
    }

    function test_update_overwrites_profile() public {
        bytes32 user = keccak256("alice");
        target.update(user, "old bio", "old img");
        target.update(user, "new bio", "new img");

        (, string memory bio, string memory image) = target.get(user);
        assertEq(bio, "new bio", "Bio should be overwritten");
        assertEq(image, "new img", "Image should be overwritten");
    }

    function test_update_empty_values_allowed() public {
        bytes32 user = keccak256("alice");
        target.update(user, "", "");

        (bool found, string memory bio, string memory image) = target.get(user);
        assertTrue(found, "Profile with empty values should still be found");
        assertEq(bytes(bio).length, 0, "Bio should be empty");
        assertEq(bytes(image).length, 0, "Image should be empty");
    }

    // --- get tests ---

    function test_get_nonexistent_returns_false() public view {
        (bool found, string memory bio, string memory image) = target.get(keccak256("missing"));
        assertFalse(found, "Nonexistent profile should return false");
        assertEq(bytes(bio).length, 0, "Bio should be empty");
        assertEq(bytes(image).length, 0, "Image should be empty");
    }
}
