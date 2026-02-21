// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Session.sol";

contract SessionTest is Test {
    Session public target;

    event Created(bytes32 indexed sessionId, bytes32 indexed userId);
    event Destroyed(bytes32 indexed sessionId);
    event Refreshed(bytes32 indexed sessionId);

    function setUp() public {
        target = new Session();
    }

    // --- create tests ---

    function test_create_makes_valid_session() public {
        bytes32 sessionId = keccak256("sess1");
        bytes32 userId = keccak256("alice");

        target.create(sessionId, userId, "Chrome", 3600);

        (bool valid, bytes32 returnedUser) = target.validate(sessionId);
        assertTrue(valid);
        assertEq(returnedUser, userId);
    }

    function test_create_emits_event() public {
        bytes32 sessionId = keccak256("sess1");
        bytes32 userId = keccak256("alice");

        vm.expectEmit(true, true, false, false);
        emit Created(sessionId, userId);

        target.create(sessionId, userId, "Chrome", 3600);
    }

    function test_create_zero_session_id_reverts() public {
        vm.expectRevert("Session ID cannot be zero");
        target.create(bytes32(0), keccak256("alice"), "Chrome", 3600);
    }

    function test_create_zero_user_id_reverts() public {
        vm.expectRevert("User ID cannot be zero");
        target.create(keccak256("sess1"), bytes32(0), "Chrome", 3600);
    }

    function test_create_duplicate_reverts() public {
        bytes32 sessionId = keccak256("sess1");
        target.create(sessionId, keccak256("alice"), "Chrome", 3600);

        vm.expectRevert("Session already exists");
        target.create(sessionId, keccak256("bob"), "Firefox", 3600);
    }

    function test_create_zero_duration_reverts() public {
        vm.expectRevert("Duration must be positive");
        target.create(keccak256("sess1"), keccak256("alice"), "Chrome", 0);
    }

    // --- validate tests ---

    function test_validate_expired_session_returns_false() public {
        bytes32 sessionId = keccak256("sess1");
        target.create(sessionId, keccak256("alice"), "Chrome", 100);

        // Warp time forward past expiration
        vm.warp(block.timestamp + 200);

        (bool valid,) = target.validate(sessionId);
        assertFalse(valid);
    }

    function test_validate_nonexistent_returns_false() public {
        (bool valid, bytes32 userId) = target.validate(keccak256("missing"));
        assertFalse(valid);
        assertEq(userId, bytes32(0));
    }

    // --- refresh tests ---

    function test_refresh_extends_expiration() public {
        bytes32 sessionId = keccak256("sess1");
        target.create(sessionId, keccak256("alice"), "Chrome", 100);

        // Warp to near expiration
        vm.warp(block.timestamp + 90);

        target.refresh(sessionId, 200);

        // Should still be valid after original expiration
        vm.warp(block.timestamp + 150);

        (bool valid,) = target.validate(sessionId);
        assertTrue(valid);
    }

    function test_refresh_emits_event() public {
        bytes32 sessionId = keccak256("sess1");
        target.create(sessionId, keccak256("alice"), "Chrome", 3600);

        vm.expectEmit(true, false, false, false);
        emit Refreshed(sessionId);

        target.refresh(sessionId, 7200);
    }

    function test_refresh_nonexistent_reverts() public {
        vm.expectRevert("Session not found");
        target.refresh(keccak256("missing"), 3600);
    }

    function test_refresh_inactive_session_reverts() public {
        bytes32 sessionId = keccak256("sess1");
        target.create(sessionId, keccak256("alice"), "Chrome", 3600);
        target.destroy(sessionId);

        vm.expectRevert("Session is not active");
        target.refresh(sessionId, 3600);
    }

    function test_refresh_zero_duration_reverts() public {
        bytes32 sessionId = keccak256("sess1");
        target.create(sessionId, keccak256("alice"), "Chrome", 3600);

        vm.expectRevert("Duration must be positive");
        target.refresh(sessionId, 0);
    }

    // --- destroy tests ---

    function test_destroy_deactivates_session() public {
        bytes32 sessionId = keccak256("sess1");
        target.create(sessionId, keccak256("alice"), "Chrome", 3600);
        target.destroy(sessionId);

        (bool valid,) = target.validate(sessionId);
        assertFalse(valid);
    }

    function test_destroy_emits_event() public {
        bytes32 sessionId = keccak256("sess1");
        target.create(sessionId, keccak256("alice"), "Chrome", 3600);

        vm.expectEmit(true, false, false, false);
        emit Destroyed(sessionId);

        target.destroy(sessionId);
    }

    function test_destroy_nonexistent_reverts() public {
        vm.expectRevert("Session not found");
        target.destroy(keccak256("missing"));
    }
}
