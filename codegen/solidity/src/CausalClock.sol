// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CausalClock
/// @notice Tracks happens-before ordering via vector clocks.
/// @dev Implements the CausalClock concept from Clef specification.
///      Supports ticking replicas, merging clocks, and comparing event ordering
///      (before, after, concurrent).

contract CausalClock {
    // --- Types ---

    /// @notice Ordering result for comparing two events.
    enum Ordering { Before, After, Concurrent, Equal }

    // --- Storage ---

    /// @dev Maps replicaId -> vector clock (array of uint256)
    mapping(bytes32 => uint256[]) private _clocks;

    /// @dev Maps replicaId -> its index in the vector
    mapping(bytes32 => uint256) private _replicaIndex;

    /// @dev Whether a replica has been registered
    mapping(bytes32 => bool) private _replicaRegistered;

    /// @dev Total number of registered replicas
    uint256 private _replicaCount;

    /// @dev Maps eventId -> clock snapshot at time of event
    mapping(bytes32 => uint256[]) private _eventClock;

    /// @dev Maps eventId -> which replica produced it
    mapping(bytes32 => bytes32) private _eventReplica;

    /// @dev Whether an event exists
    mapping(bytes32 => bool) private _eventExists;

    /// @dev Nonce for generating unique event IDs
    uint256 private _eventNonce;

    // --- Events ---

    event ReplicaRegistered(bytes32 indexed replicaId, uint256 index);
    event Ticked(bytes32 indexed replicaId, bytes32 indexed eventId);
    event Merged(bytes32 indexed replicaA, bytes32 indexed replicaB);

    // --- Actions ---

    /// @notice Register a new replica in the system. Must be called before tick.
    /// @param replicaId Unique identifier for the replica.
    function registerReplica(bytes32 replicaId) external {
        require(replicaId != bytes32(0), "Replica ID cannot be zero");
        require(!_replicaRegistered[replicaId], "Replica already registered");

        uint256 index = _replicaCount;
        _replicaIndex[replicaId] = index;
        _replicaRegistered[replicaId] = true;
        _replicaCount++;

        // Extend clock to cover new dimension
        _clocks[replicaId] = new uint256[](_replicaCount);

        emit ReplicaRegistered(replicaId, index);
    }

    /// @notice Increment the replica's logical clock and record an event.
    /// @param replicaId The replica performing the tick.
    /// @return eventId The generated event identifier.
    /// @return clock The clock snapshot after the tick.
    function tick(bytes32 replicaId) external returns (bytes32 eventId, uint256[] memory clock) {
        require(_replicaRegistered[replicaId], "Replica not registered");

        // Ensure clock vector is large enough
        _ensureClockSize(replicaId);

        // Increment this replica's position in its own clock
        uint256 idx = _replicaIndex[replicaId];
        _clocks[replicaId][idx]++;

        // Generate event ID
        _eventNonce++;
        eventId = keccak256(abi.encodePacked(replicaId, _clocks[replicaId][idx], _eventNonce));

        // Store snapshot
        _eventClock[eventId] = _cloneClock(_clocks[replicaId]);
        _eventReplica[eventId] = replicaId;
        _eventExists[eventId] = true;

        clock = _cloneClock(_clocks[replicaId]);

        emit Ticked(replicaId, eventId);
    }

    /// @notice Merge two replicas' clocks (component-wise max). Updates replicaA's clock.
    /// @param replicaA The replica whose clock will be updated.
    /// @param replicaB The replica whose clock is merged in.
    /// @return merged The resulting merged clock.
    function merge(bytes32 replicaA, bytes32 replicaB) external returns (uint256[] memory merged) {
        require(_replicaRegistered[replicaA], "Replica A not registered");
        require(_replicaRegistered[replicaB], "Replica B not registered");

        _ensureClockSize(replicaA);
        _ensureClockSize(replicaB);

        uint256 size = _replicaCount;
        for (uint256 i = 0; i < size; i++) {
            uint256 a = i < _clocks[replicaA].length ? _clocks[replicaA][i] : 0;
            uint256 b = i < _clocks[replicaB].length ? _clocks[replicaB][i] : 0;
            if (b > a) {
                _clocks[replicaA][i] = b;
            }
        }

        merged = _cloneClock(_clocks[replicaA]);

        emit Merged(replicaA, replicaB);
    }

    /// @notice Compare two events to determine causal ordering.
    /// @param eventA First event ID.
    /// @param eventB Second event ID.
    /// @return ordering The causal relationship between the events.
    function compare(bytes32 eventA, bytes32 eventB) external view returns (Ordering) {
        require(_eventExists[eventA], "Event A does not exist");
        require(_eventExists[eventB], "Event B does not exist");

        uint256[] storage clockA = _eventClock[eventA];
        uint256[] storage clockB = _eventClock[eventB];

        bool aBeforeB = true;  // all components of A <= B, at least one <
        bool bBeforeA = true;  // all components of B <= A, at least one <
        bool hasLess = false;
        bool hasGreater = false;

        uint256 maxLen = clockA.length > clockB.length ? clockA.length : clockB.length;

        for (uint256 i = 0; i < maxLen; i++) {
            uint256 a = i < clockA.length ? clockA[i] : 0;
            uint256 b = i < clockB.length ? clockB[i] : 0;

            if (a > b) {
                aBeforeB = false;
                hasGreater = true;
            }
            if (a < b) {
                bBeforeA = false;
                hasLess = true;
            }
        }

        if (!hasLess && !hasGreater) return Ordering.Equal;
        if (aBeforeB && hasLess) return Ordering.Before;
        if (bBeforeA && hasGreater) return Ordering.After;
        return Ordering.Concurrent;
    }

    /// @notice Check if eventA causally dominates eventB (A happened after B).
    /// @param eventA The potentially dominating event.
    /// @param eventB The potentially dominated event.
    /// @return True if eventA dominates eventB.
    function dominates(bytes32 eventA, bytes32 eventB) external view returns (bool) {
        require(_eventExists[eventA], "Event A does not exist");
        require(_eventExists[eventB], "Event B does not exist");

        uint256[] storage clockA = _eventClock[eventA];
        uint256[] storage clockB = _eventClock[eventB];

        bool hasGreater = false;
        uint256 maxLen = clockA.length > clockB.length ? clockA.length : clockB.length;

        for (uint256 i = 0; i < maxLen; i++) {
            uint256 a = i < clockA.length ? clockA[i] : 0;
            uint256 b = i < clockB.length ? clockB[i] : 0;

            if (a < b) return false;
            if (a > b) hasGreater = true;
        }

        return hasGreater;
    }

    // --- Views ---

    /// @notice Get the current clock for a replica.
    /// @param replicaId The replica to query.
    /// @return The vector clock array.
    function getClock(bytes32 replicaId) external view returns (uint256[] memory) {
        require(_replicaRegistered[replicaId], "Replica not registered");
        return _clocks[replicaId];
    }

    /// @notice Get the clock snapshot for an event.
    /// @param eventId The event to look up.
    /// @return The clock snapshot at the time of the event.
    function getEventClock(bytes32 eventId) external view returns (uint256[] memory) {
        require(_eventExists[eventId], "Event does not exist");
        return _eventClock[eventId];
    }

    /// @notice Get the total number of registered replicas.
    /// @return The replica count.
    function getReplicaCount() external view returns (uint256) {
        return _replicaCount;
    }

    // --- Internal ---

    /// @dev Ensure a replica's clock vector covers all registered replicas.
    function _ensureClockSize(bytes32 replicaId) private {
        uint256 currentLen = _clocks[replicaId].length;
        if (currentLen < _replicaCount) {
            for (uint256 i = currentLen; i < _replicaCount; i++) {
                _clocks[replicaId].push(0);
            }
        }
    }

    /// @dev Clone a clock array into memory.
    function _cloneClock(uint256[] storage source) private view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](source.length);
        for (uint256 i = 0; i < source.length; i++) {
            result[i] = source[i];
        }
        return result;
    }
}
