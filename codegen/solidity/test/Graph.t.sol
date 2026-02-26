// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Graph.sol";

contract GraphTest is Test {
    Graph public target;

    event NodeAdded(bytes32 indexed entityId);
    event NodeRemoved(bytes32 indexed entityId);
    event EdgeAdded(bytes32 indexed source, bytes32 indexed target_);
    event EdgeRemoved(bytes32 indexed source, bytes32 indexed target_);

    function setUp() public {
        target = new Graph();
    }

    // --- addNode tests ---

    function test_addNode_creates_node() public {
        bytes32 nid = keccak256("n1");
        target.addNode(nid);

        assertTrue(target.nodeExists(nid));
    }

    function test_addNode_emits_event() public {
        bytes32 nid = keccak256("n1");

        vm.expectEmit(true, false, false, false);
        emit NodeAdded(nid);

        target.addNode(nid);
    }

    function test_addNode_duplicate_reverts() public {
        bytes32 nid = keccak256("n1");
        target.addNode(nid);

        vm.expectRevert("Node already exists");
        target.addNode(nid);
    }

    // --- removeNode tests ---

    function test_removeNode_removes_node() public {
        bytes32 nid = keccak256("n1");
        target.addNode(nid);
        target.removeNode(nid);

        assertFalse(target.nodeExists(nid));
    }

    function test_removeNode_emits_event() public {
        bytes32 nid = keccak256("n1");
        target.addNode(nid);

        vm.expectEmit(true, false, false, false);
        emit NodeRemoved(nid);

        target.removeNode(nid);
    }

    function test_removeNode_nonexistent_reverts() public {
        vm.expectRevert("Node does not exist");
        target.removeNode(keccak256("none"));
    }

    // --- addEdge tests ---

    function test_addEdge_creates_edge() public {
        bytes32 a = keccak256("a");
        bytes32 b = keccak256("b");
        target.addNode(a);
        target.addNode(b);
        target.addEdge(a, b);

        bytes32[] memory outs = target.getOutEdges(a);
        assertEq(outs.length, 1);
        assertEq(outs[0], b);

        bytes32[] memory ins = target.getInEdges(b);
        assertEq(ins.length, 1);
        assertEq(ins[0], a);
    }

    function test_addEdge_source_missing_reverts() public {
        bytes32 b = keccak256("b");
        target.addNode(b);

        vm.expectRevert("Source node does not exist");
        target.addEdge(keccak256("missing"), b);
    }

    function test_addEdge_target_missing_reverts() public {
        bytes32 a = keccak256("a");
        target.addNode(a);

        vm.expectRevert("Target node does not exist");
        target.addEdge(a, keccak256("missing"));
    }

    function test_addEdge_duplicate_reverts() public {
        bytes32 a = keccak256("a");
        bytes32 b = keccak256("b");
        target.addNode(a);
        target.addNode(b);
        target.addEdge(a, b);

        vm.expectRevert("Edge already exists");
        target.addEdge(a, b);
    }

    // --- removeEdge tests ---

    function test_removeEdge_removes_edge() public {
        bytes32 a = keccak256("a");
        bytes32 b = keccak256("b");
        target.addNode(a);
        target.addNode(b);
        target.addEdge(a, b);
        target.removeEdge(a, b);

        bytes32[] memory outs = target.getOutEdges(a);
        assertEq(outs.length, 0);

        bytes32[] memory ins = target.getInEdges(b);
        assertEq(ins.length, 0);
    }

    function test_removeEdge_nonexistent_reverts() public {
        vm.expectRevert("Edge does not exist");
        target.removeEdge(keccak256("a"), keccak256("b"));
    }

    // --- nodeExists tests ---

    function test_nodeExists_returns_false_for_unknown() public {
        assertFalse(target.nodeExists(keccak256("unknown")));
    }

    // --- getOutEdges / getInEdges tests ---

    function test_getOutEdges_empty_for_unknown() public {
        bytes32[] memory outs = target.getOutEdges(keccak256("unknown"));
        assertEq(outs.length, 0);
    }

    function test_getInEdges_empty_for_unknown() public {
        bytes32[] memory ins = target.getInEdges(keccak256("unknown"));
        assertEq(ins.length, 0);
    }
}
