// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CollaborationFlag.sol";

contract CollaborationFlagTest is Test {
    CollaborationFlag public target;

    event FlagTypeCreated(bytes32 indexed flagType);
    event Flagged(bytes32 indexed flagType, bytes32 indexed userId, bytes32 indexed entityId);
    event Unflagged(bytes32 indexed flagType, bytes32 indexed userId, bytes32 indexed entityId);

    function setUp() public {
        target = new CollaborationFlag();
    }

    // --- createFlagType tests ---

    function test_createFlagType_stores_type() public {
        bytes32 ft = keccak256("bookmark");
        target.createFlagType(ft, "Bookmark", "Save for later");

        // Verify via flag/unflag behavior
        bytes32 user = keccak256("user1");
        bytes32 entity = keccak256("article1");
        target.flag(ft, user, entity);
        assertTrue(target.isFlagged(ft, user, entity), "Should be flaggable after type creation");
    }

    function test_createFlagType_emits_event() public {
        bytes32 ft = keccak256("bookmark");

        vm.expectEmit(true, false, false, false);
        emit FlagTypeCreated(ft);

        target.createFlagType(ft, "Bookmark", "desc");
    }

    function test_createFlagType_zero_type_reverts() public {
        vm.expectRevert("Flag type cannot be zero");
        target.createFlagType(bytes32(0), "name", "desc");
    }

    function test_createFlagType_duplicate_reverts() public {
        bytes32 ft = keccak256("bookmark");
        target.createFlagType(ft, "Bookmark", "desc");

        vm.expectRevert("Flag type already exists");
        target.createFlagType(ft, "Bookmark2", "desc2");
    }

    function test_createFlagType_empty_name_reverts() public {
        vm.expectRevert("Name cannot be empty");
        target.createFlagType(keccak256("ft"), "", "desc");
    }

    // --- flag tests ---

    function test_flag_increments_count() public {
        bytes32 ft = keccak256("like");
        bytes32 entity = keccak256("post1");
        target.createFlagType(ft, "Like", "");

        target.flag(ft, keccak256("user1"), entity);
        target.flag(ft, keccak256("user2"), entity);

        assertEq(target.getCount(ft, entity), 2, "Count should be 2");
    }

    function test_flag_nonexistent_type_reverts() public {
        vm.expectRevert("Flag type not found");
        target.flag(keccak256("missing"), keccak256("u1"), keccak256("e1"));
    }

    function test_flag_zero_user_reverts() public {
        bytes32 ft = keccak256("like");
        target.createFlagType(ft, "Like", "");

        vm.expectRevert("User ID cannot be zero");
        target.flag(ft, bytes32(0), keccak256("e1"));
    }

    function test_flag_zero_entity_reverts() public {
        bytes32 ft = keccak256("like");
        target.createFlagType(ft, "Like", "");

        vm.expectRevert("Entity ID cannot be zero");
        target.flag(ft, keccak256("u1"), bytes32(0));
    }

    function test_flag_duplicate_reverts() public {
        bytes32 ft = keccak256("like");
        bytes32 user = keccak256("u1");
        bytes32 entity = keccak256("e1");
        target.createFlagType(ft, "Like", "");
        target.flag(ft, user, entity);

        vm.expectRevert("Already flagged");
        target.flag(ft, user, entity);
    }

    // --- unflag tests ---

    function test_unflag_decrements_count() public {
        bytes32 ft = keccak256("like");
        bytes32 user = keccak256("u1");
        bytes32 entity = keccak256("e1");
        target.createFlagType(ft, "Like", "");
        target.flag(ft, user, entity);
        target.unflag(ft, user, entity);

        assertEq(target.getCount(ft, entity), 0, "Count should be 0 after unflag");
        assertFalse(target.isFlagged(ft, user, entity), "Should not be flagged after unflag");
    }

    function test_unflag_not_flagged_reverts() public {
        bytes32 ft = keccak256("like");
        target.createFlagType(ft, "Like", "");

        vm.expectRevert("Not flagged");
        target.unflag(ft, keccak256("u1"), keccak256("e1"));
    }

    // --- isFlagged tests ---

    function test_isFlagged_false_when_not_flagged() public view {
        assertFalse(target.isFlagged(keccak256("ft"), keccak256("u"), keccak256("e")));
    }

    // --- getCount tests ---

    function test_getCount_zero_for_no_flags() public view {
        assertEq(target.getCount(keccak256("ft"), keccak256("e")), 0);
    }
}
