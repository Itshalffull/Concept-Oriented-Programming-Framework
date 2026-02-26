// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ClassificationTag.sol";

contract ClassificationTagTest is Test {
    ClassificationTag public target;

    event TagAdded(bytes32 indexed nodeId, string tagName);
    event TagRemoved(bytes32 indexed nodeId, string tagName);
    event TagRenamed(string oldTag, string newTag);

    function setUp() public {
        target = new ClassificationTag();
    }

    // --- addTag tests ---

    function test_addTag_assigns_tag() public {
        bytes32 nodeId = keccak256("node1");
        target.addTag(nodeId, "important");

        assertTrue(target.hasTag(nodeId, "important"));
    }

    function test_addTag_emits_event() public {
        bytes32 nodeId = keccak256("node1");

        vm.expectEmit(true, false, false, true);
        emit TagAdded(nodeId, "important");

        target.addTag(nodeId, "important");
    }

    function test_addTag_zero_node_reverts() public {
        vm.expectRevert("Invalid node ID");
        target.addTag(bytes32(0), "tag");
    }

    function test_addTag_empty_name_reverts() public {
        vm.expectRevert("Tag name cannot be empty");
        target.addTag(keccak256("node1"), "");
    }

    function test_addTag_duplicate_reverts() public {
        bytes32 nodeId = keccak256("node1");
        target.addTag(nodeId, "important");

        vm.expectRevert("Tag already assigned to node");
        target.addTag(nodeId, "important");
    }

    // --- removeTag tests ---

    function test_removeTag_unassigns_tag() public {
        bytes32 nodeId = keccak256("node1");
        target.addTag(nodeId, "important");
        target.removeTag(nodeId, "important");

        assertFalse(target.hasTag(nodeId, "important"));
    }

    function test_removeTag_emits_event() public {
        bytes32 nodeId = keccak256("node1");
        target.addTag(nodeId, "important");

        vm.expectEmit(true, false, false, true);
        emit TagRemoved(nodeId, "important");

        target.removeTag(nodeId, "important");
    }

    function test_removeTag_not_assigned_reverts() public {
        vm.expectRevert("Tag not assigned to node");
        target.removeTag(keccak256("node1"), "missing");
    }

    // --- getByTag tests ---

    function test_getByTag_returns_tagged_nodes() public {
        bytes32 n1 = keccak256("node1");
        bytes32 n2 = keccak256("node2");

        target.addTag(n1, "urgent");
        target.addTag(n2, "urgent");

        bytes32[] memory nodes = target.getByTag("urgent");
        assertEq(nodes.length, 2);
    }

    function test_getByTag_empty_returns_empty() public {
        bytes32[] memory nodes = target.getByTag("nonexistent");
        assertEq(nodes.length, 0);
    }

    // --- rename tests ---

    function test_rename_changes_tag_name() public {
        bytes32 nodeId = keccak256("node1");
        target.addTag(nodeId, "old-tag");

        target.rename("old-tag", "new-tag");

        assertFalse(target.hasTag(nodeId, "old-tag"));
        assertTrue(target.hasTag(nodeId, "new-tag"));
    }

    function test_rename_emits_event() public {
        bytes32 nodeId = keccak256("node1");
        target.addTag(nodeId, "old-tag");

        vm.expectEmit(false, false, false, true);
        emit TagRenamed("old-tag", "new-tag");

        target.rename("old-tag", "new-tag");
    }

    function test_rename_nonexistent_old_tag_reverts() public {
        vm.expectRevert("Old tag does not exist");
        target.rename("missing", "new-tag");
    }

    function test_rename_existing_new_tag_reverts() public {
        bytes32 nodeId = keccak256("node1");
        target.addTag(nodeId, "tag-a");
        target.addTag(nodeId, "tag-b");

        vm.expectRevert("New tag already exists");
        target.rename("tag-a", "tag-b");
    }

    function test_rename_empty_new_tag_reverts() public {
        bytes32 nodeId = keccak256("node1");
        target.addTag(nodeId, "old-tag");

        vm.expectRevert("New tag name cannot be empty");
        target.rename("old-tag", "");
    }

    // --- hasTag tests ---

    function test_hasTag_returns_false_for_untagged() public {
        assertFalse(target.hasTag(keccak256("node1"), "missing"));
    }
}
