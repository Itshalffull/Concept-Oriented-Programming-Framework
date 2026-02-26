// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/User.sol";

contract UserTest is Test {
    User public target;

    function setUp() public {
        target = new User();
    }

    // --- register tests ---

    function test_register_success() public {
        bytes32 userId = keccak256("user1");
        (bool success, bytes32 returnedId) = target.register(userId, "alice", "alice@example.com");

        assertTrue(success, "Registration should succeed");
        assertEq(returnedId, userId, "Returned ID should match input");
    }

    function test_register_stores_data() public {
        bytes32 userId = keccak256("user1");
        target.register(userId, "alice", "alice@example.com");

        (bool exists, string memory name, string memory email) = target.get(userId);
        assertTrue(exists, "User should exist after registration");
        assertEq(name, "alice", "Name should match");
        assertEq(email, "alice@example.com", "Email should match");
    }

    function test_register_duplicate_name() public {
        bytes32 user1 = keccak256("user1");
        bytes32 user2 = keccak256("user2");

        target.register(user1, "alice", "alice@example.com");
        (bool success,) = target.register(user2, "alice", "bob@example.com");

        assertFalse(success, "Duplicate name registration should fail");
    }

    function test_register_duplicate_email() public {
        bytes32 user1 = keccak256("user1");
        bytes32 user2 = keccak256("user2");

        target.register(user1, "alice", "alice@example.com");
        (bool success,) = target.register(user2, "bob", "alice@example.com");

        assertFalse(success, "Duplicate email registration should fail");
    }

    function test_register_duplicate_id() public {
        bytes32 userId = keccak256("user1");

        target.register(userId, "alice", "alice@example.com");
        (bool success,) = target.register(userId, "bob", "bob@example.com");

        assertFalse(success, "Duplicate user ID registration should fail");
    }

    function test_register_empty_name_reverts() public {
        bytes32 userId = keccak256("user1");
        vm.expectRevert("Name cannot be empty");
        target.register(userId, "", "alice@example.com");
    }

    function test_register_empty_email_reverts() public {
        bytes32 userId = keccak256("user1");
        vm.expectRevert("Email cannot be empty");
        target.register(userId, "alice", "");
    }

    function test_register_zero_id_reverts() public {
        vm.expectRevert("User ID cannot be zero");
        target.register(bytes32(0), "alice", "alice@example.com");
    }

    // --- getByName tests ---

    function test_getByName_found() public {
        bytes32 userId = keccak256("user1");
        target.register(userId, "alice", "alice@example.com");

        (bool found, bytes32 id) = target.getByName("alice");
        assertTrue(found, "Should find user by name");
        assertEq(id, userId, "ID should match");
    }

    function test_getByName_not_found() public {
        (bool found,) = target.getByName("nonexistent");
        assertFalse(found, "Should not find nonexistent user");
    }

    // --- getByEmail tests ---

    function test_getByEmail_found() public {
        bytes32 userId = keccak256("user1");
        target.register(userId, "alice", "alice@example.com");

        (bool found, bytes32 id) = target.getByEmail("alice@example.com");
        assertTrue(found, "Should find user by email");
        assertEq(id, userId, "ID should match");
    }

    function test_getByEmail_not_found() public {
        (bool found,) = target.getByEmail("missing@example.com");
        assertFalse(found, "Should not find nonexistent email");
    }

    // --- get tests ---

    function test_get_nonexistent() public {
        bytes32 userId = keccak256("nonexistent");
        (bool exists,,) = target.get(userId);
        assertFalse(exists, "Nonexistent user should return false");
    }

    // --- multiple registrations ---

    function test_multiple_registrations() public {
        bytes32 user1 = keccak256("user1");
        bytes32 user2 = keccak256("user2");
        bytes32 user3 = keccak256("user3");

        (bool s1,) = target.register(user1, "alice", "alice@example.com");
        (bool s2,) = target.register(user2, "bob", "bob@example.com");
        (bool s3,) = target.register(user3, "charlie", "charlie@example.com");

        assertTrue(s1 && s2 && s3, "All registrations should succeed");

        (bool e1,,) = target.get(user1);
        (bool e2,,) = target.get(user2);
        (bool e3,,) = target.get(user3);

        assertTrue(e1 && e2 && e3, "All users should exist");
    }
}
