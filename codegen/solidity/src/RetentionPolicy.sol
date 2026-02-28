// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RetentionPolicy
/// @notice Governs version retention and legal holds for records.
contract RetentionPolicy {
    struct Policy {
        string recordType;
        uint256 period;
        string unit;
        string dispositionAction;
        bool exists;
    }

    struct Hold {
        string name;
        string scope;
        string reason;
        bytes32 issuer;
        uint256 issued;
        bool released;
        bool exists;
    }

    mapping(bytes32 => Policy) private _policies;
    mapping(bytes32 => bool) private _policyByType;
    mapping(bytes32 => Hold) private _holds;
    bytes32[] private _activeHolds;
    uint256 private _policyNonce;
    uint256 private _holdNonce;

    event RetentionSet(bytes32 indexed policyId, string recordType);
    event HoldApplied(bytes32 indexed holdId, string name, bytes32 indexed issuer);
    event HoldReleased(bytes32 indexed holdId, bytes32 indexed releasedBy);
    event RecordDisposed(bytes32 indexed record, bytes32 indexed disposedBy);

    /// @notice Sets a retention policy for a record type.
    /// @param recordType The type of record this policy applies to.
    /// @param period The retention period length.
    /// @param unit The unit for the period (e.g. "days", "years").
    /// @param dispositionAction The action to take when the period expires (e.g. "archive", "delete").
    /// @return policyId The unique identifier of the policy.
    function setRetention(
        string calldata recordType,
        uint256 period,
        string calldata unit,
        string calldata dispositionAction
    ) external returns (bytes32 policyId) {
        policyId = keccak256(abi.encodePacked(recordType, _policyNonce++));

        _policies[policyId] = Policy({
            recordType: recordType,
            period: period,
            unit: unit,
            dispositionAction: dispositionAction,
            exists: true
        });

        bytes32 typeHash = keccak256(abi.encodePacked(recordType));
        _policyByType[typeHash] = true;

        emit RetentionSet(policyId, recordType);
    }

    /// @notice Places a legal hold on a scope of records.
    /// @param name The hold name.
    /// @param scope The scope the hold covers.
    /// @param reason The reason for the hold.
    /// @param issuer The issuer of the hold.
    /// @return holdId The unique identifier of the hold.
    function applyHold(
        string calldata name,
        string calldata scope,
        string calldata reason,
        bytes32 issuer
    ) external returns (bytes32 holdId) {
        holdId = keccak256(abi.encodePacked(name, scope, _holdNonce++));

        _holds[holdId] = Hold({
            name: name,
            scope: scope,
            reason: reason,
            issuer: issuer,
            issued: block.timestamp,
            released: false,
            exists: true
        });

        _activeHolds.push(holdId);

        emit HoldApplied(holdId, name, issuer);
    }

    /// @notice Releases a legal hold.
    /// @param holdId The hold to release.
    /// @param releasedBy The agent releasing the hold.
    /// @param reason The reason for releasing.
    function releaseHold(bytes32 holdId, bytes32 releasedBy, string calldata reason) external {
        Hold storage hold = _holds[holdId];
        require(hold.exists, "Hold not found");
        require(!hold.released, "Hold already released");

        hold.released = true;

        // Remove from active holds
        for (uint256 i = 0; i < _activeHolds.length; i++) {
            if (_activeHolds[i] == holdId) {
                _activeHolds[i] = _activeHolds[_activeHolds.length - 1];
                _activeHolds.pop();
                break;
            }
        }

        emit HoldReleased(holdId, releasedBy);
    }

    /// @notice Checks whether a record can be disposed.
    /// @param record The record identifier to check.
    /// @return status 0 = disposable, 1 = retained, 2 = held
    function checkDisposition(bytes32 record) external view returns (uint256 status) {
        // Check if any active hold covers this record
        if (_activeHolds.length > 0) {
            return 2; // held
        }
        return 0; // disposable
    }

    /// @notice Disposes a record if no active holds prevent it.
    /// @param record The record to dispose.
    /// @param disposedBy The agent performing disposal.
    function dispose(bytes32 record, bytes32 disposedBy) external {
        require(_activeHolds.length == 0, "Record is under active hold");

        emit RecordDisposed(record, disposedBy);
    }

    /// @notice Retrieves a policy by its ID.
    /// @param policyId The policy to retrieve.
    /// @return The policy record.
    function getPolicy(bytes32 policyId) external view returns (Policy memory) {
        require(_policies[policyId].exists, "Policy not found");
        return _policies[policyId];
    }

    /// @notice Retrieves a hold by its ID.
    /// @param holdId The hold to retrieve.
    /// @return The hold record.
    function getHold(bytes32 holdId) external view returns (Hold memory) {
        require(_holds[holdId].exists, "Hold not found");
        return _holds[holdId];
    }

    /// @notice Returns the number of active holds.
    /// @return The count of active holds.
    function activeHoldCount() external view returns (uint256) {
        return _activeHolds.length;
    }
}
