// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GovernanceTransparency
/// @notice Append-only audit trail with hash-chain integrity and disclosure policy management
/// @dev Implements the AuditTrail and DisclosurePolicy concepts from Clef specification.
///      AuditTrail provides an append-only, hash-chained log with record/query/verifyIntegrity.
///      DisclosurePolicy manages timing rules for when governance actions become publicly visible.

contract GovernanceTransparency {
    // --- Types ---

    struct AuditEntry {
        bytes32 entryHash;           // hash of this entry's content
        bytes32 previousHash;        // hash of the previous entry (chain link)
        bytes32 actorId;             // who performed the action
        bytes32 actionType;          // what type of action
        bytes32 subjectId;           // what entity was acted upon
        string details;              // human-readable details
        uint256 timestamp;
        uint256 blockNumber;
    }

    enum DisclosureTiming { Immediate, Delayed, AfterExecution, OnDemand }

    struct DisclosurePolicy {
        string name;
        bytes32 actionType;          // which action type this policy covers
        DisclosureTiming timing;
        uint256 delaySeconds;        // delay for Delayed timing (0 for others)
        bool active;
        bool exists;
    }

    struct DisclosureRecord {
        bytes32 policyId;
        bytes32 entryIndex;          // reference to the audit entry
        uint256 disclosableAt;       // timestamp when the entry becomes publicly visible
        bool disclosed;
    }

    // --- Storage ---

    /// @dev Append-only array of audit entries
    AuditEntry[] private _auditLog;

    /// @dev The hash of the most recent entry (head of the hash chain)
    bytes32 private _headHash;

    /// @dev Maps policy ID -> DisclosurePolicy
    mapping(bytes32 => DisclosurePolicy) private _disclosurePolicies;

    /// @dev Array of disclosure records
    DisclosureRecord[] private _disclosureRecords;

    /// @dev Maps action type -> policy ID for quick lookup
    mapping(bytes32 => bytes32) private _actionPolicyMap;

    // --- Events ---

    event AuditRecorded(
        uint256 indexed index,
        bytes32 indexed actorId,
        bytes32 indexed actionType,
        bytes32 entryHash,
        bytes32 previousHash
    );

    event IntegrityVerified(uint256 fromIndex, uint256 toIndex, bool valid);

    event DisclosurePolicyCreated(bytes32 indexed policyId, string name, bytes32 indexed actionType, DisclosureTiming timing);
    event DisclosurePolicyDeactivated(bytes32 indexed policyId);
    event DisclosureScheduled(uint256 indexed recordIndex, bytes32 indexed policyId, uint256 disclosableAt);
    event DisclosureReleased(uint256 indexed recordIndex);

    // --- AuditTrail Actions ---

    /// @notice Record an audit entry (append-only, hash-chained)
    /// @param actorId Who performed the action
    /// @param actionType Type of governance action
    /// @param subjectId Entity acted upon
    /// @param details Human-readable details
    function record(
        bytes32 actorId,
        bytes32 actionType,
        bytes32 subjectId,
        string calldata details
    ) external {
        require(actorId != bytes32(0), "Actor ID cannot be zero");
        require(actionType != bytes32(0), "Action type cannot be zero");

        bytes32 previousHash = _headHash;

        bytes32 entryHash = keccak256(abi.encodePacked(
            previousHash,
            actorId,
            actionType,
            subjectId,
            details,
            block.timestamp,
            block.number
        ));

        _auditLog.push(AuditEntry({
            entryHash: entryHash,
            previousHash: previousHash,
            actorId: actorId,
            actionType: actionType,
            subjectId: subjectId,
            details: details,
            timestamp: block.timestamp,
            blockNumber: block.number
        }));

        _headHash = entryHash;

        uint256 index = _auditLog.length - 1;

        emit AuditRecorded(index, actorId, actionType, entryHash, previousHash);

        // Auto-schedule disclosure if a policy exists for this action type
        bytes32 policyId = _actionPolicyMap[actionType];
        if (policyId != bytes32(0) && _disclosurePolicies[policyId].active) {
            _scheduleDisclosure(policyId, index);
        }
    }

    /// @notice Verify hash-chain integrity over a range of entries
    /// @param fromIndex Start index (inclusive)
    /// @param toIndex End index (inclusive)
    /// @return valid Whether the hash chain is intact over the range
    function verifyIntegrity(uint256 fromIndex, uint256 toIndex) external returns (bool valid) {
        require(fromIndex <= toIndex, "Invalid range");
        require(toIndex < _auditLog.length, "Index out of bounds");

        // Verify the first entry's previousHash matches the entry before it (if not index 0)
        if (fromIndex > 0) {
            if (_auditLog[fromIndex].previousHash != _auditLog[fromIndex - 1].entryHash) {
                emit IntegrityVerified(fromIndex, toIndex, false);
                return false;
            }
        }

        // Verify the chain within the range
        for (uint256 i = fromIndex + 1; i <= toIndex; i++) {
            bytes32 expectedPrev = _auditLog[i - 1].entryHash;
            if (_auditLog[i].previousHash != expectedPrev) {
                emit IntegrityVerified(fromIndex, toIndex, false);
                return false;
            }

            // Recompute hash to verify entry integrity
            AuditEntry storage entry = _auditLog[i];
            bytes32 recomputed = keccak256(abi.encodePacked(
                entry.previousHash,
                entry.actorId,
                entry.actionType,
                entry.subjectId,
                entry.details,
                entry.timestamp,
                entry.blockNumber
            ));
            if (recomputed != entry.entryHash) {
                emit IntegrityVerified(fromIndex, toIndex, false);
                return false;
            }
        }

        emit IntegrityVerified(fromIndex, toIndex, true);
        return true;
    }

    // --- DisclosurePolicy Actions ---

    /// @notice Create a disclosure policy for a governance action type
    /// @param policyId Unique identifier
    /// @param name Policy name
    /// @param actionType The action type this policy governs
    /// @param timing When entries become publicly visible
    /// @param delaySeconds Delay for Delayed timing (ignored for other timings)
    function createDisclosurePolicy(
        bytes32 policyId,
        string calldata name,
        bytes32 actionType,
        DisclosureTiming timing,
        uint256 delaySeconds
    ) external {
        require(policyId != bytes32(0), "Policy ID cannot be zero");
        require(!_disclosurePolicies[policyId].exists, "Policy already exists");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(actionType != bytes32(0), "Action type cannot be zero");

        if (timing == DisclosureTiming.Delayed) {
            require(delaySeconds > 0, "Delay must be positive for Delayed timing");
        }

        _disclosurePolicies[policyId] = DisclosurePolicy({
            name: name,
            actionType: actionType,
            timing: timing,
            delaySeconds: delaySeconds,
            active: true,
            exists: true
        });

        _actionPolicyMap[actionType] = policyId;

        emit DisclosurePolicyCreated(policyId, name, actionType, timing);
    }

    /// @notice Deactivate a disclosure policy
    /// @param policyId The policy to deactivate
    function deactivateDisclosurePolicy(bytes32 policyId) external {
        require(_disclosurePolicies[policyId].exists, "Policy not found");
        require(_disclosurePolicies[policyId].active, "Already inactive");

        _disclosurePolicies[policyId].active = false;

        emit DisclosurePolicyDeactivated(policyId);
    }

    /// @notice Release a disclosure record (make it publicly visible)
    /// @param recordIndex The disclosure record index
    function releaseDisclosure(uint256 recordIndex) external {
        require(recordIndex < _disclosureRecords.length, "Index out of bounds");
        DisclosureRecord storage rec = _disclosureRecords[recordIndex];
        require(!rec.disclosed, "Already disclosed");
        require(block.timestamp >= rec.disclosableAt, "Not yet disclosable");

        rec.disclosed = true;

        emit DisclosureReleased(recordIndex);
    }

    // --- Views ---

    /// @notice Get the total number of audit entries
    /// @return count Number of entries
    function getAuditLogLength() external view returns (uint256 count) {
        return _auditLog.length;
    }

    /// @notice Get an audit entry by index
    /// @param index The entry index
    /// @return The AuditEntry struct
    function getAuditEntry(uint256 index) external view returns (AuditEntry memory) {
        require(index < _auditLog.length, "Index out of bounds");
        return _auditLog[index];
    }

    /// @notice Get the current head hash of the audit chain
    /// @return The head hash
    function getHeadHash() external view returns (bytes32) {
        return _headHash;
    }

    /// @notice Query audit entries by actor (returns indices; off-chain filtering recommended)
    /// @param actorId The actor to filter by
    /// @param maxResults Maximum number of indices to return
    /// @return indices Array of matching entry indices
    function queryByActor(bytes32 actorId, uint256 maxResults) external view returns (uint256[] memory indices) {
        uint256[] memory temp = new uint256[](maxResults);
        uint256 found = 0;

        for (uint256 i = 0; i < _auditLog.length && found < maxResults; i++) {
            if (_auditLog[i].actorId == actorId) {
                temp[found] = i;
                found++;
            }
        }

        // Trim to actual size
        indices = new uint256[](found);
        for (uint256 j = 0; j < found; j++) {
            indices[j] = temp[j];
        }
    }

    /// @notice Query audit entries by action type (returns indices)
    /// @param actionType The action type to filter by
    /// @param maxResults Maximum number of indices to return
    /// @return indices Array of matching entry indices
    function queryByActionType(bytes32 actionType, uint256 maxResults) external view returns (uint256[] memory indices) {
        uint256[] memory temp = new uint256[](maxResults);
        uint256 found = 0;

        for (uint256 i = 0; i < _auditLog.length && found < maxResults; i++) {
            if (_auditLog[i].actionType == actionType) {
                temp[found] = i;
                found++;
            }
        }

        indices = new uint256[](found);
        for (uint256 j = 0; j < found; j++) {
            indices[j] = temp[j];
        }
    }

    /// @notice Get a disclosure policy
    /// @param policyId The policy ID
    /// @return The DisclosurePolicy struct
    function getDisclosurePolicy(bytes32 policyId) external view returns (DisclosurePolicy memory) {
        require(_disclosurePolicies[policyId].exists, "Policy not found");
        return _disclosurePolicies[policyId];
    }

    /// @notice Get the total number of disclosure records
    /// @return count Number of disclosure records
    function getDisclosureRecordCount() external view returns (uint256 count) {
        return _disclosureRecords.length;
    }

    // --- Internal ---

    /// @dev Schedule a disclosure based on policy timing
    function _scheduleDisclosure(bytes32 policyId, uint256 auditIndex) private {
        DisclosurePolicy storage policy = _disclosurePolicies[policyId];

        uint256 disclosableAt;
        if (policy.timing == DisclosureTiming.Immediate) {
            disclosableAt = block.timestamp;
        } else if (policy.timing == DisclosureTiming.Delayed) {
            disclosableAt = block.timestamp + policy.delaySeconds;
        } else {
            // AfterExecution and OnDemand: set to max, require explicit release
            disclosableAt = type(uint256).max;
        }

        _disclosureRecords.push(DisclosureRecord({
            policyId: policyId,
            entryIndex: bytes32(auditIndex),
            disclosableAt: disclosableAt,
            disclosed: false
        }));

        uint256 recordIndex = _disclosureRecords.length - 1;

        emit DisclosureScheduled(recordIndex, policyId, disclosableAt);
    }
}
