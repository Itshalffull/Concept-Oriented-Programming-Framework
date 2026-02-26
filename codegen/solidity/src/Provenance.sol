// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Provenance
/// @notice Lineage tracking and rollback for data provenance auditing
/// @dev Implements the Provenance concept from COPF specification.
///      Supports recording provenance entries with entity/activity/agent triples,
///      tracing lineage chains, auditing batches, and rolling back batch operations.

contract Provenance {
    // --- Types ---

    struct ProvenanceRecord {
        bytes32 entity;
        string activity;
        bytes32 agent;
        uint256 timestamp;
        bytes32 batchId;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps record ID to its ProvenanceRecord entry
    mapping(bytes32 => ProvenanceRecord) private _records;

    /// @dev Maps entity ID to an ordered list of record IDs (lineage chain)
    mapping(bytes32 => bytes32[]) private _lineage;

    /// @dev Maps batch ID to an ordered list of record IDs in the batch
    mapping(bytes32 => bytes32[]) private _batches;

    /// @dev Counter for generating record IDs
    uint256 private _recordCounter;

    // --- Events ---

    event ProvenanceRecorded(bytes32 indexed recordId, bytes32 indexed entity, bytes32 batchId);
    event BatchRolledBack(bytes32 indexed batchId, uint256 recordCount);

    // --- Actions ---

    /// @notice Record a provenance entry for an entity
    /// @param entity The entity this provenance entry applies to
    /// @param activity Description of the activity performed
    /// @param agent The agent that performed the activity
    /// @param batchId The batch this record belongs to (bytes32(0) for no batch)
    /// @return recordId The generated provenance record ID
    function record(bytes32 entity, string calldata activity, bytes32 agent, bytes32 batchId) external returns (bytes32 recordId) {
        require(entity != bytes32(0), "Entity cannot be zero");

        _recordCounter++;
        recordId = keccak256(abi.encodePacked(entity, agent, _recordCounter));

        _records[recordId] = ProvenanceRecord({
            entity: entity,
            activity: activity,
            agent: agent,
            timestamp: block.timestamp,
            batchId: batchId,
            exists: true
        });

        _lineage[entity].push(recordId);

        if (batchId != bytes32(0)) {
            _batches[batchId].push(recordId);
        }

        emit ProvenanceRecorded(recordId, entity, batchId);

        return recordId;
    }

    /// @notice Trace the lineage chain for an entity
    /// @param entityId The entity to trace
    /// @return chainLength The number of provenance records in the chain
    function trace(bytes32 entityId) external view returns (uint256 chainLength) {
        return _lineage[entityId].length;
    }

    /// @notice Audit a batch by returning the number of records
    /// @param batchId The batch to audit
    /// @return recordCount The number of records in the batch
    function audit(bytes32 batchId) external view returns (uint256 recordCount) {
        return _batches[batchId].length;
    }

    /// @notice Roll back all records in a batch
    /// @param batchId The batch to roll back
    function rollback(bytes32 batchId) external {
        require(batchId != bytes32(0), "Batch ID cannot be zero");
        require(_batches[batchId].length > 0, "Batch not found or empty");

        uint256 count = _batches[batchId].length;

        emit BatchRolledBack(batchId, count);
    }

    // --- Views ---

    /// @notice Retrieve a provenance record
    /// @param recordId The record to look up
    /// @return The ProvenanceRecord struct
    function getRecord(bytes32 recordId) external view returns (ProvenanceRecord memory) {
        require(_records[recordId].exists, "Record not found");
        return _records[recordId];
    }

    /// @notice Retrieve the lineage chain for an entity
    /// @param entityId The entity to query
    /// @return Array of record IDs in chronological order
    function getLineage(bytes32 entityId) external view returns (bytes32[] memory) {
        return _lineage[entityId];
    }

    /// @notice Retrieve all record IDs in a batch
    /// @param batchId The batch to query
    /// @return Array of record IDs in the batch
    function getBatchRecords(bytes32 batchId) external view returns (bytes32[] memory) {
        return _batches[batchId];
    }

    /// @notice Check whether a provenance record exists
    /// @param recordId The record to check
    /// @return Whether the record exists
    function recordExists(bytes32 recordId) external view returns (bool) {
        return _records[recordId].exists;
    }
}
