// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Replica
/// @notice Locally-modifiable copy of shared state that syncs with peers.
/// @dev Implements the Replica concept from Clef specification.
///      Supports local updates, receiving remote operations, peer management,
///      forking replicas, and state/clock queries.

contract Replica {
    // --- Storage ---

    /// @dev The local state data
    bytes private _localState;

    /// @dev Pending operations not yet synced
    bytes[] private _pendingOps;

    /// @dev Set of known peers
    mapping(bytes32 => bool) private _peers;

    /// @dev Ordered list of peer IDs
    bytes32[] private _peerList;

    /// @dev This replica's identifier
    bytes32 private _replicaId;

    /// @dev Logical clock for ordering
    uint256 private _clock;

    /// @dev Nonce for fork ID generation
    uint256 private _forkNonce;

    /// @dev Whether the replica has been initialized
    bool private _initialized;

    // --- Events ---

    event LocalUpdated(bytes32 indexed replicaId, uint256 clock);
    event RemoteReceived(bytes32 indexed fromReplica, uint256 clock);
    event SyncRequested(bytes32 indexed peer);
    event Forked(bytes32 indexed parentReplicaId, bytes32 indexed newReplicaId);
    event PeerAdded(bytes32 indexed peerId);
    event Conflict(bytes32 indexed fromReplica, string reason);
    event UnknownReplica(bytes32 indexed fromReplica);

    // --- Actions ---

    /// @notice Initialize the replica with an ID and optional initial state.
    /// @param replicaId The unique identifier for this replica.
    /// @param initialState The initial state data.
    function initialize(bytes32 replicaId, bytes calldata initialState) external {
        require(!_initialized, "Replica already initialized");
        require(replicaId != bytes32(0), "Replica ID cannot be zero");

        _replicaId = replicaId;
        _localState = initialState;
        _clock = 0;
        _initialized = true;
    }

    /// @notice Apply a local operation, updating state and incrementing the clock.
    /// @param op The operation data to apply.
    /// @return newState The state after applying the operation.
    function localUpdate(bytes calldata op) external returns (bytes memory newState) {
        require(_initialized, "Replica not initialized");
        require(op.length > 0, "Operation cannot be empty");

        _clock++;
        _localState = op; // Simplified: operation replaces state
        _pendingOps.push(op);

        emit LocalUpdated(_replicaId, _clock);

        return _localState;
    }

    /// @notice Receive and apply a remote operation from a peer.
    /// @param op The operation data from the remote peer.
    /// @param fromReplica The peer replica that sent the operation.
    /// @return newState The state after applying the operation.
    function receiveRemote(bytes calldata op, bytes32 fromReplica) external returns (bytes memory newState) {
        require(_initialized, "Replica not initialized");
        require(op.length > 0, "Operation cannot be empty");

        if (!_peers[fromReplica]) {
            emit UnknownReplica(fromReplica);
            revert("Unknown replica");
        }

        // Simple conflict detection: if we have pending ops, flag conflict
        if (_pendingOps.length > 0) {
            emit Conflict(fromReplica, "Concurrent modifications detected");
            // Still apply the remote op (last-writer-wins semantics)
        }

        _clock++;
        _localState = op; // Simplified: remote op replaces state

        emit RemoteReceived(fromReplica, _clock);

        return _localState;
    }

    /// @notice Request sync with a peer (emits event only; actual sync is off-chain).
    /// @param peer The peer to sync with.
    function sync(bytes32 peer) external {
        require(_initialized, "Replica not initialized");
        require(_peers[peer], "Peer not known");

        emit SyncRequested(peer);
    }

    /// @notice Get the current state and clock.
    /// @return state The current local state.
    /// @return clock The current logical clock value.
    function getState() external view returns (bytes memory state, uint256 clock) {
        require(_initialized, "Replica not initialized");
        return (_localState, _clock);
    }

    /// @notice Fork this replica, creating a new replica ID.
    /// @return newReplicaId The identifier for the forked replica.
    function fork() external returns (bytes32 newReplicaId) {
        require(_initialized, "Replica not initialized");

        _forkNonce++;
        newReplicaId = keccak256(abi.encodePacked(_replicaId, "fork", _forkNonce, block.timestamp));

        emit Forked(_replicaId, newReplicaId);
    }

    /// @notice Add a peer to the known peer set.
    /// @param peerId The peer identifier to add.
    function addPeer(bytes32 peerId) external {
        require(_initialized, "Replica not initialized");
        require(peerId != bytes32(0), "Peer ID cannot be zero");
        require(!_peers[peerId], "Peer already known");

        _peers[peerId] = true;
        _peerList.push(peerId);

        emit PeerAdded(peerId);
    }

    // --- Views ---

    /// @notice Get the replica's identifier.
    /// @return The replica ID.
    function getReplicaId() external view returns (bytes32) {
        require(_initialized, "Replica not initialized");
        return _replicaId;
    }

    /// @notice Get the list of known peers.
    /// @return Array of peer IDs.
    function getPeers() external view returns (bytes32[] memory) {
        return _peerList;
    }

    /// @notice Get the number of pending operations.
    /// @return The count of pending ops.
    function getPendingOpsCount() external view returns (uint256) {
        return _pendingOps.length;
    }

    /// @notice Check if a peer is known.
    /// @param peerId The peer to check.
    /// @return Whether the peer is in the known set.
    function isPeer(bytes32 peerId) external view returns (bool) {
        return _peers[peerId];
    }
}
