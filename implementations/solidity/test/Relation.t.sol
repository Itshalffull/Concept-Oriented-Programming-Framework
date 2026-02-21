// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Relation.sol";

contract RelationTest is Test {
    Relation public target;

    event RelationDefined(bytes32 indexed relationId, string name);
    event Linked(bytes32 indexed relationId, bytes32 sourceId, bytes32 targetId);
    event Unlinked(bytes32 indexed relationId, bytes32 sourceId, bytes32 targetId);

    function setUp() public {
        target = new Relation();
    }

    // --- defineRelation tests ---

    function test_defineRelation_creates_relation() public {
        bytes32 relId = keccak256("authored-by");
        target.defineRelation(relId, "authored-by", "article", "user", 1, false);

        // Verify by linking (would revert if relation not found)
        target.link(relId, keccak256("article1"), keccak256("user1"));
    }

    function test_defineRelation_emits_event() public {
        bytes32 relId = keccak256("authored-by");

        vm.expectEmit(true, false, false, true);
        emit RelationDefined(relId, "authored-by");

        target.defineRelation(relId, "authored-by", "article", "user", 1, false);
    }

    function test_defineRelation_zero_id_reverts() public {
        vm.expectRevert("Relation ID cannot be zero");
        target.defineRelation(bytes32(0), "name", "src", "tgt", 1, false);
    }

    function test_defineRelation_duplicate_reverts() public {
        bytes32 relId = keccak256("authored-by");
        target.defineRelation(relId, "authored-by", "article", "user", 1, false);

        vm.expectRevert("Relation already defined");
        target.defineRelation(relId, "authored-by-v2", "article", "user", 1, false);
    }

    // --- link tests ---

    function test_link_creates_connection() public {
        bytes32 relId = keccak256("authored-by");
        bytes32 source = keccak256("article1");
        bytes32 dest = keccak256("user1");

        target.defineRelation(relId, "authored-by", "article", "user", 1, false);
        target.link(relId, source, dest);

        bytes32[] memory related = target.getRelated(source, relId);
        assertEq(related.length, 1);
        assertEq(related[0], dest);
    }

    function test_link_emits_event() public {
        bytes32 relId = keccak256("authored-by");
        bytes32 source = keccak256("article1");
        bytes32 dest = keccak256("user1");

        target.defineRelation(relId, "authored-by", "article", "user", 1, false);

        vm.expectEmit(true, false, false, true);
        emit Linked(relId, source, dest);

        target.link(relId, source, dest);
    }

    function test_link_nonexistent_relation_reverts() public {
        vm.expectRevert("Relation not found");
        target.link(keccak256("missing"), keccak256("s"), keccak256("t"));
    }

    function test_link_zero_source_reverts() public {
        bytes32 relId = keccak256("rel");
        target.defineRelation(relId, "rel", "src", "tgt", 1, false);

        vm.expectRevert("Source ID cannot be zero");
        target.link(relId, bytes32(0), keccak256("t"));
    }

    function test_link_zero_target_reverts() public {
        bytes32 relId = keccak256("rel");
        target.defineRelation(relId, "rel", "src", "tgt", 1, false);

        vm.expectRevert("Target ID cannot be zero");
        target.link(relId, keccak256("s"), bytes32(0));
    }

    // --- unlink tests ---

    function test_unlink_removes_connection() public {
        bytes32 relId = keccak256("authored-by");
        bytes32 source = keccak256("article1");
        bytes32 dest = keccak256("user1");

        target.defineRelation(relId, "authored-by", "article", "user", 1, false);
        target.link(relId, source, dest);
        target.unlink(relId, source, dest);

        bytes32[] memory related = target.getRelated(source, relId);
        assertEq(related.length, 0);
    }

    function test_unlink_emits_event() public {
        bytes32 relId = keccak256("authored-by");
        bytes32 source = keccak256("article1");
        bytes32 dest = keccak256("user1");

        target.defineRelation(relId, "authored-by", "article", "user", 1, false);
        target.link(relId, source, dest);

        vm.expectEmit(true, false, false, true);
        emit Unlinked(relId, source, dest);

        target.unlink(relId, source, dest);
    }

    function test_unlink_nonexistent_link_reverts() public {
        bytes32 relId = keccak256("rel");
        target.defineRelation(relId, "rel", "src", "tgt", 1, false);

        vm.expectRevert("Link not found");
        target.unlink(relId, keccak256("s"), keccak256("t"));
    }

    function test_unlink_nonexistent_relation_reverts() public {
        vm.expectRevert("Relation not found");
        target.unlink(keccak256("missing"), keccak256("s"), keccak256("t"));
    }

    // --- getRelated tests ---

    function test_getRelated_bidirectional() public {
        bytes32 relId = keccak256("friend");
        bytes32 alice = keccak256("alice");
        bytes32 bob = keccak256("bob");

        target.defineRelation(relId, "friend", "user", "user", 1, true);
        target.link(relId, alice, bob);

        // Alice should see Bob as related
        bytes32[] memory aliceRelated = target.getRelated(alice, relId);
        assertEq(aliceRelated.length, 1);
        assertEq(aliceRelated[0], bob);

        // Bob should also see Alice as related (bidirectional)
        bytes32[] memory bobRelated = target.getRelated(bob, relId);
        assertEq(bobRelated.length, 1);
        assertEq(bobRelated[0], alice);
    }

    function test_getRelated_nonexistent_relation_reverts() public {
        vm.expectRevert("Relation not found");
        target.getRelated(keccak256("node"), keccak256("missing"));
    }
}
