// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ContentNode.sol";

contract ContentNodeTest is Test {
    ContentNode public target;

    event Created(bytes32 indexed id, string nodeType);
    event Updated(bytes32 indexed id);
    event Deleted(bytes32 indexed id);
    event MetadataSet(bytes32 indexed id, string key);
    event TypeChanged(bytes32 indexed id, string newType);

    function setUp() public {
        target = new ContentNode();
    }

    // --- create tests ---

    function test_create_stores_node() public {
        bytes32 id = keccak256("node1");
        target.create(id, "page", "Hello World");

        ContentNode.NodeData memory node = target.get(id);
        assertEq(node.nodeType, "page");
        assertEq(node.content, "Hello World");
        assertTrue(node.exists);
    }

    function test_create_emits_event() public {
        bytes32 id = keccak256("node1");

        vm.expectEmit(true, false, false, true);
        emit Created(id, "page");

        target.create(id, "page", "content");
    }

    function test_create_zero_id_reverts() public {
        vm.expectRevert("Node ID cannot be zero");
        target.create(bytes32(0), "page", "content");
    }

    function test_create_duplicate_reverts() public {
        bytes32 id = keccak256("node1");
        target.create(id, "page", "content");

        vm.expectRevert("Node already exists");
        target.create(id, "page", "content2");
    }

    // --- update tests ---

    function test_update_changes_content() public {
        bytes32 id = keccak256("node1");
        target.create(id, "page", "original");
        target.update(id, "updated");

        ContentNode.NodeData memory node = target.get(id);
        assertEq(node.content, "updated");
    }

    function test_update_emits_event() public {
        bytes32 id = keccak256("node1");
        target.create(id, "page", "original");

        vm.expectEmit(true, false, false, false);
        emit Updated(id);

        target.update(id, "updated");
    }

    function test_update_nonexistent_reverts() public {
        vm.expectRevert("Node not found");
        target.update(keccak256("missing"), "content");
    }

    // --- deleteNode tests ---

    function test_deleteNode_removes_node() public {
        bytes32 id = keccak256("node1");
        target.create(id, "page", "content");
        target.deleteNode(id);

        assertFalse(target.exists(id));
    }

    function test_deleteNode_emits_event() public {
        bytes32 id = keccak256("node1");
        target.create(id, "page", "content");

        vm.expectEmit(true, false, false, false);
        emit Deleted(id);

        target.deleteNode(id);
    }

    function test_deleteNode_nonexistent_reverts() public {
        vm.expectRevert("Node not found");
        target.deleteNode(keccak256("missing"));
    }

    // --- setMetadata / getMetadata tests ---

    function test_setMetadata_and_getMetadata() public {
        bytes32 id = keccak256("node1");
        target.create(id, "page", "content");
        target.setMetadata(id, "author", "alice");

        string memory value = target.getMetadata(id, "author");
        assertEq(value, "alice");
    }

    function test_setMetadata_emits_event() public {
        bytes32 id = keccak256("node1");
        target.create(id, "page", "content");

        vm.expectEmit(true, false, false, true);
        emit MetadataSet(id, "author");

        target.setMetadata(id, "author", "alice");
    }

    function test_setMetadata_nonexistent_reverts() public {
        vm.expectRevert("Node not found");
        target.setMetadata(keccak256("missing"), "key", "val");
    }

    function test_getMetadata_missing_key_returns_empty() public {
        bytes32 id = keccak256("node1");
        target.create(id, "page", "content");

        string memory value = target.getMetadata(id, "nonexistent");
        assertEq(bytes(value).length, 0);
    }

    // --- changeType tests ---

    function test_changeType_updates_type() public {
        bytes32 id = keccak256("node1");
        target.create(id, "page", "content");
        target.changeType(id, "document");

        ContentNode.NodeData memory node = target.get(id);
        assertEq(node.nodeType, "document");
    }

    function test_changeType_emits_event() public {
        bytes32 id = keccak256("node1");
        target.create(id, "page", "content");

        vm.expectEmit(true, false, false, true);
        emit TypeChanged(id, "document");

        target.changeType(id, "document");
    }

    function test_changeType_nonexistent_reverts() public {
        vm.expectRevert("Node not found");
        target.changeType(keccak256("missing"), "document");
    }

    // --- exists tests ---

    function test_exists_returns_false_for_unknown() public {
        assertFalse(target.exists(keccak256("unknown")));
    }

    function test_exists_returns_true_after_create() public {
        bytes32 id = keccak256("node1");
        target.create(id, "page", "content");
        assertTrue(target.exists(id));
    }
}
