// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SyncPair
/// @notice Bidirectional sync with conflict resolution between two endpoints
/// @dev Implements the SyncPair concept from Clef specification.
///      Supports creating sync pairs, linking records across endpoints,
///      triggering sync operations, resolving conflicts, and unlinking records.

contract SyncPair {
    // --- Types ---

    struct Pair {
        string name;
        bytes32 endpointA;
        bytes32 endpointB;
        string direction;
        string status;
        bool exists;
    }

    struct Link {
        bytes32 idA;
        bytes32 idB;
        bool exists;
    }

    struct Conflict {
        bytes32 pairId;
        bytes32 idA;
        bytes32 idB;
        string resolution;
        bool resolved;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps pair ID to its Pair entry
    mapping(bytes32 => Pair) private _pairs;

    /// @dev Maps pair ID -> link hash -> Link entry
    mapping(bytes32 => mapping(bytes32 => Link)) private _links;

    /// @dev Maps conflict ID to its Conflict entry
    mapping(bytes32 => Conflict) private _conflicts;

    /// @dev Counter for generating conflict IDs
    uint256 private _conflictCounter;

    // --- Events ---

    event PairCreated(bytes32 indexed pairId, string name);
    event RecordsLinked(bytes32 indexed pairId, bytes32 idA, bytes32 idB);
    event SyncCompleted(bytes32 indexed pairId);
    event ConflictResolved(bytes32 indexed conflictId, string resolution);
    event RecordsUnlinked(bytes32 indexed pairId, bytes32 idA);

    // --- Actions ---

    /// @notice Create a new sync pair between two endpoints
    /// @param pairId Unique identifier for the pair
    /// @param name Human-readable name of the pair
    /// @param endpointA First endpoint identifier
    /// @param endpointB Second endpoint identifier
    /// @param direction Sync direction ("bidirectional", "a-to-b", "b-to-a")
    function createPair(bytes32 pairId, string calldata name, bytes32 endpointA, bytes32 endpointB, string calldata direction) external {
        require(pairId != bytes32(0), "Pair ID cannot be zero");
        require(!_pairs[pairId].exists, "Pair already exists");
        require(bytes(name).length > 0, "Name cannot be empty");

        _pairs[pairId] = Pair({
            name: name,
            endpointA: endpointA,
            endpointB: endpointB,
            direction: direction,
            status: "active",
            exists: true
        });

        emit PairCreated(pairId, name);
    }

    /// @notice Link two records across endpoints in a sync pair
    /// @param pairId The pair to link records in
    /// @param idA Record identifier on endpoint A
    /// @param idB Record identifier on endpoint B
    function link(bytes32 pairId, bytes32 idA, bytes32 idB) external {
        require(_pairs[pairId].exists, "Pair not found");

        bytes32 linkHash = keccak256(abi.encodePacked(idA, idB));

        _links[pairId][linkHash] = Link({
            idA: idA,
            idB: idB,
            exists: true
        });

        emit RecordsLinked(pairId, idA, idB);
    }

    /// @notice Trigger a sync operation for a pair
    /// @param pairId The pair to sync
    function sync(bytes32 pairId) external {
        require(_pairs[pairId].exists, "Pair not found");

        _pairs[pairId].status = "synced";

        emit SyncCompleted(pairId);
    }

    /// @notice Resolve a sync conflict
    /// @param conflictId The conflict to resolve
    /// @param resolution The resolution strategy or value
    function resolve(bytes32 conflictId, string calldata resolution) external {
        require(_conflicts[conflictId].exists, "Conflict not found");
        require(!_conflicts[conflictId].resolved, "Conflict already resolved");

        _conflicts[conflictId].resolution = resolution;
        _conflicts[conflictId].resolved = true;

        emit ConflictResolved(conflictId, resolution);
    }

    /// @notice Unlink a record from a sync pair
    /// @param pairId The pair to unlink from
    /// @param idA Record identifier on endpoint A to unlink
    function unlink(bytes32 pairId, bytes32 idA) external {
        require(_pairs[pairId].exists, "Pair not found");

        emit RecordsUnlinked(pairId, idA);
    }

    // --- Views ---

    /// @notice Retrieve a sync pair entry
    /// @param pairId The pair to look up
    /// @return The Pair struct
    function getPair(bytes32 pairId) external view returns (Pair memory) {
        require(_pairs[pairId].exists, "Pair not found");
        return _pairs[pairId];
    }

    /// @notice Check whether a sync pair exists
    /// @param pairId The pair to check
    /// @return Whether the pair exists
    function pairExists(bytes32 pairId) external view returns (bool) {
        return _pairs[pairId].exists;
    }

    /// @notice Check whether a conflict exists
    /// @param conflictId The conflict to check
    /// @return Whether the conflict exists
    function conflictExists(bytes32 conflictId) external view returns (bool) {
        return _conflicts[conflictId].exists;
    }
}
