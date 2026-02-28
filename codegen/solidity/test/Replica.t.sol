// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Replica.sol";

contract ReplicaTest is Test {
    Replica public target;

    event LocalUpdated(bytes32 indexed replicaId, uint256 clock);
    event RemoteReceived(bytes32 indexed fromReplica, uint256 clock);
    event SyncRequested(bytes32 indexed peer);
    event Forked(bytes32 indexed parentReplicaId, bytes32 indexed newReplicaId);
    event PeerAdded(bytes32 indexed peerId);
    event Conflict(bytes32 indexed fromReplica, string reason);
    event UnknownReplica(bytes32 indexed fromReplica);

    bytes32 private _replicaId;

    function setUp() public {
        target = new Replica();
        _replicaId = keccak256("replica1");
        target.initialize(_replicaId, "initial-state");
    }

    // --- initialize tests ---

    function test_initialize_sets_state() public {
        Replica fresh = new Replica();
        bytes32 rid = keccak256("r2");
        fresh.initialize(rid, "hello");

        (bytes memory state, uint256 clock) = fresh.getState();
        assertEq(keccak256(state), keccak256("hello"));
        assertEq(clock, 0);
        assertEq(fresh.getReplicaId(), rid);
    }

    function test_initialize_double_reverts() public {
        vm.expectRevert("Replica already initialized");
        target.initialize(keccak256("r2"), "data");
    }

    function test_initialize_zero_id_reverts() public {
        Replica fresh = new Replica();

        vm.expectRevert("Replica ID cannot be zero");
        fresh.initialize(bytes32(0), "data");
    }

    // --- localUpdate tests ---

    function test_localUpdate_changes_state() public {
        bytes memory newState = target.localUpdate("updated-state");

        assertEq(keccak256(newState), keccak256("updated-state"));

        (bytes memory state, uint256 clock) = target.getState();
        assertEq(keccak256(state), keccak256("updated-state"));
        assertEq(clock, 1);
    }

    function test_localUpdate_increments_clock() public {
        target.localUpdate("op1");
        target.localUpdate("op2");
        target.localUpdate("op3");

        (, uint256 clock) = target.getState();
        assertEq(clock, 3);
    }

    function test_localUpdate_adds_pending_op() public {
        target.localUpdate("op1");
        target.localUpdate("op2");

        assertEq(target.getPendingOpsCount(), 2);
    }

    function test_localUpdate_emits_event() public {
        vm.expectEmit(true, false, false, true);
        emit LocalUpdated(_replicaId, 1);

        target.localUpdate("op1");
    }

    function test_localUpdate_empty_op_reverts() public {
        vm.expectRevert("Operation cannot be empty");
        target.localUpdate("");
    }

    function test_localUpdate_uninitialized_reverts() public {
        Replica fresh = new Replica();

        vm.expectRevert("Replica not initialized");
        fresh.localUpdate("op");
    }

    // --- receiveRemote tests ---

    function test_receiveRemote_applies_op() public {
        bytes32 peer = keccak256("peer1");
        target.addPeer(peer);

        bytes memory newState = target.receiveRemote("remote-data", peer);

        assertEq(keccak256(newState), keccak256("remote-data"));
    }

    function test_receiveRemote_increments_clock() public {
        bytes32 peer = keccak256("peer1");
        target.addPeer(peer);

        target.receiveRemote("remote-data", peer);

        (, uint256 clock) = target.getState();
        assertEq(clock, 1);
    }

    function test_receiveRemote_unknown_replica_reverts() public {
        vm.expectRevert("Unknown replica");
        target.receiveRemote("data", keccak256("unknown"));
    }

    function test_receiveRemote_empty_op_reverts() public {
        bytes32 peer = keccak256("peer1");
        target.addPeer(peer);

        vm.expectRevert("Operation cannot be empty");
        target.receiveRemote("", peer);
    }

    // --- sync tests ---

    function test_sync_emits_event() public {
        bytes32 peer = keccak256("peer1");
        target.addPeer(peer);

        vm.expectEmit(true, false, false, false);
        emit SyncRequested(peer);

        target.sync(peer);
    }

    function test_sync_unknown_peer_reverts() public {
        vm.expectRevert("Peer not known");
        target.sync(keccak256("unknown"));
    }

    // --- getState tests ---

    function test_getState_returns_current() public view {
        (bytes memory state, uint256 clock) = target.getState();

        assertEq(keccak256(state), keccak256("initial-state"));
        assertEq(clock, 0);
    }

    function test_getState_uninitialized_reverts() public {
        Replica fresh = new Replica();

        vm.expectRevert("Replica not initialized");
        fresh.getState();
    }

    // --- fork tests ---

    function test_fork_creates_new_id() public {
        bytes32 newId = target.fork();

        assertTrue(newId != bytes32(0));
        assertTrue(newId != _replicaId);
    }

    function test_fork_emits_event() public {
        vm.expectEmit(true, false, false, false);
        emit Forked(_replicaId, bytes32(0));

        target.fork();
    }

    function test_fork_generates_unique_ids() public {
        bytes32 id1 = target.fork();
        bytes32 id2 = target.fork();

        assertTrue(id1 != id2);
    }

    function test_fork_uninitialized_reverts() public {
        Replica fresh = new Replica();

        vm.expectRevert("Replica not initialized");
        fresh.fork();
    }

    // --- addPeer tests ---

    function test_addPeer_adds_to_set() public {
        bytes32 peer = keccak256("peer1");

        target.addPeer(peer);

        assertTrue(target.isPeer(peer));

        bytes32[] memory peers = target.getPeers();
        assertEq(peers.length, 1);
        assertEq(peers[0], peer);
    }

    function test_addPeer_emits_event() public {
        bytes32 peer = keccak256("peer1");

        vm.expectEmit(true, false, false, false);
        emit PeerAdded(peer);

        target.addPeer(peer);
    }

    function test_addPeer_duplicate_reverts() public {
        bytes32 peer = keccak256("peer1");
        target.addPeer(peer);

        vm.expectRevert("Peer already known");
        target.addPeer(peer);
    }

    function test_addPeer_zero_reverts() public {
        vm.expectRevert("Peer ID cannot be zero");
        target.addPeer(bytes32(0));
    }

    function test_addPeer_multiple() public {
        target.addPeer(keccak256("peer1"));
        target.addPeer(keccak256("peer2"));
        target.addPeer(keccak256("peer3"));

        bytes32[] memory peers = target.getPeers();
        assertEq(peers.length, 3);
    }

    // --- isPeer tests ---

    function test_isPeer_false_when_not_added() public view {
        assertFalse(target.isPeer(keccak256("unknown")));
    }
}
