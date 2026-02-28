// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PessimisticLock
/// @notice Exclusive write locks for resources with expiration and forced break.
/// @dev Implements the PessimisticLock concept from Clef specification.
///      Supports checking out a lock on a resource, checking in to release,
///      breaking locks by force, renewing duration, and querying active locks.

contract PessimisticLock {
    // --- Types ---

    struct Lock {
        bytes32 resource;
        bytes32 holder;
        uint256 acquired;
        uint256 expires;
        bool active;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps lockId -> lock record
    mapping(bytes32 => Lock) private _locks;

    /// @dev Maps resource -> currently active lockId
    mapping(bytes32 => bytes32) private _resourceLock;

    /// @dev Maps resource -> all lock IDs (history)
    mapping(bytes32 => bytes32[]) private _resourceLockHistory;

    /// @dev Nonce for generating unique lock IDs
    uint256 private _nonce;

    // --- Events ---

    event CheckedOut(bytes32 indexed lockId, bytes32 indexed resource, bytes32 indexed holder);
    event CheckedIn(bytes32 indexed lockId);
    event LockBroken(bytes32 indexed lockId, bytes32 indexed breaker, bytes32 previousHolder);
    event Renewed(bytes32 indexed lockId, uint256 newExpires);
    event AlreadyLocked(bytes32 indexed resource, bytes32 indexed currentHolder);

    // --- Actions ---

    /// @notice Check out an exclusive lock on a resource.
    /// @param resource The resource identifier to lock.
    /// @param holder The identity claiming the lock.
    /// @param duration The lock duration in seconds.
    /// @param reason A description for the lock.
    /// @return lockId The generated lock ID, or bytes32(0) if already locked.
    function checkOut(
        bytes32 resource,
        bytes32 holder,
        uint256 duration,
        string calldata reason
    ) external returns (bytes32 lockId) {
        require(resource != bytes32(0), "Resource cannot be zero");
        require(holder != bytes32(0), "Holder cannot be zero");
        require(duration > 0, "Duration must be positive");
        require(bytes(reason).length > 0, "Reason cannot be empty");

        bytes32 activeLockId = _resourceLock[resource];

        // Check if there is an active, non-expired lock
        if (activeLockId != bytes32(0) && _locks[activeLockId].active) {
            if (block.timestamp < _locks[activeLockId].expires) {
                // Resource is locked by someone else
                emit AlreadyLocked(resource, _locks[activeLockId].holder);
                return bytes32(0);
            }
            // Lock has expired, deactivate it
            _locks[activeLockId].active = false;
        }

        _nonce++;
        lockId = keccak256(abi.encodePacked(resource, holder, block.timestamp, _nonce));

        _locks[lockId] = Lock({
            resource: resource,
            holder: holder,
            acquired: block.timestamp,
            expires: block.timestamp + duration,
            active: true,
            exists: true
        });

        _resourceLock[resource] = lockId;
        _resourceLockHistory[resource].push(lockId);

        emit CheckedOut(lockId, resource, holder);
    }

    /// @notice Release a lock by checking in.
    /// @param lockId The lock to release.
    function checkIn(bytes32 lockId) external {
        require(_locks[lockId].exists, "Lock does not exist");
        require(_locks[lockId].active, "Lock is not active");

        _locks[lockId].active = false;

        bytes32 resource = _locks[lockId].resource;
        if (_resourceLock[resource] == lockId) {
            _resourceLock[resource] = bytes32(0);
        }

        emit CheckedIn(lockId);
    }

    /// @notice Force break an active lock.
    /// @param lockId The lock to break.
    /// @param breaker The identity breaking the lock.
    /// @param reason A description for why the lock is being broken.
    /// @return previousHolder The holder whose lock was broken.
    function breakLock(
        bytes32 lockId,
        bytes32 breaker,
        string calldata reason
    ) external returns (bytes32 previousHolder) {
        require(_locks[lockId].exists, "Lock does not exist");
        require(_locks[lockId].active, "Lock is not active");
        require(breaker != bytes32(0), "Breaker cannot be zero");
        require(bytes(reason).length > 0, "Reason cannot be empty");

        previousHolder = _locks[lockId].holder;
        _locks[lockId].active = false;

        bytes32 resource = _locks[lockId].resource;
        if (_resourceLock[resource] == lockId) {
            _resourceLock[resource] = bytes32(0);
        }

        emit LockBroken(lockId, breaker, previousHolder);
    }

    /// @notice Extend the duration of an active lock.
    /// @param lockId The lock to renew.
    /// @param additionalDuration Additional seconds to add to the expiration.
    /// @return newExpires The new expiration timestamp.
    function renew(bytes32 lockId, uint256 additionalDuration) external returns (uint256 newExpires) {
        require(_locks[lockId].exists, "Lock does not exist");
        require(_locks[lockId].active, "Lock is not active");
        require(additionalDuration > 0, "Additional duration must be positive");

        newExpires = _locks[lockId].expires + additionalDuration;
        _locks[lockId].expires = newExpires;

        emit Renewed(lockId, newExpires);
    }

    /// @notice Query all lock IDs for a resource (history).
    /// @param resource The resource to query.
    /// @return Array of lock IDs.
    function queryLocks(bytes32 resource) external view returns (bytes32[] memory) {
        return _resourceLockHistory[resource];
    }

    // --- Views ---

    /// @notice Get a lock record.
    /// @param lockId The lock to look up.
    /// @return The lock struct.
    function getLock(bytes32 lockId) external view returns (Lock memory) {
        require(_locks[lockId].exists, "Lock does not exist");
        return _locks[lockId];
    }

    /// @notice Get the currently active lock for a resource.
    /// @param resource The resource to query.
    /// @return The active lock ID, or bytes32(0) if none.
    function getActiveLock(bytes32 resource) external view returns (bytes32) {
        return _resourceLock[resource];
    }
}
