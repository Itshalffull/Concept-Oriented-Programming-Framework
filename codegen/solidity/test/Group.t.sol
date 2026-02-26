// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Group.sol";

contract GroupTest is Test {
    Group public target;

    event GroupCreated(bytes32 indexed groupId);
    event MemberAdded(bytes32 indexed groupId, bytes32 indexed userId);
    event ContentAdded(bytes32 indexed groupId, bytes32 indexed nodeId);

    function setUp() public {
        target = new Group();
    }

    // --- createGroup tests ---

    function test_createGroup_stores_group() public {
        bytes32 groupId = keccak256("team1");
        target.createGroup(groupId, "Engineering", "team");

        Group.GroupData memory g = target.getGroup(groupId);
        assertEq(g.name, "Engineering", "Name should match");
        assertEq(g.groupType, "team", "Group type should match");
        assertTrue(g.exists);
    }

    function test_createGroup_emits_event() public {
        bytes32 groupId = keccak256("team1");

        vm.expectEmit(true, false, false, false);
        emit GroupCreated(groupId);

        target.createGroup(groupId, "Engineering", "team");
    }

    function test_createGroup_zero_id_reverts() public {
        vm.expectRevert("Group ID cannot be zero");
        target.createGroup(bytes32(0), "name", "type");
    }

    function test_createGroup_duplicate_reverts() public {
        bytes32 groupId = keccak256("team1");
        target.createGroup(groupId, "Engineering", "team");

        vm.expectRevert("Group already exists");
        target.createGroup(groupId, "Other", "team");
    }

    function test_createGroup_empty_name_reverts() public {
        vm.expectRevert("Name cannot be empty");
        target.createGroup(keccak256("g1"), "", "team");
    }

    // --- addMember tests ---

    function test_addMember_stores_membership() public {
        bytes32 groupId = keccak256("team1");
        bytes32 userId = keccak256("alice");
        bytes32 role = keccak256("admin");
        target.createGroup(groupId, "Engineering", "team");
        target.addMember(groupId, userId, role);

        assertTrue(target.isMember(groupId, userId), "User should be a member");
        assertEq(target.getMemberRole(groupId, userId), role, "Role should match");
    }

    function test_addMember_nonexistent_group_reverts() public {
        vm.expectRevert("Group not found");
        target.addMember(keccak256("missing"), keccak256("u1"), keccak256("role"));
    }

    function test_addMember_zero_user_reverts() public {
        bytes32 groupId = keccak256("team1");
        target.createGroup(groupId, "Eng", "team");

        vm.expectRevert("User ID cannot be zero");
        target.addMember(groupId, bytes32(0), keccak256("role"));
    }

    function test_addMember_duplicate_reverts() public {
        bytes32 groupId = keccak256("team1");
        bytes32 userId = keccak256("alice");
        target.createGroup(groupId, "Eng", "team");
        target.addMember(groupId, userId, keccak256("admin"));

        vm.expectRevert("Member already exists");
        target.addMember(groupId, userId, keccak256("editor"));
    }

    // --- addContent tests ---

    function test_addContent_associates_node() public {
        bytes32 groupId = keccak256("team1");
        bytes32 nodeId = keccak256("doc1");
        target.createGroup(groupId, "Eng", "team");
        target.addContent(groupId, nodeId);

        assertTrue(target.isContent(groupId, nodeId), "Node should be group content");
    }

    function test_addContent_nonexistent_group_reverts() public {
        vm.expectRevert("Group not found");
        target.addContent(keccak256("missing"), keccak256("n1"));
    }

    function test_addContent_zero_node_reverts() public {
        bytes32 groupId = keccak256("team1");
        target.createGroup(groupId, "Eng", "team");

        vm.expectRevert("Node ID cannot be zero");
        target.addContent(groupId, bytes32(0));
    }

    function test_addContent_duplicate_reverts() public {
        bytes32 groupId = keccak256("team1");
        bytes32 nodeId = keccak256("doc1");
        target.createGroup(groupId, "Eng", "team");
        target.addContent(groupId, nodeId);

        vm.expectRevert("Content already added");
        target.addContent(groupId, nodeId);
    }

    // --- isMember tests ---

    function test_isMember_false_for_nonmember() public view {
        assertFalse(target.isMember(keccak256("g1"), keccak256("u1")));
    }

    // --- getGroup tests ---

    function test_getGroup_nonexistent_reverts() public {
        vm.expectRevert("Group not found");
        target.getGroup(keccak256("missing"));
    }

    // --- getMemberRole tests ---

    function test_getMemberRole_nonmember_reverts() public {
        bytes32 groupId = keccak256("team1");
        target.createGroup(groupId, "Eng", "team");

        vm.expectRevert("Member not found");
        target.getMemberRole(groupId, keccak256("missing"));
    }

    // --- isContent tests ---

    function test_isContent_false_for_nonassociated() public view {
        assertFalse(target.isContent(keccak256("g1"), keccak256("n1")));
    }
}
