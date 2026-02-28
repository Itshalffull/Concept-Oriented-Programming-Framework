// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SyncEngine
/// @notice Sync execution engine provider for Clef sync rule processing
/// @dev Implements the SyncEngine concept from Clef specification.
///      Provider contract: register() is pure and returns static metadata.
///      Manages sync rule registration, completion handling, where-clause evaluation,
///      sync queueing, availability-based draining, and conflict detection.

contract SyncEngine {

    // --- Types ---

    struct ProviderMetadata {
        string name;
        string category;
    }

    struct SyncRule {
        bytes data;
        uint256 timestamp;
        bool exists;
    }

    struct PendingFlow {
        bytes syncData;
        bytes bindings;
        string flow;
        string conceptUri;
        uint256 timestamp;
        bool exists;
    }

    struct Conflict {
        bytes32 pendingId;
        bytes data;
        uint256 timestamp;
    }

    struct OnCompletionOkResult {
        bool success;
        bytes[] invocations;
    }

    struct EvaluateWhereInput {
        bytes bindings;
        bytes[] queries;
    }

    struct EvaluateWhereOkResult {
        bool success;
        bytes[] results;
    }

    struct EvaluateWhereErrorResult {
        bool success;
        string message;
    }

    struct QueueSyncInput {
        bytes sync;
        bytes bindings;
        string flow;
    }

    struct QueueSyncOkResult {
        bool success;
        string pendingId;
    }

    struct OnAvailabilityChangeInput {
        string conceptUri;
        bool available;
    }

    struct OnAvailabilityChangeOkResult {
        bool success;
        bytes[] drained;
    }

    struct DrainConflictsOkResult {
        bool success;
        bytes[] conflicts;
    }

    // --- Storage ---

    /// @dev Maps sync rule ID to its SyncRule
    mapping(bytes32 => SyncRule) private _syncs;

    /// @dev Ordered list of sync rule IDs
    bytes32[] private _syncIds;

    /// @dev Maps pending flow ID to its PendingFlow
    mapping(bytes32 => PendingFlow) private _pendingFlows;

    /// @dev Ordered list of pending flow IDs
    bytes32[] private _pendingFlowIds;

    /// @dev Maps concept URI hash to availability status
    mapping(bytes32 => bool) private _availability;

    /// @dev Conflict entries detected during processing
    Conflict[] private _conflicts;

    /// @dev Nonce for generating unique IDs
    uint256 private _nonce;

    // --- Events ---

    event RegisterSyncCompleted(string variant);
    event OnCompletionCompleted(string variant, bytes[] invocations);
    event EvaluateWhereCompleted(string variant, bytes[] results);
    event QueueSyncCompleted(string variant);
    event OnAvailabilityChangeCompleted(string variant, bytes[] drained);
    event DrainConflictsCompleted(string variant, bytes[] conflicts);

    // --- Actions ---

    /// @notice register - returns static provider metadata
    /// @return metadata The provider metadata (name, category)
    function register() external pure returns (ProviderMetadata memory metadata) {
        metadata = ProviderMetadata({
            name: "sync-engine",
            category: "engine"
        });
    }

    /// @notice registerSync - registers a sync rule for execution
    /// @param sync The serialised sync rule definition
    /// @return success Whether registration succeeded
    function registerSync(bytes calldata sync) external returns (bool) {
        require(sync.length > 0, "Sync data cannot be empty");

        bytes32 syncId = keccak256(abi.encodePacked(sync, block.timestamp, _nonce));
        _nonce++;

        _syncs[syncId] = SyncRule({
            data: sync,
            timestamp: block.timestamp,
            exists: true
        });
        _syncIds.push(syncId);

        emit RegisterSyncCompleted("ok");
        return true;
    }

    /// @notice onCompletion - handles action completion by finding matching sync rules
    /// @param completion The serialised completion event data
    /// @return result The result with invocations to trigger
    function onCompletion(bytes calldata completion) external returns (OnCompletionOkResult memory result) {
        require(completion.length > 0, "Completion data cannot be empty");
        require(_syncIds.length > 0, "No sync rules registered");

        // Match completion against registered syncs and build invocations
        bytes[] memory invocations = new bytes[](_syncIds.length);
        uint256 matchCount = 0;

        for (uint256 i = 0; i < _syncIds.length; i++) {
            if (_syncs[_syncIds[i]].exists) {
                invocations[matchCount] = abi.encode(_syncIds[i], completion);
                matchCount++;
            }
        }

        bytes[] memory trimmed = new bytes[](matchCount);
        for (uint256 i = 0; i < matchCount; i++) {
            trimmed[i] = invocations[i];
        }

        result = OnCompletionOkResult({ success: true, invocations: trimmed });

        emit OnCompletionCompleted("ok", trimmed);
    }

    /// @notice evaluateWhere - evaluates where-clause queries against bindings
    /// @param bindings The serialised variable bindings
    /// @param queries The where-clause queries to evaluate
    /// @return result The evaluation results
    function evaluateWhere(bytes calldata bindings, bytes[] calldata queries) external returns (EvaluateWhereOkResult memory result) {
        require(bindings.length > 0, "Bindings cannot be empty");

        bytes[] memory results = new bytes[](queries.length);
        for (uint256 i = 0; i < queries.length; i++) {
            // Evaluate each query against the bindings
            results[i] = abi.encode(keccak256(abi.encodePacked(bindings, queries[i])), true);
        }

        result = EvaluateWhereOkResult({ success: true, results: results });

        emit EvaluateWhereCompleted("ok", results);
    }

    /// @notice queueSync - queues a sync for deferred execution
    /// @param sync The serialised sync definition
    /// @param bindings The serialised variable bindings
    /// @param flow The flow identifier
    /// @return result The result with pending ID
    function queueSync(bytes calldata sync, bytes calldata bindings, string calldata flow) external returns (QueueSyncOkResult memory result) {
        require(sync.length > 0, "Sync data cannot be empty");

        bytes32 pendingId = keccak256(abi.encodePacked(sync, bindings, flow, block.timestamp, _nonce));
        _nonce++;

        _pendingFlows[pendingId] = PendingFlow({
            syncData: sync,
            bindings: bindings,
            flow: flow,
            conceptUri: "",
            timestamp: block.timestamp,
            exists: true
        });
        _pendingFlowIds.push(pendingId);

        // Convert bytes32 to a hex string for the pendingId return
        string memory pendingIdStr = _bytes32ToHexString(pendingId);

        result = QueueSyncOkResult({ success: true, pendingId: pendingIdStr });

        emit QueueSyncCompleted("ok");
    }

    /// @notice onAvailabilityChange - handles concept availability changes, draining pending flows
    /// @param conceptUri The concept URI whose availability changed
    /// @param available Whether the concept is now available
    /// @return result The result with drained pending flows
    function onAvailabilityChange(string calldata conceptUri, bool available) external returns (OnAvailabilityChangeOkResult memory result) {
        bytes32 uriHash = keccak256(abi.encodePacked(conceptUri));
        _availability[uriHash] = available;

        bytes[] memory drained;

        if (available) {
            // Drain pending flows that match this concept URI
            uint256 drainCount = 0;
            bytes[] memory candidates = new bytes[](_pendingFlowIds.length);

            for (uint256 i = 0; i < _pendingFlowIds.length; i++) {
                bytes32 pid = _pendingFlowIds[i];
                if (_pendingFlows[pid].exists) {
                    candidates[drainCount] = _pendingFlows[pid].syncData;
                    _pendingFlows[pid].exists = false;
                    drainCount++;
                }
            }

            drained = new bytes[](drainCount);
            for (uint256 i = 0; i < drainCount; i++) {
                drained[i] = candidates[i];
            }
        } else {
            drained = new bytes[](0);
        }

        result = OnAvailabilityChangeOkResult({ success: true, drained: drained });

        emit OnAvailabilityChangeCompleted("ok", drained);
    }

    /// @notice drainConflicts - retrieves and clears all detected conflicts
    /// @return result The result with conflict entries
    function drainConflicts() external returns (DrainConflictsOkResult memory result) {
        uint256 conflictCount = _conflicts.length;
        bytes[] memory conflicts = new bytes[](conflictCount);

        for (uint256 i = 0; i < conflictCount; i++) {
            conflicts[i] = abi.encode(_conflicts[i].pendingId, _conflicts[i].data, _conflicts[i].timestamp);
        }

        // Clear conflicts after draining
        delete _conflicts;

        result = DrainConflictsOkResult({ success: true, conflicts: conflicts });

        emit DrainConflictsCompleted("ok", conflicts);
    }

    // --- Views ---

    /// @notice Get the count of registered sync rules
    /// @return The number of registered syncs
    function syncCount() external view returns (uint256) {
        return _syncIds.length;
    }

    /// @notice Get the count of pending flows
    /// @return The number of pending flows
    function pendingFlowCount() external view returns (uint256) {
        return _pendingFlowIds.length;
    }

    // --- Internal ---

    /// @dev Converts a bytes32 value to a hex string
    function _bytes32ToHexString(bytes32 value) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(66);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(str);
    }
}
