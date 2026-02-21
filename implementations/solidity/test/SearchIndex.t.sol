// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SearchIndex.sol";

contract SearchIndexTest is Test {
    SearchIndex public target;

    event IndexCreated(bytes32 indexed indexId);
    event ItemIndexed(bytes32 indexed indexId, bytes32 indexed nodeId);
    event ItemRemoved(bytes32 indexed indexId, bytes32 indexed nodeId);

    function setUp() public {
        target = new SearchIndex();
    }

    // --- createIndex tests ---

    function test_createIndex_stores_config() public {
        bytes32 idx = keccak256("idx1");
        target.createIndex(idx, "fulltext:title,body");

        // Verify via itemCount (only works on existing index)
        uint256 count = target.itemCount(idx);
        assertEq(count, 0);
    }

    function test_createIndex_emits_event() public {
        bytes32 idx = keccak256("idx1");

        vm.expectEmit(true, false, false, false);
        emit IndexCreated(idx);

        target.createIndex(idx, "fulltext:title,body");
    }

    function test_createIndex_duplicate_reverts() public {
        bytes32 idx = keccak256("idx1");
        target.createIndex(idx, "fulltext:title,body");

        vm.expectRevert("Index already exists");
        target.createIndex(idx, "fulltext:title,body");
    }

    // --- indexItem tests ---

    function test_indexItem_adds_item() public {
        bytes32 idx = keccak256("idx1");
        bytes32 node = keccak256("node1");
        target.createIndex(idx, "config");
        target.indexItem(idx, node);

        assertTrue(target.isIndexed(idx, node));
        assertEq(target.itemCount(idx), 1);
    }

    function test_indexItem_emits_event() public {
        bytes32 idx = keccak256("idx1");
        bytes32 node = keccak256("node1");
        target.createIndex(idx, "config");

        vm.expectEmit(true, true, false, false);
        emit ItemIndexed(idx, node);

        target.indexItem(idx, node);
    }

    function test_indexItem_nonexistent_index_reverts() public {
        bytes32 idx = keccak256("nonexistent");
        bytes32 node = keccak256("node1");

        vm.expectRevert("Index does not exist");
        target.indexItem(idx, node);
    }

    function test_indexItem_duplicate_reverts() public {
        bytes32 idx = keccak256("idx1");
        bytes32 node = keccak256("node1");
        target.createIndex(idx, "config");
        target.indexItem(idx, node);

        vm.expectRevert("Item already indexed");
        target.indexItem(idx, node);
    }

    // --- removeItem tests ---

    function test_removeItem_removes_item() public {
        bytes32 idx = keccak256("idx1");
        bytes32 node = keccak256("node1");
        target.createIndex(idx, "config");
        target.indexItem(idx, node);
        target.removeItem(idx, node);

        assertFalse(target.isIndexed(idx, node));
        assertEq(target.itemCount(idx), 0);
    }

    function test_removeItem_emits_event() public {
        bytes32 idx = keccak256("idx1");
        bytes32 node = keccak256("node1");
        target.createIndex(idx, "config");
        target.indexItem(idx, node);

        vm.expectEmit(true, true, false, false);
        emit ItemRemoved(idx, node);

        target.removeItem(idx, node);
    }

    function test_removeItem_not_indexed_reverts() public {
        bytes32 idx = keccak256("idx1");
        bytes32 node = keccak256("node1");
        target.createIndex(idx, "config");

        vm.expectRevert("Item not indexed");
        target.removeItem(idx, node);
    }

    // --- isIndexed tests ---

    function test_isIndexed_returns_false_for_unknown() public {
        bytes32 idx = keccak256("idx1");
        bytes32 node = keccak256("node1");

        assertFalse(target.isIndexed(idx, node));
    }

    // --- itemCount tests ---

    function test_itemCount_nonexistent_index_reverts() public {
        bytes32 idx = keccak256("nonexistent");

        vm.expectRevert("Index does not exist");
        target.itemCount(idx);
    }

    function test_itemCount_tracks_additions_and_removals() public {
        bytes32 idx = keccak256("idx1");
        bytes32 n1 = keccak256("n1");
        bytes32 n2 = keccak256("n2");
        target.createIndex(idx, "config");

        target.indexItem(idx, n1);
        target.indexItem(idx, n2);
        assertEq(target.itemCount(idx), 2);

        target.removeItem(idx, n1);
        assertEq(target.itemCount(idx), 1);
    }
}
