// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Authentication.sol";

contract AuthenticationTest is Test {
    Authentication public target;

    event Registered(bytes32 indexed userId);
    event LoggedIn(bytes32 indexed userId);
    event LoggedOut(bytes32 indexed userId);
    event PasswordReset(bytes32 indexed userId);

    function setUp() public {
        target = new Authentication();
    }

    // --- register tests ---

    function test_register_creates_account() public {
        bytes32 userId = keccak256("alice");
        bytes32 credHash = keccak256("password123");

        target.register(userId, credHash);
        assertTrue(target.isRegistered(userId));
    }

    function test_register_emits_event() public {
        bytes32 userId = keccak256("alice");
        bytes32 credHash = keccak256("password123");

        vm.expectEmit(true, false, false, false);
        emit Registered(userId);

        target.register(userId, credHash);
    }

    function test_register_zero_user_reverts() public {
        vm.expectRevert("User ID cannot be zero");
        target.register(bytes32(0), keccak256("pass"));
    }

    function test_register_zero_credential_reverts() public {
        vm.expectRevert("Credential hash cannot be zero");
        target.register(keccak256("alice"), bytes32(0));
    }

    function test_register_duplicate_reverts() public {
        bytes32 userId = keccak256("alice");
        target.register(userId, keccak256("pass"));

        vm.expectRevert("Account already registered");
        target.register(userId, keccak256("pass2"));
    }

    // --- login tests ---

    function test_login_succeeds_with_correct_credential() public {
        bytes32 userId = keccak256("alice");
        bytes32 credHash = keccak256("password123");

        target.register(userId, credHash);
        bool success = target.login(userId, credHash);
        assertTrue(success);
    }

    function test_login_fails_with_wrong_credential() public {
        bytes32 userId = keccak256("alice");
        target.register(userId, keccak256("correct"));

        bool success = target.login(userId, keccak256("wrong"));
        assertFalse(success);
    }

    function test_login_emits_event_on_success() public {
        bytes32 userId = keccak256("alice");
        bytes32 credHash = keccak256("password123");
        target.register(userId, credHash);

        vm.expectEmit(true, false, false, false);
        emit LoggedIn(userId);

        target.login(userId, credHash);
    }

    function test_login_nonexistent_reverts() public {
        vm.expectRevert("Account not found");
        target.login(keccak256("missing"), keccak256("pass"));
    }

    // --- logout tests ---

    function test_logout_emits_event() public {
        bytes32 userId = keccak256("alice");
        target.register(userId, keccak256("pass"));
        target.login(userId, keccak256("pass"));

        vm.expectEmit(true, false, false, false);
        emit LoggedOut(userId);

        target.logout(userId);
    }

    function test_logout_nonexistent_reverts() public {
        vm.expectRevert("Account not found");
        target.logout(keccak256("missing"));
    }

    // --- resetPassword tests ---

    function test_resetPassword_changes_credential() public {
        bytes32 userId = keccak256("alice");
        bytes32 oldCred = keccak256("oldpass");
        bytes32 newCred = keccak256("newpass");

        target.register(userId, oldCred);
        target.resetPassword(userId, newCred);

        // Old credential should fail, new should succeed
        bool failResult = target.login(userId, oldCred);
        assertFalse(failResult);

        bool successResult = target.login(userId, newCred);
        assertTrue(successResult);
    }

    function test_resetPassword_emits_event() public {
        bytes32 userId = keccak256("alice");
        target.register(userId, keccak256("pass"));

        vm.expectEmit(true, false, false, false);
        emit PasswordReset(userId);

        target.resetPassword(userId, keccak256("newpass"));
    }

    function test_resetPassword_nonexistent_reverts() public {
        vm.expectRevert("Account not found");
        target.resetPassword(keccak256("missing"), keccak256("newpass"));
    }

    function test_resetPassword_zero_credential_reverts() public {
        bytes32 userId = keccak256("alice");
        target.register(userId, keccak256("pass"));

        vm.expectRevert("Credential hash cannot be zero");
        target.resetPassword(userId, bytes32(0));
    }

    // --- isRegistered tests ---

    function test_isRegistered_false_for_unknown() public {
        assertFalse(target.isRegistered(keccak256("unknown")));
    }
}
