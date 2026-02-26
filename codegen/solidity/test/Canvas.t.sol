// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Canvas.sol";

contract CanvasTest is Test {
    Canvas public target;

    event NodeAdded(bytes32 indexed nodeId);
    event NodeMoved(bytes32 indexed nodeId);
    event NodesConnected(bytes32 indexed edgeId, bytes32 indexed fromNode, bytes32 indexed toNode);

    function setUp() public {
        target = new Canvas();
    }

    // --- addNode tests ---

    function test_addNode_stores_node() public {
        bytes32 nid = keccak256("n1");
        target.addNode(nid, "card", int256(100), int256(200), "My Card");

        Canvas.CanvasNode memory n = target.getNode(nid);
        assertEq(n.nodeType, "card");
        assertEq(n.posX, int256(100));
        assertEq(n.posY, int256(200));
        assertEq(n.content, "My Card");
        assertTrue(n.exists);
    }

    function test_addNode_emits_event() public {
        bytes32 nid = keccak256("n1");

        vm.expectEmit(true, false, false, false);
        emit NodeAdded(nid);

        target.addNode(nid, "card", int256(0), int256(0), "content");
    }

    function test_addNode_duplicate_reverts() public {
        bytes32 nid = keccak256("n1");
        target.addNode(nid, "card", int256(0), int256(0), "content");

        vm.expectRevert("Node already exists");
        target.addNode(nid, "text", int256(1), int256(1), "other");
    }

    // --- moveNode tests ---

    function test_moveNode_updates_position() public {
        bytes32 nid = keccak256("n1");
        target.addNode(nid, "card", int256(0), int256(0), "content");
        target.moveNode(nid, int256(50), int256(-30));

        Canvas.CanvasNode memory n = target.getNode(nid);
        assertEq(n.posX, int256(50));
        assertEq(n.posY, int256(-30));
    }

    function test_moveNode_emits_event() public {
        bytes32 nid = keccak256("n1");
        target.addNode(nid, "card", int256(0), int256(0), "content");

        vm.expectEmit(true, false, false, false);
        emit NodeMoved(nid);

        target.moveNode(nid, int256(10), int256(20));
    }

    function test_moveNode_nonexistent_reverts() public {
        vm.expectRevert("Node does not exist");
        target.moveNode(keccak256("none"), int256(0), int256(0));
    }

    // --- connectNodes tests ---

    function test_connectNodes_creates_edge() public {
        bytes32 n1 = keccak256("n1");
        bytes32 n2 = keccak256("n2");
        bytes32 eid = keccak256("e1");
        target.addNode(n1, "card", int256(0), int256(0), "A");
        target.addNode(n2, "card", int256(100), int256(0), "B");
        target.connectNodes(eid, n1, n2, "relates to");

        Canvas.CanvasEdge memory e = target.getEdge(eid);
        assertEq(e.fromNode, n1);
        assertEq(e.toNode, n2);
        assertEq(e.label, "relates to");
        assertTrue(e.exists);
    }

    function test_connectNodes_emits_event() public {
        bytes32 n1 = keccak256("n1");
        bytes32 n2 = keccak256("n2");
        bytes32 eid = keccak256("e1");
        target.addNode(n1, "card", int256(0), int256(0), "A");
        target.addNode(n2, "card", int256(100), int256(0), "B");

        vm.expectEmit(true, true, true, false);
        emit NodesConnected(eid, n1, n2);

        target.connectNodes(eid, n1, n2, "label");
    }

    function test_connectNodes_duplicate_edge_reverts() public {
        bytes32 n1 = keccak256("n1");
        bytes32 n2 = keccak256("n2");
        bytes32 eid = keccak256("e1");
        target.addNode(n1, "card", int256(0), int256(0), "A");
        target.addNode(n2, "card", int256(100), int256(0), "B");
        target.connectNodes(eid, n1, n2, "label");

        vm.expectRevert("Edge already exists");
        target.connectNodes(eid, n1, n2, "other");
    }

    function test_connectNodes_source_missing_reverts() public {
        bytes32 n2 = keccak256("n2");
        target.addNode(n2, "card", int256(0), int256(0), "B");

        vm.expectRevert("Source node does not exist");
        target.connectNodes(keccak256("e1"), keccak256("missing"), n2, "label");
    }

    function test_connectNodes_target_missing_reverts() public {
        bytes32 n1 = keccak256("n1");
        target.addNode(n1, "card", int256(0), int256(0), "A");

        vm.expectRevert("Target node does not exist");
        target.connectNodes(keccak256("e1"), n1, keccak256("missing"), "label");
    }

    // --- getNode tests ---

    function test_getNode_nonexistent_reverts() public {
        vm.expectRevert("Node does not exist");
        target.getNode(keccak256("none"));
    }

    // --- getEdge tests ---

    function test_getEdge_nonexistent_reverts() public {
        vm.expectRevert("Edge does not exist");
        target.getEdge(keccak256("none"));
    }
}
