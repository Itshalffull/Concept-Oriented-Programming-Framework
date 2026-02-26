// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Password.sol";

contract PasswordTest is Test {
    Password public target;

    function setUp() public {
        target = new Password();
    }

    // --- validate tests ---

    function test_validate_short_password() public {
        assertFalse(target.validate("short"), "Password with < 8 chars should be invalid");
    }

    function test_validate_exact_minimum() public {
        assertTrue(target.validate("12345678"), "Password with exactly 8 chars should be valid");
    }

    function test_validate_long_password() public {
        assertTrue(target.validate("a_very_long_and_secure_password"), "Long password should be valid");
    }

    function test_validate_empty() public {
        assertFalse(target.validate(""), "Empty password should be invalid");
    }

    // --- set tests ---

    function test_set_success() public {
        bytes32 userId = keccak256("user1");
        bool success = target.set(userId, "securepassword");
        assertTrue(success, "Setting a valid password should succeed");
    }

    function test_set_too_short() public {
        bytes32 userId = keccak256("user1");
        bool success = target.set(userId, "short");
        assertFalse(success, "Setting a short password should fail");
    }

    function test_set_zero_user_reverts() public {
        vm.expectRevert("User ID cannot be zero");
        target.set(bytes32(0), "securepassword");
    }

    function test_set_stores_credentials() public {
        bytes32 userId = keccak256("user1");
        target.set(userId, "securepassword");
        assertTrue(target.hasPassword(userId), "User should have credentials after set");
    }

    // --- check tests ---

    function test_check_correct_password() public {
        bytes32 userId = keccak256("user1");
        target.set(userId, "securepassword");

        bool valid = target.check(userId, "securepassword");
        assertTrue(valid, "Correct password should return true");
    }

    function test_check_wrong_password() public {
        bytes32 userId = keccak256("user1");
        target.set(userId, "securepassword");

        bool valid = target.check(userId, "wrongpassword");
        assertFalse(valid, "Wrong password should return false");
    }

    function test_check_no_credentials() public {
        bytes32 userId = keccak256("no_credentials");
        bool valid = target.check(userId, "anypassword");
        assertFalse(valid, "User with no credentials should return false");
    }

    function test_check_after_password_change() public {
        bytes32 userId = keccak256("user1");

        // Set initial password
        target.set(userId, "firstpassword");
        assertTrue(target.check(userId, "firstpassword"), "First password should be valid");

        // Change password (need to advance block so salt changes)
        vm.roll(block.number + 1);
        target.set(userId, "secondpassword");

        assertFalse(target.check(userId, "firstpassword"), "Old password should no longer work");
        assertTrue(target.check(userId, "secondpassword"), "New password should be valid");
    }

    // --- hasPassword tests ---

    function test_hasPassword_before_set() public {
        bytes32 userId = keccak256("user1");
        assertFalse(target.hasPassword(userId), "Should not have password before set");
    }

    function test_hasPassword_after_set() public {
        bytes32 userId = keccak256("user1");
        target.set(userId, "securepassword");
        assertTrue(target.hasPassword(userId), "Should have password after set");
    }
}
