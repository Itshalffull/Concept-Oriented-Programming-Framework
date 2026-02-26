// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/JWT.sol";

contract JWTTest is Test {
    JWT public target;

    event TokenGenerated(bytes32 indexed user, bytes32 token);

    function setUp() public {
        target = new JWT();
    }

    // --- generate tests ---

    function test_generate_returns_nonzero_token() public {
        bytes32 user = keccak256("alice");
        bytes32 token = target.generate(user);

        assertTrue(token != bytes32(0), "Token should be nonzero");
    }

    function test_generate_token_is_verifiable() public {
        bytes32 user = keccak256("alice");
        bytes32 token = target.generate(user);

        (bool valid, bytes32 returnedUser) = target.verify(token);
        assertTrue(valid, "Generated token should be valid");
        assertEq(returnedUser, user, "Verified user should match");
    }

    function test_generate_emits_event() public {
        bytes32 user = keccak256("alice");

        vm.expectEmit(true, false, false, false);
        emit TokenGenerated(user, bytes32(0));

        target.generate(user);
    }

    function test_generate_zero_user_reverts() public {
        vm.expectRevert("User ID cannot be zero");
        target.generate(bytes32(0));
    }

    function test_generate_invalidates_previous_token() public {
        bytes32 user = keccak256("alice");
        bytes32 oldToken = target.generate(user);

        // Generate a new token at a different block
        vm.roll(block.number + 1);
        target.generate(user);

        (bool valid,) = target.verify(oldToken);
        assertFalse(valid, "Old token should be invalidated");
    }

    // --- verify tests ---

    function test_verify_invalid_token_returns_false() public view {
        (bool valid, bytes32 user) = target.verify(keccak256("random"));
        assertFalse(valid, "Random token should be invalid");
        assertEq(user, bytes32(0), "User should be zero for invalid token");
    }

    // --- revoke tests ---

    function test_revoke_invalidates_token() public {
        bytes32 user = keccak256("alice");
        bytes32 token = target.generate(user);

        target.revoke(user);

        (bool valid,) = target.verify(token);
        assertFalse(valid, "Revoked token should be invalid");
    }

    function test_revoke_zero_user_reverts() public {
        vm.expectRevert("User ID cannot be zero");
        target.revoke(bytes32(0));
    }

    function test_revoke_no_token_does_not_revert() public {
        // Revoking a user with no token should be a no-op
        target.revoke(keccak256("nobody"));
    }

    // --- getToken tests ---

    function test_getToken_returns_active_token() public {
        bytes32 user = keccak256("alice");
        bytes32 token = target.generate(user);

        (bool hasToken, bytes32 returnedToken) = target.getToken(user);
        assertTrue(hasToken, "User should have an active token");
        assertEq(returnedToken, token, "Token should match");
    }

    function test_getToken_returns_false_for_no_token() public view {
        (bool hasToken,) = target.getToken(keccak256("nobody"));
        assertFalse(hasToken, "User with no token should return false");
    }

    function test_getToken_returns_false_after_revoke() public {
        bytes32 user = keccak256("alice");
        target.generate(user);
        target.revoke(user);

        (bool hasToken,) = target.getToken(user);
        assertFalse(hasToken, "Revoked user should have no active token");
    }
}
