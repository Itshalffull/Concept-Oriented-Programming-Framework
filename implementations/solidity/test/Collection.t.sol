// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Collection.sol";

contract CollectionTest is Test {
    Collection public target;

    event CollectionCreated(bytes32 indexed collectionId);
    event MemberAdded(bytes32 indexed collectionId, bytes32 indexed nodeId);
    event MemberRemoved(bytes32 indexed collectionId, bytes32 indexed nodeId);

    function setUp() public {
        target = new Collection();
    }

    // --- create tests ---

    function test_create_stores_collection() public {
        bytes32 cid = keccak256("c1");
        bytes32 sid = keccak256("schema1");
        target.create(cid, "My Collection", "manual", sid);

        Collection.CollectionData memory c = target.getCollection(cid);
        assertEq(c.name, "My Collection");
        assertEq(c.collectionType, "manual");
        assertEq(c.schemaId, sid);
        assertTrue(c.exists);
    }

    function test_create_emits_event() public {
        bytes32 cid = keccak256("c1");

        vm.expectEmit(true, false, false, false);
        emit CollectionCreated(cid);

        target.create(cid, "My Collection", "manual", bytes32(0));
    }

    function test_create_duplicate_reverts() public {
        bytes32 cid = keccak256("c1");
        target.create(cid, "My Collection", "manual", bytes32(0));

        vm.expectRevert("Collection already exists");
        target.create(cid, "Other", "auto", bytes32(0));
    }

    function test_create_empty_name_reverts() public {
        bytes32 cid = keccak256("c1");

        vm.expectRevert("Name cannot be empty");
        target.create(cid, "", "manual", bytes32(0));
    }

    // --- addMember tests ---

    function test_addMember_adds_node() public {
        bytes32 cid = keccak256("c1");
        bytes32 nid = keccak256("n1");
        target.create(cid, "Coll", "manual", bytes32(0));
        target.addMember(cid, nid);

        assertTrue(target.isMember(cid, nid));
        bytes32[] memory members = target.getMembers(cid);
        assertEq(members.length, 1);
        assertEq(members[0], nid);
    }

    function test_addMember_emits_event() public {
        bytes32 cid = keccak256("c1");
        bytes32 nid = keccak256("n1");
        target.create(cid, "Coll", "manual", bytes32(0));

        vm.expectEmit(true, true, false, false);
        emit MemberAdded(cid, nid);

        target.addMember(cid, nid);
    }

    function test_addMember_duplicate_reverts() public {
        bytes32 cid = keccak256("c1");
        bytes32 nid = keccak256("n1");
        target.create(cid, "Coll", "manual", bytes32(0));
        target.addMember(cid, nid);

        vm.expectRevert("Already a member");
        target.addMember(cid, nid);
    }

    function test_addMember_nonexistent_collection_reverts() public {
        vm.expectRevert("Collection does not exist");
        target.addMember(keccak256("none"), keccak256("n1"));
    }

    // --- removeMember tests ---

    function test_removeMember_removes_node() public {
        bytes32 cid = keccak256("c1");
        bytes32 nid = keccak256("n1");
        target.create(cid, "Coll", "manual", bytes32(0));
        target.addMember(cid, nid);
        target.removeMember(cid, nid);

        assertFalse(target.isMember(cid, nid));
        bytes32[] memory members = target.getMembers(cid);
        assertEq(members.length, 0);
    }

    function test_removeMember_emits_event() public {
        bytes32 cid = keccak256("c1");
        bytes32 nid = keccak256("n1");
        target.create(cid, "Coll", "manual", bytes32(0));
        target.addMember(cid, nid);

        vm.expectEmit(true, true, false, false);
        emit MemberRemoved(cid, nid);

        target.removeMember(cid, nid);
    }

    function test_removeMember_not_a_member_reverts() public {
        bytes32 cid = keccak256("c1");
        target.create(cid, "Coll", "manual", bytes32(0));

        vm.expectRevert("Not a member");
        target.removeMember(cid, keccak256("n1"));
    }

    // --- getMembers tests ---

    function test_getMembers_nonexistent_collection_reverts() public {
        vm.expectRevert("Collection does not exist");
        target.getMembers(keccak256("none"));
    }

    // --- isMember tests ---

    function test_isMember_returns_false_for_nonmember() public {
        bytes32 cid = keccak256("c1");
        target.create(cid, "Coll", "manual", bytes32(0));

        assertFalse(target.isMember(cid, keccak256("n1")));
    }

    // --- getCollection tests ---

    function test_getCollection_nonexistent_reverts() public {
        vm.expectRevert("Collection does not exist");
        target.getCollection(keccak256("none"));
    }
}
