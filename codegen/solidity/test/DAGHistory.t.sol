// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/DAGHistory.sol";

contract DAGHistoryTest is Test {
    DAGHistory public target;

    event NodeAppended(bytes32 indexed nodeId, bytes32 contentRef, uint256 parentCount);
    event RootAdded(bytes32 indexed nodeId);

    function setUp() public {
        target = new DAGHistory();
    }

    // --- append tests ---

    function test_append_creates_node() public {
        bytes32[] memory parents = new bytes32[](0);
        bytes32 contentRef = keccak256("content1");

        bytes32 nodeId = target.append(parents, contentRef, "meta");

        (bytes32[] memory p, bytes32 cr, bytes memory meta) = target.getNode(nodeId);
        assertEq(p.length, 0);
        assertEq(cr, contentRef);
        assertEq(meta, "meta");
    }

    function test_append_no_parents_creates_root() public {
        bytes32[] memory parents = new bytes32[](0);
        bytes32 nodeId = target.append(parents, keccak256("c1"), "");

        bytes32[] memory roots = target.getRoots();
        assertEq(roots.length, 1);
        assertEq(roots[0], nodeId);
    }

    function test_append_with_parent() public {
        bytes32[] memory noParents = new bytes32[](0);
        bytes32 root = target.append(noParents, keccak256("c1"), "");

        bytes32[] memory parents = new bytes32[](1);
        parents[0] = root;
        bytes32 child = target.append(parents, keccak256("c2"), "child-meta");

        (bytes32[] memory p,,) = target.getNode(child);
        assertEq(p.length, 1);
        assertEq(p[0], root);
    }

    function test_append_with_multiple_parents() public {
        bytes32[] memory noParents = new bytes32[](0);
        bytes32 root1 = target.append(noParents, keccak256("c1"), "");
        bytes32 root2 = target.append(noParents, keccak256("c2"), "");

        bytes32[] memory parents = new bytes32[](2);
        parents[0] = root1;
        parents[1] = root2;
        bytes32 merge = target.append(parents, keccak256("merge"), "merged");

        (bytes32[] memory p,,) = target.getNode(merge);
        assertEq(p.length, 2);
        assertEq(p[0], root1);
        assertEq(p[1], root2);
    }

    function test_append_unknown_parent_reverts() public {
        bytes32[] memory parents = new bytes32[](1);
        parents[0] = keccak256("nonexistent");

        vm.expectRevert("Parent node does not exist");
        target.append(parents, keccak256("c1"), "");
    }

    function test_append_emits_event() public {
        bytes32[] memory parents = new bytes32[](0);
        bytes32 contentRef = keccak256("c1");

        vm.expectEmit(false, false, false, true);
        emit NodeAppended(bytes32(0), contentRef, 0);

        target.append(parents, contentRef, "");
    }

    function test_append_root_emits_root_event() public {
        bytes32[] memory parents = new bytes32[](0);

        vm.expectEmit(false, false, false, false);
        emit RootAdded(bytes32(0));

        target.append(parents, keccak256("c1"), "");
    }

    // --- ancestors tests ---

    function test_ancestors_returns_parents() public {
        bytes32[] memory noParents = new bytes32[](0);
        bytes32 root = target.append(noParents, keccak256("c1"), "");

        bytes32[] memory parents = new bytes32[](1);
        parents[0] = root;
        bytes32 child = target.append(parents, keccak256("c2"), "");

        bytes32[] memory anc = target.ancestors(child);
        assertEq(anc.length, 1);
        assertEq(anc[0], root);
    }

    function test_ancestors_root_returns_empty() public {
        bytes32[] memory noParents = new bytes32[](0);
        bytes32 root = target.append(noParents, keccak256("c1"), "");

        bytes32[] memory anc = target.ancestors(root);
        assertEq(anc.length, 0);
    }

    function test_ancestors_nonexistent_reverts() public {
        vm.expectRevert("Node does not exist");
        target.ancestors(keccak256("fake"));
    }

    // --- descendants tests ---

    function test_descendants_returns_children() public {
        bytes32[] memory noParents = new bytes32[](0);
        bytes32 root = target.append(noParents, keccak256("c1"), "");

        bytes32[] memory parents = new bytes32[](1);
        parents[0] = root;
        bytes32 child1 = target.append(parents, keccak256("c2"), "");
        bytes32 child2 = target.append(parents, keccak256("c3"), "");

        bytes32[] memory desc = target.descendants(root);
        assertEq(desc.length, 2);
        assertEq(desc[0], child1);
        assertEq(desc[1], child2);
    }

    function test_descendants_leaf_returns_empty() public {
        bytes32[] memory noParents = new bytes32[](0);
        bytes32 leaf = target.append(noParents, keccak256("c1"), "");

        bytes32[] memory desc = target.descendants(leaf);
        assertEq(desc.length, 0);
    }

    // --- getNode tests ---

    function test_getNode_returns_data() public {
        bytes32[] memory noParents = new bytes32[](0);
        bytes32 contentRef = keccak256("content");
        bytes32 nodeId = target.append(noParents, contentRef, "metadata123");

        (bytes32[] memory p, bytes32 cr, bytes memory meta) = target.getNode(nodeId);
        assertEq(p.length, 0);
        assertEq(cr, contentRef);
        assertEq(meta, "metadata123");
    }

    function test_getNode_nonexistent_reverts() public {
        vm.expectRevert("Node does not exist");
        target.getNode(keccak256("fake"));
    }

    // --- commonAncestor tests ---

    function test_commonAncestor_shared_parent() public {
        bytes32[] memory noParents = new bytes32[](0);
        bytes32 root = target.append(noParents, keccak256("c1"), "");

        bytes32[] memory parents = new bytes32[](1);
        parents[0] = root;
        bytes32 childA = target.append(parents, keccak256("c2"), "");
        bytes32 childB = target.append(parents, keccak256("c3"), "");

        (bool found, bytes32 ancestor) = target.commonAncestor(childA, childB);
        assertTrue(found);
        assertEq(ancestor, root);
    }

    function test_commonAncestor_none() public {
        bytes32[] memory noParents = new bytes32[](0);
        bytes32 rootA = target.append(noParents, keccak256("c1"), "");
        bytes32 rootB = target.append(noParents, keccak256("c2"), "");

        (bool found,) = target.commonAncestor(rootA, rootB);
        assertFalse(found);
    }

    function test_commonAncestor_direct_parent() public {
        bytes32[] memory noParents = new bytes32[](0);
        bytes32 root = target.append(noParents, keccak256("c1"), "");

        bytes32[] memory parents = new bytes32[](1);
        parents[0] = root;
        bytes32 child = target.append(parents, keccak256("c2"), "");

        (bool found, bytes32 ancestor) = target.commonAncestor(root, child);
        assertTrue(found);
        assertEq(ancestor, root);
    }
}
