// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ConflictResolution
/// @notice Detects and resolves concurrent modifications with pluggable strategies.
/// @dev Implements the ConflictResolution concept from Clef specification.
///      Supports registering resolution policies, detecting conflicts between versions,
///      and resolving them automatically or manually.

contract ConflictResolution {
    // --- Types ---

    struct PolicyInfo {
        string name;
        uint256 priority;
        bool exists;
    }

    struct ConflictInfo {
        bytes base;
        bytes version1;
        bytes version2;
        string context;
        bytes resolution;
        bool resolved;
        bool requiresHuman;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps policyId -> policy definition
    mapping(bytes32 => PolicyInfo) private _policies;

    /// @dev Maps conflictId -> conflict record
    mapping(bytes32 => ConflictInfo) private _conflicts;

    /// @dev Array of pending (unresolved) conflict IDs
    bytes32[] private _pendingConflicts;

    /// @dev Nonce for generating unique conflict IDs
    uint256 private _conflictNonce;

    // --- Events ---

    event PolicyRegistered(bytes32 indexed policyId, string name, uint256 priority);
    event ConflictDetected(bytes32 indexed conflictId, string context);
    event ConflictResolved(bytes32 indexed conflictId, bool automatic);
    event NoConflict(bytes32 indexed base);

    // --- Actions ---

    /// @notice Register a resolution policy.
    /// @param name Human-readable name for the policy.
    /// @param priority Priority value (higher = preferred).
    /// @return policyId The generated policy identifier.
    function registerPolicy(string calldata name, uint256 priority) external returns (bytes32 policyId) {
        require(bytes(name).length > 0, "Policy name cannot be empty");

        policyId = keccak256(abi.encodePacked(name, priority));
        require(!_policies[policyId].exists, "Policy already exists");

        _policies[policyId] = PolicyInfo({
            name: name,
            priority: priority,
            exists: true
        });

        emit PolicyRegistered(policyId, name, priority);
    }

    /// @notice Detect whether a conflict exists between two versions of a base.
    /// @param base The base version data.
    /// @param version1 The first concurrent version.
    /// @param version2 The second concurrent version.
    /// @param context Description of the conflict context.
    /// @return conflictId The generated conflict ID, or bytes32(0) if no conflict.
    function detect(
        bytes calldata base,
        bytes calldata version1,
        bytes calldata version2,
        string calldata context
    ) external returns (bytes32 conflictId) {
        require(base.length > 0, "Base cannot be empty");

        // If both versions are identical, no conflict
        if (keccak256(version1) == keccak256(version2)) {
            emit NoConflict(keccak256(base));
            return bytes32(0);
        }

        _conflictNonce++;
        conflictId = keccak256(abi.encodePacked(base, version1, version2, _conflictNonce));

        _conflicts[conflictId] = ConflictInfo({
            base: base,
            version1: version1,
            version2: version2,
            context: context,
            resolution: "",
            resolved: false,
            requiresHuman: false,
            exists: true
        });

        _pendingConflicts.push(conflictId);

        emit ConflictDetected(conflictId, context);
    }

    /// @notice Attempt automatic resolution of a conflict using the given policy.
    /// @param conflictId The conflict to resolve.
    /// @param policyOverride Optional policy ID to use (bytes32(0) to skip).
    /// @return resolved Whether the conflict was automatically resolved.
    /// @return result The resolution data (empty if requiresHuman).
    function resolve(bytes32 conflictId, bytes32 policyOverride) external returns (bool resolved, bytes memory result) {
        require(_conflicts[conflictId].exists, "Conflict does not exist");
        require(!_conflicts[conflictId].resolved, "Conflict already resolved");

        if (policyOverride != bytes32(0)) {
            require(_policies[policyOverride].exists, "Policy does not exist");

            // Automatic resolution: use version1 as winner (deterministic strategy)
            _conflicts[conflictId].resolution = _conflicts[conflictId].version1;
            _conflicts[conflictId].resolved = true;
            _removePending(conflictId);

            emit ConflictResolved(conflictId, true);
            return (true, _conflicts[conflictId].resolution);
        }

        // No policy provided: mark as requiring human intervention
        _conflicts[conflictId].requiresHuman = true;
        return (false, "");
    }

    /// @notice Manually resolve a conflict with a chosen resolution.
    /// @param conflictId The conflict to resolve.
    /// @param chosen The chosen resolution data.
    /// @return result The applied resolution.
    function manualResolve(bytes32 conflictId, bytes calldata chosen) external returns (bytes memory result) {
        require(_conflicts[conflictId].exists, "Conflict does not exist");
        require(!_conflicts[conflictId].resolved, "Conflict already resolved");
        require(chosen.length > 0, "Resolution cannot be empty");

        _conflicts[conflictId].resolution = chosen;
        _conflicts[conflictId].resolved = true;
        _conflicts[conflictId].requiresHuman = false;
        _removePending(conflictId);

        emit ConflictResolved(conflictId, false);
        return chosen;
    }

    // --- Views ---

    /// @notice Get a conflict record.
    /// @param conflictId The conflict to look up.
    /// @return The conflict info struct.
    function getConflict(bytes32 conflictId) external view returns (ConflictInfo memory) {
        require(_conflicts[conflictId].exists, "Conflict does not exist");
        return _conflicts[conflictId];
    }

    /// @notice Get a policy record.
    /// @param policyId The policy to look up.
    /// @return The policy info struct.
    function getPolicy(bytes32 policyId) external view returns (PolicyInfo memory) {
        require(_policies[policyId].exists, "Policy does not exist");
        return _policies[policyId];
    }

    /// @notice Get all pending (unresolved) conflict IDs.
    /// @return Array of pending conflict IDs.
    function getPendingConflicts() external view returns (bytes32[] memory) {
        return _pendingConflicts;
    }

    // --- Internal ---

    /// @dev Remove a conflict from the pending list.
    function _removePending(bytes32 conflictId) private {
        uint256 len = _pendingConflicts.length;
        for (uint256 i = 0; i < len; i++) {
            if (_pendingConflicts[i] == conflictId) {
                _pendingConflicts[i] = _pendingConflicts[len - 1];
                _pendingConflicts.pop();
                break;
            }
        }
    }
}
