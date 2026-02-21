// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Follow.sol";

contract FollowTest is Test {
    Follow public target;

    event Followed(bytes32 indexed user, bytes32 indexed followTarget);
    event Unfollowed(bytes32 indexed user, bytes32 indexed followTarget);

    function setUp() public {
        target = new Follow();
    }

    // --- follow tests ---

    function test_follow_creates_relationship() public {
        bytes32 user = keccak256("alice");
        bytes32 followTarget = keccak256("bob");

        target.follow(user, followTarget);

        assertTrue(target.isFollowing(user, followTarget));
    }

    function test_follow_emits_event() public {
        bytes32 user = keccak256("alice");
        bytes32 followTarget = keccak256("bob");

        vm.expectEmit(true, true, false, false);
        emit Followed(user, followTarget);

        target.follow(user, followTarget);
    }

    function test_follow_zero_user_reverts() public {
        vm.expectRevert("User cannot be zero");
        target.follow(bytes32(0), keccak256("bob"));
    }

    function test_follow_zero_target_reverts() public {
        vm.expectRevert("Target cannot be zero");
        target.follow(keccak256("alice"), bytes32(0));
    }

    function test_follow_self_reverts() public {
        bytes32 user = keccak256("alice");

        vm.expectRevert("Cannot follow yourself");
        target.follow(user, user);
    }

    function test_follow_duplicate_reverts() public {
        bytes32 user = keccak256("alice");
        bytes32 followTarget = keccak256("bob");

        target.follow(user, followTarget);

        vm.expectRevert("Already following");
        target.follow(user, followTarget);
    }

    // --- unfollow tests ---

    function test_unfollow_removes_relationship() public {
        bytes32 user = keccak256("alice");
        bytes32 followTarget = keccak256("bob");

        target.follow(user, followTarget);
        target.unfollow(user, followTarget);

        assertFalse(target.isFollowing(user, followTarget));
    }

    function test_unfollow_emits_event() public {
        bytes32 user = keccak256("alice");
        bytes32 followTarget = keccak256("bob");

        target.follow(user, followTarget);

        vm.expectEmit(true, true, false, false);
        emit Unfollowed(user, followTarget);

        target.unfollow(user, followTarget);
    }

    function test_unfollow_not_following_reverts() public {
        vm.expectRevert("Not following");
        target.unfollow(keccak256("alice"), keccak256("bob"));
    }

    // --- isFollowing tests ---

    function test_isFollowing_returns_false_by_default() public {
        assertFalse(target.isFollowing(keccak256("alice"), keccak256("bob")));
    }

    function test_isFollowing_not_symmetric() public {
        bytes32 alice = keccak256("alice");
        bytes32 bob = keccak256("bob");

        target.follow(alice, bob);

        assertTrue(target.isFollowing(alice, bob));
        assertFalse(target.isFollowing(bob, alice));
    }
}
